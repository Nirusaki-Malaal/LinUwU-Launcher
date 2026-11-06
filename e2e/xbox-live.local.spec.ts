import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'
import { mkdtemp, rm } from 'fs/promises'
test('read existing Xbox account, runtime and library from migrated services', async () => {
  test.setTimeout(90000)
  const profile = await mkdtemp('/tmp/heroic-xbox-live-')
  const app = await electron.launch({ executablePath: '/usr/bin/electron42', args: [join(__dirname, '../build/main/main.js'), `--user-data-dir=${profile}`, '--ozone-platform=wayland'], env: { ...process.env, CI: 'e2e', HEROIC_XBOX_IMPORT_PROFILE: '1', XODUS_DEMO: '0' } })
  try {
    const page = await app.firstWindow()
    await page.getByRole('link', { name: 'Library', exact: true }).waitFor()
    await expect.poll(async () => page.evaluate(async () => (await window.launcher.getSnapshot()).backend.available), { timeout: 60000 }).toBe(true)
    const status = await page.evaluate(async () => { const data = await window.launcher.getSnapshot(); return { backend: data.backend.available, runtime: data.runtime.installed, games: data.games.length, account: data.auth.stored, overlay: data.overlayShortcut?.state } })
    console.log('LIVE XBOX STATUS', JSON.stringify(status))
    expect(status.runtime).toBe(true)
    expect(status.games).toBeGreaterThan(0)
    await page.evaluate(() => { window.location.hash = '/wine-manager?repository=xbox' })
    await expect(page.getByLabel('Xbox-compatible Wine executable')).toBeVisible()
    await page.screenshot({ path: '/tmp/heroic-xbox-live-wine.png' })
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
    await app.close()
    await rm(profile, { recursive: true, force: true })
  }
})
