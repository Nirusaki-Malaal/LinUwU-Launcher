import './GameDetails.scss'
import useGlobalState from 'frontend/state/GlobalStateV2'
import { projectXboxGame } from 'common/xbox-library'
import { nexusRuntimeUpdateAvailable } from '../../../integrations/xbox/shared/runtime-display'
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  PageHeader,
  Panel,
  SettingsCard,
  SettingRow,
  Tabs,
  TextInputField,
  ToggleSwitch
} from 'frontend/components/UI'
import { Modal, ModalHeader, ModalContent } from 'frontend/components/UI/Modal'
import type {
  AppSnapshot,
  CatalogProduct,
  Game,
  GameContentPlan,
  GameAchievements,
  GameStoreDetails,
  InstallPlan,
  OfflinePermissions
} from '../../../integrations/xbox/shared/types'
import type { XboxSection } from './Content'

export type XboxAction = (action: () => Promise<unknown>) => void
const api = () => window.launcher
export function XboxSetup({
  data,
  section,
  action
}: {
  data: AppSnapshot
  section: XboxSection
  action: XboxAction
}) {
  const navigate = useNavigate()
  const [offline, setOffline] = useState<OfflinePermissions>()
  const [wallet, setWallet] = useState<string>()
  const [shortcut, setShortcut] = useState(
    data.settings.overlayShortcut || 'Super+G'
  )
  useEffect(() => {
    if (
      section === 'account' &&
      data.auth.stored &&
      data.backend.capabilities.offlinePc
    )
      void api()
        .offlinePermissions()
        .then(setOffline)
        .catch(() => {})
  }, [section, data.auth.stored, data.backend.capabilities.offlinePc])
  if (section === 'wine')
    return (
      <SettingsCard
        title="Xbox-compatible Wine"
        description="Manage the Wine build with Xbox GDK and Microsoft Store support."
      >
        <SettingRow
          label={data.runtime.name || 'Xbox runtime not installed'}
          description={
            data.runtime.winePath ||
            'Select an existing installation or install the verified Xbox runtime.'
          }
        >
          <span>{data.runtime.installed ? 'Installed' : 'Not installed'}</span>
        </SettingRow>
        {data.runtime.error && (
          <Alert variant="error">{data.runtime.error}</Alert>
        )}
        {data.runtime.nexusError && (
          <Alert variant="warning">{data.runtime.nexusError}</Alert>
        )}
        {data.runtime.phase && <p role="status">{data.runtime.phase}</p>}
        <div className="XboxActions">
          <Button
            variant="secondary"
            disabled={data.runtime.nexusChecking || data.runtime.updating}
            onClick={() => action(() => api().checkNexusRuntime())}
          >
            Check for updates
          </Button>
          <Button
            disabled={
              data.runtime.updating ||
              !nexusRuntimeUpdateAvailable(data.runtime)
            }
            onClick={() => action(() => api().installNexusRuntime())}
          >
            {data.runtime.installed
              ? 'Update Xbox-compatible Wine'
              : 'Install Xbox-compatible Wine'}
          </Button>
          <Button
            variant="ghost"
            disabled={data.runtime.updating}
            onClick={() => action(() => api().checkRuntimeUpdate())}
          >
            Check upstream snapshots
          </Button>
          {data.runtime.artifactAvailable && (
            <Button
              variant="secondary"
              disabled={data.runtime.updating}
              onClick={() => action(() => api().installRuntime())}
            >
              Install upstream snapshot
            </Button>
          )}
          {/-xgamesave-pr28-/.test(data.runtime.name || '') && (
            <Button
              variant="ghost"
              onClick={() => action(() => api().rollbackRuntimePreview())}
            >
              Restore stable runtime
            </Button>
          )}
        </div>
      </SettingsCard>
    )
  if (section === 'runtime')
    return (
      <>
        <SettingsCard
          title="Xbox game runtime"
          description="Xbox account, licensing and game services used by Microsoft Store games."
        >
          <SettingRow
            label="Xbox services"
            description={
              data.backend.version
                ? `Version ${data.backend.version}`
                : data.backend.blockReason || 'No compatible backend installed.'
            }
          >
            <span>{data.backend.available ? 'Ready' : 'Unavailable'}</span>
          </SettingRow>
          <SettingRow
            label="Xbox-compatible Wine"
            description={data.runtime.name || 'Not installed'}
          >
            <Button
              variant="secondary"
              onClick={() => navigate('/wine-manager?repository=xbox')}
            >
              Manage in Wine Manager
            </Button>
          </SettingRow>
          {data.backend.phase && <p role="status">{data.backend.phase}</p>}
          <div className="XboxActions">
            <Button
              variant="secondary"
              onClick={() => action(() => api().checkBackendUpdate())}
            >
              Check service updates
            </Button>
            <Button
              disabled={data.backend.updating || !data.backend.releaseAvailable}
              onClick={() => action(() => api().updateBackend())}
            >
              {data.backend.available
                ? 'Update Xbox services'
                : 'Install Xbox services'}
            </Button>
          </div>
        </SettingsCard>
      </>
    )
  if (section === 'account')
    return (
      <SettingsCard
        title="Xbox / Microsoft account"
        description="Sign in to access your owned games, Game Pass library and Xbox friends."
      >
        <SettingRow
          label={
            data.auth.gamertag || data.auth.username || 'Microsoft account'
          }
          description={data.auth.note}
        >
          <span>
            {data.auth.running
              ? 'Signing in…'
              : data.auth.stored
                ? 'Signed in'
                : 'Signed out'}
          </span>
        </SettingRow>
        <div className="XboxActions">
          <Button
            disabled={!data.backend.capabilities.login || data.auth.running}
            onClick={() => action(() => api().login())}
          >
            {data.auth.stored ? 'Sign in again' : 'Sign in to Xbox'}
          </Button>
          <Button
            variant="secondary"
            disabled={data.auth.running}
            onClick={() => action(() => api().refreshAccount())}
          >
            Refresh account
          </Button>
          {data.auth.stored && (
            <Button
              variant="ghost"
              disabled={data.auth.running}
              onClick={() => action(() => api().logout())}
            >
              Sign out
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() =>
              action(async () => {
                const result = await api().checkKeyring()
                setWallet(result.message)
              })
            }
          >
            Check system wallet
          </Button>
        </div>
        {wallet && (
          <Alert variant="info">
            {wallet}
            <div className="XboxActions">
              <Button
                variant="secondary"
                onClick={() =>
                  action(async () =>
                    setWallet((await api().startKeyring()).message)
                  )
                }
              >
                Start system wallet
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  action(async () =>
                    setWallet((await api().createKeyringCollection()).message)
                  )
                }
              >
                Create wallet collection
              </Button>
            </div>
          </Alert>
        )}
        {offline && (
          <>
            <ToggleSwitch
              htmlId="xbox-offline-permissions"
              title="Xbox offline permissions for this PC"
              value={offline.enabled}
              description="Microsoft limits how often the designated offline PC can be changed."
              handleChange={() =>
                action(async () =>
                  setOffline(
                    await api().setOfflinePermissions(!offline.enabled)
                  )
                )
              }
            />
            <p>
              {offline.remainingToggles === undefined
                ? ''
                : `${offline.remainingToggles} changes remaining`}
            </p>
          </>
        )}
      </SettingsCard>
    )
  if (section === 'overlays')
    return (
      <SettingsCard title="Xbox Game Bar">
        <ToggleSwitch
          htmlId="xbox-guide-enabled"
          title="Enable Xbox guide"
          description="Access friends, chat, parties and game invitations while playing Xbox games."
          value={data.settings.overlayEnabled}
          handleChange={(event) =>
            action(() =>
              api().updateSettings({ overlayEnabled: event.target.checked })
            )
          }
        />
        <TextInputField
          htmlId="xbox-guide-shortcut"
          label="Xbox guide shortcut"
          value={shortcut}
          onChange={setShortcut}
          afterInput={
            <Button
              variant="secondary"
              onClick={() =>
                action(() =>
                  api().updateSettings({ overlayShortcut: shortcut })
                )
              }
            >
              Save shortcut
            </Button>
          }
        />
        <SettingRow label="Guide position">
          <Button
            variant="secondary"
            onClick={() =>
              action(() =>
                api().updateSettings({
                  overlaySide:
                    data.settings.overlaySide === 'right' ? 'left' : 'right'
                })
              )
            }
          >
            {data.settings.overlaySide || 'left'}
          </Button>
        </SettingRow>
        {data.overlayShortcut?.message && (
          <Alert variant="info">{data.overlayShortcut.message}</Alert>
        )}
      </SettingsCard>
    )
  if (section === 'advanced')
    return (
      <SettingsCard title="Xbox diagnostics">
        <ToggleSwitch
          htmlId="xbox-verbose-logs"
          title="Verbose Xbox game logs"
          value={data.settings.verboseLogs}
          handleChange={(event) =>
            action(() =>
              api().updateSettings({ verboseLogs: event.target.checked })
            )
          }
        />
        <SettingRow
          label="Xbox backend"
          description={data.backend.binaryPath || 'Unavailable'}
        >
          <Button
            variant="secondary"
            onClick={() => action(() => api().rebuildBackend())}
          >
            Build from source
          </Button>
        </SettingRow>
        <div className="XboxActions">
          <Button
            variant="secondary"
            onClick={() =>
              action(async () => {
                const report = await api().createDiagnosticReport()
                await api().saveDiagnosticReport(report.content)
              })
            }
          >
            Save diagnostic report
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              action(async () => {
                const log = await api().readBackendDiagnosticLog()
                await navigator.clipboard.writeText(log.content)
              })
            }
          >
            Copy backend log
          </Button>
        </div>
      </SettingsCard>
    )
  return null
}

