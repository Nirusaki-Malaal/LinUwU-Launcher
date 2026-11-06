import { opendir, readFile, stat } from 'fs/promises'
import { basename, join } from 'path'
import type { GameSettings } from 'common/types'

export interface CompatibilityScan {
  overrides: Record<string, string>
  fakeAppId?: string
}

/** DLL filenames are sufficient for overrides. Never open an Online-prefixed
 * file, and never load a game DLL into Heroic. */
export async function scanOnlineFix(root: string): Promise<CompatibilityScan> {
  const overrides: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >
  let fakeAppId: string | undefined
  let count = 0
  async function visit(directory: string, depth: number): Promise<void> {
    for await (const entry of await opendir(directory)) {
      if (++count > 100000)
        throw new Error(
          'Compatibility scan exceeded 100,000 files. Select a more specific game folder.'
        )
      const name = entry.name.toLowerCase()
      if (entry.isDirectory() && depth < 24) {
        if (
          !['pfx', 'drive_c', 'node_modules', '.git', 'ofme prefix'].includes(
            name
          ) &&
          !name.startsWith('online')
        )
          await visit(join(directory, entry.name), depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      if (/^(?:(?:online|steam|eos|epicfix|win).*|emp|custom)\.dll$/.test(name))
        overrides[name.slice(0, -4)] = name.startsWith('win') ? 'n,b' : 'n'
      // Names may be used for detection; protected contents are never opened.
      if (
        name.startsWith('online') ||
        !['steamfix.ini', 'winmm.txt', 'dlllist.txt'].includes(name)
      )
        continue
      const file = join(directory, entry.name)
      if ((await stat(file)).size > 1024 * 1024)
        throw new Error(`Compatibility configuration is too large: ${file}`)
      const text = await readFile(file, 'utf8')
      if (name.endsWith('.txt')) {
        for (const line of text.split(/\r?\n/)) {
          const dll = basename(line.trim().replaceAll('\\', '/')).toLowerCase()
          if (/^[\w.-]+\.dll$/.test(dll)) overrides[dll.slice(0, -4)] = 'n'
        }
      } else {
        const value = /^\s*FakeAppId\s*=\s*(\d+)\s*$/im.exec(text)?.[1]
        if (value) fakeAppId = value
      }
    }
  }
  await visit(root, 0)
  return { overrides, fakeAppId }
}

export function mergeDllOverrides(
  detected: Record<string, string>,
  value: string
): string {
  const merged = new Map(Object.entries(detected))
  const trimmed = value.trim()
  const text = /^(?:".*"|'.*')$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed
  for (const item of text.split(';')) {
    const equal = item.indexOf('=')
    if (equal < 0) continue
    for (const name of item.slice(0, equal).split(','))
      if (name.trim())
        merged.set(name.trim().toLowerCase(), item.slice(equal + 1).trim())
  }
  return [...merged].map(([name, mode]) => `${name}=${mode}`).join(';')
}

export function onlineFixSettings(
  settings: GameSettings,
  scan: CompatibilityScan,
  overlayLibraries: string[]
): GameSettings {
  const env = new Map(
    (settings.enviromentOptions ?? []).map(({ key, value }) => [
      key.toLowerCase() === 'winedlloverrides' ? 'WINEDLLOVERRIDES' : key,
      value
    ])
  )
  const overrides = mergeDllOverrides(
    scan.overrides,
    env.get('WINEDLLOVERRIDES') ?? process.env.WINEDLLOVERRIDES ?? ''
  )
  if (overrides) env.set('WINEDLLOVERRIDES', overrides)
  if (settings.onlineFixSteamOverlay && overlayLibraries.length) {
    const preloads = env.get('LD_PRELOAD') ?? process.env.LD_PRELOAD ?? ''
    env.set(
      'LD_PRELOAD',
      [
        ...new Set([
          ...preloads.split(':').filter(Boolean),
          ...overlayLibraries
        ])
      ].join(':')
    )
    env.set('ENABLE_VK_LAYER_VALVE_steam_overlay_1', '1')
    if (!env.has('SteamOverlayGameId'))
      env.set('SteamOverlayGameId', scan.fakeAppId ?? '480')
  }
  return {
    ...settings,
    enviromentOptions: [...env].map(([key, value]) => ({ key, value }))
  }
}
