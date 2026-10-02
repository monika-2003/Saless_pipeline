import { Radio } from 'lucide-react'
import { Header } from './components/layout/Header.jsx'
import { ViewTabs } from './components/layout/ViewTabs.jsx'
import { FilterBar } from './components/layout/FilterBar.jsx'
import { ActivityPanel } from './components/layout/ActivityPanel.jsx'
import { PipelineBoard } from './components/pipeline/PipelineBoard.jsx'
import { AttentionTable } from './components/attention/AttentionTable.jsx'
import { DealList } from './components/deal/DealList.jsx'
import { DealTable } from './components/deal/DealTable.jsx'
import { DealDrawer } from './components/deal/DealDrawer.jsx'
import { BulkProgress, BulkToolbar } from './components/bulk/BulkToolbar.jsx'
import { SimulationPanel } from './components/simulation/SimulationPanel.jsx'
import { Skeleton } from './components/common/Skeleton.jsx'
import { useFilterChromeScroll } from './hooks/useFilterChromeScroll.js'
import { usePipeline } from './store/pipelineContext.js'
import { STAGE_BY_ID, STAGES } from './data/constants.js'
import { ACTIVITY_TYPES, formatActivityHeadline } from './utils/activity.js'
import { cx } from './utils/cx.js'
import './components/common/common.css'
import './components/pipeline/pipeline.css'
import './App.css'

function LoadingScreen() {
  return (
    <div className="boot-screen">
      <Skeleton width={220} height={22} />
      <div className="loading-grid">
        {STAGES.map((stage) => (
          <div key={stage.id} className="stage-column" style={{ minHeight: 280, padding: 12, '--stage': stage.color }}>
            <Skeleton width="50%" height={14} style={{ marginBottom: 12 }} />
            <Skeleton height={88} style={{ marginBottom: 8 }} />
            <Skeleton height={88} style={{ marginBottom: 8 }} />
            <Skeleton height={88} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityLive() {
  const { activityEvents } = usePipeline()
  const latest = activityEvents.find((event) => event.type === ACTIVITY_TYPES.DEAL_MOVED) || activityEvents[0]
  if (!latest) {
    return (
      <div className="activity-live-row">
        <div className="activity-live is-idle">
          <Radio size={13} />
          Teammate activity will appear here
        </div>
      </div>
    )
  }
  const stage = STAGE_BY_ID[latest.metadata?.toStage]
  const isMove = latest.type === ACTIVITY_TYPES.DEAL_MOVED
  return (
    <div className="activity-live-row">
      <div className="activity-live is-live" aria-live="polite">
        <span className="activity-live-icon" aria-hidden="true">
          <Radio size={13} />
        </span>
        <span className="activity-live-text">
          {isMove ? (
            <>
              <strong>{latest.actorName}</strong> moved <strong>{latest.dealName}</strong> to{' '}
              {stage ? (
                <span className="activity-stage-chip" style={{ '--stage': stage.color }}>
                  {stage.label}
                </span>
              ) : latest.metadata?.toStage}
            </>
          ) : (
            <>
              <strong>{latest.actorName || 'Pipeline'}</strong> {formatActivityHeadline(latest)}
            </>
          )}
        </span>
      </div>
    </div>
  )
}

function AppShell() {
  const { ready, view, layout, listIds, clearSelection, openedDealId } = usePipeline()
  const { shellRef, headerRef, tabsRef, actionsRef } = useFilterChromeScroll(ready)
  const pipelineView = view === 'all' || view === 'mine'
  const tableLayout = pipelineView && layout === 'table'
  const showBoardChrome = pipelineView && layout !== 'table'

  if (!ready) return <LoadingScreen />

  return (
    <div
      ref={shellRef}
      className={cx('app-shell', tableLayout && 'is-table-layout')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !openedDealId) clearSelection()
      }}
    >
      <div className="app-sticky-header" ref={headerRef}>
        <Header />
      </div>
      <div className="app-view-tabs-wrap" ref={tabsRef}>
        <ViewTabs />
      </div>
      <FilterBar />
      <div className="app-sticky-actions" ref={actionsRef}>
        {showBoardChrome ? <ActivityLive /> : null}
        <BulkToolbar />
        <BulkProgress />
      </div>
      <main className="app-main">
        {view === 'attention' ? (
          <AttentionTable />
        ) : view === 'failed' ? (
          <DealList
            ids={listIds}
            emptyTitle="No failed saves"
            emptyMessage="When a move cannot be saved, it will show up here with a retry action."
          />
        ) : layout === 'table' ? (
          <DealTable />
        ) : (
          <PipelineBoard />
        )}
      </main>
      <DealDrawer />
      <SimulationPanel />
      <ActivityPanel />
    </div>
  )
}

export default function App() {
  return <AppShell />
}
