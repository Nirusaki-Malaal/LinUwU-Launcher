import { useEffect, useState } from 'react'
import { Alert, TextInputField } from 'frontend/components/UI'
import { useXboxSnapshot } from '../Xbox/Content'
export default function XboxDownloadSettings() {
  const { data } = useXboxSnapshot()
  const [limit, setLimit] = useState('0')
  const [streams, setStreams] = useState('4')
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (data) {
      setLimit(String(data.settings.downloadLimitMiB ?? 0))
      setStreams(String(data.settings.parallelDownloads))
    }
  }, [data?.settings.downloadLimitMiB, data?.settings.parallelDownloads])
  const save = (
    key: 'downloadLimitMiB' | 'parallelDownloads',
    value: string
  ) => {
    const number = Number(value)
    if (
      !value.trim() ||
      !Number.isFinite(number) ||
      number < 0 ||
      (key === 'parallelDownloads' &&
        (!Number.isInteger(number) || number < 1 || number > 16))
    ) {
      setError(
        key === 'parallelDownloads'
          ? 'Choose 1–16 parallel streams.'
          : 'Enter a speed limit of zero or greater.'
      )
      return
    }
    setError(undefined)
    void window.launcher
      .updateSettings({ [key]: number })
      .catch((error) => setError(String(error)))
  }
  if (!data) return null
  return (
    <>
      <TextInputField
        htmlId="xbox-download-speed"
        label="Xbox download speed limit (MiB/s, 0 = unlimited)"
        inputMode="decimal"
        value={limit}
        onChange={setLimit}
        onBlur={() => save('downloadLimitMiB', limit)}
      />
      <TextInputField
        htmlId="xbox-download-streams"
        label="Xbox parallel download streams"
        inputMode="numeric"
        value={streams}
        onChange={setStreams}
        onBlur={() => save('parallelDownloads', streams)}
      />
      {error && <Alert variant="error">{error}</Alert>}
    </>
  )
}
