import { faXbox } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  NotificationBell,
  useNotifications
} from '../../../integrations/xbox/renderer/Notifications'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  XboxSetup,
  XboxDownloads,
  XboxLibrary,
  XboxGameDialog
} from './NativeSections'
import { emptySnapshot } from './empty-state'
import { XboxSocial } from '../../../integrations/xbox/renderer/XboxSocial'
import type {
  AppSnapshot,
  Settings,
  XboxProfileRequest
} from '../../../integrations/xbox/shared/types'
import {
  Alert,
  Button,
  PageHeader,
  SettingsCard,
  TextInputField,
  Panel
} from 'frontend/components/UI'
import { i18n } from '../../../integrations/xbox/renderer/i18n'
import './content.scss'

let current: AppSnapshot | undefined
let failure: string | undefined
let pending: Promise<void> | undefined
const subscribers = new Set<() => void>()
let subscribed = false
const notify = () => subscribers.forEach((update) => update())
function load() {
  if (!subscribed) {
    subscribed = true
    window.launcher.onSnapshot((value) => {
      current = value
      failure = undefined
      notify()
    })
  }
  pending ??= window.launcher
    .getSnapshot()
    .then((value) => {
      current = value
      failure = undefined
    })
    .catch((error) => {
      failure = String(error)
    })
    .finally(() => {
      pending = undefined
      notify()
    })
}
export function useXboxSnapshot() {
  const [, update] = useState(0)
  useEffect(() => {
    if (window.platform !== 'linux') return
    const change = () => update((value) => value + 1)
    subscribers.add(change)
    if (!current) load()
    return () => {
      subscribers.delete(change)
    }
  }, [])
  return { data: current, error: failure }
}
export type XboxSection =
  | 'library'
  | 'store'
  | 'downloads'
  | 'account'
  | 'runtime'
  | 'wine'
  | 'overlays'
  | 'advanced'
  | 'social'
  | 'storage'

function Preferences({
  data,
  section,
  problem
}: {
  data: AppSnapshot
  section: XboxSection
  problem: (message: string) => void
}) {
  const fields: Array<{
    key: keyof Settings
    label: string
    directory?: boolean
    file?: boolean
    number?: boolean
  }> =
    section === 'wine'
      ? [
          {
            key: 'winePath',
            label: 'Xbox-compatible Wine executable',
            file: true
          }
        ]
      : section === 'runtime'
        ? [
            {
              key: 'runtimeRoot',
              label: 'Xbox runtime directory',
              directory: true
            }
          ]
        : section === 'downloads'
          ? [
              {
                key: 'downloadLimitMiB',
                label: 'Xbox download speed limit (MiB/s, 0 = unlimited)',
                number: true
              },
              {
                key: 'parallelDownloads',
                label: 'Xbox parallel download streams',
                number: true
              }
            ]
          : section === 'advanced'
            ? [
                {
                  key: 'externalXodusRoot',
                  label: 'External Xodus backend source',
                  directory: true
                },
                {
                  key: 'shaderCacheLimitGiB',
                  label: 'Xbox shader cache limit per game (GiB)',
                  number: true
                }
              ]
            : section === 'storage'
              ? [
                  {
                    key: 'installRoot',
                    label: 'Xbox game installation folder',
                    directory: true
                  },
                  { key: 'market', label: 'Microsoft Store market' }
                ]
              : []
  const [draft, setDraft] = useState<Partial<Settings>>({})
  const [busy, setBusy] = useState(false)
  if (!fields.length) return null
  const title =
    section === 'wine'
      ? 'Wine selection'
      : section === 'runtime'
        ? 'Runtime location'
        : section === 'downloads'
          ? 'Xbox download options'
          : section === 'storage'
            ? 'Xbox library folders'
            : 'Xbox game defaults'
  return (
    <SettingsCard title={title}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          void window.launcher
            .updateSettings(draft)
            .then(() => setDraft({}))
            .catch((error) => problem(String(error)))
            .finally(() => setBusy(false))
        }}
      >
        {fields.map((field) => (
          <TextInputField
            key={field.key}
            htmlId={'xbox-setting-' + field.key}
            label={field.label}
            type={field.number ? 'number' : 'text'}
            min={field.number ? 0 : undefined}
            step={field.number ? 'any' : undefined}
            value={String(draft[field.key] ?? data.settings[field.key] ?? '')}
            onChange={(value) =>
              setDraft((previous) => ({
                ...previous,
                [field.key]: field.number ? Number(value) : value
              }))
            }
            afterInput={
              (field.directory || field.file) && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    const path = String(
                      draft[field.key] ?? data.settings[field.key] ?? ''
                    )
                    const selection = field.file
                      ? window.launcher.chooseFile(path)
                      : window.launcher.chooseDirectory(path)
                    void selection
                      .then((path) => {
                        if (path)
                          setDraft((value) => ({ ...value, [field.key]: path }))
                      })
                      .catch((error) => problem(String(error)))
                  }}
                >
                  Browse
                </Button>
              )
            }
          />
        ))}
        <Button type="submit" disabled={busy || !Object.keys(draft).length}>
          Save Xbox settings
        </Button>
      </form>
    </SettingsCard>
  )
}

