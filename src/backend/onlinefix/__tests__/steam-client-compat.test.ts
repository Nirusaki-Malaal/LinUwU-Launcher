import fs from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  steamClientLaunch,
  needsHostSteamClient,
  onlineFixOverlayAppId,
  onlineFixSteamIdentity
} from '../runtime'
import {
  scanOnlineFix,
  onlineFixSettings,
  mergeDllOverrides
} from '../compatibility'
import type { GameSettings } from 'common/types'
let root: string
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'heroic-steam-client-'))
})
afterEach(async () => {
  jest.restoreAllMocks()
  await fs.rm(root, { recursive: true, force: true })
})
async function fixture(appid = '4183110', runtime = 'SteamLinuxRuntime_4') {
  const steam = join(root, 'Steam Client')
  const library = join(root, 'Steam Library')
  const proton = join(root, 'Shared Proton', 'proton')
  await fs.mkdir(join(root, 'Shared Proton'), { recursive: true })
  await fs.writeFile(proton, '')
  await fs.writeFile(
    join(root, 'Shared Proton', 'toolmanifest.vdf'),
    `"manifest" { "require_tool_appid" "${appid}" }`
  )
  await fs.mkdir(join(steam, 'legacycompat'), { recursive: true })
  await fs.writeFile(join(steam, 'legacycompat/steamclient.dll'), '')
  await fs.writeFile(join(steam, 'legacycompat/steamclient64.dll'), '')
  const command = join(library, 'steamapps/common', runtime, 'run')
  await fs.mkdir(join(command, '..'), { recursive: true })
  await fs.writeFile(command, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  const settings = {
    onlineFix: true,
    wineVersion: { bin: proton, name: 'Shared GE-Proton', type: 'proton' }
  } as GameSettings
  return { steam, library, proton, command, settings }
}
test('uses the installed Steamrt4 and host Steam client for Proton 11', async () => {
  const f = await fixture()
  const args = ['/games/Forza Horizon 4/game.exe', 'two words']
  const plan = await steamClientLaunch(
    f.settings,
    args,
    'waitforexitandrun',
    f.steam,
    [f.library]
  )
  expect(plan.command).toBe(f.command)
  expect(plan.args).toEqual(['--', f.proton, 'waitforexitandrun', ...args])
  expect(plan.environment.STEAM_COMPAT_CLIENT_INSTALL_PATH).toBe(
    await fs.realpath(f.steam)
  )
  expect(args).toEqual(['/games/Forza Horizon 4/game.exe', 'two words'])
})
test('selects Sniper when the Proton manifest requires it', async () => {
  const f = await fixture('1628350', 'SteamLinuxRuntime_sniper')
  expect(
    (
      await steamClientLaunch(f.settings, ['cmd.exe'], 'run', f.steam, [
        f.library
      ])
    ).command
  ).toBe(f.command)
})
test('does not silently run against the wrong or missing runtime', async () => {
  const f = await fixture()
  await fs.unlink(f.command)
  await expect(
    steamClientLaunch(f.settings, ['cmd.exe'], 'run', f.steam, [f.library])
  ).rejects.toThrow('Install SteamLinuxRuntime_4')
})
test('reports a missing real Steam client instead of launching with an empty path', async () => {
  const f = await fixture()
  await fs.unlink(join(f.steam, 'legacycompat/steamclient64.dll'))
  await expect(
    steamClientLaunch(f.settings, ['cmd.exe'], 'run', f.steam, [f.library])
  ).rejects.toThrow('steamclient64.dll is missing')
})
test('ordinary Proton games and Wine retain their launch mode', () => {
  const proton = {
    wineVersion: { type: 'proton' },
    onlineFix: false
  } as GameSettings
  expect(needsHostSteamClient(proton)).toBe(false)
  expect(needsHostSteamClient({ ...proton, onlineFix: true })).toBe(true)
  expect(
    needsHostSteamClient({
      ...proton,
      onlineFix: true,
      wineVersion: { ...proton.wineVersion, type: 'wine' }
    })
  ).toBe(false)
})
test('aligns every Steam identity with the OnlineFix overlay app id', () => {
  const settings = {
    onlineFix: true,
    onlineFixSteamOverlay: true,
    enviromentOptions: [{ key: 'SteamOverlayGameId', value: '1091500' }]
  } as GameSettings
  expect(onlineFixSteamIdentity(settings)).toEqual({
    STEAM_COMPAT_APP_ID: '1091500',
    SteamAppId: '1091500',
    SteamGameId: '1091500'
  })
})
test('does not touch the launch identity without an active overlay', () => {
  const settings = {
    onlineFix: true,
    onlineFixSteamOverlay: false,
    enviromentOptions: [{ key: 'SteamOverlayGameId', value: '480' }]
  } as GameSettings
  expect(onlineFixSteamIdentity(settings)).toBeUndefined()
  expect(
    onlineFixOverlayAppId({
      ...settings,
      onlineFixSteamOverlay: true,
      enviromentOptions: [{ key: 'steamoverlaygameid', value: ' 480 ' }]
    })
  ).toBe('480')
})
test('uses the fake app id for the overlay and keeps an explicit id', () => {
  const settings = {
    onlineFix: true,
    onlineFixSteamOverlay: true,
    enviromentOptions: [] as GameSettings['enviromentOptions']
  } as GameSettings
  const generated = onlineFixSettings(
    settings,
    { overrides: {}, fakeAppId: '1091500' },
    ['/steam/ubuntu12_64/gameoverlayrenderer.so']
  )
  expect(generated.enviromentOptions).toContainEqual({
    key: 'SteamOverlayGameId',
    value: '1091500'
  })
  expect(onlineFixSteamIdentity(generated)).toEqual({
    STEAM_COMPAT_APP_ID: '1091500',
    SteamAppId: '1091500',
    SteamGameId: '1091500'
  })

  const explicit = onlineFixSettings(
    {
      ...settings,
      enviromentOptions: [{ key: 'steamoverlaygameid', value: '480' }]
    },
    { overrides: {}, fakeAppId: '1091500' },
    ['/steam/ubuntu12_64/gameoverlayrenderer.so']
  )
  expect(onlineFixSteamIdentity(explicit)).toEqual({
    STEAM_COMPAT_APP_ID: '480',
    SteamAppId: '480',
    SteamGameId: '480'
  })
  expect(
    explicit.enviromentOptions?.filter(
      ({ key }) => key.toLowerCase() === 'steamoverlaygameid'
    )
  ).toEqual([{ key: 'steamoverlaygameid', value: '480' }])
})
test('detects DLL names without opening any Online-prefixed contents', async () => {
  for (const name of [
    'OnlineFix.ini',
    'ONLINE-private.txt',
    'OnlineFix64.dll',
    'steam_api64.dll'
  ])
    await fs.writeFile(join(root, name), 'private fixture')
  const read = jest
    .spyOn(fs, 'readFile')
    .mockRejectedValue(new Error('File contents must not be opened'))
  const result = await scanOnlineFix(root)
  expect(result.overrides).toEqual({ onlinefix64: 'n', steam_api64: 'n' })
  expect(read).not.toHaveBeenCalled()
})
test('uses only permitted configuration files and preserves manual overrides', async () => {
  await fs.writeFile(join(root, 'SteamFix.ini'), '[Main]\nFakeAppId=480\n')
  await fs.writeFile(
    join(root, 'dlllist.txt'),
    'sub\\custom.dll\nnot-a-dll.txt\n'
  )
  const scan = await scanOnlineFix(root)
  expect(scan).toEqual({ overrides: { custom: 'n' }, fakeAppId: '480' })
  expect(mergeDllOverrides(scan.overrides, 'custom=b;winmm=n,b')).toBe(
    'custom=b;winmm=n,b'
  )
  const settings = {
    onlineFix: true,
    enviromentOptions: [{ key: 'WINEDLLOVERRIDES', value: 'custom=b' }]
  } as GameSettings
  const result = onlineFixSettings(settings, scan, [])
  expect(result.enviromentOptions).toContainEqual({
    key: 'WINEDLLOVERRIDES',
    value: 'custom=b'
  })
  expect(settings.enviromentOptions).toEqual([
    { key: 'WINEDLLOVERRIDES', value: 'custom=b' }
  ])
})
