import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { AlertTriangle, Check, LoaderCircle, RefreshCw } from 'lucide-react'
import { Badge } from '../common/Badge.jsx'
import { Button } from '../common/Button.jsx'
import { Checkbox } from '../common/Checkbox.jsx'
import { Avatar } from '../common/Avatar.jsx'
import { STAGE_BY_ID } from '../../data/constants.js'
import { cx } from '../../utils/cx.js'
import { formatCloseRelative, formatMoney } from '../../utils/format.js'
import './deal.css'

function DealCardComponent({
  deal,
  overlay,
  selected,
  focused,
  onOpen,
  onToggleSelect,
  onRetry,
  onUndo,
  onKeepMine,
  onUseLatest,
  disableDrag = false,
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: disableDrag ? `overlay-${deal.id}` : deal.id,
    data: { type: 'deal', stageId: deal.stage },
    disabled: disableDrag,
  })

  const pending = overlay?.pending
  const failed = overlay?.failed
  const conflict = overlay?.conflict
  const saved = overlay?.saved

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="article"
      className={cx(
        'deal-card',
        selected && 'is-selected',
        focused && 'is-focused',
        failed && 'is-failed',
        conflict && 'is-conflict',
      )}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      tabIndex={focused ? 0 : -1}
      aria-selected={selected}
      data-deal-id={deal.id}
      onClick={() => onOpen(deal.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen(deal.id)
        if (event.key === ' ') {
          event.preventDefault()
          onToggleSelect(deal.id, event)
        }
      }}
    >
      <div className="deal-top">
        <Checkbox
          checked={selected}
          onChange={(_, event) => onToggleSelect(deal.id, event)}
        />
        <div className="deal-main">
          <div className="deal-heading">
            <div className="deal-company">{deal.company}</div>
            <div className="deal-value">{formatMoney(deal.value)}</div>
          </div>
          <div className="deal-contact">{deal.contactName}</div>
        </div>
      </div>

      <div className="deal-meta">
        <Avatar name={deal.owner} />
        <span className="deal-owner">{deal.owner}</span>
        <span className="deal-sep" aria-hidden="true">·</span>
        <span className="deal-close">{formatCloseRelative(deal.expectedCloseDate)}</span>
        <span className="deal-priority">
          <Badge tone={deal.priority}>{deal.priority}</Badge>
        </span>
      </div>

      {pending ? (
        <div className="deal-status is-saving">
          <LoaderCircle size={13} className="spin" />
          Saving… {STAGE_BY_ID[pending.toStage]?.label || 'updating'}
        </div>
      ) : null}

      {saved && !pending && !failed ? (
        <div className="deal-status is-saved">
          <Check size={13} />
          Saved
        </div>
      ) : null}

      {failed ? (
        <div className="status-row">
          <div className="deal-status is-failed">
            <AlertTriangle size={13} />
            Save failed
          </div>
          <div className="status-actions">
            <Button
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                onRetry(deal.id)
              }}
            >
              <RefreshCw size={12} /> Retry
            </Button>
            {onUndo ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation()
                  onUndo(deal.id)
                }}
              >
                Undo
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {conflict ? (
        <div className="conflict-box" onClick={(event) => event.stopPropagation()}>
          <strong>Deal updated by another teammate</strong>
          <p>
            Your change: {STAGE_BY_ID[conflict.localStage].label}
            <br />
            Latest teammate change: {STAGE_BY_ID[conflict.serverDeal.stage].label}
            {conflict.actorName ? (
              <>
                <br />
                Updated by: {conflict.actorName}
              </>
            ) : null}
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" variant="primary" onClick={() => onKeepMine(deal.id)}>
              Keep my change
            </Button>
            <Button size="sm" onClick={() => onUseLatest(deal.id)}>
              Use latest
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export const DealCard = memo(DealCardComponent)
