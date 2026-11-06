import { useXboxSnapshot } from '../Xbox/Content'
import XboxDownloadItem from './components/XboxDownloadItem'
import { useNavigate } from 'react-router-dom'
import type { DownloadTask } from '../../../integrations/xbox/shared/types'
import { Modal, ModalHeader, ModalContent } from 'frontend/components/UI/Modal'
import './index.css'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import {
  CircleCheck,
  Download,
  Inbox,
  ListOrdered,
  Trash2,
  Settings
} from 'lucide-react'
import { DMQueueElement, DownloadManagerState } from 'common/types'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Icon,
  PageHeader,
  Panel,
  SettingsCard,
  UpdateComponent
} from 'frontend/components/UI'
import ProgressHeader from './components/ProgressHeader'
import DownloadManagerHeader from './DownloadManagerHeader'
import { downloadManagerStore } from 'frontend/helpers/electronStores'
import { DMQueue } from 'frontend/types'
import DownloadManagerItem from './components/DownloadManagerItem'
import { hasHelp } from 'frontend/hooks/hasHelp'

export default React.memo(function DownloadManager(): JSX.Element | null {
  const { t } = useTranslation()
  const { data: xbox } = useXboxSnapshot()
  const navigate = useNavigate()
  const [downloadError, setDownloadError] = useState<string>()
  const [cancel, setCancel] = useState<{
    task: DownloadTask
    deleteAllowed: boolean
    reason?: string
  }>()
  const xboxTasks = xbox?.downloads || []
  const xboxActive = xboxTasks.filter((task) =>
    ['running', 'paused'].includes(task.status)
  )
  const xboxFinished = xboxTasks.filter((task) =>
    ['complete', 'failed', 'cancelled'].includes(task.status)
  )
  const run = (operation: () => Promise<unknown>) => {
    void operation().catch((error) => setDownloadError(String(error)))
  }
  const cancelXbox = (task: DownloadTask) =>
    run(async () => {
      const options = await window.launcher.getDownloadCancelOptions(task.id)
      setCancel({
        task,
        deleteAllowed: options.deleteFilesAllowed,
        reason: options.reason
      })
    })
  const [refreshing, setRefreshing] = useState(false)
  const [state, setState] = useState<DownloadManagerState>('idle')
  const [plannendElements, setPlannendElements] = useState<DMQueueElement[]>([])
  const [currentElement, setCurrentElement] = useState<DMQueueElement>()
  const [finishedElem, setFinishedElem] = useState<DMQueueElement[]>()

  hasHelp(
    'downloadManager',
    t('help.title.downloadManager', 'Download Manager'),
    <p>
      {t('help.content.downloadManager', 'Shows current and past downloads.')}
    </p>
  )

  useEffect(() => {
    setRefreshing(true)
    window.api.getDMQueueInformation().then(({ elements, state }: DMQueue) => {
      setCurrentElement(elements[0])
      setPlannendElements([...elements.slice(1)])
      setRefreshing(false)
      setState(state)
    })

    const removeHandleDMQueueInformation = window.api.handleDMQueueInformation(
      (
        e: Electron.IpcRendererEvent,
        elements: DMQueueElement[],
        state: DownloadManagerState
      ) => {
        if (elements) {
          setCurrentElement(elements[0])
          setPlannendElements([...elements.slice(1)])
          setState(state)
        }
      }
    )

    return () => {
      removeHandleDMQueueInformation()
    }
  }, [])

  useEffect(() => {
    window.api.getDMQueueInformation().then(({ finished }: DMQueue) => {
      setFinishedElem(finished)
    })
  }, [plannendElements.length, currentElement?.params.appName])

  if (refreshing) {
    return <UpdateComponent />
  }

  const handleClearList = () => {
    setFinishedElem([])
    downloadManagerStore.set('finished', [])
    if (xboxFinished.length) run(() => window.launcher.clearFinishedDownloads())
  }

  const handleClearItem = (appName: string) => {
    const filteredFinishedElem = finishedElem?.filter(
      (e) => e.params.appName !== appName
    )
    setFinishedElem(filteredFinishedElem)
    downloadManagerStore.set(
      'finished',
      filteredFinishedElem ? filteredFinishedElem : []
    )
  }

  type Entry =
    | { source: 'heroic'; element: DMQueueElement; time: number }
    | { source: 'xbox'; task: DownloadTask; time: number }
  const queue: Entry[] = [
    ...plannendElements.map((element) => ({
      source: 'heroic' as const,
      element,
      time: element.addToQueueTime
    })),
    ...xboxTasks
      .filter((task) => task.status === 'queued')
      .map((task) => ({
        source: 'xbox' as const,
        task,
        time: Date.parse(task.startedAt) || 0
      }))
  ].sort((a, b) => a.time - b.time)
  const history: Entry[] = [
    ...(finishedElem || []).map((element) => ({
      source: 'heroic' as const,
      element,
      time: element.endTime
    })),
    ...xboxFinished.map((task) => ({
      source: 'xbox' as const,
      task,
      time: Date.parse(task.finishedAt || task.startedAt) || 0
    }))
  ].sort((a, b) => b.time - a.time)
  const hasActive = Boolean(currentElement) || xboxActive.length > 0
  return (
    <div className="DownloadManager">
      <div className="DownloadManager__wrapper">
        <PageHeader
          title={t('download-manager.title', 'Downloads')}
          description={t(
            'download-manager.pageSubtitle',
            'What is installing now, what comes next and what is already done'
          )}
          actions={
            <Button
              variant="ghost"
              aria-label="Download settings"
              icon={<Icon glyph={Settings} />}
              onClick={() => navigate('/settings/general')}
            />
          }
        />
        {downloadError && (
          <Alert
            variant="error"
            actions={
              <Button
                variant="ghost"
                onClick={() => setDownloadError(undefined)}
              >
                Dismiss
              </Button>
            }
          >
            {downloadError}
          </Alert>
        )}
        <Panel
          tone="glass"
          padding="lg"
          className={classNames('DownloadManager__current', {
            'DownloadManager__current--idle': !hasActive
          })}
        >
          {hasActive ? (
            <div className="DownloadManager__activeList">
              {currentElement && (
                <div className="DownloadManager__activeItem">
                  <DownloadManagerItem
                    element={currentElement}
                    current
                    state={state}
                    variant="hero"
                  />
                  <ProgressHeader
                    state={state}
                    appName={currentElement.params.appName}
                    runner={currentElement.params.runner}
                  />
                </div>
              )}
              {xboxActive.map((task) => (
                <div
                  key={'xbox-' + task.id}
                  className="DownloadManager__activeItem"
                >
                  <XboxDownloadItem
                    task={task}
                    variant="hero"
                    onCancel={cancelXbox}
                    onError={setDownloadError}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              glyph={Download}
              title={t('queue.label.empty', 'Nothing to download')}
              description={t(
                'download-manager.empty.current',
                'Games you install or update show their progress here.'
              )}
            />
          )}
        </Panel>
        {(hasActive || queue.length > 0) && (
          <SettingsCard
            title={t('queue.label.queued', 'Queued')}
            glyph={ListOrdered}
            meta={<Badge>{queue.length}</Badge>}
            className="DownloadManager__section"
          >
            {queue.length ? (
              <div className="DownloadList">
                <DownloadManagerHeader time="queued" />
                {queue.map((entry, index) =>
                  entry.source === 'heroic' ? (
                    <DownloadManagerItem
                      key={'heroic-' + entry.element.params.appName}
                      element={entry.element}
                      current={false}
                      position={index + 1}
                    />
                  ) : (
                    <XboxDownloadItem
                      key={'xbox-' + entry.task.id}
                      task={entry.task}
                      position={index + 1}
                      onCancel={cancelXbox}
                      onError={setDownloadError}
                    />
                  )
                )}
              </div>
            ) : (
              <EmptyState
                glyph={Inbox}
                title={t(
                  'download-manager.empty.queue.title',
                  'Queue is empty'
                )}
                description={t(
                  'download-manager.empty.queue.description',
                  'Downloads you start while another one is running wait here.'
                )}
              />
            )}
          </SettingsCard>
        )}
        {history.length > 0 && (
          <SettingsCard
            title={t('queue.label.finished', 'Completed')}
            glyph={CircleCheck}
            meta={<Badge>{history.length}</Badge>}
            actions={
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon glyph={Trash2} size="md" />}
                onClick={handleClearList}
              >
                {t('queue.label.clear', 'Clear List')}
              </Button>
            }
            className="DownloadManager__section"
          >
            <div className="DownloadList">
              <DownloadManagerHeader time="finished" />
              {history.map((entry) =>
                entry.source === 'heroic' ? (
                  <DownloadManagerItem
                    key={
                      'heroic-' +
                      entry.element.params.appName +
                      '-' +
                      entry.element.endTime
                    }
                    element={entry.element}
                    current={false}
                    handleClearItem={handleClearItem}
                  />
                ) : (
                  <XboxDownloadItem
                    key={'xbox-' + entry.task.id}
                    task={entry.task}
                    onCancel={cancelXbox}
                    onError={setDownloadError}
                  />
                )
              )}
            </div>
          </SettingsCard>
        )}
        {cancel && (
          <Modal onClose={() => setCancel(undefined)} showCloseButton>
            <ModalHeader>Cancel {cancel.task.title}</ModalHeader>
            <ModalContent>
              <p>
                Keep the downloaded files to resume later, or delete this
                partial download.
              </p>
              {cancel.reason && <p>{cancel.reason}</p>}
              <div className="XboxActions">
                <Button
                  onClick={() => {
                    run(() =>
                      window.launcher.cancelDownload(cancel.task.id, 'keep')
                    )
                    setCancel(undefined)
                  }}
                >
                  Cancel and keep files
                </Button>
                <Button
                  variant="secondary"
                  disabled={!cancel.deleteAllowed}
                  onClick={() => {
                    run(() =>
                      window.launcher.cancelDownload(
                        cancel.task.id,
                        'delete-files'
                      )
                    )
                    setCancel(undefined)
                  }}
                >
                  Cancel and delete partial files
                </Button>
              </div>
            </ModalContent>
          </Modal>
        )}
      </div>
    </div>
  )
})
