import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, SettingsCard, Alert } from 'frontend/components/UI'
import { Gamepad2 } from 'lucide-react'
import type { NexusXboxRequest, NexusXboxSnapshot } from 'common/types/xbox'
import './index.css'

export default function Xbox() {
  const [snapshot, setSnapshot] = useState<NexusXboxSnapshot>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const mounted = useRef(true)
  const request = useCallback(async (command: NexusXboxRequest) => {
    setBusy(true)
    setError('')
    try {
      const result = await window.api.nexusXbox(command)
      if (mounted.current) setSnapshot(result)
      return result
    } catch (error) {
      if (mounted.current)
        setError(error instanceof Error ? error.message : String(error))
      return undefined
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const connected = Boolean(snapshot)
  const activeOperation = Boolean(
    snapshot?.operation &&
    ['preparing', 'running', 'stopping'].includes(snapshot.operation.status)
  )
  useEffect(() => {
    if (!connected) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (!document.hidden) {
        try {
          const result = await window.api.nexusXbox({ action: 'snapshot' })
          if (!cancelled) setSnapshot(result)
        } catch {
          /* Explicit actions report errors; polling does not erase a working library. */
        }
      }
      if (!cancelled)
        timer = setTimeout(
          () => {
            void poll()
          },
          activeOperation ? 2000 : 10000
        )
    }
    timer = setTimeout(
      () => {
        void poll()
      },
      activeOperation ? 2000 : 10000
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [connected, activeOperation])
  function setCompatibility(gameId: string, enabled: boolean) {
    const previous = snapshot
    setSnapshot((current) =>
      current
        ? {
            ...current,
            games: current.games.map((game) =>
              game.id === gameId
                ? { ...game, onlineFixCompatibility: enabled }
                : game
            )
          }
        : current
    )
    void request({ action: 'compatibility', gameId, enabled }).then(
      (result) => {
        if (!result && mounted.current) setSnapshot(previous)
      }
    )
  }
  const running =
    snapshot?.operation &&
    ['preparing', 'running', 'stopping'].includes(snapshot.operation.status)
  const games =
    snapshot?.games.filter((game) =>
      game.title.toLowerCase().includes(query.toLowerCase())
    ) ?? []
  return (
    <section className="XboxPage">
      <header>
        <div>
          <h1>Xbox</h1>
          <p>Your Xbox and sideloaded games, powered by Xodus Nexus.</p>
        </div>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => {
            void request({ action: snapshot ? 'snapshot' : 'connect' })
          }}
        >
          {busy ? 'Working…' : snapshot ? 'Refresh' : 'Connect Xodus Nexus'}
        </Button>
      </header>
      {error && <Alert variant="warning">{error}</Alert>}
      {!snapshot ? (
        <SettingsCard
          glyph={Gamepad2}
          title="Connect your Xbox library"
          description="Use your installed xodus-nexus fork and its existing Microsoft account, Xbox runtime, game library, and EXE sideloading support. Connect when you’re ready."
        >
          {null}
        </SettingsCard>
      ) : (
        <>
          <SettingsCard
            glyph={Gamepad2}
            title={snapshot.account.gamertag || 'Xbox account'}
            description={`${snapshot.account.signedIn ? 'Signed in' : 'Sign in through Nexus to play account-linked games'} · ${snapshot.runtime.installed ? snapshot.runtime.name || 'Nexus runtime installed' : 'Set up the Nexus runtime before playing'}`}
          >
            <div className="XboxPage__actions">
              <Button
                disabled={busy}
                onClick={() => {
                  void request({ action: 'show' })
                }}
              >
                Account, Store &amp; Downloads
              </Button>
              <Button
                disabled={busy || Boolean(running)}
                onClick={() => {
                  void request({ action: 'import-exe' })
                }}
              >
                Add Windows EXE
              </Button>
              {running && (
                <Button
                  variant="dangerSubtle"
                  disabled={busy}
                  onClick={() => {
                    void request({ action: 'stop' })
                  }}
                >
                  Stop game
                </Button>
              )}
            </div>
            {snapshot.operation && (
              <p role="status">
                {snapshot.operation.phase || snapshot.operation.status}
              </p>
            )}
          </SettingsCard>
          <label className="XboxPage__search">
            Search Xbox library
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a game…"
            />
          </label>
          {!games.length && (
            <p>
              No installed games yet. Install a game through Nexus or add a
              Windows EXE.
            </p>
          )}
          <div className="XboxPage__grid">
            {games.map((game) => (
              <article className="XboxPage__game" key={game.id}>
                {game.coverUrl?.startsWith('https://') ? (
                  <img src={game.coverUrl} alt="" loading="lazy" />
                ) : (
                  <Gamepad2
                    className="XboxPage__placeholder"
                    aria-hidden="true"
                  />
                )}
                <h2>{game.title}</h2>
                <p>
                  {game.sideloaded
                    ? 'Sideloaded EXE'
                    : 'Xbox / Microsoft Store'}{' '}
                  · {game.installState}
                </p>
                <Button
                  variant="primary"
                  disabled={
                    busy ||
                    Boolean(running) ||
                    game.installState === 'incomplete'
                  }
                  onClick={() => {
                    void request({ action: 'launch', gameId: game.id })
                  }}
                >
                  {snapshot.operation?.gameId === game.id && running
                    ? 'Playing…'
                    : 'Play'}
                </Button>
                <label className="XboxPage__compatibility">
                  <input
                    type="checkbox"
                    checked={game.onlineFixCompatibility}
                    disabled={busy || Boolean(running) || !game.executable}
                    onChange={(event) => {
                      setCompatibility(game.id, event.target.checked)
                    }}
                  />
                  OnlineFix compatibility
                </label>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
