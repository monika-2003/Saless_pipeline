import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core'
import { STAGES, STAGE_BY_ID } from '../../data/constants.js'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { sortDealIds } from '../../utils/dealSort.js'
import { pinSelectedFirst } from '../../utils/selection.js'
import { DealCard } from '../deal/DealCard.jsx'
import { StageColumn } from './StageColumn.jsx'
import './pipeline.css'

function firstDealId(columns) {
  return columns.find((column) => column.ids.length)?.ids[0] || null
}

export function PipelineBoard() {
  const {
    visibleStageIds,
    getDeal,
    requestMove,
    overlays,
    selectedIds,
    pinSelected,
    focusedDealId,
    setFocusedDealId,
    openDeal,
    selectMany,
    toggleSelect,
    selectRange,
    stageSorts,
  } = usePipeline()
  const [activeId, setActiveId] = useState(null)
  const isNarrow = useMediaQuery('(max-width: 768px)')
  const boardRef = useRef(null)
  const rangeAnchorRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isNarrow
        ? { delay: 180, tolerance: 8 }
        : { distance: 6 },
    }),
  )

  const columns = useMemo(
    () => STAGES.map((stage) => {
      const sorted = sortDealIds(visibleStageIds?.[stage.id] || [], getDeal, stageSorts[stage.id])
      return {
        stage,
        ids: pinSelected ? pinSelectedFirst(sorted, selectedIds) : sorted,
      }
    }),
    [getDeal, pinSelected, selectedIds, stageSorts, visibleStageIds],
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

  const focusCard = useCallback((dealId) => {
    if (!dealId || !boardRef.current) return false
    const card = boardRef.current.querySelector(`[data-deal-id="${dealId}"]`)
    if (!card) return false
    if (document.activeElement !== card) card.focus({ preventScroll: true })
    return true
  }, [])

  useEffect(() => {
    if (!focusedDealId) return undefined
    if (focusCard(focusedDealId)) return undefined
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (!cancelled && !focusCard(focusedDealId)) {
        requestAnimationFrame(() => {
          if (!cancelled) focusCard(focusedDealId)
        })
      }
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [focusCard, focusedDealId])

  const moveFocus = useCallback((dealId) => {
    if (!dealId) return
    setFocusedDealId(dealId)
  }, [setFocusedDealId])

  const handleCardSelect = useCallback((columnIds, dealId, event) => {
    const shift = Boolean(event?.shiftKey || event?.nativeEvent?.shiftKey)
    if (shift && rangeAnchorRef.current && columnIds.includes(rangeAnchorRef.current)) {
      selectRange(columnIds, rangeAnchorRef.current, dealId)
      setFocusedDealId(dealId)
      return
    }
    rangeAnchorRef.current = dealId
    toggleSelect(dealId)
  }, [selectRange, setFocusedDealId, toggleSelect])

  const onBoardKeyDown = useCallback((event) => {
    if (event.target.closest('input, textarea, [role="menu"], [role="listbox"], .dropdown')) return

    const currentId = focusedDealId || firstDealId(columns)
    if (!currentId) return

    if (!focusedDealId && (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      if (!rangeAnchorRef.current) rangeAnchorRef.current = currentId
      moveFocus(currentId)
      return
    }

    const columnIndex = columns.findIndex((column) => column.ids.includes(currentId))
    if (columnIndex < 0) return
    const column = columns[columnIndex]
    const index = column.ids.indexOf(currentId)

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveFocus(column.ids[Math.min(column.ids.length - 1, index + 1)])
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(column.ids[Math.max(0, index - 1)])
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      for (let i = columnIndex + 1; i < columns.length; i += 1) {
        if (columns[i].ids[index] || columns[i].ids[0]) {
          moveFocus(columns[i].ids[index] || columns[i].ids[0])
          break
        }
      }
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      for (let i = columnIndex - 1; i >= 0; i -= 1) {
        if (columns[i].ids[index] || columns[i].ids[0]) {
          moveFocus(columns[i].ids[index] || columns[i].ids[0])
          break
        }
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      if (column.ids.some((id) => overlays.pending[id])) return
      selectMany(column.ids)
    }
  }, [columns, focusedDealId, moveFocus, overlays.pending, selectMany])

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
        ref={boardRef}
        className="pipeline-board"
        role="region"
        aria-label="Sales pipeline board"
        tabIndex={focusedDealId ? -1 : 0}
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return
          const first = focusedDealId || firstDealId(columns)
          if (!first) return
          if (!rangeAnchorRef.current) rangeAnchorRef.current = first
          moveFocus(first)
        }}
        onKeyDown={onBoardKeyDown}
      >
        {columns.map(({ stage, ids }) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            ids={ids}
            dragFromStage={activeDeal?.stage}
            onCardSelect={handleCardSelect}
          />
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
