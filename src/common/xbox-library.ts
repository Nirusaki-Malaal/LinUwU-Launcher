import type { GameInfo } from 'common/types'
import type { Game } from '../integrations/xbox/shared/types'
export function projectXboxGame(game: Game): GameInfo {
  return {
    runner: 'sideload',
    app_name: `xbox-${game.id}`,
    xboxGameId: game.id,
    title: game.title,
    art_cover: game.coverUrl || game.coverDataUrl || '',
    art_square: game.coverUrl || game.coverDataUrl || '',
    art_background: game.heroUrl,
    folder_name: game.path,
    install: {
      executable: game.executable,
      install_path: game.path,
      platform: 'Windows',
      is_dlc: false
    },
    is_installed: true,
    canRunOffline: false,
    thirdPartyManagedApp: 'Xbox'
  }
}
