import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsCard, ToggleSwitch } from 'frontend/components/UI'
import { Users } from 'lucide-react'
import ContextProvider from 'frontend/state/ContextProvider'
import SettingsContext from '../SettingsContext'
import useSetting from 'frontend/hooks/useSetting'

export default function OnlineFix() {
  const { t } = useTranslation()
  const { platform } = useContext(ContextProvider)
  const { isDefault, runner, isLinuxNative, gameInfo } =
    useContext(SettingsContext)
  const [enabled, setEnabled] = useSetting('onlineFix', false)
  const [overlay, setOverlay] = useSetting('onlineFixSteamOverlay', false)
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
      title="OnlineFix"
      description={t(
        'setting.onlineFix.description',
        'Play an installed OnlineFix game using this game’s selected Wine/Proton and prefix. Steam must be signed in.'
      )}
    >
      <ToggleSwitch
        htmlId="onlineFix"
        title={t('setting.onlineFix.enable', 'Enable OnlineFix support')}
        description={t(
          'setting.onlineFix.hint',
          'Detect DLL overrides from the game folder and start Steam before launch. Your manual overrides take priority. Game files are not modified.'
        )}
        value={enabled}
        handleChange={() => setEnabled(!enabled)}
      />
      {enabled && (
        <ToggleSwitch
          htmlId="onlineFixSteamOverlay"
          title={t('setting.onlineFix.overlay', 'Enable Steam overlay')}
          description={t(
            'setting.onlineFix.overlayHint',
            'Use Steam’s installed overlay libraries. Disable this if the overlay causes problems.'
          )}
          value={overlay}
          handleChange={() => setOverlay(!overlay)}
        />
      )}
    </SettingsCard>
  )
}
