import { app } from 'electron'
import { cpSync, existsSync, mkdirSync } from 'graceful-fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { env } from 'process'
import { dirSync } from 'tmp'

let configFolder = app.getPath('appData')
// If we're running tests, we want a config folder independent of the normal
// user configuration
if (process.env.CI === 'e2e') {
  const temp_dir = dirSync({ unsafeCleanup: true })
  console.log(
    `CI is set to "e2e", storing Heroic config files in ${temp_dir.name}`
  )
  configFolder = temp_dir.name
  mkdirSync(join(configFolder, 'heroic'))
}

export const flatpakHome = env.XDG_DATA_HOME?.replace('/data', '') || homedir()
export const userHome = homedir()

export const userDataPath = app.getPath('userData')
export const appFolder = userDataPath

// Auto-migrate configuration from legacy ~/.config/heroic if needed
const legacyHeroicFolder = join(configFolder, 'heroic')
if (existsSync(legacyHeroicFolder) && legacyHeroicFolder !== appFolder) {
  try {
    const items = [
      'config.json',
      'GamesConfig',
      'legendaryConfig',
      'gogdlConfig',
      'gog_store',
      'nile_store',
      'nile_config',
      'sideload_apps',
      'xbox',
      'tools',
      'themes',
      'icons',
      'images-cache',
      'store',
      'store_cache',
      'areweanticheatyet.json',
      'known_fixes.json',
      'steamrip_catalog.json'
    ]
    for (const item of items) {
      const src = join(legacyHeroicFolder, item)
      const dst = join(appFolder, item)
      if (existsSync(src) && !existsSync(dst)) {
        cpSync(src, dst, { recursive: true })
      }
    }
  } catch (err) {
    console.warn('Heroic -> LinUwU auto-migration notice:', err)
  }
}

export const toolsPath = join(appFolder, 'tools')
export const runtimePath = join(toolsPath, 'runtimes')
export const defaultUmuPath = join(runtimePath, 'umu', 'umu_run.py')
export const configPath = join(appFolder, 'config.json')
export const gamesConfigPath = join(appFolder, 'GamesConfig')
export const heroicIconFolder = join(appFolder, 'icons')
export const heroicInstallPath = join(userHome, 'Games', 'Heroic')
export const defaultWinePrefixDir = join(
  userHome,
  'Games',
  'Heroic',
  'Prefixes'
)
export const sharedWinePrefix = join(defaultWinePrefixDir, 'shared')
export const defaultWinePrefix = join(defaultWinePrefixDir, 'default')

export const publicDir = resolve(
  __dirname,
  '..',
  app.isPackaged || process.env.CI === 'e2e' ? '' : '../public'
)

// Built preload scripts live next to the main process bundle
// (`build/preload/`). The webview preload is built from
// `src/webviewPreload/index.ts` — see `electron.vite.config.ts`.
const preloadDir = resolve(__dirname, '..', 'preload')

export const mainPreloadPath = join(preloadDir, 'index.js')

export const fakeEpicExePath = fixAsarPath(
  join(publicDir, 'bin', 'x64', 'win32', 'EpicGamesLauncher.exe')
)

export const galaxyCommunicationExePath = fixAsarPath(
  join(publicDir, 'bin', 'x64', 'win32', 'GalaxyCommunication.exe')
)

export const webviewPreloadPath = fixAsarPath(
  join('file://', preloadDir, 'webviewPreload.js')
)

/**
 * Fix path for packed files with asar, else will do nothing.
 * @param origin  original path
 * @returns fixed path
 */
export function fixAsarPath(origin: string): string {
  if (!origin.includes('app.asar.unpacked')) {
    return origin.replace('app.asar', 'app.asar.unpacked')
  }
  return origin
}

export const windowIcon = fixAsarPath(join(publicDir, 'icon.png'))
