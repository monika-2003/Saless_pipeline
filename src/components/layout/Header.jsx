import { Radio, SlidersHorizontal } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { formatCount } from '../../utils/format.js'
import { Button } from '../common/Button.jsx'
import { Input } from '../common/Input.jsx'
import { Tooltip } from '../common/Tooltip.jsx'
import { AppearanceMenu } from './AppearanceMenu.jsx'
import { PipelineSummary } from './PipelineSummary.jsx'
import { UserSwitcher } from './UserSwitcher.jsx'

export function Header() {
  const {
    filterDraft,
    setFilterDraft,
    setSimulationOpen,
    activityEvents,
    activityOpen,
    setActivityOpen,
  } = usePipeline()
  const isNarrow = useMediaQuery('(max-width: 768px)')

  return (
    <header className="app-header">
      <div className="header-copy">
        <h1>Sales Pipeline</h1>
        <PipelineSummary />
      </div>
      <div className="header-actions">
        <div className="header-search">
          <Input
            icon="search"
            type="search"
            placeholder={isNarrow ? 'Search deals' : 'Search company, contact, or owner'}
            value={filterDraft.search}
            onChange={(event) => setFilterDraft((current) => ({ ...current, search: event.target.value }))}
            aria-label="Search deals"
          />
        </div>
        <Button
          variant={activityOpen ? 'primary' : 'secondary'}
          data-activity-trigger="true"
          aria-label="Activity"
          onClick={() => {
            setSimulationOpen(false)
            setActivityOpen((open) => !open)
          }}
        >
          <Radio size={15} />
          <span className="btn-text">Activity</span>
          {activityEvents.length ? <span className="count-chip">{formatCount(activityEvents.length)}</span> : null}
        </Button>
        <Tooltip label="Latency, failures, teammates, conflicts">
          <Button
            variant="secondary"
            data-sim-trigger="true"
            aria-label="Simulation"
            onClick={() => {
              setActivityOpen(false)
              setSimulationOpen((open) => !open)
            }}
          >
            <SlidersHorizontal size={15} />
            <span className="btn-text">Simulation</span>
          </Button>
        </Tooltip>
        <UserSwitcher />
        <AppearanceMenu />
      </div>
    </header>
  )
}
