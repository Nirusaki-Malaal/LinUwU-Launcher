import type { AppSnapshot } from '../../../integrations/xbox/shared/types'
export const emptySnapshot: AppSnapshot = {
  backend: {
    available: false,
    source: 'none',
    updateAvailable: false,
    checking: false,
    updating: false,
    externalRoot: '',
    capabilities: {
      commands: [],
      account: false,
      login: false,
      logout: false,
      download: false,
      streaming: false,
      run: false
    },
    prerequisites: { git: false, cargo: false, rustc: false, protoc: false }
  },
  runtime: {
    installed: false,
    checking: false,
    updating: false,
    runtimeRoot: '',
    artifactAvailable: false,
    prerequisites: {
      gh: false,
      authenticated: false,
      tar: false,
      sha512sum: false
    }
  },
  games: [],
  downloads: [],
  settings: {
    installRoot: '',
    market: 'neutral',
    parallelDownloads: 4,
    winePath: '',
    externalXodusRoot: '',
    runtimeRoot: '',
    verboseLogs: false
  },
  auth: { running: false, stored: null, note: '' }
}
