import { useContext } from 'react'
import { ToggleSwitch } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'
import ContextProvider from 'frontend/state/ContextProvider'
import SettingsContext from '../SettingsContext'
export default function SteamOverlay() {
  const { platform } = useContext(ContextProvider)
  const { isDefault, runner, isLinuxNative } = useContext(SettingsContext)
  const [enabled] = useSetting('onlineFix', false)
  const [overlay, setOverlay] = useSetting('onlineFixSteamOverlay', false)
  if (
    platform !== 'linux' ||
    isDefault ||
    runner !== 'sideload' ||
    isLinuxNative ||
    !enabled
  )
    return null
  return (
    <ToggleSwitch
      htmlId="onlineFixSteamOverlay"
      title="Enable Steam overlay"
      description="Use Steam's installed overlay for this compatibility-enabled game."
      value={overlay}
      handleChange={() => setOverlay(!overlay)}
    />
  )
}
