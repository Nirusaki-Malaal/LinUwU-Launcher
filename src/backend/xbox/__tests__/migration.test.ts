import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { importExistingProfile } from '../../../integrations/xbox/main/heroic-profile'
import { xboxWineInstallation } from '../wine-discovery'
let mockRoot: string
jest.mock('os', () => {
  const original: typeof import('os') = jest.requireActual('os')
  return { ...original, homedir: () => mockRoot }
})
jest.mock('backend/constants/paths', () => ({
  get appFolder() {
    return join(mockRoot, 'heroic')
  }
}))
const originalCI = process.env.CI
beforeEach(async () => {
  mockRoot = await fs.mkdtemp(join(tmpdir(), 'heroic-xbox-migration-'))
  delete process.env.CI
})
afterEach(async () => {
  if (originalCI === undefined) delete process.env.CI
  else process.env.CI = originalCI
  await fs.rm(mockRoot, { recursive: true, force: true })
})
test('imports metadata once, preserves Heroic edits and reuses existing runtime paths', async () => {
  const source = join(mockRoot, '.config/xodus-nexus')
  const destination = join(mockRoot, 'heroic/xbox')
  await fs.mkdir(join(source, 'xodus-backends'), { recursive: true })
  const state = JSON.stringify({
    settings: { winePath: '/shared/wine', runtimeRoot: '/shared/runtime' },
    games: [{ id: 'existing-game' }]
  })
  await fs.writeFile(join(source, 'launcher-state.json'), state)
  await fs.writeFile(
    join(source, 'xodus-backends/current.json'),
    '{"binaryPath":"/shared/backend"}'
  )
  await fs.writeFile(join(source, 'heroic-bridge.sock'), 'must not be imported')
  await importExistingProfile(destination)
  expect(
    await fs.readFile(join(destination, 'launcher-state.json'), 'utf8')
  ).toBe(state)
  expect(
    (await fs.stat(join(destination, 'launcher-state.json'))).mode & 0o777
  ).toBe(0o600)
  await fs.writeFile(
    join(destination, 'launcher-state.json'),
    'Heroic preference'
  )
  await importExistingProfile(destination)
  expect(
    await fs.readFile(join(destination, 'launcher-state.json'), 'utf8')
  ).toBe('Heroic preference')
  await expect(
    fs.stat(join(destination, 'heroic-bridge.sock'))
  ).rejects.toMatchObject({ code: 'ENOENT' })
})
test('does not import the real profile into UI tests', async () => {
  process.env.CI = 'e2e'
  const destination = join(mockRoot, 'test-profile')
  await importExistingProfile(destination)
  expect(await fs.readdir(destination)).toEqual([])
})
test('discovers an existing executable Xbox Wine without downloading or copying it', async () => {
  const bin = join(mockRoot, 'shared/nexus-runtime-test/files/bin/wine')
  await fs.mkdir(join(bin, '..'), { recursive: true })
  await fs.writeFile(bin, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  await fs.writeFile(join(bin, '../wineserver'), '')
  await fs.mkdir(join(mockRoot, 'heroic/xbox'), { recursive: true })
  await fs.writeFile(
    join(mockRoot, 'heroic/xbox/launcher-state.json'),
    JSON.stringify({ settings: { winePath: bin } })
  )
  expect(await xboxWineInstallation()).toMatchObject({
    bin,
    type: 'wine',
    wineserver: join(bin, '../wineserver')
  })
  await fs.unlink(bin)
  expect(await xboxWineInstallation()).toBeUndefined()
})
