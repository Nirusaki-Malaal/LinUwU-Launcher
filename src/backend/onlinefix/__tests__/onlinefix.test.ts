import { mkdtemp, mkdir, writeFile, rm, symlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  scanOnlineFix,
  mergeDllOverrides,
  onlineFixSettings
} from '../onlinefix'
import type { GameSettings } from 'common/types'
let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'heroic-onlinefix-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})
test('detects nested DLLs and case-insensitive INI metadata', async () => {
  await mkdir(join(root, 'Bin'))
  await writeFile(join(root, 'Bin', 'OnlineFix64.DLL'), '')
  await writeFile(join(root, 'WinMM.dll'), '')
  await writeFile(join(root, 'steam_api64.dll'), '')
  await writeFile(
    join(root, 'OnlineFix.ini'),
    '[Main]\nRealAppId=1234\nFakeAppId=480\n'
  )
  const scan = await scanOnlineFix(root)
  expect(scan.overrides).toEqual({
    onlinefix64: 'n',
    winmm: 'n,b',
    steam_api64: 'n'
  })
  expect(scan.realAppId).toBe('1234')
  expect(scan.fakeAppId).toBe('480')
})
test('prefers the original app ID recorded by the legacy launcher', async () => {
  await writeFile(
    join(root, 'SteamFix.ini'),
    '[Main]\nRealAppId=480\nFakeAppId=480\n[OnlineFix Linux]\nRealAppId=1234\n'
  )
  expect((await scanOnlineFix(root)).realAppId).toBe('1234')
})
test('reads DLL lists with Windows paths, ignoring non-DLL entries', async () => {
  await writeFile(join(root, 'dlllist.txt'), 'sub\\CUSTOM.dll\r\ninvalid.exe\n')
  expect((await scanOnlineFix(root)).overrides).toEqual({ custom: 'n' })
})
test('does not follow symlinks or scan Wine prefixes', async () => {
  await mkdir(join(root, 'pfx'))
  await writeFile(join(root, 'pfx', 'wininet.dll'), '')
  await symlink(join(root, 'pfx'), join(root, 'linked-prefix'))
  expect((await scanOnlineFix(root)).overrides).toEqual({})
})
test('manual grouped and disabled DLL modes override detection', () => {
  expect(
    mergeDllOverrides(
      { winmm: 'n,b', dxgi: 'n', onlinefix64: 'n' },
      'WINMM=b;dxgi,d3d11=d;foo=n'
    )
  ).toBe('winmm=b;dxgi=d;onlinefix64=n;d3d11=d;foo=n')
})
test('environment is ephemeral, preserving the selected runtime and prefix', () => {
  const settings = {
    onlineFix: true,
    wineVersion: { name: 'shared GE', bin: '/shared/proton' },
    winePrefix: '/existing/prefix',
    enviromentOptions: [
      { key: 'WINEDLLOVERRIDES', value: 'winmm=b' },
      { key: 'FOO', value: 'two words' }
    ]
  } as GameSettings
  const before = JSON.stringify(settings)
  const result = onlineFixSettings(
    settings,
    { overrides: { winmm: 'n,b', onlinefix64: 'n' }, filesFound: 2 },
    []
  )
  expect(result.enviromentOptions).toContainEqual({
    key: 'WINEDLLOVERRIDES',
    value: 'winmm=b;onlinefix64=n'
  })
  expect(result.enviromentOptions).toContainEqual({
    key: 'FOO',
    value: 'two words'
  })
  expect(result.wineVersion).toBe(settings.wineVersion)
  expect(result.winePrefix).toBe(settings.winePrefix)
  expect(JSON.stringify(settings)).toBe(before)
})
test('optional overlay preserves preloads and uses the configured ID', () => {
  const settings = {
    onlineFixSteamOverlay: true,
    enviromentOptions: [{ key: 'LD_PRELOAD', value: '/my/lib.so' }]
  } as GameSettings
  const result = onlineFixSettings(
    settings,
    { overrides: {}, filesFound: 0, fakeAppId: '999' },
    ['/steam/overlay.so']
  )
  expect(result.enviromentOptions).toContainEqual({
    key: 'LD_PRELOAD',
    value: '/my/lib.so:/steam/overlay.so'
  })
  expect(result.enviromentOptions).toContainEqual({
    key: 'SteamOverlayGameId',
    value: '999'
  })
})
test('overlay stays off when disabled', () => {
  const settings = {
    onlineFixSteamOverlay: false,
    enviromentOptions: []
  } as unknown as GameSettings
  expect(
    onlineFixSettings(settings, { overrides: {}, filesFound: 0 }, [
      '/steam/overlay.so'
    ]).enviromentOptions
  ).toEqual([])
})
test('missing folders and oversized configuration fail visibly', async () => {
  await expect(scanOnlineFix(join(root, 'missing'))).rejects.toThrow()
  await writeFile(join(root, 'OnlineFix.ini'), Buffer.alloc(1024 * 1024 + 1))
  await expect(scanOnlineFix(root)).rejects.toThrow('too large')
})

test('accepts quoted manual override values from existing Heroic configurations', () => {
  expect(mergeDllOverrides({ winmm: 'n,b' }, '"winmm=b;custom=n"')).toBe(
    'winmm=b;custom=n'
  )
})
