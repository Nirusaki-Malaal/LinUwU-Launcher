import { existsSync } from 'fs'
import { join, sep } from 'path'
/** Electron-vite bundles these modules beside Heroic's main process entry. */
export const xboxMainDirectory = __dirname
export function assetFile(name: string): string {
  const packaged = join(xboxMainDirectory, '..', 'xbox-assets', name)
  const unpacked = packaged.replace('app.asar' + sep, 'app.asar.unpacked' + sep)
  if (existsSync(unpacked)) return unpacked
  return existsSync(packaged)
    ? packaged
    : join(xboxMainDirectory, '..', '..', 'public', 'xbox-assets', name)
}
