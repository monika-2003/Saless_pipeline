import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { usePipeline } from '../../store/pipelineContext.js'
import { Button } from '../common/Button.jsx'
import { IconButton } from '../common/IconButton.jsx'
import { cx } from '../../utils/cx.js'
import '../bulk/bulk.css'

export function SimulationPanel() {
  const {
    simulationOpen,
    setSimulationOpen,
    openedDealId,
    simulation,
    updateSimulation,
    simulateConflict,
    simulateFailure,
  } = usePipeline()
  const panelRef = useRef(null)

  useEffect(() => {
    if (!simulationOpen) return undefined
    function onKey(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setSimulationOpen(false)
    }
    function onPointerDown(event) {
      if (event.target.closest('[data-sim-trigger]')) return
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setSimulationOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [setSimulationOpen, simulationOpen])

  if (!simulationOpen) return null

  return createPortal(
    <aside
      ref={panelRef}
      className={cx('sim-popover', openedDealId && 'is-with-drawer')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sim-title"
    >
      <div className="sim-head">
        <div>
          <h2 id="sim-title">Simulation controls</h2>
          <p className="sim-help" style={{ marginBottom: 0 }}>
            Admin tools for latency, failures, and teammate edits.
          </p>
        </div>
        <IconButton label="Close" onClick={() => setSimulationOpen(false)}>
          <X size={14} />
        </IconButton>
      </div>

      <div className="sim-row">
        <label htmlFor="latency-min">Network latency {simulation.latencyMin}–{simulation.latencyMax}ms</label>
        <input
          id="latency-min"
          type="range"
          min="100"
          max="1500"
          step="50"
          value={simulation.latencyMin}
          onChange={(event) => updateSimulation({ latencyMin: Number(event.target.value) })}
        />
        <input
          aria-label="Maximum latency"
          type="range"
          min="300"
          max="2500"
          step="50"
          value={simulation.latencyMax}
          onChange={(event) => updateSimulation({ latencyMax: Number(event.target.value) })}
        />
      </div>

      <div className="sim-row">
        <label htmlFor="failure-rate">Failure rate {Math.round(simulation.failureRate * 100)}%</label>
        <input
          id="failure-rate"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(simulation.failureRate * 100)}
          onChange={(event) => updateSimulation({ failureRate: Number(event.target.value) / 100 })}
        />
      </div>

      <div className="sim-row">
        <label
          className={cx('toggle', simulation.teammateEnabled && 'is-on')}
        >
          <span>Teammate activity</span>
          <input
            type="checkbox"
            className="sr-only"
            checked={simulation.teammateEnabled}
            onChange={(event) => updateSimulation({ teammateEnabled: event.target.checked })}
          />
          <span className="toggle-track" aria-hidden="true">
            <span className="toggle-thumb" />
          </span>
        </label>
      </div>

      <div className="sim-actions">
        <Button variant="secondary" onClick={simulateConflict}>Simulate conflict</Button>
        <Button variant="secondary" onClick={simulateFailure}>Simulate API failure</Button>
      </div>
    </aside>,
    document.body,
  )
}
