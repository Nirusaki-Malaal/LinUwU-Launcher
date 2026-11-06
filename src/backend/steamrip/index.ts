import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import axios from 'axios'
import { addHandler } from 'backend/ipc'
import { logError, logInfo, LogPrefix } from 'backend/logger'
import { userDataPath } from 'backend/constants/paths'
import type { SteamRipCatalog, SteamRipDownload, SyncResult } from 'common/types/steamrip'
import bundledCatalog from './bundled_catalog.json'

const DEFAULT_SOURCE_URL = 'https://hydralinks.cloud/sources/steamrip.json'
const CACHE_FILE = join(userDataPath, 'steamrip_catalog.json')

let memoryCatalog: SteamRipCatalog | null = null

function loadCachedCatalog(): SteamRipCatalog {
  if (memoryCatalog) return memoryCatalog

  if (existsSync(CACHE_FILE)) {
    try {
      const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as SteamRipCatalog
      if (data && Array.isArray(data.downloads) && data.downloads.length > 0) {
        memoryCatalog = data
        return data
      }
    } catch (err) {
      logError(`Failed to read steamrip cache: ${err}`, LogPrefix.Backend)
    }
  }

  // Seed with bundled catalog
  const catalog: SteamRipCatalog = {
    name: bundledCatalog.name || 'SteamRIP',
    sourceUrl: bundledCatalog.sourceUrl || DEFAULT_SOURCE_URL,
    lastUpdated: bundledCatalog.lastUpdated || new Date().toISOString(),
    count: bundledCatalog.downloads.length,
    downloads: bundledCatalog.downloads as SteamRipDownload[]
  }
  memoryCatalog = catalog
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(catalog, null, 2))
  } catch (err) {
    logError(`Failed to write initial steamrip cache: ${err}`, LogPrefix.Backend)
  }
  return catalog
}

export async function fetchRemoteCatalog(url = DEFAULT_SOURCE_URL): Promise<SyncResult> {
  const targetUrl = url.trim() || DEFAULT_SOURCE_URL
  logInfo(`Syncing SteamRIP catalog from: ${targetUrl}`, LogPrefix.Backend)

  try {
    const response = await axios.get(targetUrl, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*'
      }
    })

    const rawData = response.data
    let downloadsRaw: unknown[] = []
    let sourceName = 'SteamRIP'

    if (rawData && Array.isArray(rawData.downloads)) {
      downloadsRaw = rawData.downloads
      if (typeof rawData.name === 'string') sourceName = rawData.name
    } else if (Array.isArray(rawData)) {
      downloadsRaw = rawData
    } else {
      throw new Error('Received unexpected response format (not a Hydra-compatible downloads JSON).')
    }

    const validDownloads: SteamRipDownload[] = []
    for (const item of downloadsRaw) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const title = String(rec.title || rec.name || '').trim()
      if (!title) continue

      let uris: string[] = []
      if (Array.isArray(rec.uris)) {
        uris = rec.uris.map(String).filter((u) => u.startsWith('http') || u.startsWith('magnet:'))
      } else if (typeof rec.uri === 'string') {
        uris = [rec.uri]
      } else if (typeof rec.url === 'string') {
        uris = [rec.url]
      }

      const fileSize = rec.fileSize ? String(rec.fileSize) : undefined
      const uploadDate = rec.uploadDate ? String(rec.uploadDate) : undefined
      const pageUrl = typeof rec.pageUrl === 'string' ? rec.pageUrl : `https://steamrip.com/?s=${encodeURIComponent(title)}`

      validDownloads.push({
        title,
        uris,
        fileSize,
        uploadDate,
        pageUrl
      })
    }

    if (validDownloads.length === 0) {
      throw new Error('Source returned 0 valid games.')
    }

    const updatedCatalog: SteamRipCatalog = {
      name: sourceName,
      sourceUrl: targetUrl,
      lastUpdated: new Date().toISOString(),
      count: validDownloads.length,
      downloads: validDownloads
    }

    memoryCatalog = updatedCatalog
    writeFileSync(CACHE_FILE, JSON.stringify(updatedCatalog, null, 2))
    logInfo(`Successfully synced ${validDownloads.length} games from ${targetUrl}`, LogPrefix.Backend)

    return {
      success: true,
      message: `Successfully synced ${validDownloads.length} games from ${targetUrl}`,
      count: validDownloads.length,
      sourceUrl: targetUrl
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logError(`SteamRIP sync failed: ${errorMsg}`, LogPrefix.Backend)
    const current = loadCachedCatalog()

    return {
      success: false,
      message: `Sync failed (${errorMsg}). Using cached catalog of ${current.count} games.`,
      count: current.count,
      sourceUrl: targetUrl
    }
  }
}

// Register IPC handlers
addHandler('getSteamRipCatalog', async () => {
  return loadCachedCatalog()
})

addHandler('syncSteamRipCatalog', async (_event, url) => {
  return fetchRemoteCatalog(url)
})
