import { useLocation } from 'react-router-dom'
import XboxContent from './Content'
export default function Xbox() {
  const { pathname } = useLocation()
  return (
    <XboxContent
      section={
        pathname === '/store/xbox'
          ? 'store'
          : pathname === '/xbox/account'
            ? 'account'
            : pathname === '/xbox/friends'
              ? 'social'
              : 'library'
      }
    />
  )
}
