import { useNavigate } from 'react-router-dom'
import { faXbox } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Clock, Gamepad2, Pause, Play, Trash2, X } from 'lucide-react'
import {
  Badge,
  Button,
  CachedImage,
  Icon,
  ProgressBar
} from 'frontend/components/UI'
import type { DownloadTask } from '../../../../integrations/xbox/shared/types'
import './DownloadManagerItem/index.css'

type Props = {
  task: DownloadTask
  variant?: 'row' | 'hero'
  position?: number
  onCancel: (task: DownloadTask) => void
  onError: (error: string) => void
}
const statusNames = {
  queued: 'Queued',
  running: 'Downloading',
  paused: 'Paused',
  complete: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled'
}
const bytes = (value: number) =>
  value >= 1073741824
    ? `${(value / 1073741824).toFixed(1)} GiB`
    : `${(value / 1048576).toFixed(1)} MiB`
export default function XboxDownloadItem({
  task,
  variant = 'row',
  position,
  onCancel,
  onError
}: Props) {
  const navigate = useNavigate()
  const finished = ['complete', 'failed', 'cancelled'].includes(task.status)
  const pending = task.cancelling || task.controlPending
  const action = (operation: () => Promise<unknown>) => {
    void operation().catch((error) => onError(String(error)))
  }
  const open = () => {
    if (task.gameId) navigate('/?game=' + encodeURIComponent(task.gameId))
  }
  const timestamp = task.finishedAt || task.startedAt
  const date = new Date(timestamp)
  const validDate = Number.isFinite(date.getTime())
  return (
    <div
      className={`DownloadItem DownloadItem--${variant}${task.status === 'failed' || task.status === 'cancelled' ? ' DownloadItem--canceled' : ''}`}
    >
      <div className="DownloadItem__game">
        {position !== undefined && (
          <span className="DownloadItem__position">{position}</span>
        )}
        <span className="DownloadItem__cover DownloadItem__cover--static">
          {task.coverUrl ? (
            <CachedImage src={task.coverUrl} alt={task.title} />
          ) : (
            <Icon glyph={Gamepad2} size="lg" />
          )}
        </span>
        <div className="DownloadItem__text">
          <div className="DownloadItem__titleRow">
            <button
              className="DownloadItem__title XboxDownloadTitle"
              onClick={open}
              disabled={!task.gameId}
            >
              {task.title}
            </button>
            <Badge
              variant={
                task.status === 'complete'
                  ? 'success'
                  : task.status === 'failed'
                    ? 'error'
                    : task.status === 'paused'
                      ? 'warning'
                      : 'neutral'
              }
            >
              {task.cancelling ? 'Cancelling…' : statusNames[task.status]}
            </Badge>
          </div>
          <span className="DownloadItem__details" title={task.destination}>
            {task.error || task.phase}
          </span>
          {variant === 'hero' && (
            <div className="DownloadItem__progress">
              <ProgressBar
                value={task.progress ?? undefined}
                showValue
                size="md"
                tone={task.status === 'paused' ? 'warning' : 'success'}
                label={`${task.title} download`}
              />
              <span className="DownloadItem__progressMeta">
                {task.downloadedBytes !== undefined &&
                  bytes(task.downloadedBytes)}
                {task.totalBytes !== undefined &&
                  ` / ${bytes(task.totalBytes)}`}
                {task.transferRate && ` · ${task.transferRate}`}
              </span>
            </div>
          )}
        </div>
      </div>
      <span className="DownloadItem__type">
        <Badge variant={task.kind === 'update' ? 'info' : 'neutral'}>
          {task.kind === 'update'
            ? 'Update'
            : task.kind === 'content'
              ? 'Additional content'
              : 'Install'}
        </Badge>
      </span>
      <span className="DownloadItem__store">
        <span className="StoreBadge" title="Xbox / Microsoft Store">
          <FontAwesomeIcon
            icon={faXbox}
            className="StoreBadge__logo"
            style={{ color: '#107c10' }}
          />
        </span>
      </span>
      <span
        className="DownloadItem__time"
        title={validDate ? date.toLocaleString() : undefined}
      >
        {variant === 'hero' && <Icon glyph={Clock} size="sm" />}
        <span className="DownloadItem__date">
          {validDate ? date.toLocaleDateString() : '—'}
        </span>
        <span className="DownloadItem__hour">
          {validDate
            ? date.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
              })
            : ''}
        </span>
      </span>
      <span className="DownloadItem__actions">
        {task.status === 'running' && task.canPause && (
          <Button
            variant="ghost"
            size={variant === 'hero' ? 'md' : 'sm'}
            disabled={pending}
            aria-label={`Pause ${task.title}`}
            icon={<Icon glyph={Pause} />}
            onClick={() => action(() => window.launcher.pauseDownload(task.id))}
          />
        )}
        {(task.status === 'paused' || task.status === 'failed') && (
          <Button
            variant="ghost"
            size={variant === 'hero' ? 'md' : 'sm'}
            disabled={pending}
            aria-label={`Resume ${task.title}`}
            icon={<Icon glyph={Play} />}
            onClick={() =>
              action(() => window.launcher.resumeDownload(task.id))
            }
          />
        )}
        {!finished ? (
          <Button
            variant="dangerSubtle"
            size={variant === 'hero' ? 'md' : 'sm'}
            disabled={pending}
            aria-label={`Cancel ${task.title}`}
            icon={<Icon glyph={X} />}
            onClick={() => onCancel(task)}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove ${task.title} from history`}
            icon={<Icon glyph={Trash2} />}
            onClick={() =>
              action(() => window.launcher.removeDownload(task.id))
            }
          />
        )}
      </span>
    </div>
  )
}
