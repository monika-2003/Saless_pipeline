import { ArrowUpToLine, RefreshCw, X } from 'lucide-react'
import { STAGES, STAGE_BY_ID } from '../../data/constants.js'
import { formatCount } from '../../utils/format.js'
import { canMoveStage } from '../../utils/stageOrder.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { Button } from '../common/Button.jsx'
import { ProgressBar } from '../common/ProgressBar.jsx'
import { Dropdown, DropdownItem } from '../common/Dropdown.jsx'
import { cx } from '../../utils/cx.js'
import './bulk.css'

export function BulkToolbar() {
  const {
    selectedIds,
    pinSelected,
    pinSelectedToTop,
    clearSelection,
    requestBulkMove,
    getDeal,
    overlays,
    selectMany,
    retryFailedDeals,
    view,
    listIds,
  } = usePipeline()
  const count = selectedIds.size
  const ids = [...selectedIds]
  const hasSelection = count > 0
  const failedIds = view === 'failed' && listIds
    ? listIds
    : Object.keys(overlays.failed)
  const hasFailed = failedIds.length > 0
  const allFailedSelected = hasFailed && failedIds.every((id) => selectedIds.has(id))
  const selectedFailedIds = ids.filter((id) => overlays.failed[id])
  const selectedFailedCount = selectedFailedIds.length

  const eligibleStages = hasSelection
    ? STAGES.filter((stage) =>
        ids.some((id) => {
          const deal = getDeal(id)
          return deal && canMoveStage(deal.stage, stage.id)
        }),
      )
    : []
  const canMarkLost = hasSelection && ids.some((id) => {
    const deal = getDeal(id)
    return deal && canMoveStage(deal.stage, 'lost')
  })

  return (
    <div className={cx('bulk-toolbar', !hasSelection && 'is-empty')} role="region" aria-label="Bulk actions">
      <div className="bulk-toolbar-cluster">
        {hasSelection ? (
          <strong>{formatCount(count)} selected</strong>
        ) : (
          <span>Select deals to perform bulk actions</span>
        )}
        {hasSelection && eligibleStages.length > 0 ? (
          <Dropdown trigger={<Button size="sm">Move to…</Button>}>
            {eligibleStages.map((stage) => (
              <DropdownItem key={stage.id} onClick={() => requestBulkMove(ids, stage.id)}>
                <span className="color-dot" style={{ background: stage.color, color: stage.color }} />
                {stage.label}
              </DropdownItem>
            ))}
          </Dropdown>
        ) : (
          <Button size="sm" disabled>Move to…</Button>
        )}
        <Button
          size="sm"
          variant="danger"
          disabled={!canMarkLost}
          onClick={() => requestBulkMove(ids, 'lost')}
        >
          Mark lost
        </Button>
        {hasFailed ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (allFailedSelected) {
                const next = new Set(selectedIds)
                failedIds.forEach((id) => next.delete(id))
                selectMany([...next])
                return
              }
              selectMany([...new Set([...selectedIds, ...failedIds])])
            }}
          >
            {allFailedSelected ? 'Unselect failed' : `Select failed (${formatCount(failedIds.length)})`}
          </Button>
        ) : null}
        {selectedFailedCount > 0 ? (
          <Button size="sm" onClick={() => retryFailedDeals(selectedFailedIds)}>
            <RefreshCw size={13} />
            Retry failed ({formatCount(selectedFailedCount)})
          </Button>
        ) : null}
      </div>
      {hasSelection ? (
        <div className="bulk-toolbar-end">
          <button
            type="button"
            className={cx('bulk-pin-selected', pinSelected && 'is-pinned')}
            aria-pressed={pinSelected}
            aria-label={pinSelected ? 'Restore order' : 'Bring to top'}
            title={pinSelected ? 'Restore order' : 'Bring to top'}
            onClick={pinSelectedToTop}
          >
            <ArrowUpToLine size={15} />
            <span className="bulk-action-label">{pinSelected ? 'Restore order' : 'Bring to top'}</span>
          </button>
          <button
            type="button"
            className="bulk-clear-selected"
            aria-label="Unselect all"
            title="Unselect all"
            onClick={clearSelection}
          >
            <X size={15} />
            <span className="bulk-action-label">Unselect all</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function BulkProgress() {
  const { bulkJob } = usePipeline()
  if (!bulkJob?.running) return null
  const { completed, total, failedCount, toStage } = bulkJob
  const stageLabel = STAGE_BY_ID[toStage]?.label || toStage

  return (
    <div className="bulk-progress" role="status">
      <div className="bulk-progress-head">
        <span>{`Moving ${formatCount(total)} deals to ${stageLabel}`}</span>
        <span>
          {formatCount(completed)} / {formatCount(total)}
          {failedCount ? <span className="bulk-failed-count"> · {formatCount(failedCount)} failed</span> : null}
        </span>
      </div>
      <ProgressBar value={completed} max={total} />
      <p className="bulk-progress-note">Requests are processed in controlled batches.</p>
    </div>
  )
}
