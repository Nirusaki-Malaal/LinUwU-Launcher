import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
test('sidebar collapses to icons and persists independently of Xbox services', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'heroic-sidebar-'))
  const app = await electron.launch({
    executablePath: '/usr/bin/electron42',
    args: [
      join(__dirname, '../build/main/main.js'),
      `--user-data-dir=${profile}`,
      '--ozone-platform=wayland'
    ],
    env: { ...process.env, CI: 'e2e', XODUS_DEMO: '1' }
  })
  try {
    const page = await app.firstWindow()
    await page
      .getByRole('button', { name: 'Collapse sidebar', exact: true })
      .click()
    await expect(page.locator('.Sidebar')).toHaveClass(/collapsed/)
    await page.reload()
    await expect(page.locator('.Sidebar')).toHaveClass(/collapsed/)
    await page
      .getByRole('button', { name: 'Expand sidebar', exact: true })
      .click()
    await expect(page.locator('.Sidebar')).not.toHaveClass(/collapsed/)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
    await app.close()
    await rm(profile, { recursive: true, force: true })
  }
})
