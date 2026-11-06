export interface SteamRipDownload {
  title: string
  uris: string[]
  fileSize?: string
  uploadDate?: string
  pageUrl?: string
}

export interface SteamRipCatalog {
  name: string
  sourceUrl: string
  lastUpdated: string
  count: number
  downloads: SteamRipDownload[]
}

export interface SyncResult {
  success: boolean
  message: string
  count: number
  sourceUrl: string
}
