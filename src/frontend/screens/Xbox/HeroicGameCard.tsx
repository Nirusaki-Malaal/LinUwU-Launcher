import { useContext, useState } from 'react'
import { faXbox } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  MoreVertical,
  Play,
  X,
  ExternalLink,
  Settings,
  FileText,
  Pencil,
  EyeOff,
  Eye,
  Heart,
  HeartOff,
  List,
  ListX,
  Trash2,
  ArrowUpCircle
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ContextMenu, { type Item } from '../Library/components/ContextMenu'
import useGlobalState from 'frontend/state/GlobalStateV2'
import EditGameDialog from 'frontend/components/UI/EditGameDialog'
import type { GameInfo } from 'common/types'
import {
  CachedImage,
  GameActionButton,
  Icon,
  SvgButton,
  Alert
} from 'frontend/components/UI'
import ContextProvider from 'frontend/state/ContextProvider'
import { openXboxGameDetails } from './library-projection'
import { useXboxSnapshot } from './Content'
import fallback from 'frontend/assets/heroic_card.jpg'

export default function XboxHeroicGameCard({
  gameInfo,
  forceCard,
  isRecent = false,
  justPlayed = false
}: {
  gameInfo: GameInfo
  forceCard?: boolean
  justPlayed?: boolean
  isRecent?: boolean
}) {
  const { data } = useXboxSnapshot()
  const { gameOverrides } = useGlobalState.keys('gameOverrides')
  const originalGameInfo = gameInfo
  const override = gameOverrides[gameInfo.app_name]
  gameInfo = {
    ...gameInfo,
    overrides: override,
    title: override?.title || gameInfo.title,
    art_cover: override?.art_cover || gameInfo.art_cover,
    art_square: override?.art_square || gameInfo.art_square
  }
  const { activeController, hiddenGames, favouriteGames, showDialogModal } =
    useContext(ContextProvider)
  const { openGameCategoriesModal, openGameSettingsModal } =
    useGlobalState.keys('openGameCategoriesModal', 'openGameSettingsModal')
  const { t } = useTranslation()
  const [error, setError] = useState<string>()
  const id = gameInfo.xboxGameId!
  const running =
    data?.gameOperation?.gameId === id &&
    ['preparing', 'running', 'stopping'].includes(data.gameOperation.status)
  const open = () => openXboxGameDetails(id)
  const appName = gameInfo.app_name
  const hidden = hiddenGames.list.some((game) => game.appName === appName)
  const favourite = favouriteGames.list.some((game) => game.appName === appName)
  const run = (operation: () => Promise<unknown>) => {
    void operation().catch((error) => setError(String(error)))
  }
  const launch = () =>
    run(() =>
      running ? window.launcher.cancelGame() : window.launcher.launchGame(id)
    )
  const ready =
    data?.games.find((game) => game.id === id)?.installState === 'ready'
  const items: Item[] = [
    {
      label: running
        ? t('button.stop', 'Stop')
        : t('label.playing.start', 'Play'),
      icon: <Icon glyph={running ? X : Play} />,
      show: running || !!ready,
      onclick: launch
    },
    {
      label: t('button.update', 'Update'),
      icon: <Icon glyph={ArrowUpCircle} />,
      show: !!data?.gameUpdates?.[id]?.available && !running,
      onclick: () => run(() => window.launcher.updateInstalledGame(id))
    },
    {
      label: t('button.details', 'Details'),
      icon: <Icon glyph={ExternalLink} />,
      show: true,
      onclick: open
    },
    {
      label: t('submenu.settings', 'Settings'),
      icon: <Icon glyph={Settings} />,
      show: true,
      onclick: () => openGameSettingsModal(gameInfo)
    },
    {
      label: t('submenu.logs', 'Logs'),
      icon: <Icon glyph={FileText} />,
      show: true,
      onclick: () => openXboxGameDetails(id, 'logs')
    },
    {
      label: t('edit-game.title', 'Edit Game'),
      icon: <Icon glyph={Pencil} />,
      show: true,
      onclick: () =>
        showDialogModal({
          showDialog: true,
          title: t('edit-game.title', 'Edit Game'),
          message: (
            <EditGameDialog
              gameInfo={{ ...originalGameInfo, overrides: override }}
              backdropClick={() => showDialogModal({ showDialog: false })}
            />
          )
        })
    },
    {
      label: hidden
        ? t('button.unhide_game', 'Unhide Game')
        : t('button.hide_game', 'Hide Game'),
      icon: <Icon glyph={hidden ? Eye : EyeOff} />,
      show: true,
      onclick: () =>
        hidden
          ? hiddenGames.remove(appName)
          : hiddenGames.add(appName, gameInfo.title)
    },
    {
      label: favourite
        ? t('button.remove_from_favourites', 'Remove From Favourites')
        : t('button.add_to_favourites', 'Add To Favourites'),
      icon: <Icon glyph={favourite ? HeartOff : Heart} />,
      show: true,
      onclick: () =>
        favourite
          ? favouriteGames.remove(appName)
          : favouriteGames.add(appName, gameInfo.title)
    },
    {
      label: t('submenu.categories', 'Categories'),
      icon: <Icon glyph={List} />,
      show: true,
      onclick: () => openGameCategoriesModal(gameInfo)
    },
    {
      label: t('button.remove_from_recent', 'Remove From Recent'),
      icon: <Icon glyph={ListX} />,
      show: isRecent,
      onclick: () => run(() => window.api.removeRecentGame(appName))
    },
    {
      label: t('button.uninstall', 'Uninstall'),
      icon: <Icon glyph={Trash2} />,
      show: !running,
      onclick: () => openXboxGameDetails(id, 'uninstall')
    }
  ]
  return (
    <div className="gameCardWrapper" data-xbox-game={id}>
      {error && <Alert variant="error">{error}</Alert>}
      <ContextMenu items={items} className="gameCardMenu">
        <div
          className={`${forceCard ? 'gameCard' : 'gameListItem'} installed${justPlayed ? ' justPlayed' : ''}${activeController ? ' gamepad' : ''}`}
          data-app-name={gameInfo.app_name}
        >
          <a
            href="#"
            aria-label={`Details for ${gameInfo.title}`}
            onClick={(event) => {
              event.preventDefault()
              open()
            }}
          >
            <span className="StoreBadge XboxStoreBadge" aria-label="Xbox">
              <FontAwesomeIcon icon={faXbox} />
            </span>
            <CachedImage
              src={gameInfo.art_cover || fallback}
              alt={gameInfo.title}
              className={justPlayed ? 'justPlayedImg' : 'gameImg installed'}
            />
          </a>
          <div className="gameCardCaption">
            <span className="gameTitle installed">
              <span>{gameInfo.title}</span>
            </span>
            <span className="runner installed">Xbox</span>
          </div>
          <span className="icons">
            <SvgButton
              title={`Settings (${gameInfo.title})`}
              className="settingsIcon"
              onClick={(event) => {
                event.stopPropagation()
                event.currentTarget.dispatchEvent(
                  new MouseEvent('contextmenu', {
                    bubbles: true,
                    clientX: event.clientX,
                    clientY: event.clientY
                  })
                )
              }}
            >
              <Icon glyph={MoreVertical} />
            </SvgButton>
            <GameActionButton
              action={running ? 'stop' : 'play'}
              label={running ? 'Stop' : 'Play'}
              title={`${running ? 'Stop' : 'Play'} (${gameInfo.title})`}
              iconOnly
              disabled={
                !running &&
                data?.games.find((game) => game.id === id)?.installState !==
                  'ready'
              }
              onClick={() => {
                void (
                  running
                    ? window.launcher.cancelGame()
                    : window.launcher.launchGame(id)
                ).catch((error) => setError(String(error)))
              }}
            />
          </span>
        </div>
      </ContextMenu>
    </div>
  )
}