export function XboxDownloads({
  data,
  action
}: {
  data: AppSnapshot
  action: XboxAction
}) {
  const [cancel, setCancel] = useState<{
    id: string
    deleteAllowed: boolean
    reason?: string
  }>()
  return (
    <SettingsCard
      title="Xbox downloads"
      description="Microsoft Store installations, updates and additional content."
    >
      {!data.downloads.length && <p>No Xbox downloads in the queue.</p>}
      {data.downloads.map((task) => (
        <Panel key={task.id}>
          <SettingRow label={task.title} description={task.error || task.phase}>
            <span>
              {task.progress === undefined || task.progress === null
                ? task.status
                : `${Math.round(task.progress)}%`}
            </span>
          </SettingRow>
          {task.progress !== undefined && task.progress !== null && (
            <progress
              aria-label={`${task.title} download`}
              value={task.progress}
              max={100}
            />
          )}
          <div className="XboxActions">
            {task.status === 'running' && task.canPause && (
              <Button
                variant="secondary"
                onClick={() => action(() => api().pauseDownload(task.id))}
              >
                Pause
              </Button>
            )}
            {['paused', 'failed'].includes(task.status) && (
              <Button
                variant="secondary"
                onClick={() => action(() => api().resumeDownload(task.id))}
              >
                Resume
              </Button>
            )}
            {['running', 'paused', 'queued'].includes(task.status) ? (
              <Button
                variant="ghost"
                onClick={() =>
                  action(async () => {
                    const options = await api().getDownloadCancelOptions(
                      task.id
                    )
                    setCancel({
                      id: task.id,
                      deleteAllowed: options.deleteFilesAllowed,
                      reason: options.reason
                    })
                  })
                }
              >
                Cancel
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => action(() => api().removeDownload(task.id))}
              >
                Remove from history
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => action(() => api().openPath(task.destination))}
            >
              Open folder
            </Button>
          </div>
        </Panel>
      ))}
      {data.downloads.some((task) =>
        ['complete', 'failed', 'cancelled'].includes(task.status)
      ) && (
        <Button
          variant="ghost"
          onClick={() => action(() => api().clearFinishedDownloads())}
        >
          Clear finished downloads
        </Button>
      )}
      {cancel && (
        <Modal onClose={() => setCancel(undefined)} showCloseButton>
          <ModalHeader>Cancel Xbox download</ModalHeader>
          <ModalContent>
            <p>
              Keep downloaded files to resume later, or remove the partial
              download.
            </p>
            {cancel.reason && <p>{cancel.reason}</p>}
            <div className="XboxActions">
              <Button
                onClick={() => {
                  action(() => api().cancelDownload(cancel.id, 'keep'))
                  setCancel(undefined)
                }}
              >
                Cancel and keep files
              </Button>
              <Button
                variant="secondary"
                disabled={!cancel.deleteAllowed}
                onClick={() => {
                  action(() => api().cancelDownload(cancel.id, 'delete-files'))
                  setCancel(undefined)
                }}
              >
                Cancel and delete partial files
              </Button>
            </div>
          </ModalContent>
        </Modal>
      )}
    </SettingsCard>
  )
}

