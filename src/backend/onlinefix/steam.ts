import { access } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { isSteamRunning } from 'backend/shortcuts/nonesteamgame/steamProcess'
import { flatpakHome } from 'backend/constants/paths'
import { isFlatpak } from 'backend/constants/environment'

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
export async function findSteamRoot(): Promise<string> {
  for (const path of [
    join(flatpakHome, '.steam/steam'),
    join(flatpakHome, '.local/share/Steam'),
    join(flatpakHome, '.steam/root')
  ]) {
    if (await exists(join(path, 'steamapps'))) return path
  }
  throw new Error(
    'OnlineFix needs the native Steam client. Install Steam and sign in before launching this game.'
  )
}
export async function ensureOnlineFixSteam(): Promise<string> {
  const root = await findSteamRoot()
  if (isSteamRunning(root)) return root
  if (isFlatpak)
    throw new Error(
      'Start the native Steam client before launching an OnlineFix game from Flatpak Heroic.'
    )
  await new Promise<void>((resolve, reject) => {
    const child = spawn('steam', ['-silent'], {
      detached: true,
      stdio: 'ignore'
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    if (isSteamRunning(root)) return root
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(
    'Steam did not start within 90 seconds. Open Steam, sign in, then try again.'
  )
}
export async function steamOverlayLibraries(root: string): Promise<string[]> {
  const libraries: string[] = []
  for (const arch of ['ubuntu12_32', 'ubuntu12_64']) {
    const path = join(root, arch, 'gameoverlayrenderer.so')
    if (await exists(path)) libraries.push(path)
  }
  return libraries
}
