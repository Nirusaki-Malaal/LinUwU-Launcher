import type { Game } from './types.js'

export const COMPATIBILITY_DLL_OVERRIDES =
  'OnlineFix64=n;SteamOverlay64=n;winmm=n,b;dnet=n;steam_api64=n;winhttp=n,b'

/** Keep the user's launch options intact so disabling the preset restores them. */
export function compatibilityPatch(
  game: Game,
  enabled: unknown
): Partial<Game> {
  if (typeof enabled !== 'boolean')
    throw Error('Invalid compatibility setting.')
  if (!game.executable)
    throw Error('Select a game executable before enabling compatibility.')
  return { onlineFixCompatibility: enabled }
}