export function XboxLibrary({
  data,
  store = false,
  action
}: {
  data: AppSnapshot
  store?: boolean
  action: XboxAction
}) {
  const [parameters] = useSearchParams()
  const requestedGame = parameters.get('game')
  const [kind, setKind] = useState(store ? 'store' : 'installed')
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [cursor, setCursor] = useState<string>()
  const [loading, setLoading] = useState(false)
  const requestGeneration = useRef(0)
  const [selected, setSelected] = useState<Game>()
  useEffect(() => {
    if (requestedGame)
      setSelected(data.games.find((game) => game.id === requestedGame))
  }, [requestedGame, data.games])
  const [offer, setOffer] = useState<CatalogProduct>()
  const [plan, setPlan] = useState<InstallPlan>()
  const [choice, setChoice] = useState('')
  const [destination, setDestination] = useState(data.settings.installRoot)
  const [searchError, setSearchError] = useState<string>()
  const [submittedQuery, setSubmittedQuery] = useState('')
  async function load(more = false) {
    const generation = ++requestGeneration.current
    const search = query.trim()
    setLoading(true)
    setSearchError(undefined)
    try {
      const value =
        kind === 'store'
          ? search
            ? await api().searchCatalog(search, more ? cursor : undefined)
            : await api().getFeaturedCatalog()
          : await api().getAccountLibrary(
              kind === 'gamepass' ? 'gamepass' : 'owned',
              more ? cursor : undefined
            )
      if (generation !== requestGeneration.current) return
      setProducts((previous) =>
        more ? [...previous, ...value.products] : value.products
      )
      setSubmittedQuery(search)
      setCursor(value.cursor)
    } catch (error) {
      if (generation === requestGeneration.current)
        setSearchError(String(error))
    } finally {
      if (generation === requestGeneration.current) setLoading(false)
    }
  }
  useEffect(() => {
    requestGeneration.current++
    setCursor(undefined)
    setSearchError(undefined)
    if (kind === 'installed') {
      setLoading(false)
      return
    }
    if (kind === 'store' && query.trim().length === 1) {
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(
      () => {
        void load()
      },
      query.trim() ? 350 : 0
    )
    return () => {
      clearTimeout(timer)
      requestGeneration.current++
    }
  }, [
    kind,
    kind === 'store' ? query : '',
    data.auth.username,
    data.settings.market
  ])
  function install(product: CatalogProduct) {
    action(async () => {
      const result = await api().getInstallPlan(
        product.productId,
        data.settings.installRoot
      )
      setOffer(product)
      setPlan(result)
      setChoice(result.choices.find((item) => item.supported)?.contentId || '')
      setDestination(data.settings.installRoot)
    })
  }
  const games = data.games.filter((game) =>
    game.title.toLowerCase().includes(query.toLowerCase())
  )
  const rows =
    kind === 'store'
      ? submittedQuery === query.trim()
        ? products
        : []
      : products.filter((product) =>
          product.title.toLowerCase().includes(query.trim().toLowerCase())
        )
  return (
    <section className="XboxLibrary">
      <PageHeader
        title={store ? 'Xbox & Microsoft Store' : 'Xbox library'}
        description={
          store
            ? 'Browse Windows PC games from Microsoft Store.'
            : 'Owned games, Game Pass and imported Xbox installations.'
        }
        actions={
          !store && (
            <>
              <Button
                variant="secondary"
                onClick={() => action(() => api().importGame())}
              >
                Import Xbox game folder
              </Button>
              <Button onClick={() => action(() => api().importExecutable())}>
                Add Windows executable
              </Button>
            </>
          )
        }
      />
      {
        <Tabs
          aria-label="Xbox library filters"
          items={[
            ...(store
              ? [{ value: 'store', label: 'Browse Store' }]
              : [{ value: 'installed', label: 'Installed' }]),
            { value: 'owned', label: 'Owned' },
            { value: 'gamepass', label: 'Game Pass' }
          ]}
          value={kind}
          onChange={setKind}
        />
      }
      <form
        className="XboxSearch"
        onSubmit={(event) => {
          event.preventDefault()
          if (kind !== 'installed') void load()
        }}
      >
        <TextInputField
          htmlId="xbox-game-search"
          aria-label="Search Xbox games"
          placeholder="Search Xbox games"
          value={query}
          onChange={setQuery}
        />
        <Button type="submit" variant="secondary" disabled={loading}>
          Search
        </Button>
        {kind === 'installed' && (
          <Button
            variant="ghost"
            onClick={() => action(() => api().checkGameUpdates())}
          >
            Check game updates
          </Button>
        )}
      </form>
      {searchError && (
        <Alert variant="error">
          {searchError}
          <Button variant="ghost" onClick={() => void load()}>
            Retry
          </Button>
        </Alert>
      )}
      {kind === 'store' && query.trim().length === 1 && (
        <p role="status">Enter at least two characters to search.</p>
      )}
      {loading && <p role="status">Searching Xbox games…</p>}
      {!loading && !searchError && kind === 'store' && rows.length === 0 && (
        <p role="status">
          {submittedQuery
            ? `No games found for “${submittedQuery}”.`
            : 'No games available.'}
        </p>
      )}
      <div className="XboxGameGrid" aria-busy={loading}>
        {kind === 'installed'
          ? games.map((game) => (
              <Panel key={game.id} className="XboxGameCard">
                {(game.coverUrl || game.coverDataUrl) && (
                  <img
                    src={game.coverUrl || game.coverDataUrl}
                    alt=""
                    loading="lazy"
                  />
                )}
                <h3>{game.title}</h3>
                <p>
                  {game.sideloaded
                    ? 'Imported Windows game'
                    : 'Xbox / Microsoft Store'}
                </p>
                <div className="XboxActions">
                  <Button
                    disabled={
                      game.installState !== 'ready' ||
                      data.gameOperation?.status === 'preparing' ||
                      data.gameOperation?.status === 'running'
                    }
                    onClick={() => action(() => api().launchGame(game.id))}
                  >
                    Play
                  </Button>
                  <Button variant="secondary" onClick={() => setSelected(game)}>
                    Details & settings
                  </Button>
                </div>
                {data.gameUpdates?.[game.id]?.available && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      action(() => api().updateInstalledGame(game.id))
                    }
                  >
                    Update available
                  </Button>
                )}
              </Panel>
            ))
          : rows.map((product) => (
              <Panel key={product.productId} className="XboxGameCard">
                {product.posterUrl && (
                  <img src={product.posterUrl} alt="" loading="lazy" />
                )}
                <h3>{product.title}</h3>
                <p>
                  {product.includedWith ||
                    product.purchasePrice ||
                    product.publisher}
                </p>
                <div className="XboxActions XboxStoreActions">
                  <Button
                    size="sm"
                    disabled={
                      !data.auth.stored ||
                      product.installability === 'unsupported'
                    }
                    onClick={() => install(product)}
                  >
                    Install
                  </Button>
                  {product.storeUrl && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        window.api.openWebviewPage(product.storeUrl!)
                      }
                    >
                      View in Store
                    </Button>
                  )}
                </div>
              </Panel>
            ))}
      </div>
      {kind === 'installed' && !games.length && (
        <Panel>
          No installed Xbox games. Import a game folder or browse your owned
          library.
        </Panel>
      )}
      {cursor && (
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => load(true)}
        >
          Load more games
        </Button>
      )}
      {data.gameOperation &&
        ['preparing', 'running', 'stopping', 'failed'].includes(
          data.gameOperation.status
        ) && (
          <SettingsCard title={data.gameOperation.title}>
            <p>{data.gameOperation.error || data.gameOperation.phase}</p>
            {data.gameOperation.cloudSaveWarning && (
              <Alert variant="warning">
                {data.gameOperation.cloudSaveWarning}
              </Alert>
            )}
            {data.gameOperation.status !== 'failed' && (
              <Button
                variant="secondary"
                onClick={() => action(() => api().cancelGame())}
              >
                Stop game
              </Button>
            )}
          </SettingsCard>
        )}
      {selected && (
        <XboxGameDialog
          data={data}
          game={data.games.find((game) => game.id === selected.id) || selected}
          action={action}
          close={() => setSelected(undefined)}
        />
      )}
      {plan && offer && (
        <Modal onClose={() => setPlan(undefined)} size="lg" showCloseButton>
          <ModalHeader>Install {offer.title}</ModalHeader>
          <ModalContent>
            <p>
              Select a supported Windows PC package. Xbox services verify your
              entitlement before downloading.
            </p>
            {plan.choices.map((item) => (
              <SettingRow
                key={item.contentId}
                label={item.title}
                description={`${item.platform} · ${item.packageFormat}${item.installBytes ? ' · ' + (item.installBytes / 1073741824).toFixed(1) + ' GiB' : ''}`}
              >
                <input
                  aria-label={`Install package ${item.title}`}
                  type="radio"
                  name="xbox-package"
                  disabled={!item.supported}
                  checked={choice === item.contentId}
                  onChange={() => setChoice(item.contentId)}
                />
              </SettingRow>
            ))}
            <TextInputField
              htmlId="xbox-install-destination"
              label="Installation folder"
              value={destination}
              onChange={setDestination}
              afterInput={
                <Button
                  variant="secondary"
                  onClick={() =>
                    action(async () => {
                      const path = await api().chooseDirectory(destination)
                      if (path) setDestination(path)
                    })
                  }
                >
                  Browse
                </Button>
              }
            />
            {plan.availableBytes !== undefined && (
              <p>
                {(plan.availableBytes / 1073741824).toFixed(1)} GiB available
              </p>
            )}
            <Button
              disabled={!choice || plan.status === 'unavailable'}
              onClick={() => {
                action(() =>
                  api().startInstall({
                    productId: offer.productId,
                    title: offer.title,
                    destination,
                    selectedContentId: choice,
                    selectionMarket: plan.market
                  })
                )
                setPlan(undefined)
              }}
            >
              Install selected package
            </Button>
          </ModalContent>
        </Modal>
      )}
    </section>
  )
}

