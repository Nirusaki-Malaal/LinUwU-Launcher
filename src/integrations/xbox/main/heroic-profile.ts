import { promises as fs, constants } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
/** Import metadata once; games, Wine, credentials and backend binaries stay in place. */
export async function importExistingProfile(
  destination: string
): Promise<void> {
  await fs.mkdir(destination, { recursive: true, mode: 0o700 })
  if (
    process.env.CI === 'e2e' &&
    process.env.HEROIC_XBOX_IMPORT_PROFILE !== '1'
  )
    return
  const source = join(homedir(), '.config', 'xodus-nexus')
  for (const relative of [
    'launcher-state.json',
    'xbox-profile.json',
    'xodus-backends/current.json'
  ]) {
    const target = join(destination, relative)
    await fs.mkdir(join(target, '..'), { recursive: true, mode: 0o700 })
    try {
      await fs.copyFile(join(source, relative), target, constants.COPYFILE_EXCL)
      await fs.chmod(target, 0o600)
    } catch (error) {
      if (
        !['ENOENT', 'EEXIST'].includes(
          (error as NodeJS.ErrnoException).code ?? ''
        )
      )
        throw error
    }
  }
}
