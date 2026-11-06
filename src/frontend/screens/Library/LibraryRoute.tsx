import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Library from './index'
import { XboxGameDetailHost } from '../Xbox/Content'
import { openXboxGameDetails } from '../Xbox/library-projection'
export default function LibraryRoute() {
  const [query] = useSearchParams()
  const game = query.get('game')
  useEffect(() => {
    if (game) openXboxGameDetails(game)
  }, [game])
  return (
    <>
      <Library />
      <XboxGameDetailHost />
    </>
  )
}
