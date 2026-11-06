import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

test('Steam runtime and overlay controls are visible in the correct game-settings cards', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'heroic-steam-settings-'))
  const gameDirectory = join(profile, 'fixture-game')
  await mkdir(gameDirectory)
  await writeFile(join(gameDirectory, 'game.exe'), '')
  const proton = join(profile, 'proton')
  await writeFile(proton, '')
  await mkdir(join(profile, 'sideload_apps'))
  await writeFile(
    join(profile, 'sideload_apps/library.json'),
    JSON.stringify({
      games: [
        {
          runner: 'sideload',
          app_name: 'steam-settings-test',
          title: 'Steam Runtime Test',
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
      .getByRole('link', { name: 'Library', exact: true })
      .waitFor({ state: 'visible' })
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('getSteamRuntimeStatus')
      ipcMain.handle('getSteamRuntimeStatus', () => ({
        name: 'Steam Linux Runtime 4.0',
        ready: true,
        detail:
          'Required by the selected Proton. Uses the existing Steam installation.',
        path: '/shared/SteamLibrary/steamapps/common/SteamLinuxRuntime_4/run'
      }))
    })
    await page
      .locator('a[href*="/gamepage/sideload/steam-settings-test"]')
      .first()
      .click()
    await page.evaluate(
      (proton) =>
        window.api.setSetting({
          appName: 'steam-settings-test',
          key: 'wineVersion',
          value: { bin: proton, name: 'Test GE-Proton11', type: 'proton' }
        }),
      proton
    )
    await page
      .getByRole('button', { name: 'Game settings', exact: true })
      .click()
    await page.getByText('Enable OnlineFix support', { exact: true }).click()
    await expect(page.locator('#onlineFix')).toBeChecked()
    await expect(page.locator('#onlineFixSteamOverlay')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Other', exact: true }).click()
    await expect(
      page.getByText('Steam Linux Runtime', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: 'Steam Linux Runtime 4.0' })
    ).toBeVisible()
    await expect(
      page.getByText(
        '/shared/SteamLibrary/steamapps/common/SteamLinuxRuntime_4/run',
        { exact: true }
      )
    ).toBeVisible()
    await page.getByText('Enable Steam overlay', { exact: true }).click()
    await expect(page.locator('#onlineFixSteamOverlay')).toBeChecked()
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.api.requestGameSettings('steam-settings-test'))
              .onlineFixSteamOverlay
        )
      )
      .toBe(true)
    await page
      .getByText('Steam Linux Runtime', { exact: true })
      .scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'docs/steam-runtime-settings.png' })
    await page.getByRole('tab', { name: 'Wine', exact: true }).click()
    await page.getByText('Enable OnlineFix support', { exact: true }).click()
    await expect(page.locator('#onlineFix')).not.toBeChecked()
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
    await app.close()
    await rm(profile, { recursive: true, force: true })
  }
})
