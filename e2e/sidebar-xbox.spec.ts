import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, chmod, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer } from 'net'

test('icons-only sidebar persists and Xbox controls use the Nexus sideloading bridge', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'heroic-xbox-ui-'))
  const commands: { action: string; gameId?: string; enabled?: boolean }[] = []
  const snapshot = {
    protocol: 1,
    account: { signedIn: true, gamertag: 'Test player' },
    runtime: { installed: true, name: 'Existing Nexus runtime' },
    operation: undefined as { gameId: string; status: string } | undefined,
    games: [
      {
        id: '0123456789abcdef',
        title: 'Xbox Test Game',
        path: '/games/xbox',
        executable: 'game.exe',
        sideloaded: false,
        onlineFixCompatibility: false,
        installState: 'ready'
      },
      {
        id: 'fedcba9876543210',
        title: 'EXE Test Game',
        path: '/games/exe',
        executable: 'game.exe',
        sideloaded: true,
        onlineFixCompatibility: false,
        installState: 'imported'
      }
    ]
  }
  const server = createServer((socket) => {
    let text = ''
    socket.setEncoding('utf8')
    socket.on('data', (part) => {
      text += part
      if (!text.includes('\n')) return
      const request = JSON.parse(text) as (typeof commands)[number]
      commands.push(request)
      if (request.action === 'compatibility')
        snapshot.games.find(
          (g) => g.id === request.gameId
        )!.onlineFixCompatibility = request.enabled!
      if (request.action === 'launch')
        snapshot.operation = { gameId: request.gameId!, status: 'running' }
      if (request.action === 'stop') snapshot.operation = undefined
      if (request.action === 'import-exe')
        snapshot.games.push({
          ...snapshot.games[1],
          id: 'aabbccddeeff0011',
          title: 'Imported EXE'
        })
      socket.end(
        JSON.stringify({ protocol: 1, ok: true, result: snapshot }) + '\n'
      )
    })
  })
  await new Promise<void>((resolve) =>
    server.listen(join(profile, 'heroic-bridge.sock'), () => resolve())
  )
  await chmod(join(profile, 'heroic-bridge.sock'), 0o600)
  const app = await electron.launch({
    executablePath: process.env.HEROIC_TEST_ELECTRON,
    args: [
      join(__dirname, '../build/main/main.js'),
      `--user-data-dir=${join(profile, 'electron')}`,
      '--ozone-platform=wayland'
    ],
    env: { ...process.env, CI: 'e2e', HEROIC_NEXUS_PROFILE: profile }
  })
  try {
    const page = await app.firstWindow()
    await page
      .getByRole('button', { name: 'Collapse sidebar', exact: true })
      .click()
    await expect(page.locator('#heroic-sidebar')).toHaveClass(/collapsed/)
    expect((await page.locator('#heroic-sidebar').boundingBox())!.width).toBe(
      68
    )
    await expect(
      page.getByRole('link', { name: 'Library', exact: true })
    ).toBeVisible()
    await expect(
      page.locator('.Sidebar__sectionLabel').first()
    ).not.toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Expand sidebar', exact: true })
    ).toBeVisible()
    expect((await page.locator('#heroic-sidebar').boundingBox())!.width).toBe(
      68
    )
    await page.getByRole('link', { name: 'Xbox', exact: true }).click()
    await page
      .getByRole('button', { name: 'Connect Xodus Nexus', exact: true })
      .click()
    await expect(page.getByText('EXE Test Game', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Xbox Test Game', { exact: true })
    ).toBeVisible()
    const exe = page
      .locator('.XboxPage__game')
      .filter({ hasText: 'EXE Test Game' })
    await exe.getByRole('checkbox', { name: 'OnlineFix compatibility' }).check()
    await expect(exe.getByRole('checkbox')).toBeChecked()
    await exe.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(exe.getByRole('button', { name: 'Playing…' })).toBeVisible()
    await page.getByRole('button', { name: 'Stop game', exact: true }).click()
    await expect(
      exe.getByRole('button', { name: 'Play', exact: true })
    ).toBeEnabled()
    await page
      .getByRole('button', { name: 'Add Windows EXE', exact: true })
      .click()
    await expect(page.getByText('Imported EXE', { exact: true })).toBeVisible()
    expect(commands).toContainEqual({
      action: 'launch',
      gameId: 'fedcba9876543210'
    })
    expect(commands).toContainEqual({
      action: 'compatibility',
      gameId: 'fedcba9876543210',
      enabled: true
    })
    await expect(page.getByText('Community', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: 'docs/xbox-integration.png' })
    await page
      .getByRole('button', { name: 'Expand sidebar', exact: true })
      .click()
    expect(
      (await page.locator('#heroic-sidebar').boundingBox())!.width
    ).toBeGreaterThanOrEqual(120)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
    await app.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(profile, { recursive: true, force: true })
  }
})
