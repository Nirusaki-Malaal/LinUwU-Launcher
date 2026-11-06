export interface NexusXboxGame {
  id: string
  title: string
  path: string
  executable?: string
  sideloaded: boolean
  onlineFixCompatibility: boolean
  installState: string
  coverUrl?: string
  storeId?: string
}
export interface NexusXboxSnapshot {
  protocol: 1
  account: { signedIn: boolean; gamertag?: string }
  runtime: { installed: boolean; name?: string }
  operation?: { gameId?: string; status: string; phase?: string }
  games: NexusXboxGame[]
}
export type NexusXboxRequest =
  | { action: 'connect' | 'snapshot' | 'show' | 'import-exe' | 'stop' }
  | { action: 'launch'; gameId: string }
  | { action: 'compatibility'; gameId: string; enabled: boolean }
