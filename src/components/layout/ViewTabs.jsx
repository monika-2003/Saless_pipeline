import { VIEWS } from '../../data/constants.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { formatCount } from '../../utils/format.js'

export function ViewTabs() {
  const { view, setView, overlays, summaries, layout, setLayout } = usePipeline()
  const failedCount = Object.keys(overlays.failed).length
  const counts = {
    all: summaries.totalDeals,
    mine: summaries.myDeals,
    attention: summaries.needsAttention,
    failed: failedCount,
  }

  return (
    <div className="view-tabs-row">
      <div className="view-tabs" role="tablist" aria-label="Pipeline views">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            className={view === item.id ? 'view-tab is-active' : 'view-tab'}
            style={{ '--stage': item.color }}
            onClick={() => setView(item.id)}
          >
            <span className="color-dot" style={{ background: item.color }} />
            <span className="view-tab-label">{item.label}</span>
            {counts[item.id] != null ? <span className="count">{formatCount(counts[item.id])}</span> : null}
          </button>
        ))}
      </div>
      {view === 'all' || view === 'mine' ? (
        <div className="layout-toggle" role="group" aria-label="Pipeline layout">
          <button
            type="button"
            className={layout === 'board' ? 'is-active' : undefined}
            onClick={() => setLayout('board')}
          >
            Board
          </button>
          <button
            type="button"
            className={layout === 'table' ? 'is-active' : undefined}
            onClick={() => setLayout('table')}
          >
            Table
          </button>
        </div>
      ) : null}
    </div>
  )
}
