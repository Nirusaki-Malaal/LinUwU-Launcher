import { opendir, readFile, stat } from 'fs/promises'
import { basename, join } from 'path'
import type { EnviromentVariable, GameSettings } from 'common/types'

export interface OnlineFixScan {
  overrides: Record<string, string>
  realAppId?: string
  fakeAppId?: string
  filesFound: number
}

// Inspect filenames/configuration only. Never load a game's DLLs into Heroic.
export async function scanOnlineFix(root: string): Promise<OnlineFixScan> {
  const result: OnlineFixScan = {
    overrides: Object.create(null) as Record<string, string>,
    filesFound: 0
  }
  let entries = 0
  async function visit(directory: string, depth: number): Promise<void> {
    const dir = await opendir(directory)
    for await (const entry of dir) {
      if (++entries > 100000)
        throw new Error(
          'OnlineFix scan exceeded 100,000 files. Select a more specific game folder.'
        )
      const path = join(directory, entry.name)
      if (entry.isDirectory() && depth < 24) {
        if (
          !['pfx', 'drive_c', 'node_modules', '.git', 'OFME Prefix'].includes(
            entry.name
          )
        )
          await visit(path, depth + 1)
        continue
      }
      // Do not follow symlinks into unrelated directories or Wine prefixes.
      if (!entry.isFile()) continue
      const name = entry.name.toLowerCase()
      if (
        /^(?:(?:online|steam|eos|epicfix|win).*|emp|custom)\.dll$/.test(name)
      ) {
        result.overrides[name.slice(0, -4)] = name.startsWith('win')
          ? 'n,b'
          : 'n'
        result.filesFound++
      }
      if (
        !['onlinefix.ini', 'steamfix.ini', 'winmm.txt', 'dlllist.txt'].includes(
          name
        )
      )
        continue
      if ((await stat(path)).size > 1024 * 1024)
        throw new Error(`OnlineFix configuration is too large: ${path}`)
      const contents = await readFile(path, 'utf8')
      if (name.endsWith('.txt')) {
        for (const line of contents.split(/\r?\n/)) {
          const dll = basename(line.trim().replaceAll('\\', '/')).toLowerCase()
          if (/^[\w.-]+\.dll$/.test(dll))
            result.overrides[dll.slice(0, -4)] = 'n'
        }
      } else {
        const sections = Object.create(null) as Record<
          string,
          Record<string, string>
        >
        let section = ''
        for (const line of contents.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed || /^[;#]/.test(trimmed)) continue
          const match = /^\[([^\]]+)\]$/.exec(trimmed)
          if (match) {
            section = match[1].toLowerCase()
            sections[section] ??= Object.create(null) as Record<string, string>
            continue
          }
          const equals = trimmed.indexOf('=')
          if (equals >= 0 && section)
            sections[section][trimmed.slice(0, equals).trim().toLowerCase()] =
              trimmed.slice(equals + 1).trim()
        }
        const real =
          sections['onlinefix linux']?.realappid ?? sections.main?.realappid
        const fake = sections.main?.fakeappid
        if (real && /^\d+$/.test(real)) result.realAppId = real
        if (fake && /^\d+$/.test(fake)) result.fakeAppId = fake
      }
    }
  }
  await visit(root, 0)
  return result
}

/** Manual overrides win, including grouped overrides and explicit '=d'. */
export function mergeDllOverrides(
  detected: Record<string, string>,
  existing: string
): string {
  const overrides = new Map(Object.entries(detected))
  const trimmed = existing.trim()
  const unquoted = /^(?:".*"|'.*')$/.test(trimmed)
    ? trimmed.slice(1, -1)
    : trimmed
  for (const entry of unquoted.split(';')) {
    const equal = entry.indexOf('=')
    if (equal < 0) continue
    const mode = entry.slice(equal + 1).trim()
    for (const name of entry.slice(0, equal).split(',')) {
      if (name.trim()) overrides.set(name.trim().toLowerCase(), mode)
    }
  }
  return [...overrides].map(([name, mode]) => `${name}=${mode}`).join(';')
}

/** Return a launch-local copy, so turning this off cannot leave stale settings. */
export function onlineFixSettings(
  settings: GameSettings,
  scan: OnlineFixScan,
  overlayLibraries: string[]
): GameSettings {
  const environment = new Map<string, string>()
  for (const { key, value } of settings.enviromentOptions ?? []) {
    environment.set(
      key.toLowerCase() === 'winedlloverrides' ? 'WINEDLLOVERRIDES' : key,
      value
    )
  }
  const overrides = mergeDllOverrides(
    scan.overrides,
    environment.get('WINEDLLOVERRIDES') ?? process.env.WINEDLLOVERRIDES ?? ''
  )
  if (overrides) environment.set('WINEDLLOVERRIDES', overrides)
  if (settings.onlineFixSteamOverlay && overlayLibraries.length) {
    const preload =
      environment.get('LD_PRELOAD') ?? process.env.LD_PRELOAD ?? ''
    environment.set(
      'LD_PRELOAD',
      [
        ...new Set([...preload.split(':').filter(Boolean), ...overlayLibraries])
      ].join(':')
    )
    environment.set('ENABLE_VK_LAYER_VALVE_steam_overlay_1', '1')
    if (!environment.has('SteamOverlayGameId'))
      environment.set('SteamOverlayGameId', scan.fakeAppId ?? '480')
  }
  const enviromentOptions: EnviromentVariable[] = [...environment].map(
    ([key, value]) => ({ key, value })
  )
  return { ...settings, enviromentOptions }
}
