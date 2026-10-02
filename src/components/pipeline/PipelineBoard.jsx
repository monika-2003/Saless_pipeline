import { useCallback, useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core'
import { STAGES, STAGE_BY_ID } from '../../data/constants.js'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { pinSelectedFirst } from '../../utils/selection.js'
import { DealCard } from '../deal/DealCard.jsx'
import { StageColumn } from './StageColumn.jsx'
import './pipeline.css'

export function PipelineBoard() {
  const {
    visibleStageIds,
    getDeal,
    requestMove,
    overlays,
    selectedIds,
    focusedDealId,
    setFocusedDealId,
    openDeal,
    selectMany,
    clearSelection,
  } = usePipeline()
  const [activeId, setActiveId] = useState(null)
  const isNarrow = useMediaQuery('(max-width: 768px)')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isNarrow
        ? { delay: 180, tolerance: 8 }
        : { distance: 6 },
    }),
  )

  const columns = useMemo(
    () => STAGES.map((stage) => ({
      stage,
      ids: pinSelectedFirst(visibleStageIds[stage.id] || [], selectedIds),
    })),
    [selectedIds, visibleStageIds],
  )

  const onDragEnd = useCallback(
    (event) => {
      setActiveId(null)
      const over = event.over
      if (!over) return
      const toStage = over.data.current?.stageId || (STAGE_BY_ID[over.id] ? over.id : null)
      const dealId = event.active.id
      if (toStage) requestMove(dealId, toStage)
    },
    [requestMove],
  )

  const activeDeal = activeId ? getDeal(activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event) => setActiveId(event.active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      <div
        className="pipeline-board"
        role="region"
        aria-label="Sales pipeline board"
        onKeyDown={(event) => {
          if (!focusedDealId) {
            const first = columns.find((col) => col.ids.length)?.ids[0]
            if (first && (event.key === 'ArrowDown' || event.key === 'ArrowRight')) setFocusedDealId(first)
            return
          }
          const columnIndex = columns.findIndex((col) => col.ids.includes(focusedDealId))
          if (columnIndex < 0) return
          const column = columns[columnIndex]
          const index = column.ids.indexOf(focusedDealId)

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            const next = column.ids[Math.min(column.ids.length - 1, index + 1)]
            if (next) setFocusedDealId(next)
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            const next = column.ids[Math.max(0, index - 1)]
            if (next) setFocusedDealId(next)
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            for (let i = columnIndex + 1; i < columns.length; i += 1) {
              if (columns[i].ids[index] || columns[i].ids[0]) {
                setFocusedDealId(columns[i].ids[index] || columns[i].ids[0])
                break
              }
            }
          }
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            for (let i = columnIndex - 1; i >= 0; i -= 1) {
              if (columns[i].ids[index] || columns[i].ids[0]) {
                setFocusedDealId(columns[i].ids[index] || columns[i].ids[0])
                break
              }
            }
          }
          if (event.key === 'Enter') openDeal(focusedDealId)
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault()
            selectMany(column.ids)
          }
          if (event.key === 'Escape') clearSelection()
        }}
      >
        {columns.map(({ stage, ids }) => (
          <StageColumn key={stage.id} stage={stage} ids={ids} dragFromStage={activeDeal?.stage} />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? (
          <DealCard
            deal={activeDeal}
            disableDrag
            overlay={{
              pending: overlays.pending[activeDeal.id],
              failed: overlays.failed[activeDeal.id],
              conflict: overlays.conflicts[activeDeal.id],
              saved: overlays.saved?.[activeDeal.id],
            }}
            selected={selectedIds.has(activeDeal.id)}
            focused
            onOpen={() => {}}
            onToggleSelect={() => {}}
            onRetry={() => {}}
            onKeepMine={() => {}}
            onUseLatest={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
