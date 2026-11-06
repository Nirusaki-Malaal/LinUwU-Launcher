import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// The profile and game are disposable; this never edits the user's real library.
test('OnlineFix is opt-in and persists through Heroic game settings', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'heroic-onlinefix-ui-'))
  const gameDirectory = join(profile, 'fixture-game')
  await mkdir(gameDirectory)
  await writeFile(join(gameDirectory, 'game.exe'), '')
  await mkdir(join(profile, 'sideload_apps'))
  await writeFile(
    join(profile, 'sideload_apps/library.json'),
    JSON.stringify({
      games: [
        {
          runner: 'sideload',
          app_name: 'onlinefix-test-game',
          title: 'OnlineFix Test Game',
          install: {
            executable: join(gameDirectory, 'game.exe'),
            platform: 'Windows',
            is_dlc: false
          },
          folder_name: gameDirectory,
          art_cover: '',
          art_square: '',
          is_installed: true,
          canRunOffline: true
        }
      ]
    })
  )
  const app = await electron.launch({
    executablePath: process.env.HEROIC_TEST_ELECTRON,
    timeout: 20000,
    args: [
      join(__dirname, '../build/main/main.js'),
      `--user-data-dir=${profile}`,
      '--ozone-platform=wayland'
    ],
    env: { ...process.env, CI: 'e2e' }
  })
  try {
    const page = await app.firstWindow()
    await page
      .locator('a[href*="/gamepage/sideload/onlinefix-test-game"]')
      .first()
      .click({ timeout: 10000 })
    await page
      .getByRole('button', { name: 'Game settings', exact: true })
      .click({ timeout: 8000 })
    await expect(
      page.getByText('Enable OnlineFix support', { exact: true })
    ).toBeVisible()
    await expect(page.locator('#onlineFix')).not.toBeChecked()
    await expect(page.locator('#onlineFixSteamOverlay')).toHaveCount(0)
    await page.getByText('Enable OnlineFix support', { exact: true }).click()
    await expect(page.locator('#onlineFix')).toBeChecked()
    await expect(page.locator('#onlineFixSteamOverlay')).not.toBeChecked()
    await page.getByText('Enable Steam overlay', { exact: true }).click()
    await expect(page.locator('#onlineFixSteamOverlay')).toBeChecked()
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const settings = await window.api.requestGameSettings(
            'onlinefix-test-game'
          )
          return [settings.onlineFix, settings.onlineFixSteamOverlay]
        })
      )
      .toEqual([true, true])
    await page.screenshot({ path: 'docs/onlinefix-settings.png' })
    await page.getByText('Enable OnlineFix support', { exact: true }).click()
    await expect(page.locator('#onlineFix')).not.toBeChecked()
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.api.requestGameSettings('onlinefix-test-game'))
              .onlineFix
        )
      )
      .toBe(false)
  } catch (error) {
    const page = await app.firstWindow()
    console.log('Failure body:', await page.locator('body').innerText())
    await page.screenshot({ path: '/tmp/heroic-onlinefix-failure.png' })
    throw error
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
    await app.close()
    await rm(profile, { recursive: true, force: true })
  }
})
