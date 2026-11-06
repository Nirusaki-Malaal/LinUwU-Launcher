export { projectXboxGame } from 'common/xbox-library'
export type XboxGameView = 'overview' | 'settings' | 'logs' | 'uninstall'
export function openXboxGameDetails(
  id: string,
  view: XboxGameView = 'overview'
) {
  window.dispatchEvent(
    new CustomEvent('heroic-xbox-game-details', { detail: { id, view } })
  )
}
