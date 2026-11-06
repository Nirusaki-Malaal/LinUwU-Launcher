import { contextBridge, ipcRenderer as electronIpc } from 'electron'
const ipcRenderer = {
  ...electronIpc,
  invoke: async (channel: string, ...args: unknown[]) => {
    await electronIpc.invoke('xbox-nexus:initialize')
    return electronIpc.invoke(channel, ...args)
  },
  on: electronIpc.on.bind(electronIpc),
  removeListener: electronIpc.removeListener.bind(electronIpc)
}
import type {
  Game,
  InstallRequest,
  LauncherApi,
  Settings,
  XboxSocialApi
} from '../shared/types.js'

// Demo fixtures live in the main process (src/shared/demo-data.ts) and are
// served over these same IPC channels when XODUS_DEMO=1, so the sandboxed
// preload stays a thin passthrough. Store pages always use the live
// Microsoft Store catalog. No real credentials, tokens or account data.
const nativeSocial: XboxSocialApi = {
  popOutXboxChat: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:pop-out-xbox-chat', xuid),
  openXboxPlayerProfile: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:open-xbox-player-profile', xuid),
  getXboxGameInviteAvailability: () =>
    ipcRenderer.invoke('xbox-nexus:xbox-game-invite-availability'),
  sendXboxGameInvite: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:xbox-game-invite-send', xuid),
  getXboxPlayerDetails: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:xbox-player-details', xuid),
  getXboxPlayerGames: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:xbox-player-games', xuid),
  getXboxPeople: (list, query) =>
    ipcRenderer.invoke('xbox-nexus:xbox-social-people', list, query),
  getXboxRelationship: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:xbox-social-relationship', xuid),
  changeXboxRelationship: (account, xuid, action) =>
    ipcRenderer.invoke(
      'xbox-nexus:xbox-social-relationship-change',
      account,
      xuid,
      action
    ),
  getXboxPlayerProfile: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:xbox-player-profile', xuid),
  getXboxFriends: () => ipcRenderer.invoke('xbox-nexus:xbox-social-friends'),
  getXboxInbox: () => ipcRenderer.invoke('xbox-nexus:xbox-social-inbox'),
  getXboxConversation: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:xbox-social-conversation', xuid),
  sendXboxMessage: (account, xuid, text) =>
    ipcRenderer.invoke('xbox-nexus:xbox-social-send', account, xuid, text)
}
const api: LauncherApi = {
  onLauncherPage: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      page: Parameters<typeof callback>[0]
    ) => callback(page)
    ipcRenderer.on('xbox-nexus:launcher-page', listener)
    return () =>
      ipcRenderer.removeListener('xbox-nexus:launcher-page', listener)
  },
  showTouchKeyboard: (field) =>
    ipcRenderer.invoke('xbox-nexus:show-touch-keyboard', field),
  setXboxOverlayRecording: (recording) =>
    ipcRenderer.invoke('xbox-nexus:xbox-overlay-recording', recording),
  getXboxDesktopProfile: () =>
    ipcRenderer.invoke('xbox-nexus:xbox-desktop-profile'),
  onXboxDesktopProfile: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      request: Parameters<typeof callback>[0]
    ) => callback(request)
    ipcRenderer.on('xbox-nexus:xbox-desktop-profile', listener)
    return () =>
      ipcRenderer.removeListener('xbox-nexus:xbox-desktop-profile', listener)
  },
  nativeSocial,
  closeXboxChat: () => ipcRenderer.invoke('xbox-nexus:close-xbox-chat'),
  getXboxChatReads: () => ipcRenderer.invoke('xbox-nexus:xbox-chat-reads'),
  onXboxChatReads: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: Parameters<typeof callback>[0]
    ) => callback(state)
    ipcRenderer.on('xbox-nexus:xbox-chat-reads', listener)
    return () =>
      ipcRenderer.removeListener('xbox-nexus:xbox-chat-reads', listener)
  },
  viewedXboxChat: (account, binary, peer, ids) =>
    ipcRenderer.invoke(
      'xbox-nexus:xbox-chat-viewed',
      account,
      binary,
      peer,
      ids
    ),
  inviteXboxFriend: (gameId, xuid) =>
    ipcRenderer.invoke('xbox-nexus:game-invite-friend', gameId, xuid),
  chooseGameInviteRecipient: (id, xuid) =>
    ipcRenderer.invoke('xbox-nexus:game-invite-choose', id, xuid),
  cancelGameInvite: (id) =>
    ipcRenderer.invoke('xbox-nexus:game-invite-cancel', id),
  acceptGameInvite: (id) =>
    ipcRenderer.invoke('xbox-nexus:game-invite-accept', id),
  onOpenFriends: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('xbox-nexus:open-friends', listener)
    return () => ipcRenderer.removeListener('xbox-nexus:open-friends', listener)
  },
  getXboxFriends: () => ipcRenderer.invoke('xbox-nexus:xbox-friends'),
  getXboxConversation: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:xbox-conversation', xuid),
  sendXboxMessage: (xuid, text) =>
    ipcRenderer.invoke('xbox-nexus:xbox-send-message', xuid, text),
  closeXboxSocial: () => ipcRenderer.invoke('xbox-nexus:xbox-social-close'),
  getXboxVoiceState: () => ipcRenderer.invoke('xbox-nexus:xbox-voice-state'),
  controlXboxVoice: (command) =>
    ipcRenderer.invoke('xbox-nexus:xbox-voice-control', command),
  onXboxVoiceState: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: Parameters<typeof callback>[0]
    ) => callback(state)
    ipcRenderer.on('xbox-nexus:xbox-voice-state', listener)
    return () =>
      ipcRenderer.removeListener('xbox-nexus:xbox-voice-state', listener)
  },
  xboxVoiceHostReady: () =>
    ipcRenderer.invoke('xbox-nexus:xbox-voice-owner-ready'),
  publishXboxVoiceHostState: (state) =>
    ipcRenderer.invoke('xbox-nexus:xbox-voice-owner-state', state),
  completeXboxVoiceHostCommand: (id, error) =>
    ipcRenderer.invoke('xbox-nexus:xbox-voice-owner-complete', id, error),
  onXboxVoiceHostCommand: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      request: Parameters<typeof callback>[0]
    ) => callback(request)
    ipcRenderer.on('xbox-nexus:xbox-voice-owner-command', listener)
    return () =>
      ipcRenderer.removeListener(
        'xbox-nexus:xbox-voice-owner-command',
        listener
      )
  },
  getXboxParty: () => ipcRenderer.invoke('xbox-nexus:xbox-party-state'),
  startXboxParty: (offer, partyId) =>
    ipcRenderer.invoke('xbox-nexus:xbox-party-start', offer, partyId),
  getXboxActiveParties: () =>
    ipcRenderer.invoke('xbox-nexus:xbox-party-active'),
  leaveExistingXboxParty: (id) =>
    ipcRenderer.invoke('xbox-nexus:xbox-party-leave-existing', id),
  confirmXboxParty: (id) =>
    ipcRenderer.invoke('xbox-nexus:xbox-party-connected', id),
  leaveXboxParty: () => ipcRenderer.invoke('xbox-nexus:xbox-party-leave'),
  inviteXboxPartyFriend: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:xbox-party-invite', xuid),
  xboxVoiceAllowed: (xuid) =>
    ipcRenderer.invoke('xbox-nexus:xbox-party-voice-policy', xuid),
  allowXboxMicrophone: () =>
    ipcRenderer.invoke('xbox-nexus:xbox-party-microphone'),
  onXboxPartyState: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: Parameters<typeof callback>[0]
    ) => callback(state)
    ipcRenderer.on('xbox-nexus:xbox-party-state', listener)
    return () =>
      ipcRenderer.removeListener('xbox-nexus:xbox-party-state', listener)
  },
  getXboxInvites: () => ipcRenderer.invoke('xbox-nexus:xbox-invites'),
  acceptXboxPartyInvite: (offer, id) =>
    ipcRenderer.invoke('xbox-nexus:xbox-party-accept', offer, id),
  onXboxInvitesChanged: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      invites: Parameters<typeof callback>[0]
    ) => callback(invites)
    ipcRenderer.on('xbox-nexus:xbox-invites', listener)
    return () => ipcRenderer.removeListener('xbox-nexus:xbox-invites', listener)
  },
  getSnapshot: () => ipcRenderer.invoke('xbox-nexus:get-snapshot'),
  refreshBackend: () => ipcRenderer.invoke('xbox-nexus:backend-refresh'),
  checkBackendUpdate: () =>
    ipcRenderer.invoke('xbox-nexus:backend-check-update'),
  updateBackend: () => ipcRenderer.invoke('xbox-nexus:backend-update'),
  rebuildBackend: () => ipcRenderer.invoke('xbox-nexus:backend-rebuild'),
  refreshRuntime: () => ipcRenderer.invoke('xbox-nexus:runtime-refresh'),
  checkRuntimeUpdate: () =>
    ipcRenderer.invoke('xbox-nexus:runtime-check-update'),
  checkNexusRuntime: () => ipcRenderer.invoke('xbox-nexus:runtime-check-nexus'),
  installRuntime: () => ipcRenderer.invoke('xbox-nexus:runtime-install'),
  installNexusRuntime: () =>
    ipcRenderer.invoke('xbox-nexus:runtime-install-nexus'),
  rollbackRuntimePreview: () =>
    ipcRenderer.invoke('xbox-nexus:runtime-rollback-preview'),
  refreshAccount: () => ipcRenderer.invoke('xbox-nexus:account-refresh'),
  checkKeyring: () => ipcRenderer.invoke('xbox-nexus:keyring-check'),
  startKeyring: () => ipcRenderer.invoke('xbox-nexus:keyring-start'),
  createKeyringCollection: () =>
    ipcRenderer.invoke('xbox-nexus:keyring-create'),
  onKeyringStatus: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: Parameters<typeof callback>[0]
    ) => callback(status)
    ipcRenderer.on('xbox-nexus:keyring-state', listener)
    return () =>
      ipcRenderer.removeListener('xbox-nexus:keyring-state', listener)
  },
  checkLauncherUpdate: () =>
    ipcRenderer.invoke('xbox-nexus:check-launcher-update'),
  installLauncherUpdate: () =>
    ipcRenderer.invoke('xbox-nexus:install-launcher-update'),
  restartLauncher: () => ipcRenderer.invoke('xbox-nexus:restart-launcher'),
  rollbackLauncherUpdate: () =>
    ipcRenderer.invoke('xbox-nexus:rollback-launcher-update'),
  stopGameUpdateCheck: () =>
    ipcRenderer.invoke('xbox-nexus:stop-game-update-check'),
  checkGameUpdates: (id?: string) =>
    ipcRenderer.invoke('xbox-nexus:check-game-updates', id),
  getHeroicGameSettings: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:heroic-game-settings', id),
  readGameDiagnosticLog: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:read-game-diagnostic-log', id),
  readDiagnosticLog: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:read-diagnostic-log', id),
  copyDiagnosticLog: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:copy-diagnostic-log', id),
  revealDiagnosticLog: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:reveal-diagnostic-log', id),
  readBackendDiagnosticLog: () =>
    ipcRenderer.invoke('xbox-nexus:read-backend-diagnostic-log'),
  createDiagnosticReport: (gameId) =>
    ipcRenderer.invoke('xbox-nexus:create-diagnostic-report', gameId),
  saveDiagnosticReport: (content) =>
    ipcRenderer.invoke('xbox-nexus:save-diagnostic-report', content),
  login: () => ipcRenderer.invoke('xbox-nexus:login'),
  logout: () => ipcRenderer.invoke('xbox-nexus:logout'),
  offlinePermissions: () =>
    ipcRenderer.invoke('xbox-nexus:offline-permissions'),
  setOfflinePermissions: (enabled: boolean) =>
    ipcRenderer.invoke('xbox-nexus:set-offline-permissions', enabled),
  searchCatalog: (query: string, cursor?: string) =>
    ipcRenderer.invoke('xbox-nexus:catalog-search', query, cursor),
  getFeaturedCatalog: () => ipcRenderer.invoke('xbox-nexus:catalog-featured'),
  getAccountLibrary: (kind, cursor, refresh, sort) =>
    ipcRenderer.invoke(
      'xbox-nexus:account-library',
      kind,
      cursor,
      refresh,
      sort
    ),
  startInstall: (request: InstallRequest) =>
    ipcRenderer.invoke('xbox-nexus:start-install', request),
  getInstallPlan: (productId: string, destination?: string) =>
    ipcRenderer.invoke('xbox-nexus:install-plan', productId, destination),
  getGameContent: (id) => ipcRenderer.invoke('xbox-nexus:game-content', id),
  installGameContent: (id, productId) =>
    ipcRenderer.invoke('xbox-nexus:install-game-content', id, productId),
  updateInstalledGame: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:update-installed-game', id),
  getDownloadCancelOptions: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:download-cancel-options', id),
  cancelDownload: (id: string, mode?: 'keep' | 'delete-files') =>
    ipcRenderer.invoke('xbox-nexus:cancel-download', id, mode),
  pauseDownload: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:pause-download', id),
  resumeDownload: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:resume-download', id),
  removeDownload: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:remove-download', id),
  clearFinishedDownloads: () =>
    ipcRenderer.invoke('xbox-nexus:clear-finished-downloads'),
  importGame: (path?: string) =>
    ipcRenderer.invoke('xbox-nexus:import-game', path),
  importExecutable: (path?: string) =>
    ipcRenderer.invoke('xbox-nexus:import-executable', path),
  toggleGameOverlay: () => ipcRenderer.invoke('xbox-nexus:toggle-game-overlay'),
  updateGame: (
    id: string,
    patch: Partial<
      Pick<
        Game,
        | 'title'
        | 'executable'
        | 'launchArgs'
        | 'locale'
        | 'launchTools'
        | 'onlineFixCompatibility'
      >
    >
  ) => ipcRenderer.invoke('xbox-nexus:update-game', id, patch),
  getGameLocales: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:game-locales', id),
  removeGame: (id: string, mode: 'library' | 'delete-files') =>
    ipcRenderer.invoke('xbox-nexus:remove-game', id, mode),
  getGameLaunchOptions: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:game-launch-options', id),
  getGameDetails: (id: import('../shared/types').GameDetailsTarget) =>
    ipcRenderer.invoke('xbox-nexus:game-details', id),
  getGameActivity: (
    id: import('../shared/types').GameDetailsTarget,
    refresh?: boolean
  ) => ipcRenderer.invoke('xbox-nexus:game-activity', id, refresh),
  getGameAchievements: (
    id: import('../shared/types').GameDetailsTarget,
    refresh?: boolean
  ) => ipcRenderer.invoke('xbox-nexus:game-achievements', id, refresh),
  launchGame: (id: string) => ipcRenderer.invoke('xbox-nexus:launch-game', id),
  createGameShortcut: (id, destination) =>
    ipcRenderer.invoke('xbox-nexus:create-game-shortcut', id, destination),
  addToSteam: (id) => ipcRenderer.invoke('xbox-nexus:add-to-steam', id),
  installGameVcRuntime: (id: string) =>
    ipcRenderer.invoke('xbox-nexus:install-game-vc-runtime', id),
  cancelGame: () => ipcRenderer.invoke('xbox-nexus:cancel-game'),
  updateSettings: (patch: Partial<Settings>) =>
    ipcRenderer.invoke('xbox-nexus:update-settings', patch),
  chooseDirectory: (defaultPath?: string) =>
    ipcRenderer.invoke('xbox-nexus:choose-directory', defaultPath),
  chooseFile: (defaultPath?: string) =>
    ipcRenderer.invoke('xbox-nexus:choose-file', defaultPath),
  openPath: (target: string) =>
    ipcRenderer.invoke('xbox-nexus:open-path', target),
  onSnapshot: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      value: Parameters<typeof callback>[0]
    ) => callback(value)
    ipcRenderer.on('xbox-nexus:snapshot', listener)
    return () => ipcRenderer.removeListener('xbox-nexus:snapshot', listener)
  },
  onOperationLog: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      value: Parameters<typeof callback>[0]
    ) => callback(value)
    ipcRenderer.on('xbox-nexus:operation-log', listener)
    return () =>
      ipcRenderer.removeListener('xbox-nexus:operation-log', listener)
  },
  isDemoTour: () =>
    process.env.XODUS_DEMO_TOUR === '1' && !process.env.XODUS_DEMO_CAPTURE_DIR
}

contextBridge.exposeInMainWorld('launcher', api)
