import { existsSync } from 'fs'
import { basename, dirname } from 'path'
import { GlobalConfig } from 'backend/config'
import { getGame, getSteamLibraries } from 'backend/utils'
import { getUmuPath, isUmuSupported } from 'backend/utils/compatibility_layers'
import { findSteamRoot } from './steam'
import { needsHostSteamClient, steamClientLaunch } from './runtime'
import type { Runner } from 'common/types'
import type { SteamRuntimeStatus } from 'common/types/steam-runtime'

export async function steamRuntimeStatus(
  appName: string,
  runner: Runner
): Promise<SteamRuntimeStatus> {
  const settings =
    appName === 'default'
      ? GlobalConfig.get().getSettings()
      : await getGame(appName, runner).getSettings()
  if (needsHostSteamClient(settings)) {
    try {
      const plan = await steamClientLaunch(
        settings,
        [],
        'run',
        await findSteamRoot(),
        await getSteamLibraries()
      )
      const names: Record<string, string> = {
        SteamLinuxRuntime_4: 'Steam Linux Runtime 4.0',
        SteamLinuxRuntime_sniper: 'Steam Linux Runtime 3.0 (sniper)',
        SteamLinuxRuntime_soldier: 'Steam Linux Runtime 2.0 (soldier)'
      }
      return {
        name:
          names[basename(dirname(plan.command))] ||
          basename(dirname(plan.command)),
        ready: true,
        path: plan.command,
        detail: `Required by ${settings.wineVersion.name}. Uses your existing Steam installation and Steam client.`
      }
    } catch (error) {
      return {
        name: 'Steam runtime unavailable',
        ready: false,
        detail: error instanceof Error ? error.message : String(error)
      }
    }
  }
  if (settings.wineVersion.type === 'proton') {
    const enabled = await isUmuSupported(settings, false)
    const path = await getUmuPath()
    return {
      name: enabled
        ? 'Automatic Steam runtime (UMU)'
        : 'Direct Proton (UMU disabled)',
      ready: !enabled || existsSync(path),
      path: enabled ? path : undefined,
      detail: enabled
        ? 'UMU chooses the runtime required by the selected Proton build.'
        : 'Proton is launched directly without a Steam runtime container.'
    }
  }
  return {
    name: 'Not used by Wine',
    ready: true,
    detail: 'Wine runs directly. Select Proton to use a Steam Linux Runtime.'
  }
}
