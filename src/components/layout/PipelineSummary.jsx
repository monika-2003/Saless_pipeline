import { useEffect, useRef, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { usePipeline } from '../../store/pipelineContext.js'
import { formatCount, formatMoneyCompact } from '../../utils/format.js'

export function PipelineSummary() {
  const { summaries, setActivityOpen, setSimulationOpen } = usePipeline()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const metrics = [
    { label: 'Total deals', value: formatCount(summaries.totalDeals) },
    { label: 'Pipeline value', value: formatMoneyCompact(summaries.pipelineValue) },
    { label: 'Won this month', value: formatMoneyCompact(summaries.wonThisMonth) },
    { label: 'Needs attention', value: formatCount(summaries.needsAttention) },
  ]

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="pipeline-summary" ref={ref}>
      <button
        type="button"
        className="pipeline-summary-trigger"
        aria-expanded={open}
        aria-controls="pipeline-summary-popover"
        onClick={() => {
          setActivityOpen(false)
          setSimulationOpen(false)
          setOpen((current) => !current)
        }}
      >
        <BarChart3 size={14} aria-hidden="true" />
        <span className="pipeline-summary-label">Pipeline summary</span>
        <span className="pipeline-summary-line">
          {formatCount(summaries.totalDeals)} deals · {formatMoneyCompact(summaries.pipelineValue)} pipeline ·{' '}
          {formatMoneyCompact(summaries.wonThisMonth)} won · {formatCount(summaries.needsAttention)} need attention
        </span>
      </button>
      {open ? (
        <div
          id="pipeline-summary-popover"
          className="pipeline-summary-popover"
          role="dialog"
          aria-label="Pipeline summary"
        >
          <dl>
            {metrics.map((metric) => (
              <div key={metric.label} className="pipeline-summary-row">
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}
