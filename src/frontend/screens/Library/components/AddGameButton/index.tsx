import { useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronDown } from 'lucide-react'
import { Menu, MenuItem } from '@mui/material'
import { Alert, Button, Icon } from 'frontend/components/UI'
import LibraryContext from '../../LibraryContext'
interface AddGameButtonProps {
  'data-tour'?: string
}
function AddGameButton({ 'data-tour': dataTour }: AddGameButtonProps = {}) {
  const { t } = useTranslation()
  const { handleAddGameButtonClick } = useContext(LibraryContext)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [error, setError] = useState<string>()
  const request = (operation: () => Promise<unknown>) => {
    setAnchor(null)
    setError(undefined)
    void operation().catch((error) => setError(String(error)))
  }
  return (
    <>
      <div className="libraryAddGameActions">
        <button
          className="sideloadGameButton"
          onClick={handleAddGameButtonClick}
          data-tour={dataTour || 'library-add-game'}
        >
          <Plus size={16} strokeWidth={2} aria-hidden />
          <span>{t('add_game', 'Add Game')}</span>
        </button>
        {window.platform === 'linux' && (
          <>
            <Button
              className="libraryImportButton"
              variant="secondary"
              aria-label="More game import options"
              aria-haspopup="menu"
              aria-expanded={Boolean(anchor)}
              aria-controls={anchor ? 'library-import-menu' : undefined}
              icon={<Icon glyph={ChevronDown} />}
              onClick={(event) => setAnchor(event.currentTarget)}
            />
            <Menu
              id="library-import-menu"
              anchorEl={anchor}
              open={Boolean(anchor)}
              onClose={() => setAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{ className: 'LibraryImportMenu' }}
            >
              <MenuItem
                onClick={() => request(() => window.launcher.importGame())}
              >
                Import Xbox game folder
              </MenuItem>
              <MenuItem
                onClick={() =>
                  request(() => window.launcher.importExecutable())
                }
              >
                Add executable with Xbox runtime
              </MenuItem>
            </Menu>
          </>
        )}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </>
  )
}
export default AddGameButton
