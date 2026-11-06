import { createConnection } from 'net'
import { lstat, access } from 'fs/promises'
import { constants } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { spawn } from 'child_process'
import { z } from 'zod'
import type { NexusXboxRequest, NexusXboxSnapshot } from 'common/types/xbox'

const responseSchema = z.object({
  protocol: z.literal(1),
  account: z.object({ signedIn: z.boolean(), gamertag: z.string().optional() }),
  runtime: z.object({ installed: z.boolean(), name: z.string().optional() }),
  operation: z
    .object({
      gameId: z.string().optional(),
      status: z.string(),
      phase: z.string().optional()
    })
    .optional(),
  games: z.array(
    z.object({
      id: z.string().regex(/^[a-f0-9]{16}$/),
      title: z.string(),
      path: z.string(),
      executable: z.string().optional(),
      sideloaded: z.boolean(),
      onlineFixCompatibility: z.boolean(),
      installState: z.string(),
      coverUrl: z.string().optional(),
      storeId: z.string().optional()
    })
  )
})
const id = z.string().regex(/^[a-f0-9]{16}$/)
const requestSchema = z.union([
  z
    .object({
      action: z.enum(['connect', 'snapshot', 'show', 'import-exe', 'stop'])
    })
    .strict(),
  z.object({ action: z.literal('launch'), gameId: id }).strict(),
  z
    .object({
      action: z.literal('compatibility'),
      gameId: id,
      enabled: z.boolean()
    })
    .strict()
])
export function nexusProfile(): string {
  return (
    process.env.HEROIC_NEXUS_PROFILE || join(homedir(), '.config/xodus-nexus')
  )
}

export async function requestNexus(
  profile: string,
  request: Exclude<NexusXboxRequest, { action: 'connect' }>
): Promise<NexusXboxSnapshot> {
  const path = join(profile, 'heroic-bridge.sock')
  const entry = await lstat(path)
  if (
    !entry.isSocket() ||
    entry.uid !== process.getuid?.() ||
    entry.mode & 0o077
  )
    throw new Error('Nexus bridge is not a private socket owned by your user.')
  return new Promise((resolve, reject) => {
    const socket = createConnection(path)
    let data = ''
    const fail = (error: Error) => {
      socket.destroy()
      reject(error)
    }
    socket.setEncoding('utf8')
    socket.setTimeout(request.action === 'import-exe' ? 180000 : 120000, () =>
      fail(
        new Error(
          'Nexus did not respond in time. Open Nexus to check its account and runtime.'
        )
      )
    )
    socket.once('error', fail)
    socket.once('connect', () => socket.write(JSON.stringify(request) + '\n'))
    socket.on('data', (chunk) => {
      data += chunk.toString()
      if (Buffer.byteLength(data) > 8 * 1024 * 1024) {
        fail(new Error('Nexus response is too large.'))
        return
      }
      const end = data.indexOf('\n')
      if (end < 0) return
      try {
        const response = z
          .object({
            protocol: z.literal(1),
            ok: z.boolean(),
            result: z.unknown().optional(),
            error: z.string().optional()
          })
          .parse(JSON.parse(data.slice(0, end)))
        if (!response.ok)
          throw new Error(response.error || 'Nexus request failed.')
        const snapshot = responseSchema.parse(response.result)
        socket.destroy()
        resolve(snapshot)
      } catch (error) {
        fail(
          error instanceof Error ? error : new Error('Invalid Nexus response.')
        )
      }
    })
    socket.once('end', () => {
      if (!data.includes('\n'))
        fail(new Error('Nexus closed the connection without a response.'))
    })
  })
}
let connecting: Promise<NexusXboxSnapshot> | undefined
async function connectNexus(): Promise<NexusXboxSnapshot> {
  const profile = nexusProfile()
  try {
    return await requestNexus(profile, { action: 'snapshot' })
  } catch (error) {
    if (
      !['ENOENT', 'ECONNREFUSED'].includes(
        (error as NodeJS.ErrnoException).code ?? ''
      )
    )
      throw error
  }
  const candidates = [
    process.env.HEROIC_NEXUS_LAUNCHER,
    join(homedir(), '.local/bin/xodus-nexus-native'),
    join(homedir(), '.local/bin/xodus-nexus')
  ].filter((p): p is string => Boolean(p))
  let launcher: string | undefined
  for (const path of candidates) {
    try {
      await access(path, constants.X_OK)
      launcher = path
      break
    } catch {
      /* Try next installed launcher. */
    }
  }
  if (!launcher)
    throw new Error(
      'Install your xodus-nexus fork with Heroic bridge support first.'
    )
  await new Promise<void>((resolve, reject) => {
    const env = { ...process.env }
    for (const key of [
      'APPIMAGE',
      'APPDIR',
      'ARGV0',
      'ELECTRON_RUN_AS_NODE',
      'VITE_DEV_SERVER_URL'
    ])
      delete env[key]
    const child = spawn(launcher, ['--heroic-bridge'], {
      env,
      detached: true,
      stdio: 'ignore'
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
  const deadline = Date.now() + 45000
  while (Date.now() < deadline) {
    try {
      return await requestNexus(profile, { action: 'snapshot' })
    } catch (error) {
      if (
        !['ENOENT', 'ECONNREFUSED'].includes(
          (error as NodeJS.ErrnoException).code ?? ''
        )
      )
        throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(
    'Nexus bridge did not start. Update xodus-nexus to the integration build, then try again.'
  )
}
export async function nexusXboxRequest(
  input: NexusXboxRequest
): Promise<NexusXboxSnapshot> {
  if (process.platform !== 'linux')
    throw new Error('Xbox through Xodus Nexus requires Linux.')
  const request = requestSchema.parse(input)
  if (request.action === 'connect') {
    connecting ??= connectNexus().finally(() => {
      connecting = undefined
    })
    return connecting
  }
  return requestNexus(nexusProfile(), request)
}
