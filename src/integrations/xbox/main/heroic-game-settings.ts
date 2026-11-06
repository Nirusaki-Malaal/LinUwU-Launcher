import { existsSync } from 'node:fs'
import path from 'node:path'
import { gamesConfigPath } from 'backend/constants/paths'
import { protonRootOf } from './proton-layout'
import { GameConfig } from 'backend/game_config'
import { setupEnvVars, setupWineEnvVars } from 'backend/launcher'
import type { GameSettings } from 'common/types'
import type { Game } from '../shared/types'
import { commandWords, parseLaunchOptions } from '../shared/launch-tools'

const quote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`

/** Use the same per-game configuration and controls as the other Heroic stores. */
export async function heroicXboxSettings(
  game: Game,
  wine: string,
  runtimeRoot: string
): Promise<GameSettings> {
  const existed = existsSync(path.join(gamesConfigPath, `xbox-${game.id}.json`))
  const config = GameConfig.get(`xbox-${game.id}`)
  if (!existed) {
    const options = parseLaunchOptions(game.launchTools?.launchOptions || '')
    const defaults = await config.getSettings()
    const settings: Partial<GameSettings> = {
      wineVersion: {
        bin: wine,
        name: 'Xbox-compatible Wine',
        type: 'wine',
        wineserver: path.join(path.dirname(wine), 'wineserver')
      },
      winePrefix:
        game.launchMode === 'executable'
          ? path.join(
              process.env.HOME || '',
              '.local/share/xgamemode-runtime/prefix'
            )
          : existsSync(path.join(protonRootOf(wine), 'proton'))
            ? path.join(path.dirname(runtimeRoot), 'compatdata', game.id, 'pfx')
            : path.join(path.dirname(runtimeRoot), 'prefixes', game.id),
      launcherArgs: game.launchArgs || options.gameArgs.map(quote).join(' '),
      language: game.locale || '',
      showMangohud: game.launchTools?.mangoHud || false,
      gamescope: {
        ...defaults.gamescope,
        enableUpscaling: game.launchTools?.gamescope || false,
        additionalOptions: game.launchTools?.gamescopeArgs || ''
      },
      enviromentOptions: Object.entries(options.environment).map(
        ([key, value]) => ({ key, value })
      ),
      wrapperOptions: options.prefix.length
        ? [
            {
              exe: options.prefix[0],
              args: options.prefix.slice(1).map(quote).join(' ')
            }
          ]
        : [],
      useGameMode: false,
      verboseLogs: false
    }
    for (const [key, value] of Object.entries(settings))
      config.setSetting(key, value)
  }
  return config.getSettings()
}

export async function xboxLaunchSettings(game: Game) {
  if (!existsSync(path.join(gamesConfigPath, `xbox-${game.id}.json`)))
    return undefined
  return GameConfig.get(`xbox-${game.id}`).getSettings()
}

export function xboxHeroicEnvironment(
  settings: GameSettings,
  game: Game
): NodeJS.ProcessEnv {
  const env = {
    ...setupWineEnvVars({
      ...settings,
      enableWineWayland:
        settings.enableWineWayland && xboxWineSupportsWayland(settings)
    }),
    ...setupEnvVars(settings, game.path)
  }
  // Prefix ownership stays with the Xbox runtime / Proton runner.
  delete env.WINEPREFIX
  delete env.STEAM_COMPAT_DATA_PATH
  delete env.PROTONPATH
  return env
}

export function xboxHeroicTools(game: Game, settings: GameSettings) {
  const scope = settings.gamescope
  const scopeArgs: string[] = []
  if (scope?.enableUpscaling) {
    for (const [flag, value] of [
      ['-w', scope.gameWidth],
      ['-h', scope.gameHeight],
      ['-W', scope.upscaleWidth],
      ['-H', scope.upscaleHeight]
    ])
      if (value) scopeArgs.push(flag!, value)
    if (scope.upscaleMethod === 'fsr' || scope.upscaleMethod === 'nis')
      scopeArgs.push('-F', scope.upscaleMethod)
    if (scope.upscaleMethod === 'integer' || scope.upscaleMethod === 'stretch')
      scopeArgs.push('-S', scope.upscaleMethod)
    if (scope.windowType === 'fullscreen') scopeArgs.push('-f')
    if (scope.windowType === 'borderless') scopeArgs.push('-b')
  }
  if (scope?.enableLimiter) {
    if (scope.fpsLimiter) scopeArgs.push('-r', scope.fpsLimiter)
    if (scope.fpsLimiterNoFocus) scopeArgs.push('-o', scope.fpsLimiterNoFocus)
  }
  if (scope?.enableForceGrabCursor) scopeArgs.push('--force-grab-cursor')
  scopeArgs.push(...commandWords(scope?.additionalOptions || ''))
  const wrappers = settings.wrapperOptions.flatMap((value) => [
    value.exe,
    ...commandWords(value.args || '')
  ])
  if (settings.useGameMode) wrappers.push('gamemoderun')
  const env = settings.enviromentOptions
    .map((value) => `${value.key}=${quote(value.value)}`)
    .join(' ')
  const command = [
    ...wrappers.map(quote),
    '%command%',
    ...commandWords(settings.launcherArgs || '').map(quote)
  ].join(' ')
  return {
    ...game.launchTools,
    mangoHud: settings.showMangohud,
    gamescope: !!(
      scope?.enableUpscaling ||
      scope?.enableLimiter ||
      scope?.enableForceGrabCursor
    ),
    gamescopeArgs: scopeArgs.map(quote).join(' '),
    launchOptions: `${env} ${command}`.trim()
  }
}

export function xboxWineLoader(
  settings: GameSettings | undefined,
  fallback: string
): string {
  const selected = settings?.wineVersion
  if (!selected?.bin) return fallback
  if (selected.type !== 'proton') return selected.bin
  const root = path.dirname(selected.bin)
  for (const relative of [
    'files/bin/wine',
    'dist/bin/wine',
    'files/bin-arm64/wine'
  ]) {
    const loader = path.join(root, relative)
    if (existsSync(loader)) return loader
  }
  throw new Error(
    'This Proton build has no Wine loader compatible with the Xbox runtime.'
  )
}

export function xboxCompatibilityRoot(
  settings: GameSettings | undefined,
  fallback: string
): string {
  if (!settings?.winePrefix) return fallback
  return path.basename(settings.winePrefix) === 'pfx'
    ? path.dirname(settings.winePrefix)
    : settings.winePrefix
}

/** Do not suppress XWayland unless the selected loader ships a native driver. */
export function xboxWineSupportsWayland(settings: GameSettings): boolean {
  const loader = xboxWineLoader(settings, '')
  if (!loader) return false
  const files = path.dirname(path.dirname(loader))
  return ['lib', 'lib64', 'lib32'].some((lib) =>
    [
      'x86_64-windows/winewayland.drv',
      'x86_64-unix/winewayland.drv.so',
      'aarch64-windows/winewayland.drv',
      'aarch64-unix/winewayland.drv.so'
    ].some((driver) => existsSync(path.join(files, lib, 'wine', driver)))
  )
}
