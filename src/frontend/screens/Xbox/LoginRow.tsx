import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { faXbox } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Settings } from 'lucide-react'
import { Alert, Button, Icon } from 'frontend/components/UI'
import Runner from '../Login/components/Runner'
import { useXboxSnapshot } from './Content'
export default function XboxLoginRow() {
  const { data } = useXboxSnapshot()
  const [error, setError] = useState<string>()
  const navigate = useNavigate()
  const run = async (operation: () => Promise<void>) => {
    try {
      setError(undefined)
      await operation()
    } catch (error) {
      setError(String(error))
    }
  }
  return (
    <>
      <Runner
        class="xbox"
        icon={() => <FontAwesomeIcon icon={faXbox} />}
        buttonText="Xbox login"
        loginUrl="/xbox/account"
        loginAction={() => run(() => window.launcher.login())}
        isLoggedIn={data?.auth.stored === true}
        user={data?.auth.gamertag || data?.auth.username || 'Microsoft account'}
        logoutAction={() => run(() => window.launcher.logout())}
        disabled={!data?.backend.capabilities.login || data.auth.running}
        afterActions={
          <Button
            variant="ghost"
            aria-label="Xbox account settings"
            onClick={() => navigate('/xbox/account')}
            icon={<Icon glyph={Settings} />}
          />
        }
      />
      {error && <Alert variant="error">{error}</Alert>}
    </>
  )
}
