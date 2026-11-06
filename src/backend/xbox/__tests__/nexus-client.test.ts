import { mkdtemp, chmod, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer, Server } from 'net'
import { requestNexus, nexusXboxRequest } from '../nexus-client'

let profile: string
let server: Server
let requests: unknown[]
const snapshot = {
  protocol: 1,
  account: { signedIn: true, gamertag: 'Test player' },
  runtime: { installed: true, name: 'Existing Xbox runtime' },
  games: [
    {
      id: '0123456789abcdef',
      title: 'Sideloaded game',
      path: '/games/test',
      executable: 'game.exe',
      sideloaded: true,
      onlineFixCompatibility: false,
      installState: 'imported'
    }
  ]
}
beforeEach(async () => {
  profile = await mkdtemp(join(tmpdir(), 'heroic-nexus-'))
  requests = []
})
afterEach(async () => {
  if (server?.listening)
    await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(profile, { recursive: true, force: true })
})
async function serve(response: unknown) {
  server = createServer((socket) => {
    let data = ''
    socket.setEncoding('utf8')
    socket.on('data', (part) => {
      data += part.toString()
      if (data.includes('\n')) {
        requests.push(JSON.parse(data))
        socket.end(JSON.stringify(response) + '\n')
      }
    })
  })
  await new Promise<void>((resolve) =>
    server.listen(join(profile, 'heroic-bridge.sock'), () => resolve())
  )
  await chmod(join(profile, 'heroic-bridge.sock'), 0o600)
}
test('imports a sanitized library and sends the correct game identity', async () => {
  await serve({
    protocol: 1,
    ok: true,
    result: { ...snapshot, authToken: 'must-not-cross' }
  })
  const result = await requestNexus(profile, {
    action: 'launch',
    gameId: '0123456789abcdef'
  })
  expect(result).toEqual(snapshot)
  expect(requests).toEqual([{ action: 'launch', gameId: '0123456789abcdef' }])
})
test('forwards EXE import and compatibility settings through the fork', async () => {
  await serve({ protocol: 1, ok: true, result: snapshot })
  await requestNexus(profile, { action: 'import-exe' })
  await requestNexus(profile, {
    action: 'compatibility',
    gameId: '0123456789abcdef',
    enabled: true
  })
  expect(requests).toEqual([
    { action: 'import-exe' },
    { action: 'compatibility', gameId: '0123456789abcdef', enabled: true }
  ])
})
test('rejects sockets accessible by other users', async () => {
  await serve({ protocol: 1, ok: true, result: snapshot })
  await chmod(join(profile, 'heroic-bridge.sock'), 0o666)
  await expect(requestNexus(profile, { action: 'snapshot' })).rejects.toThrow(
    'private socket'
  )
})
test('reports backend failures and rejects an incompatible response', async () => {
  await serve({ protocol: 1, ok: false, error: 'Sign in before launching' })
  await expect(
    requestNexus(profile, { action: 'launch', gameId: '0123456789abcdef' })
  ).rejects.toThrow('Sign in before launching')
})
test('rejects arbitrary command requests before starting any process', async () => {
  await expect(
    nexusXboxRequest({ action: 'exec', command: 'anything' } as never)
  ).rejects.toThrow()
})
