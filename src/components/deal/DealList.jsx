import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'lucide-react'
import { usePipeline } from '../../store/pipelineContext.js'
import { pinSelectedFirst } from '../../utils/selection.js'
import { EmptyState } from '../common/EmptyState.jsx'
import { DealCard } from './DealCard.jsx'
import './deal.css'
import '../pipeline/pipeline.css'

export function DealList({ ids = [], emptyTitle, emptyMessage }) {
  const {
    getDeal,
    overlays,
    selectedIds,
    pinSelected,
    focusedDealId,
    setFocusedDealId,
    openDeal,
    toggleSelect,
    selectRange,
    retryDeal,
    discardFailed,
    resolveConflict,
  } = usePipeline()
  const orderedIds = useMemo(
    () => (pinSelected ? pinSelectedFirst(ids, selectedIds) : ids),
    [ids, pinSelected, selectedIds],
  )
  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: orderedIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const id = orderedIds[index]
      if (overlays.conflicts[id]) return 246
      if (overlays.failed[id]) return 182
      return 108
    },
    getItemKey: (index) => orderedIds[index],
    overscan: 10,
  })

  if (ids.length === 0) {
    return <EmptyState icon={<Search size={22} />} title={emptyTitle} message={emptyMessage} />
  }

  return (
    <div
      className="deal-list-wrap"
      ref={parentRef}
      onKeyDown={(event) => {
        if (!focusedDealId) return
        const index = orderedIds.indexOf(focusedDealId)
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setFocusedDealId(orderedIds[Math.min(orderedIds.length - 1, index + 1)])
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setFocusedDealId(orderedIds[Math.max(0, index - 1)])
        }
        if (event.key === 'Enter') openDeal(focusedDealId)
        if (event.key === 'Escape') {
          /* selection is cleared by the app shell */
        }
      }}
    >
      <div className="deal-list-inner" style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const id = orderedIds[item.index]
          const deal = getDeal(id)
          if (!deal) return null
          return (
            <div
              key={id}
              className="virtual-item"
              style={{ height: item.size, transform: `translateY(${item.start}px)` }}
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
                      setFocusedDealId(dealId)
                      if (event?.nativeEvent?.shiftKey && focusedDealId) {
                        selectRange(orderedIds, focusedDealId, dealId)
                        return
                      }
                      toggleSelect(dealId)
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
    </div>
  )
}
