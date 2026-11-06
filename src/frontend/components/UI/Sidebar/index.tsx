import { memo, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

import CurrentDownload from './components/CurrentDownload'
import SidebarLinks from './components/SidebarLinks'
import './index.scss'
import HeroicVersion from './components/HeroicVersion'
import SidebarTour from './components/SidebarTour'
import { DMQueueElement } from 'common/types'

import HeroicIcon from 'frontend/assets/heroic-icon.svg?react'
import { useNavigate } from 'react-router-dom'
import { WebviewTag } from 'electron'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

let sidebarSize = Number(localStorage.getItem('sidebar-width')) || 240
const minWidth = 60
const maxWidth = 400
const collapsedWidth = 120

export default memo(function Sidebar() {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    return saved === null ? sidebarSize < collapsedWidth : saved === 'true'
  })
  const expandedWidth = useRef(
    sidebarSize >= collapsedWidth ? sidebarSize : 240
  )
  const sidebarEl = useRef<HTMLDivElement | null>(null)
  const [currentDMElement, setCurrentDMElement] = useState<DMQueueElement>()

  const navigate = useNavigate()

  useEffect(() => {
    window.api
      .getDMQueueInformation()
      .then(({ elements }) => {
        setCurrentDMElement(elements[0])
      })
      .catch((error) => {
        console.error('Failed to get DM queue information:', error)
      })

    const removeHandleDMQueueInformation = window.api.handleDMQueueInformation(
      (e, elements) => {
        setCurrentDMElement(elements[0])
      }
    )

    return () => {
      removeHandleDMQueueInformation()
    }
  }, [])

  useEffect(() => {
    if (!sidebarEl.current) return

    sidebarSize = collapsed ? 68 : expandedWidth.current
    sidebarEl.current.style.setProperty('--sidebar-width', `${sidebarSize}px`)
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  useEffect(() => {
    return window.api.handleGoToScreen((e, screen) => {
      // handle navigate to screen
      navigate(screen, { state: { fromGameCard: false } })
    })
  }, [navigate])

  const handleDragStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    const isRTL = document.getElementById('app')?.classList.contains('isRTL')
    const viewportWidth = window.innerWidth

    let mouseDragX = e.clientX
    if (isRTL) {
      mouseDragX = viewportWidth - mouseDragX
    }
    let dragging = true

    const onMouseMove = (e: MouseEvent) => {
      if (e.clientX !== 0) {
        mouseDragX = e.clientX
        if (isRTL) {
          mouseDragX = viewportWidth - e.clientX
        }
      }
    }

    const finishDrag = () => {
      document.body.removeEventListener('mousemove', onMouseMove)
      document.body.removeEventListener('mouseup', finishDrag)
      document.body.removeEventListener('mouseleave', finishDrag)
      dragging = false
      const isCollapsed = sidebarSize < collapsedWidth
      if (!isCollapsed) expandedWidth.current = sidebarSize
      localStorage.setItem('sidebar-width', expandedWidth.current.toString())
      localStorage.setItem('sidebar-collapsed', String(isCollapsed))
      setCollapsed(isCollapsed)
      sidebarEl.current?.style.setProperty(
        '--sidebar-width',
        `${isCollapsed ? 68 : sidebarSize}px`
      )
      sidebarEl.current?.classList.toggle('collapsed', isCollapsed)

      // Re-enable pointer events on webview element
      const webviewEl = document.querySelector<WebviewTag>('webview')
      if (webviewEl) {
        webviewEl.style.pointerEvents = 'auto'
      }
    }

    document.body.addEventListener('mouseup', finishDrag)
    document.body.addEventListener('mouseleave', finishDrag)
    document.body.addEventListener('mousemove', onMouseMove)

    // Disable pointer events on webview element
    const webviewEl = document.querySelector<WebviewTag>('webview')
    if (webviewEl) {
      webviewEl.style.pointerEvents = 'none'
    }

    const dragFrame = () => {
      if (!sidebarEl.current) return

      let newWidth = mouseDragX
      if (newWidth < minWidth) {
        newWidth = minWidth
      } else if (newWidth > maxWidth) {
        newWidth = maxWidth
      }

      if (sidebarSize !== newWidth) {
        sidebarSize = newWidth

        if (sidebarSize < collapsedWidth) {
          sidebarEl.current.classList.add('collapsed')
        } else {
          sidebarEl.current.classList.remove('collapsed')
        }

        sidebarEl.current.style.setProperty('--sidebar-width', `${newWidth}px`)
      }

      if (dragging) {
        requestAnimationFrame(dragFrame)
      }
    }

    requestAnimationFrame(dragFrame)
  }

  return (
    <aside
      ref={sidebarEl}
      className={`Sidebar${collapsed ? ' collapsed' : ''}`}
      id="heroic-sidebar"
    >
      <div className="Sidebar__brand">
        <HeroicIcon className="heroicIcon" />
        <button
          type="button"
          className="Sidebar__collapseToggle"
          aria-label={
            collapsed
              ? t('sidebar.expand', 'Expand sidebar')
              : t('sidebar.collapse', 'Collapse sidebar')
          }
          title={
            collapsed
              ? t('sidebar.expand', 'Expand sidebar')
              : t('sidebar.collapse', 'Collapse sidebar')
          }
          aria-expanded={!collapsed}
          aria-controls="heroic-sidebar"
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? (
            <PanelLeftOpen size={20} />
          ) : (
            <PanelLeftClose size={20} />
          )}
        </button>
      </div>
      <SidebarLinks />
      <div className="currentDownloads" data-tour="sidebar-downloads">
        {currentDMElement && (
          <CurrentDownload
            key={currentDMElement.params.appName}
            appName={currentDMElement.params.appName}
            runner={currentDMElement.params.runner}
          />
        )}
      </div>
      <HeroicVersion />
      <div className="resizer" onMouseDown={handleDragStart} />
      <SidebarTour />
    </aside>
  )
})
