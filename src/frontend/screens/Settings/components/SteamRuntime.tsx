import { useCallback, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ContextProvider from 'frontend/state/ContextProvider'
import { defaultWineVersion } from '../util'
import type { SteamRuntimeStatus } from 'common/types/steam-runtime'
import { SettingRow, SelectField } from 'frontend/components/UI'
import useSetting from 'frontend/hooks/useSetting'
import SettingsContext from '../SettingsContext'
import InfoIcon from 'frontend/components/UI/InfoIcon'
import { Box, MenuItem, Stack, Typography } from '@mui/material'
import type { SteamRuntimeName } from 'common/types/umu'

// Names as they appear in the Steam client
const RUNTIME_NAMES = {
  'umu-scout': 'Steam Linux Runtime 1.0 (scout)',
  'umu-soldier': 'Steam Linux Runtime 2.0 (soldier)',
  'umu-sniper': 'Steam Linux Runtime 3.0 (sniper)',
  'umu-steamrt4': 'Steam Linux Runtime 4.0'
} as const satisfies Record<SteamRuntimeName, string>

function SteamRuntime() {
  const { t } = useTranslation()
  const { isLinuxNative, appName, runner } = useContext(SettingsContext)
  const { platform } = useContext(ContextProvider)
  const [wine] = useSetting('wineVersion', defaultWineVersion)
  const [compatibility] = useSetting('onlineFix', false)
  const [disableUMU] = useSetting('disableUMU', false)
  const [status, setStatus] = useState<SteamRuntimeStatus>()
  useEffect(() => {
    if (platform !== 'linux' || isLinuxNative) return
    let cancelled = false
    setStatus(undefined)
    void window.api
      .getSteamRuntimeStatus({ appName, runner: runner ?? 'sideload' })
      .then((value) => {
        if (!cancelled) setStatus(value)
      })
      .catch((error) => {
        if (!cancelled)
          setStatus({
            name: 'Steam runtime unavailable',
            ready: false,
            detail: String(error)
          })
      })
    return () => {
      cancelled = true
    }
  }, [
    appName,
    runner,
    platform,
    isLinuxNative,
    wine.bin,
    compatibility,
    disableUMU
  ])
  const [steamRuntime, setSteamRuntime] = useSetting('steamRuntime', false)

  const parseAndSet = useCallback(
    (value: string) => {
      switch (value) {
        case 'umu-scout':
        case 'umu-soldier':
        case 'umu-sniper':
        case 'umu-steamrt4':
          setSteamRuntime(value)
          break
        case 'none':
          setSteamRuntime(false)
      }
    },
    [setSteamRuntime]
  )

  if (platform !== 'linux') return null
  if (!isLinuxNative)
    return (
      <SettingRow
        label="Steam Linux Runtime"
        description={
          <>
            {status?.detail || 'Checking the selected runtime…'}
            {status?.path && (
              <div style={{ overflowWrap: 'anywhere' }}>{status.path}</div>
            )}
          </>
        }
      >
        <span role="status">{status?.name || 'Checking…'}</span>
      </SettingRow>
    )

  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
      >
        <Typography>
          {t('setting.steamRuntime.label', 'Use Steam Runtime')}
        </Typography>
        <Box
          display="flex"
          flexDirection="row"
          alignItems="center"
          gap={2}
          width="60%"
          sx={{
            [`& .selectFieldWrapper`]: {
              paddingTop: 0,
              paddingBottom: 0
            }
          }}
        >
          <SelectField
            htmlId="steamruntime"
            onChange={(event) => parseAndSet(event.target.value)}
            value={steamRuntime || 'none'}
          >
            <MenuItem value={'none'}>
              {t('setting.steamRuntime.noRuntimeOption', 'None')}
            </MenuItem>
            {Object.entries(RUNTIME_NAMES).map(([id, name]) => (
              <MenuItem key={id} value={id}>
                {name}
              </MenuItem>
            ))}
          </SelectField>
          <InfoIcon
            text={t(
              'help.steamruntime',
              'Custom libraries provided by Steam to help run Linux and Windows (Proton) games. Enabling might improve compatibility.'
            )}
          />
        </Box>
      </Stack>
    </>
  )
}

export default SteamRuntime
