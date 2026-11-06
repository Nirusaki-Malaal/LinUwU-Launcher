import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

test('Xbox features live in Heroic library, login, runtime settings, Wine Manager and downloads', async () => {
  test.setTimeout(90000)
  const profile = await mkdtemp(join(tmpdir(), 'heroic-xbox-ui-'))
  const app = await electron.launch({
    executablePath: '/usr/bin/electron42',
    args: [
      join(__dirname, '../build/main/main.js'),
      `--user-data-dir=${profile}`,
      '--ozone-platform=wayland'
    ],
    env: { ...process.env, CI: 'e2e', XODUS_DEMO: '1' }
  })
  const output: string[] = []
  app.process().stdout?.on('data', (data) => output.push(String(data)))
  app.process().stderr?.on('data', (data) => output.push(String(data)))
  try {
    const page = await app.firstWindow()
    page.on('pageerror', (error) =>
      console.log('Renderer error:', error.message)
    )
    await page.getByRole('link', { name: 'Library', exact: true }).waitFor()
    await page
      .getByRole('tab', { name: 'Xbox & Microsoft Store', exact: true })
      .click()
    await expect(
      page.locator('[data-xbox-section="library"] .XboxLibrary')
    ).toBeVisible({ timeout: 30000 })
    await expect(
      page.getByRole('button', { name: 'Connect to Nexus', exact: true })
    ).toHaveCount(0)
    await page.evaluate(() => {
      window.location.hash = '/settings/runtimes'
    })
    await expect(page.locator('[data-xbox-section="runtime"]')).toBeVisible()
    await expect(
      page.getByText('Xbox game runtime', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Install Nexus runtime/ })
    ).toHaveCount(0)
    await page.evaluate(() => {
      window.location.hash = '/wine-manager?repository=xbox'
    })
    await expect(
      page.getByRole('tab', { name: 'Xbox-compatible Wine', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-xbox-section="wine"]')).toBeVisible()
    await expect(
      page.getByLabel('Xbox-compatible Wine executable')
    ).toBeVisible()
    await page.screenshot({ path: 'docs/xbox-wine-manager.png' })
    await page.evaluate(() => {
      window.location.hash = '/login'
    })
    await expect(page.locator('[data-xbox-section="account"]')).toBeVisible()
    await page.evaluate(() => {
      window.location.hash = '/download-manager'
    })
    await expect(page.locator('[data-xbox-section="downloads"]')).toBeVisible()
    await expect(
      page.getByLabel('Xbox download speed limit (MiB/s, 0 = unlimited)')
    ).toBeVisible()
    await page.evaluate(() => {
      window.location.hash = '/xbox/friends'
    })
    await expect(
      page.getByText('Xbox friends and parties', { exact: true })
    ).toBeVisible()
    await page.screenshot({ path: 'docs/xbox-social.png' })
    expect(output.join('\n')).not.toContain('Install your xodus-nexus fork')
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
    await app.close()
    await rm(profile, { recursive: true, force: true })
  }
})
