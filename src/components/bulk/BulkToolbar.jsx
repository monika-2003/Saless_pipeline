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
  const { selectedIds, clearSelection, requestBulkMove, getDeal } = usePipeline()
  const count = selectedIds.size
  const ids = [...selectedIds]
  const hasSelection = count > 0

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
        {hasSelection ? (
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function BulkProgress() {
  const { bulkJob, retryBulkFailed } = usePipeline()
  if (!bulkJob) return null
  const { completed, total, failedCount, running, toStage } = bulkJob
  const stageLabel = STAGE_BY_ID[toStage]?.label || toStage

  return (
    <div className="bulk-progress" role="status">
      <div className="bulk-progress-head">
        <span>
          {running ? `Moving ${formatCount(total)} deals to ${stageLabel}` : `Bulk move finished to ${stageLabel}`}
        </span>
        <span>
          {formatCount(completed)} / {formatCount(total)}
          {failedCount ? <span className="bulk-failed-count"> · {formatCount(failedCount)} failed</span> : null}
        </span>
      </div>
      <ProgressBar value={completed} max={total} />
      {running ? (
        <p className="bulk-progress-note">Requests are processed in controlled batches.</p>
      ) : null}
      {!running && failedCount > 0 ? (
        <div className="bulk-progress-actions">
          <Button size="sm" onClick={retryBulkFailed}>Retry failed</Button>
        </div>
      ) : null}
    </div>
  )
}
