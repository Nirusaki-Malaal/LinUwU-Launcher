import { promises as fs } from 'fs'
import { basename, dirname, join } from 'path'
import { appFolder } from 'backend/constants/paths'
import type { WineInstallation } from 'common/types'
/** Read only Heroic's migrated selection; never install another Proton copy. */
export async function xboxWineInstallation(): Promise<
  WineInstallation | undefined
> {
  try {
    const state = JSON.parse(
      await fs.readFile(join(appFolder, 'xbox', 'launcher-state.json'), 'utf8')
    ) as { settings?: { winePath?: string } }
    const bin = state.settings?.winePath
    if (!bin) return
    await fs.access(bin, fs.constants.X_OK)
    const server = join(dirname(bin), 'wineserver')
    const root = dirname(dirname(bin))
    const name =
      basename(root) === 'files' ? basename(dirname(root)) : basename(root)
    return {
      bin,
      name: `Xbox-compatible Wine (${name})`,
      type: 'wine',
      wineserver: await fs.access(server).then(
        () => server,
        () => ''
      )
    }
  } catch {
    return undefined
  }
}
