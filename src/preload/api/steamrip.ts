import { makeHandlerInvoker } from '../ipc'

export const getSteamRipCatalog = makeHandlerInvoker('getSteamRipCatalog')
export const syncSteamRipCatalog = makeHandlerInvoker('syncSteamRipCatalog')