export function XboxGameDialog({
  data,
  game,
  action,
  close,
  initialView = 'overview'
}: {
  data: AppSnapshot
  game: Game
  action: XboxAction
  close: () => void
  initialView?: import('./library-projection').XboxGameView
}) {
  const [tab, setTab] = useState<
    'overview' | 'logs' | 'achievements' | 'content'
  >(
    initialView === 'uninstall' || initialView === 'settings'
      ? 'overview'
      : initialView
  )
  const [details, setDetails] = useState<GameStoreDetails>()
  const [achievements, setAchievements] = useState<GameAchievements>()
  const [content, setContent] = useState<GameContentPlan>()
  const [removing, setRemoving] = useState(initialView === 'uninstall')
  const [log, setLog] =
    useState<import('../../../integrations/xbox/shared/types').DiagnosticLog>()
  const [logError, setLogError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const [logUpdatedAt, setLogUpdatedAt] = useState<string>()
  const logElement = useRef<HTMLPreElement>(null)
  const followLog = useRef(true)
  const [copyError, setCopyError] = useState<string>()
  const [expandedDescription, setExpandedDescription] = useState(false)
  const [showAllScreenshots, setShowAllScreenshots] = useState(false)
  const [failedImages, setFailedImages] = useState<string[]>([])
  const screenshots = [...new Set(details?.screenshots || [])].filter(
    (url) => !failedImages.includes(url)
  )
  const hero = details?.heroUrl || game.heroUrl || screenshots[0]
  const discardImage = (url: string) =>
    setFailedImages((previous) =>
      previous.includes(url) ? previous : [...previous, url]
    )
  async function copyLog() {
    if (!log) return
    setCopyError(undefined)
    try {
      await navigator.clipboard.writeText(log.content)
      setCopied(true)
    } catch (error) {
      setCopyError(`Could not copy log: ${String(error)}`)
    }
  }
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])
  useEffect(() => {
    if (tab !== 'logs') return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    setLog(undefined)
    setLogError(undefined)
    followLog.current = true
    async function refresh() {
      try {
        const value = await api().readGameDiagnosticLog(game.id)
        if (!active) return
        setLog((previous) =>
          previous?.name === value.name &&
          previous.content === value.content &&
          previous.truncated === value.truncated
            ? previous
            : value
        )
        setLogError(undefined)
        setLogUpdatedAt(new Date().toLocaleTimeString())
      } catch (error) {
        if (active) setLogError(String(error))
      } finally {
        if (active) timer = setTimeout(() => void refresh(), 1000)
      }
    }
    void refresh()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [tab, game.id])
  useEffect(() => {
    const element = logElement.current
    if (element && followLog.current) element.scrollTop = element.scrollHeight
  }, [log])
  const [screenshot, setScreenshot] = useState<string>()
  const [playTime, setPlayTime] = useState<string>()
  const [cloud, setCloud] = useState<string>()
  useEffect(() => {
    let active = true
    void api()
      .getGameDetails(game.id)
      .then((value) => {
        if (active) setDetails(value)
      })
      .catch(() => {})
    void api()
      .getGameActivity(game.id)
      .then((value) => {
        if (active && value.minutesPlayed !== undefined)
          setPlayTime(`${Math.round(value.minutesPlayed)} minutes played`)
      })
      .catch(() => {})
    void api()
      .getGameLaunchOptions(game.id)
      .then((value) => {
        if (active)
          setCloud(
            value.cloudSaves ? 'Cloud saves supported' : value.cloudReason
          )
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [game.id])
  useEffect(() => {
    if (tab === 'achievements')
      action(async () =>
        setAchievements(await api().getGameAchievements(game.id))
      )
    if (tab === 'content')
      action(async () => setContent(await api().getGameContent(game.id)))
  }, [tab, game.id, action])
  return (
    <Modal
      onClose={close}
      size="lg"
      showCloseButton
      className="XboxGameDetailsModal"
    >
      <ModalHeader>{game.title}</ModalHeader>
      <ModalContent className="XboxGameDetails">
        <Tabs
          aria-label="Xbox game details"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'achievements', label: 'Achievements' },
            { value: 'content', label: 'Additional content' },
            { value: 'logs', label: 'Logs' }
          ]}
        />
        {tab === 'logs' && (
          <section className="XboxDetailPane" aria-label="Game logs">
            {logError && <Alert variant="error">{logError}</Alert>}
            {!log && !logError && <p role="status">Loading game log…</p>}
            {copyError && <Alert variant="error">{copyError}</Alert>}
            {log && (
              <>
                <div className="XboxDetailToolbar">
                  <div>
                    <h3>Launch log</h3>
                    <p>
                      {log.name}
                      {log.truncated ? ' · Latest 1,000 lines' : ''}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => void copyLog()}>
                    {copied
                      ? 'Copied'
                      : log.truncated
                        ? 'Copy displayed log'
                        : 'Copy log'}
                  </Button>
                </div>
                <pre
                  ref={logElement}
                  onScroll={(event) => {
                    const element = event.currentTarget
                    followLog.current =
                      element.scrollHeight -
                        element.scrollTop -
                        element.clientHeight <
                      40
                  }}
                  className="XboxDetailLog"
                  tabIndex={0}
                  aria-label="Selectable game log"
                >
                  {log.content || 'No log output yet.'}
                </pre>
                <span role="status" className="XboxCopyStatus">
                  {copied
                    ? 'Log copied to clipboard.'
                    : `Live · Refreshes every second${logUpdatedAt ? ` · Updated ${logUpdatedAt}` : ''}`}
                </span>
              </>
            )}
          </section>
        )}
        {tab === 'overview' && (
          <section
            className="XboxDetailPane XboxOverview"
            aria-label="Game overview"
          >
            <div className="XboxOverviewHero">
              {hero && !failedImages.includes(hero) && (
                <img
                  className="XboxOverviewArt"
                  src={hero}
                  alt=""
                  onError={() => discardImage(hero)}
                />
              )}
              <div className="XboxOverviewHeroContent">
                <span className="XboxOverviewEyebrow">
                  Xbox · Microsoft Store
                </span>
                <h2>{game.title}</h2>
                {details?.publisher && <p>{details.publisher}</p>}
                <div className="XboxOverviewPrimary">
                  <Button
                    disabled={
                      game.installState !== 'ready' ||
                      ['running', 'preparing', 'stopping'].includes(
                        data.gameOperation?.status || ''
                      )
                    }
                    onClick={() => action(() => api().launchGame(game.id))}
                  >
                    Play
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      close()
                      useGlobalState
                        .getState()
                        .openGameSettingsModal(projectXboxGame(game))
                    }}
                  >
                    Game settings
                  </Button>
                </div>
              </div>
            </div>
            {(playTime || cloud) && (
              <div className="XboxOverviewFacts">
                {playTime && <span>{playTime}</span>}
                {cloud && <span>{cloud}</span>}
              </div>
            )}
            {screenshots.length > 0 && (
              <section className="XboxOverviewGallery" aria-label="Screenshots">
                <h3>Screenshots</h3>
                <div className="XboxDetailScreenshots">
                  {screenshots
                    .slice(0, showAllScreenshots ? undefined : 6)
                    .map((url, index) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setScreenshot(url)}
                        aria-label={`View screenshot ${index + 1}`}
                      >
                        <img
                          src={url}
                          alt={`${game.title} screenshot ${index + 1}`}
                          loading="lazy"
                          onError={() => discardImage(url)}
                        />
                        <span>View screenshot</span>
                      </button>
                    ))}
                </div>
                {screenshots.length > 6 && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowAllScreenshots((value) => !value)}
                  >
                    {showAllScreenshots
                      ? 'Show fewer screenshots'
                      : `Show all screenshots (${screenshots.length})`}
                  </Button>
                )}
              </section>
            )}
            {details?.description && (
              <section className="XboxOverviewAbout">
                <h3>About this game</h3>
                <p
                  className={
                    expandedDescription || details.description.length <= 500
                      ? ''
                      : 'XboxDescriptionClamped'
                  }
                >
                  {details.description}
                </p>
                {details.description.length > 500 && (
                  <Button
                    variant="ghost"
                    onClick={() => setExpandedDescription((value) => !value)}
                  >
                    {expandedDescription ? 'Show less' : 'Read more'}
                  </Button>
                )}
              </section>
            )}
            <section className="XboxOverviewManagement">
              <h3>Manage game</h3>
              <SettingRow label="Game folder" description={game.path}>
                <Button
                  variant="secondary"
                  onClick={() => action(() => api().openPath(game.path))}
                >
                  Open folder
                </Button>
              </SettingRow>
              <div className="XboxDetailActions">
                <Button
                  variant="secondary"
                  onClick={() =>
                    action(() => api().updateInstalledGame(game.id))
                  }
                >
                  Check / install update
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    action(() => api().installGameVcRuntime(game.id))
                  }
                >
                  Install Visual C++ runtime
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    action(() =>
                      api().createGameShortcut(game.id, 'applications')
                    )
                  }
                >
                  Create application shortcut
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    action(() => api().createGameShortcut(game.id, 'desktop'))
                  }
                >
                  Create desktop shortcut
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => action(() => api().addToSteam(game.id))}
                >
                  Add to Steam
                </Button>
              </div>
              <div className="XboxOverviewDanger">
                <Button variant="ghost" onClick={() => setRemoving(true)}>
                  Uninstall…
                </Button>
              </div>
            </section>
            {screenshot && (
              <Modal
                onClose={() => setScreenshot(undefined)}
                size="lg"
                showCloseButton
                className="XboxScreenshotModal"
              >
                <ModalHeader>{game.title} screenshot</ModalHeader>
                <ModalContent>
                  <img
                    src={screenshot}
                    alt="Game screenshot"
                    className="XboxDetailFullScreenshot"
                  />
                </ModalContent>
              </Modal>
            )}
          </section>
        )}
        {tab === 'achievements' && (
          <section
            className="XboxDetailPane XboxDetailList"
            aria-label="Achievements"
          >
            <Button
              variant="ghost"
              onClick={() =>
                action(async () =>
                  setAchievements(
                    await api().getGameAchievements(game.id, true)
                  )
                )
              }
            >
              Refresh achievements
            </Button>
            {achievements?.status !== 'available' && (
              <p>
                {achievements
                  ? `Achievements ${achievements.status}`
                  : 'Loading achievements…'}
              </p>
            )}
            {achievements?.partial && (
              <Alert variant="warning">
                Xbox returned a partial achievement list.
              </Alert>
            )}
            {achievements?.status === 'available' &&
              achievements.items?.length === 0 && (
                <p>No achievements available for this game.</p>
              )}
            {achievements?.items?.map((item) => (
              <SettingRow
                key={item.id}
                label={item.name}
                description={
                  item.secret && item.state !== 'unlocked'
                    ? 'Secret achievement'
                    : item.description
                }
              >
                <span>
                  {item.state}{' '}
                  {item.gamerscore === undefined
                    ? ''
                    : `· ${item.gamerscore} G`}
                </span>
              </SettingRow>
            ))}
          </section>
        )}
        {tab === 'content' && (
          <section
            className="XboxDetailPane XboxDetailList"
            aria-label="Additional content"
          >
            {!content && <p role="status">Loading additional content…</p>}
            {content && content.items.length === 0 && (
              <p>No additional content available for this game.</p>
            )}
            {content?.items.map((item) => (
              <SettingRow
                key={item.productId}
                label={item.title}
                description={item.note}
              >
                <Button
                  variant="secondary"
                  disabled={!['available', 'verify'].includes(item.status)}
                  onClick={() =>
                    action(() =>
                      api().installGameContent(game.id, item.productId)
                    )
                  }
                >
                  {item.status === 'installed' ? 'Installed' : 'Install'}
                </Button>
              </SettingRow>
            ))}
          </section>
        )}
        {removing && (
          <Modal
            onClose={() => setRemoving(false)}
            tone="destructive"
            showCloseButton
          >
            <ModalHeader>Remove {game.title}</ModalHeader>
            <ModalContent>
              <p>{game.path}</p>
              <p>
                Remove the library entry, or uninstall the game and delete its
                files.
              </p>
              <div className="XboxActions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    action(() => api().removeGame(game.id, 'library'))
                    setRemoving(false)
                    close()
                  }}
                >
                  Remove from library
                </Button>
                <Button
                  onClick={() => {
                    action(() => api().removeGame(game.id, 'delete-files'))
                    setRemoving(false)
                    close()
                  }}
                >
                  Uninstall and delete game files
                </Button>
              </div>
            </ModalContent>
          </Modal>
        )}
      </ModalContent>
    </Modal>
  )
}
