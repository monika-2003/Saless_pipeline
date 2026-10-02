import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { STAGES, TABLE_PAGE_SIZE, TABLE_PAGE_SIZES } from '../../data/constants.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { pinSelectedFirst } from '../../utils/selection.js'
import { formatCloseRelative, formatCount, formatMoney } from '../../utils/format.js'
import { Badge } from '../common/Badge.jsx'
import { Button } from '../common/Button.jsx'
import { Checkbox } from '../common/Checkbox.jsx'
import { DealMoveMenu } from './DealMoveMenu.jsx'
import './deal.css'

export function DealTable({
  tablistLabel = 'Stages',
  tabs,
  idsByTab,
  defaultTabId,
  getWhy,
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
  const activeTab = resolvedTabs.find((tab) => tab.id === tabId) || resolvedTabs[0]
  const rawIds = resolvedIdsByTab[activeTab?.id] || []
  const ids = useMemo(
    () => (pinSelected ? pinSelectedFirst(rawIds, selectedIds) : rawIds),
    [pinSelected, rawIds, selectedIds],
  )
  const pageCount = Math.max(1, Math.ceil(ids.length / pageSize))
  const safePage = Math.min(page, pageCount)

  useEffect(() => {
    if (resolvedTabs.some((tab) => tab.id === tabId)) return
    setTabId(resolvedTabs[0]?.id)
  }, [resolvedTabs, tabId])

  useEffect(() => {
    setPage(1)
  }, [tabId, ids.length, pageSize])

  useEffect(() => {
    if (!pinSelected || !selectedIds.size) return
    if (rawIds.some((id) => selectedIds.has(id))) setPage(1)
  }, [pinSelected, rawIds, selectedIds])

  const pageIds = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return ids.slice(start, start + pageSize)
  }, [ids, safePage, pageSize])

  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length
  const allPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length
  const startIndex = ids.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endIndex = Math.min(ids.length, safePage * pageSize)
  const colCount = getWhy ? 10 : 9

  return (
    <div className="deal-table-wrap">
      <div className="table-stage-tabs" role="tablist" aria-label={tablistLabel}>
        {resolvedTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab?.id === tab.id}
            className={activeTab?.id === tab.id ? 'table-stage-tab is-active' : 'table-stage-tab'}
            style={{ '--stage': tab.color }}
            onClick={(event) => {
              setTabId(tab.id)
              event.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
            }}
          >
            <span className="color-dot" style={{ background: tab.color }} />
            <span className="table-stage-label">{tab.label}</span>
            <span className="table-stage-count">{formatCount(resolvedIdsByTab[tab.id]?.length || 0)}</span>
          </button>
        ))}
      </div>

      <div className="table-toolbar">
        <strong style={{ '--stage': activeTab?.color }}>
          <span className="color-dot" aria-hidden="true" style={{ background: activeTab?.color }} />
          {activeTab?.label}
          <span className="table-toolbar-count">{formatCount(ids.length)} deals</span>
        </strong>
        <span className="table-range">
          Showing {formatCount(startIndex)}–{formatCount(endIndex)} of {formatCount(ids.length)}
        </span>
      </div>

      <div className="deal-table-scroll">
        <table className="deal-table">
          <thead>
            <tr>
              <th className="col-check">
                <Checkbox
                  aria-label={`Select visible ${activeTab?.label || ''} deals`}
                  checked={allPageSelected}
                  indeterminate={selectedOnPage > 0 && !allPageSelected}
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
              <th className="col-status">Status</th>
              <th className="col-move">Move</th>
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
                  className={selectedIds.has(id) ? 'is-selected' : undefined}
                  onClick={() => openDeal(id)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') openDeal(id)
                    if (event.key === ' ') {
                      event.preventDefault()
                      toggleSelect(id)
                    }
                  }}
                >
                  <td className="col-check" onClick={(event) => event.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(id)} onChange={() => toggleSelect(id)} />
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
                  <td className="col-status">
                    {pending ? 'Saving…' : null}
                    {saved && !pending && !failed ? 'Saved' : null}
                    {failed ? (
                      <span className="table-failed">
                        Save failed
                        <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); retryDeal(id) }}>Retry</Button>
                        <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); discardFailed(id) }}>Undo</Button>
                      </span>
                    ) : null}
                    {conflict ? 'Conflict' : null}
                    {!pending && !saved && !failed && !conflict ? '—' : null}
                  </td>
                  <td className="col-move" onClick={(event) => event.stopPropagation()}>
                    <DealMoveMenu deal={deal} onMove={requestMove} />
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
