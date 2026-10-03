import { useEffect, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Inbox } from 'lucide-react'
import { usePipeline } from '../../store/pipelineContext.js'
import { formatSelectedOfTotal } from '../../utils/format.js'
import { canMoveStage } from '../../utils/stageOrder.js'
import { Checkbox } from '../common/Checkbox.jsx'
import { EmptyState } from '../common/EmptyState.jsx'
import { cx } from '../../utils/cx.js'
import { DealCard } from '../deal/DealCard.jsx'
import { StageSortMenu } from './StageSortMenu.jsx'

const CARD_GAP = 6
const FAILED_CARD_GAP = 16
const CARD_SIZE = 102 + CARD_GAP
const FAILED_CARD_SIZE = 176 + FAILED_CARD_GAP
const CONFLICT_CARD_SIZE = 240 + CARD_GAP
const STATUS_CARD_SIZE = 130 + CARD_GAP

export function StageColumn({ stage, ids, dragFromStage, onCardSelect }) {
  const {
    getDeal,
    overlays,
    selectedIds,
    focusedDealId,
    setFocusedDealId,
    openDeal,
    toggleSelect,
    selectRange,
    selectMany,
    retryDeal,
    discardFailed,
    resolveConflict,
    stageSorts,
    setStageSort,
  } = usePipeline()

  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: 'stage', stageId: stage.id },
  })
  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const id = ids[index]
      if (overlays.conflicts[id]) return CONFLICT_CARD_SIZE
      if (overlays.failed[id]) return FAILED_CARD_SIZE
      if (overlays.pending[id] || overlays.saved?.[id]) return STATUS_CARD_SIZE
      return CARD_SIZE
    },
    getItemKey: (index) => ids[index],
    overscan: 8,
  })

  const focusedIndex = focusedDealId ? ids.indexOf(focusedDealId) : -1
  useEffect(() => {
    if (focusedIndex >= 0) virtualizer.scrollToIndex(focusedIndex, { align: 'auto' })
  }, [focusedIndex, virtualizer])

  const selectedInColumn = ids.filter((id) => selectedIds.has(id)).length
  const allVisibleSelected = ids.length > 0 && selectedInColumn === ids.length
  const stageHasSaving = ids.some((id) => overlays.pending[id])
  const isBlocked = Boolean(
    dragFromStage && dragFromStage !== stage.id && !canMoveStage(dragFromStage, stage.id),
  )

  return (
    <section
      className={cx(
        'stage-column',
        isOver && !isBlocked && 'is-over',
        isOver && isBlocked && 'is-blocked-over',
        Boolean(dragFromStage) && isBlocked && 'is-blocked',
      )}
      style={{ '--stage': stage.color }}
      aria-label={`${stage.label}, ${formatSelectedOfTotal(selectedInColumn, ids.length)} deals`}
    >
      <header className="stage-header">
        <div className="stage-title">
          <span className="stage-dot" style={{ background: stage.color }} />
          {stage.label}
        </div>
        <div className="stage-header-actions">
          <span className="stage-count">{formatSelectedOfTotal(selectedInColumn, ids.length)}</span>
          <StageSortMenu
            stageLabel={stage.label}
            sort={stageSorts[stage.id]}
            onSelect={(key) => setStageSort(stage.id, key)}
          />

          <Checkbox
            aria-label={`Select visible deals in ${stage.label}`}
            checked={allVisibleSelected}
            indeterminate={selectedInColumn > 0 && !allVisibleSelected}
            disabled={stageHasSaving}
            onChange={(checked) => {
              if (checked) selectMany([...selectedIds, ...ids])
              else {
                const next = new Set(selectedIds)
                ids.forEach((id) => next.delete(id))
                selectMany([...next])
              }
            }}
            label=""
          />
        </div>
      </header>

      <div className="stage-body" ref={(node) => {
        parentRef.current = node
        setNodeRef(node)
      }}>
        {ids.length === 0 ? (
          <EmptyState icon={<Inbox size={20} />} title="No deals" message="Nothing in this stage for the current filters." />
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const id = ids[item.index]
              const deal = getDeal(id)
              if (!deal) return null
              return (
                <div
                  key={id}
                  className={cx('virtual-item', overlays.failed[id] && 'is-failed')}
                  style={{
                    height: item.size,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <DealCard
                    deal={deal}
                    overlay={{
                      pending: overlays.pending[id],
                      failed: overlays.failed[id],
                      conflict: overlays.conflicts[id],
                      saved: overlays.saved?.[id],
                    }}
                    selected={selectedIds.has(id)}
                    focused={focusedDealId === id}
                    onOpen={openDeal}
                    onToggleSelect={(dealId, event) => {
                      if (onCardSelect) {
                        onCardSelect(ids, dealId, event)
                        return
                      }
                      setFocusedDealId(dealId)
                      if ((event?.shiftKey || event?.nativeEvent?.shiftKey) && focusedDealId) {
                        selectRange(ids, focusedDealId, dealId)
                        return
                      }
                      toggleSelect(dealId, { replace: false })
                    }}
                    onRetry={retryDeal}
                    onUndo={discardFailed}
                    onKeepMine={(dealId) => resolveConflict(dealId, 'mine')}
                    onUseLatest={(dealId) => resolveConflict(dealId, 'server')}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
