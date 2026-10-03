import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { STAGES, TABLE_PAGE_SIZE, TABLE_PAGE_SIZES } from '../../data/constants.js'
import { useRovingTabs } from '../../hooks/useRovingTabs.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { sortDealIds } from '../../utils/dealSort.js'
import { pinSelectedFirst } from '../../utils/selection.js'
import { cx } from '../../utils/cx.js'
import { failedDestinationLabel, formatFailedSave } from '../../utils/dealStatus.js'
import { formatCloseRelative, formatCount, formatMoney, formatSelectedOfTotal } from '../../utils/format.js'
import { Badge } from '../common/Badge.jsx'
import { Button } from '../common/Button.jsx'
import { Checkbox } from '../common/Checkbox.jsx'
import { StageSortMenu } from '../pipeline/StageSortMenu.jsx'
import { DealMoveMenu } from './DealMoveMenu.jsx'
import './deal.css'

export function DealTable({
  tablistLabel = 'Stages',
  tabs,
  idsByTab,
  defaultTabId,
  getWhy,
  showStatus = true,
  showMove = true,
  showRetryTo = false,
} = {}) {
  const {
    visibleStageIds,
    getDeal,
    overlays,
    selectedIds,
    pinSelected,
    toggleSelect,
    selectMany,
    openDeal,
    requestMove,
    retryDeal,
    discardFailed,
    filters,
    stageSorts,
    setStageSort,
  } = usePipeline()

  const resolvedTabs = tabs || STAGES.map((stage) => ({
    id: stage.id,
    label: stage.label,
    color: stage.color,
  }))
  const resolvedIdsByTab = idsByTab || visibleStageIds || {}
  const [tabId, setTabId] = useState(defaultTabId || resolvedTabs[0]?.id)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [focusedRowId, setFocusedRowId] = useState(null)
  const tablistRef = useRef(null)
  const tableRef = useRef(null)
  const tabIds = resolvedTabs.map((tab) => tab.id)
  const { onKeyDown: onTabKeyDown, tabIndexFor } = useRovingTabs(tablistRef, tabIds, tabId, setTabId)
  const activeTab = resolvedTabs.find((tab) => tab.id === tabId) || resolvedTabs[0]
  const rawIds = resolvedIdsByTab[activeTab?.id] || []
  const sort = stageSorts[activeTab?.id]
  const ids = useMemo(() => {
    const sorted = sortDealIds(rawIds, getDeal, sort)
    return pinSelected ? pinSelectedFirst(sorted, selectedIds) : sorted
  }, [getDeal, pinSelected, rawIds, selectedIds, sort])
  const pageCount = Math.max(1, Math.ceil(ids.length / pageSize))
  const safePage = Math.min(page, pageCount)

  useEffect(() => {
    if (resolvedTabs.some((tab) => tab.id === tabId)) return
    setTabId(resolvedTabs[0]?.id)
  }, [resolvedTabs, tabId])

  useEffect(() => {
    setPage(1)
  }, [tabId, pageSize, filters])

  useEffect(() => {
    if (!pinSelected || !selectedIds.size) return
    setPage(1)
  }, [pinSelected, selectedIds])

  const pageIds = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return ids.slice(start, start + pageSize)
  }, [ids, safePage, pageSize])
  const selectedInTab = useMemo(
    () => ids.filter((id) => selectedIds.has(id)).length,
    [ids, selectedIds],
  )
  const selectedByTab = useMemo(() => {
    const counts = {}
    for (const tab of resolvedTabs) {
      const tabIdsForCount = resolvedIdsByTab[tab.id] || []
      counts[tab.id] = tabIdsForCount.filter((id) => selectedIds.has(id)).length
    }
    return counts
  }, [resolvedIdsByTab, resolvedTabs, selectedIds])
  const activeRowId = pageIds.includes(focusedRowId) ? focusedRowId : pageIds[0] || null

  useEffect(() => {
    if (!activeRowId || !tableRef.current) return
    if (!tableRef.current.contains(document.activeElement)) return
    const row = tableRef.current.querySelector(`tr[data-deal-id="${activeRowId}"]`)
    row?.focus({ preventScroll: true })
  }, [activeRowId])

  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length
  const allPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length
  const stageHasSaving = rawIds.some((id) => overlays.pending[id])
  const startIndex = ids.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endIndex = Math.min(ids.length, safePage * pageSize)
  const colCount = 8 + (getWhy ? 1 : 0) + (showStatus ? 1 : 0) + (showMove ? 1 : 0) + (showRetryTo ? 1 : 0)

  return (
    <div className="deal-table-wrap">
      <div
        ref={tablistRef}
        className="table-stage-tabs"
        role="tablist"
        aria-label={tablistLabel}
        onKeyDown={onTabKeyDown}
      >
        {resolvedTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={activeTab?.id === tab.id}
            tabIndex={tabIndexFor(tab.id)}
            className={activeTab?.id === tab.id ? 'table-stage-tab is-active' : 'table-stage-tab'}
            style={{ '--stage': tab.color }}
            onClick={(event) => {
              setTabId(tab.id)
              event.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
            }}
          >
            <span className="color-dot" style={{ background: tab.color }} />
            <span className="table-stage-label">{tab.label}</span>
            <span className="table-stage-count">{formatSelectedOfTotal(selectedByTab[tab.id] || 0, resolvedIdsByTab[tab.id]?.length || 0)}</span>
          </button>
        ))}
      </div>

      <div className="table-toolbar">
        <strong style={{ '--stage': activeTab?.color }}>
          <span className="color-dot" aria-hidden="true" style={{ background: activeTab?.color }} />
          {activeTab?.label}
          <span className="table-toolbar-count">{formatSelectedOfTotal(selectedInTab, ids.length)} deals</span>
          {activeTab ? (
            <StageSortMenu
              stageLabel={activeTab.label}
              sort={sort}
              onSelect={(key) => setStageSort(activeTab.id, key)}
            />
          ) : null}
        </strong>
        <span className="table-range">
          Showing {formatCount(startIndex)}–{formatCount(endIndex)} of {formatCount(ids.length)}
        </span>
      </div>

      <div className="deal-table-scroll">
        <table className="deal-table" ref={tableRef}>
          <thead>
            <tr>
              <th className="col-check">
                <Checkbox
                  aria-label={`Select visible ${activeTab?.label || ''} deals`}
                  checked={allPageSelected}
                  indeterminate={selectedOnPage > 0 && !allPageSelected}
                  disabled={stageHasSaving}
                  onChange={(checked) => {
                    if (checked) selectMany([...selectedIds, ...pageIds])
                    else {
                      const next = new Set(selectedIds)
                      pageIds.forEach((id) => next.delete(id))
                      selectMany([...next])
                    }
                  }}
                />
              </th>
              <th className="col-company">Company</th>
              <th className="col-contact">Contact</th>
              <th className="col-owner">Owner</th>
              <th className="col-value">Value</th>
              <th className="col-priority">Priority</th>
              <th className="col-close">Close</th>
              {getWhy ? <th className="col-why">Why</th> : null}
              {showRetryTo ? <th className="col-retry-to">Retry to</th> : null}
              {showStatus ? <th className="col-status">Status</th> : null}
              {showMove ? <th className="col-move">Move</th> : null}
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageIds.length === 0 ? (
              <tr>
                <td className="deal-table-empty" colSpan={colCount}>
                  No deals in {activeTab?.label || 'this tab'}.
                </td>
              </tr>
            ) : null}
            {pageIds.map((id) => {
              const deal = getDeal(id)
              if (!deal) return null
              const pending = overlays.pending[id]
              const failed = overlays.failed[id]
              const conflict = overlays.conflicts[id]
              const saved = overlays.saved?.[id]
              return (
                <tr
                  key={id}
                  data-deal-id={id}
                  className={cx(selectedIds.has(id) && 'is-selected', pending && 'is-saving')}
                  onClick={() => openDeal(id)}
                  tabIndex={id === activeRowId ? 0 : -1}
                  aria-busy={pending ? true : undefined}
                  onFocus={() => setFocusedRowId(id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget && event.target.closest('button, input')) {
                      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        /* keep moving rows even from row controls */
                      } else {
                        return
                      }
                    }
                    const index = pageIds.indexOf(id)
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      const next = pageIds[Math.min(pageIds.length - 1, index + 1)]
                      if (next) setFocusedRowId(next)
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      const next = pageIds[Math.max(0, index - 1)]
                      if (next) setFocusedRowId(next)
                    }
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      openDeal(id)
                    }
                    if (event.key === ' ') {
                      event.preventDefault()
                      if (!pending) toggleSelect(id)
                    }
                  }}
                >
                  <td className="col-check" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(id)}
                      disabled={Boolean(pending)}
                      tabIndex={-1}
                      onChange={() => toggleSelect(id)}
                    />
                  </td>
                  <td className="col-company">
                    <strong>{deal.company}</strong>
                  </td>
                  <td className="col-contact">{deal.contactName}</td>
                  <td className="col-owner">{deal.owner}</td>
                  <td className="col-value">{formatMoney(deal.value)}</td>
                  <td className="col-priority"><Badge tone={deal.priority}>{deal.priority}</Badge></td>
                  <td className="col-close">{formatCloseRelative(deal.expectedCloseDate)}</td>
                  {getWhy ? <td className="col-why">{getWhy(deal)}</td> : null}
                  {showRetryTo ? (
                    <td className="col-retry-to">
                      {failedDestinationLabel(failed) || '—'}
                    </td>
                  ) : null}
                  {showStatus ? (
                    <td className="col-status">
                      {pending ? 'Saving…' : null}
                      {saved && !pending && !failed ? 'Saved' : null}
                      {failed ? <span className="table-failed-label">{formatFailedSave(failed)}</span> : null}
                      {conflict ? 'Conflict' : null}
                      {!pending && !saved && !failed && !conflict ? '—' : null}
                    </td>
                  ) : null}
                  {showMove ? (
                    <td className="col-move" onClick={(event) => event.stopPropagation()}>
                      <DealMoveMenu
                        deal={deal}
                        onMove={requestMove}
                        disabled={Boolean(pending)}
                        tabIndex={id === activeRowId ? 0 : -1}
                      />
                    </td>
                  ) : null}
                  <td className="col-actions" onClick={(event) => event.stopPropagation()}>
                    {failed ? (
                      <div className="table-failed-actions">
                        <Button size="sm" tabIndex={id === activeRowId ? 0 : -1} onClick={() => retryDeal(id)}>
                          <RefreshCw size={13} />
                          Retry
                        </Button>
                        <Button size="sm" variant="secondary" tabIndex={id === activeRowId ? 0 : -1} onClick={() => discardFailed(id)}>
                          Undo
                        </Button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="table-pager">
        <Button size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
          <ChevronLeft size={14} /> Previous
        </Button>
        <div className="table-pager-meta">
          <span>Page {formatCount(safePage)} of {formatCount(pageCount)}</span>
          <div className="table-page-size" role="group" aria-label="Rows per page">
            <span className="table-page-size-label">Rows</span>
            {TABLE_PAGE_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={pageSize === size ? 'is-active' : undefined}
                aria-pressed={pageSize === size}
                onClick={() => setPageSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
          Next <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  )
}
