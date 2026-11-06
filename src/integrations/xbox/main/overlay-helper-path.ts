import { promises as fs } from 'node:fs'
import path from 'node:path'

/** Native directory installs and AppImages keep helper resources differently. */
export async function overlayHelperPath(
  appRoot: string,
  resourcesRoot: string
): Promise<string> {
  const candidates = [
    path.join(appRoot, 'assets', 'overlay', 'xbox_guide.py'),
    path.join(resourcesRoot, 'overlay', 'xbox_guide.py')
  ]
  for (const candidate of candidates) {
    if (
      await fs.stat(candidate).then(
        (value) => value.isFile(),
        () => false
      )
    )
      return candidate
  }
  // Let the existing dependency check report an unavailable overlay, without
  // preventing the rest of the launcher from opening.
  return candidates[1]
}
