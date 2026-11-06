import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { EventEmitter } from 'events'
import { spawn } from 'child_process'
import { isSteamRunning } from 'backend/shortcuts/nonesteamgame/steamProcess'
import {
  findSteamRoot,
  ensureOnlineFixSteam,
  steamOverlayLibraries
} from '../steam'

let mockHome: string
const mockEnvironment = { isFlatpak: false }
jest.mock('backend/constants/paths', () => ({
  get flatpakHome() {
    return mockHome
  }
}))
jest.mock('backend/constants/environment', () => ({
  get isFlatpak() {
    return mockEnvironment.isFlatpak
  }
}))
jest.mock('backend/shortcuts/nonesteamgame/steamProcess', () => ({
  isSteamRunning: jest.fn()
}))
jest.mock('child_process', () => ({ spawn: jest.fn() }))
const running = jest.mocked(isSteamRunning)
const start = jest.mocked(spawn)
beforeEach(async () => {
  mockHome = await mkdtemp(join(tmpdir(), 'heroic-onlinefix-steam-'))
  mockEnvironment.isFlatpak = false
})
afterEach(async () => {
  await rm(mockHome, { recursive: true, force: true })
})

test('finds the existing Steam install and reuses a running client', async () => {
  const root = join(mockHome, '.local/share/Steam')
  await mkdir(join(root, 'steamapps'), { recursive: true })
  running.mockReturnValue(true)
  expect(await findSteamRoot()).toBe(root)
  expect(await ensureOnlineFixSteam()).toBe(root)
  expect(start).not.toHaveBeenCalled()
})
test('starts Steam without a shell when it is not running', async () => {
  const root = join(mockHome, '.steam/steam')
  await mkdir(join(root, 'steamapps'), { recursive: true })
  running.mockReturnValueOnce(false).mockReturnValue(true)
  const child = Object.assign(new EventEmitter(), { unref: jest.fn() })
  start.mockImplementation(() => {
    queueMicrotask(() => child.emit('spawn'))
    return child as unknown as ReturnType<typeof spawn>
  })
  expect(await ensureOnlineFixSteam()).toBe(root)
  expect(start).toHaveBeenCalledWith('steam', ['-silent'], {
    detached: true,
    stdio: 'ignore'
  })
  expect(child.unref).toHaveBeenCalled()
})
test('reports missing Steam and inaccessible Flatpak startup without downloading anything', async () => {
  await expect(findSteamRoot()).rejects.toThrow('native Steam client')
  await mkdir(join(mockHome, '.steam/steam/steamapps'), { recursive: true })
  running.mockReturnValue(false)
  mockEnvironment.isFlatpak = true
  await expect(ensureOnlineFixSteam()).rejects.toThrow(
    'Start the native Steam client'
  )
  expect(start).not.toHaveBeenCalled()
})
test('only returns overlay libraries that already exist', async () => {
  const root = join(mockHome, 'Steam')
  await mkdir(join(root, 'ubuntu12_64'), { recursive: true })
  const lib = join(root, 'ubuntu12_64/gameoverlayrenderer.so')
  await writeFile(lib, '')
  expect(await steamOverlayLibraries(root)).toEqual([lib])
})
