import { useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Button,
  SettingsCard,
  SettingRow,
  TabPanel,
  Tabs,
  ToggleSwitch
} from 'frontend/components/UI'
import SettingsContext from '../Settings/SettingsContext'
import {
  WineVersionSelector,
  WinePrefix,
  EnableEsync,
  EnableFsync,
  EnableWineWayland,
  EnableWoW64,
  EnableFSR,
  ShowFPS,
  Mangohud,
  GameMode,
  NvidiaPrime,
  LauncherArgs,
  PreferedLanguage,
  EnvVariablesTable,
  WrappersTable,
  Gamescope
} from '../Settings/components'
import VerboseLogs from '../Settings/components/VerboseLogs'
import {
  Wine,
  SlidersHorizontal,
  Gauge,
  TerminalSquare,
  Gamepad2
} from 'lucide-react'
import { useXboxSnapshot } from './Content'
import { openXboxGameDetails } from './library-projection'
import useGlobalState from 'frontend/state/GlobalStateV2'

/** Shared Heroic controls; Xbox service / package tools stay together in one extra tab. */
export default function XboxGameSettings() {
  const { t } = useTranslation()
  const { gameInfo } = useContext(SettingsContext)
  const { closeSettingsModal } = useGlobalState.keys('closeSettingsModal')
  const { data } = useXboxSnapshot()
  const game = data?.games.find((game) => game.id === gameInfo?.xboxGameId)
  const [tab, setTab] = useState('wine')
  const [error, setError] = useState<string>()
  const action = (operation: () => Promise<unknown>) => {
    setError(undefined)
    void operation().catch((error) => setError(String(error)))
  }
  return (
    <>
      <Tabs
        className="settingsTabs"
        aria-label="Settings sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'wine', label: 'Wine' },
          { value: 'other', label: t('settings.navbar.other', 'Other') },
          {
            value: 'advanced',
            label: t('settings.navbar.advanced', 'Advanced')
          },
          { value: 'gamescope', label: 'Gamescope' },
          { value: 'xbox', label: 'Xbox' }
        ]}
      />
      {error && <Alert variant="error">{error}</Alert>}
      <TabPanel value={tab} index="wine">
        <SettingsCard glyph={Wine} title="Wine">
          <WineVersionSelector />
          <WinePrefix />
        </SettingsCard>
        <SettingsCard
          glyph={SlidersHorizontal}
          title={t('settings.section.winePerformance', 'Performance')}
        >
          <EnableEsync />
          <EnableFsync />
          <EnableWineWayland />
          <EnableWoW64 />
          <EnableFSR />
        </SettingsCard>
      </TabPanel>
      <TabPanel value={tab} index="other">
        <SettingsCard
          glyph={Gauge}
          title={t('settings.section.performance', 'Performance & Overlays')}
        >
          <ShowFPS />
          <Mangohud />
          <GameMode />
          <NvidiaPrime />
        </SettingsCard>
      </TabPanel>
      <TabPanel value={tab} index="advanced">
        <SettingsCard
          glyph={SlidersHorizontal}
          title={t('settings.section.launch', 'Launch Options')}
        >
          <LauncherArgs />
          <PreferedLanguage />
          <VerboseLogs />
        </SettingsCard>
        <SettingsCard
          glyph={TerminalSquare}
          title={t('settings.section.environment', 'Wrapper & Environment')}
        >
          <WrappersTable />
          <EnvVariablesTable />
        </SettingsCard>
      </TabPanel>
      <TabPanel value={tab} index="gamescope">
        <Gamescope />
      </TabPanel>
      <TabPanel value={tab} index="xbox">
        {game && (
          <>
            <SettingsCard glyph={Gamepad2} title="Controller compatibility">
              {(
                ['dualSenseCompatibility', 'dualShock4Compatibility'] as const
              ).map((key) => (
                <ToggleSwitch
                  key={key}
                  htmlId={`xbox-${key}`}
                  title={
                    key === 'dualSenseCompatibility'
                      ? 'DualSense compatibility'
                      : 'DualShock 4 compatibility'
                  }
                  value={!!game.launchTools?.[key]}
                  handleChange={(event) =>
                    action(() =>
                      window.launcher.updateGame(game.id, {
                        launchTools: {
                          mangoHud: false,
                          gamescope: false,
                          gamescopeArgs: '',
                          launchOptions: '',
                          ...game.launchTools,
                          [key]: event.target.checked
                        }
                      })
                    )
                  }
                />
              ))}
              {game.sideloaded && (
                <ToggleSwitch
                  htmlId="xbox-executable-compatibility"
                  title="Use executable compatibility"
                  value={!!game.onlineFixCompatibility}
                  handleChange={(event) =>
                    action(() =>
                      window.launcher.updateGame(game.id, {
                        onlineFixCompatibility: event.target.checked
                      })
                    )
                  }
                />
              )}
            </SettingsCard>
            <SettingsCard title="Xbox game tools">
              <SettingRow label="Visual C++ runtime">
                <Button
                  variant="secondary"
                  onClick={() =>
                    action(() => window.launcher.installGameVcRuntime(game.id))
                  }
                >
                  Install / update
                </Button>
              </SettingRow>
              <SettingRow label="Game updates">
                <Button
                  variant="secondary"
                  onClick={() =>
                    action(() => window.launcher.updateInstalledGame(game.id))
                  }
                >
                  Check / install update
                </Button>
              </SettingRow>
              <SettingRow label="Achievements and additional content">
                <Button
                  variant="secondary"
                  onClick={() => {
                    closeSettingsModal()
                    openXboxGameDetails(game.id)
                  }}
                >
                  Open game details
                </Button>
              </SettingRow>
            </SettingsCard>
          </>
        )}
      </TabPanel>
    </>
  )
}
