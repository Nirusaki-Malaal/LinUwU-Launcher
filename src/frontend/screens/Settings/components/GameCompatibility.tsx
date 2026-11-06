import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsCard, ToggleSwitch } from 'frontend/components/UI'
import { Users } from 'lucide-react'
import ContextProvider from 'frontend/state/ContextProvider'
import SettingsContext from '../SettingsContext'
import useSetting from 'frontend/hooks/useSetting'

export default function GameCompatibility() {
  const { t } = useTranslation()
  const { platform } = useContext(ContextProvider)
  const { isDefault, runner, isLinuxNative, gameInfo } =
    useContext(SettingsContext)
  const [enabled, setEnabled] = useSetting('onlineFix', false)
  if (
    platform !== 'linux' ||
    isDefault ||
    runner !== 'sideload' ||
    isLinuxNative ||
    gameInfo?.install.platform === 'Browser'
  )
    return null
  return (
    <SettingsCard
      glyph={Users}
      title="OnlineFix compatibility"
      description="Use this game's selected Wine/Proton and prefix. Steam must be signed in."
    >
      <ToggleSwitch
        htmlId="onlineFix"
        title={t('setting.onlineFix.enable', 'Enable OnlineFix support')}
        description="Configure compatibility automatically using your selected Wine/Proton and existing Steam installation."
        value={enabled}
        handleChange={() => setEnabled(!enabled)}
      />
    </SettingsCard>
  )
}
