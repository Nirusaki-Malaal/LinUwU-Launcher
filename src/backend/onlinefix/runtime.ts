import { readFile, access, realpath } from 'fs/promises'
import { constants } from 'fs'
import { dirname, join } from 'path'
import type { GameSettings } from 'common/types'

const runtimeTools: Record<string, string> = {
  '1070560': 'SteamLinuxRuntime',
  '1391110': 'SteamLinuxRuntime_soldier',
  '1628350': 'SteamLinuxRuntime_sniper',
  '4183110': 'SteamLinuxRuntime_4',
  '4185400': 'SteamLinuxRuntime_4-arm64'
}

/** UMU intentionally clears the host Steam directory; Steam-dependent DLLs need
 * Proton's normal Steam-client setup, inside Valve's installed runtime. */
export function needsHostSteamClient(
  settings: Pick<GameSettings, 'onlineFix' | 'wineVersion'>
): boolean {
  return (
    process.platform === 'linux' &&
    settings.onlineFix === true &&
    settings.wineVersion.type === 'proton'
  )
}

export async function steamClientLaunch(
  settings: Pick<GameSettings, 'wineVersion'>,
  commandParts: string[],
  verb: string,
  steamRoot: string,
  libraries: string[]
): Promise<{
  command: string
  args: string[]
  environment: Record<string, string>
}> {
  const proton = settings.wineVersion.bin
  const base = dirname(proton)
  let required: string | undefined
  try {
    const manifest = await readFile(join(base, 'toolmanifest.vdf'), 'utf8')
    required = /"require_tool_appid"\s+"(\d+)"/i.exec(manifest)?.[1]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (!required) {
    const version = await readFile(join(base, 'version'), 'utf8').catch(
      () => ''
    )
    const major = /(?:GE-)?Proton\s*(\d+)/i.exec(version)?.[1]
    if (major)
      required =
        Number(major) >= 11
          ? '4183110'
          : Number(major) >= 8
            ? '1628350'
            : '1391110'
  }
  const runtime = required && runtimeTools[required]
  if (!runtime)
    throw new Error(
      `Cannot determine the Steam Linux Runtime required by ${settings.wineVersion.name}. Select a Proton build with a supported toolmanifest.vdf.`
    )
  for (const library of [...new Set([steamRoot, ...libraries])]) {
    const command = join(library, 'steamapps', 'common', runtime, 'run')
    try {
      await access(command, constants.X_OK)
    } catch {
      continue
    }
    const root = await realpath(steamRoot)
    for (const name of ['steamclient.dll', 'steamclient64.dll']) {
      await access(join(root, 'legacycompat', name), constants.R_OK).catch(
        () => {
          throw new Error(
            `Steam's ${name} is missing. Open Steam and let its client update finish.`
          )
        }
      )
    }
    return {
      command,
      args: ['--', proton, verb, ...commandParts],
      environment: { STEAM_COMPAT_CLIENT_INSTALL_PATH: root }
    }
  }
  throw new Error(
    `Install ${runtime} (Steam tool ${required}) through Steam. The selected Proton needs this existing runtime for Steam-client integration.`
  )
}
