import { useEffect, useMemo, useState } from 'react'
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Database,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react'
import type { SteamRipCatalog, SteamRipDownload } from 'common/types/steamrip'
import { Modal, ModalContent, ModalHeader } from 'frontend/components/UI/Modal'
import { UpdateComponent } from 'frontend/components/UI'
import './index.scss'

function parseSizeToMB(sizeStr?: string): number {
  if (!sizeStr) return 0
  const match = /^([\d.]+)\s*(MB|GB|KB|TB)?$/i.exec(sizeStr.trim())
  if (!match) return 0
  const val = parseFloat(match[1])
  const unit = (match[2] || 'MB').toUpperCase()
  if (unit === 'GB') return val * 1024
  if (unit === 'TB') return val * 1024 * 1024
  if (unit === 'KB') return val / 1024
  return val
}

function getHostName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host.split('.')[0] || host
  } catch {
    return 'Direct Link'
  }
}

export default function SteamRip() {
  const [catalog, setCatalog] = useState<SteamRipCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'catalog' | 'webview'>('catalog')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'size-desc' | 'date-desc'>('title-asc')
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [customSourceUrl, setCustomSourceUrl] = useState('https://hydralinks.cloud/sources/steamrip.json')
  const [syncing, setSyncing] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api
      .getSteamRipCatalog()
      .then((data) => {
        if (!cancelled) {
          setCatalog(data)
          if (data?.sourceUrl) setCustomSourceUrl(data.sourceUrl)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load SteamRIP catalog:', err)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2000)
    })
  }

  const handleOpenLink = (url: string) => {
    window.api.openExternalUrl(url)
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncFeedback(null)
    try {
      const res = await window.api.syncSteamRipCatalog(customSourceUrl)
      setSyncFeedback(res.message)
      const updated = await window.api.getSteamRipCatalog()
      setCatalog(updated)
    } catch (err) {
      setSyncFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setSyncing(false)
    }
  }

  const filteredDownloads = useMemo(() => {
    if (!catalog?.downloads) return []
    let list = catalog.downloads

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((item) => item.title.toLowerCase().includes(q))
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'title-asc') return a.title.localeCompare(b.title)
      if (sortBy === 'title-desc') return b.title.localeCompare(a.title)
      if (sortBy === 'size-desc') return parseSizeToMB(b.fileSize) - parseSizeToMB(a.fileSize)
      if (sortBy === 'date-desc') return String(b.uploadDate || '').localeCompare(String(a.uploadDate || ''))
      return 0
    })
  }, [catalog, searchQuery, sortBy])

  if (loading) {
    return (
      <div className="SteamRip">
        <UpdateComponent message="Loading SteamRIP Catalog..." />
      </div>
    )
  }

  return (
    <div className="SteamRip">
      <div className="SteamRip__header">
        <div className="SteamRip__topRow">
          <div className="SteamRip__titleArea">
            <Sparkles size={24} color="#00b4d8" />
            <h1>SteamRIP Store</h1>
          </div>

          <div className="SteamRip__modeToggle">
            <button
              className={`SteamRip__modeBtn ${mode === 'catalog' ? 'SteamRip__modeBtn--active' : ''}`}
              onClick={() => setMode('catalog')}
            >
              <Database size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              Hydra Catalog ({catalog?.count ?? 0})
            </button>
            <button
              className={`SteamRip__modeBtn ${mode === 'webview' ? 'SteamRip__modeBtn--active' : ''}`}
              onClick={() => setMode('webview')}
            >
              <Globe size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              Web Store (steamrip.com)
            </button>
          </div>
        </div>

        <p className="SteamRip__tagline">
          Pre-installed, uncompressed PC games from SteamRIP with direct download links.
        </p>

        {mode === 'catalog' && (
          <div className="SteamRip__sourceBanner">
            <div className="SteamRip__sourceInfo">
              <strong>Source:</strong>
              <code>{catalog?.sourceUrl || 'https://hydralinks.cloud/sources/steamrip.json'}</code>
              <span>· {catalog?.count ?? 0} games verified</span>
            </div>

            <button
              className="SteamRip__miniBtn"
              onClick={() => setShowSyncModal(true)}
              title="Configure or refresh Hydra JSON source"
            >
              <RefreshCw size={12} />
              Sync Source
            </button>
          </div>
        )}
      </div>

      {mode === 'webview' ? (
        <div className="SteamRip__webviewWrapper">
          <webview
            className="SteamRip__webview"
            src="https://steamrip.com"
            allowpopups={true}
          />
        </div>
      ) : (
        <>
          <div className="SteamRip__filterBar">
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className="SteamRip__searchInput"
                placeholder="Search games in SteamRIP catalog (e.g. Wukong, Elden Ring, Baldur's Gate)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search
                size={16}
                color="var(--text-secondary)"
                style={{ position: 'absolute', right: 14, top: 12, pointerEvents: 'none' }}
              />
            </div>

            <select
              className="SteamRip__sortSelect"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="title-asc">Title: A to Z</option>
              <option value="title-desc">Title: Z to A</option>
              <option value="size-desc">File Size: Largest</option>
              <option value="date-desc">Date: Newest</option>
            </select>
          </div>

          {filteredDownloads.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '40px 0' }}>
              No games found matching "{searchQuery}".
            </p>
          ) : (
            <div className="SteamRip__grid">
              {filteredDownloads.map((game: SteamRipDownload, idx) => (
                <div key={`${game.title}-${idx}`} className="SteamRip__card">
                  <div className="SteamRip__cardHeader">
                    <h3 className="SteamRip__cardTitle">{game.title}</h3>
                  </div>

                  <div className="SteamRip__cardBadges">
                    {game.fileSize && (
                      <span className="SteamRip__badge SteamRip__badge--size">
                        {game.fileSize}
                      </span>
                    )}
                    {game.uploadDate && (
                      <span className="SteamRip__badge">
                        {game.uploadDate.slice(0, 10)}
                      </span>
                    )}
                    <span className="SteamRip__badge">Direct Download</span>
                  </div>

                  <div className="SteamRip__cardLinks">
                    {game.uris && game.uris.length > 0 ? (
                      game.uris.map((uri, uIdx) => {
                        const host = getHostName(uri)
                        const isCopied = copiedUrl === uri
                        return (
                          <div key={uIdx} className="SteamRip__linkRow">
                            <span className="SteamRip__hostLabel">{host}</span>
                            <div className="SteamRip__linkActions">
                              <button
                                className={`SteamRip__miniBtn ${isCopied ? 'SteamRip__miniBtn--copied' : ''}`}
                                onClick={() => handleCopy(uri)}
                                title="Copy download link"
                              >
                                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                {isCopied ? 'Copied' : 'Copy'}
                              </button>
                              <button
                                className="SteamRip__miniBtn"
                                onClick={() => handleOpenLink(uri)}
                                title="Download or open link in browser"
                              >
                                <Download size={12} />
                                Download
                              </button>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        No direct URIs listed.
                      </p>
                    )}

                    <button
                      className="SteamRip__pageBtn"
                      onClick={() => handleOpenLink(game.pageUrl || `https://steamrip.com/?s=${encodeURIComponent(game.title)}`)}
                    >
                      <ExternalLink size={12} style={{ marginRight: 5, verticalAlign: 'text-bottom' }} />
                      View on SteamRIP.com
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showSyncModal && (
        <Modal
          size="sm"
          showCloseButton={true}
          onClose={() => {
            setShowSyncModal(false)
            setSyncFeedback(null)
          }}
        >
          <ModalHeader>Hydra Source Configuration</ModalHeader>
          <ModalContent>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Sync or replace the Hydra-compatible JSON catalog source for SteamRIP.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Source JSON URL:
              </label>
              <input
                className="SteamRip__searchInput"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={customSourceUrl}
                onChange={(e) => setCustomSourceUrl(e.target.value)}
              />
            </div>

            {syncFeedback && (
              <p
                style={{
                  fontSize: 12,
                  padding: 8,
                  borderRadius: 6,
                  background: syncFeedback.includes('Successfully')
                    ? 'rgba(42, 157, 143, 0.2)'
                    : 'rgba(230, 57, 70, 0.2)',
                  color: syncFeedback.includes('Successfully') ? '#2a9d8f' : '#e63946',
                  marginBottom: 12
                }}
              >
                {syncFeedback}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="SteamRip__miniBtn"
                style={{ padding: '8px 16px', fontSize: 13 }}
                onClick={() => {
                  setShowSyncModal(false)
                  setSyncFeedback(null)
                }}
              >
                Close
              </button>
              <button
                className="SteamRip__miniBtn"
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  background: 'var(--primary-button, #00b4d8)',
                  color: '#fff'
                }}
                disabled={syncing}
                onClick={handleSync}
              >
                {syncing ? 'Syncing...' : 'Sync Source Now'}
              </button>
            </div>
          </ModalContent>
        </Modal>
      )}
    </div>
  )
}