export default function XboxContent({ section }: { section: XboxSection }) {
  const { data, error } = useXboxSnapshot()
  const [query] = useSearchParams()
  const chatId = query.get('chat')
  const chat = useMemo(
    () => (chatId ? { id: Date.now(), xuid: chatId } : undefined),
    [chatId]
  )
  const [profile, setProfile] = useState<XboxProfileRequest>()
  useEffect(() => {
    if (section !== 'social') return
    void window.launcher
      .getXboxDesktopProfile()
      .then(setProfile)
      .catch(() => {})
    return window.launcher.onXboxDesktopProfile(setProfile)
  }, [section])
  const notices = useNotifications(data ?? emptySnapshot)
  const [message, setMessage] = useState<{ kind: string; message: string }>()
  const language = data?.settings.interfaceLanguage
  const action = useCallback((operation: () => Promise<unknown>) => {
    void operation().catch((error) =>
      setMessage({ kind: 'error', message: String(error) })
    )
  }, [])
  useEffect(() => {
    if (!language) return
    void i18n.changeLanguage(document.documentElement.lang || 'en')
  }, [language])

  return (
    <div className="HeroicXbox" data-xbox-section={section}>
      {error && (
        <Alert variant="error">
          {error}
          <Button onClick={() => load()}>Retry Xbox initialization</Button>
        </Alert>
      )}
      {!data && !error && <p role="status">Loading Xbox services…</p>}
      {message && (
        <Alert variant={message.kind === 'error' ? 'error' : 'info'}>
          {message.message}
          <Button variant="ghost" onClick={() => setMessage(undefined)}>
            Dismiss
          </Button>
        </Alert>
      )}
      {data && (
        <>
          {['account', 'runtime', 'wine', 'overlays', 'advanced'].includes(
            section
          ) && <XboxSetup data={data} section={section} action={action} />}
          {(section === 'library' || section === 'store') && (
            <XboxLibrary
              data={data}
              store={section === 'store'}
              action={action}
            />
          )}
          {section === 'downloads' && (
            <XboxDownloads data={data} action={action} />
          )}
          {section === 'social' && (
            <>
              <div className="XboxPageHeading">
                <span className="XboxPageMark">
                  <FontAwesomeIcon icon={faXbox} />
                </span>
                <PageHeader
                  title="Xbox"
                  description="Friends, messages and parties"
                />
              </div>
              <Panel className="XboxSocialPanel">
                <XboxSocial
                  desktop
                  auth={data.auth}
                  api={window.launcher.nativeSocial}
                  voice={window.launcher}
                  runtimeInvites={data.social}
                  runtimeApi={window.launcher}
                  showProfile={profile}
                  openChat={chat}
                  readKeys={notices.readKeys}
                  onViewed={notices.viewed}
                />
              </Panel>
            </>
          )}
          <Preferences
            data={data}
            section={section}
            problem={(message) => setMessage({ kind: 'error', message })}
          />
        </>
      )}
    </div>
  )
}

export function XboxAccountSummary() {
  const { data } = useXboxSnapshot()
  const navigate = useNavigate()
  const notices = useNotifications(data ?? emptySnapshot)
  useEffect(
    () => window.launcher.onOpenFriends(() => navigate('/xbox/friends')),
    [navigate]
  )
  useEffect(
    () =>
      window.launcher.onXboxDesktopProfile((request) => {
        if (request) navigate('/xbox/friends')
      }),
    [navigate]
  )
  useEffect(
    () =>
      window.launcher.onLauncherPage((page) =>
        navigate(
          page === 'store'
            ? '/store/xbox'
            : page === 'settings'
              ? '/settings/runtimes'
              : '/?library=xbox'
        )
      ),
    [navigate]
  )
  return (
    <div className="HeroicXbox HeroicXbox__account">
      <button
        type="button"
        onClick={() => navigate(data?.auth.stored ? '/xbox/friends' : '/login')}
      >
        {data?.auth.avatarDataUrl && (
          <img src={data.auth.avatarDataUrl} alt="" width="28" height="28" />
        )}
        <span>{data?.auth.gamertag || 'Xbox account'}</span>
      </button>
      {data?.auth.stored && (
        <NotificationBell
          notices={notices.notices}
          failed={notices.failed}
          unsupported={notices.unsupported}
          onSelect={(notice) => {
            notices.acknowledge(notice)
            navigate(
              notice.kind === 'message'
                ? '/xbox/friends?chat=' + encodeURIComponent(notice.target)
                : '/?library=xbox&game=' + encodeURIComponent(notice.target)
            )
          }}
        />
      )}
    </div>
  )
}

export function XboxGameDetailHost() {
  const { data } = useXboxSnapshot()
  const [id, setId] = useState<string>()
  const [view, setView] =
    useState<import('./library-projection').XboxGameView>('overview')
  const [error, setError] = useState<string>()
  useEffect(() => {
    const show = (event: Event) => {
      const detail = (
        event as CustomEvent<
          | string
          | { id: string; view: import('./library-projection').XboxGameView }
        >
      ).detail
      setId(typeof detail === 'string' ? detail : detail.id)
      setView(typeof detail === 'string' ? 'overview' : detail.view)
    }
    window.addEventListener('heroic-xbox-game-details', show)
    return () => window.removeEventListener('heroic-xbox-game-details', show)
  }, [])
  const game = data?.games.find((game) => game.id === id)
  return (
    <>
      {error && <Alert variant="error">{error}</Alert>}
      {data && game && (
        <XboxGameDialog
          key={`${id}-${view}`}
          initialView={view}
          data={data}
          game={game}
          close={() => setId(undefined)}
          action={(operation) => {
            void operation().catch((error) => setError(String(error)))
          }}
        />
      )}
    </>
  )
}
