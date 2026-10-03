import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { usePipeline } from '../../store/pipelineContext.js'
import { formatCount } from '../../utils/format.js'
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
    resetDemoData,
    selectedIds,
    simulateConflict,
    simulateFailure,
    getDeal,
  } = usePipeline()
  const selectedList = [...selectedIds]
  const selectedCount = selectedList.length
  const openedDeal = !selectedCount && openedDealId ? getDeal(openedDealId) : null
  const targetList = selectedCount ? selectedList : openedDeal ? [openedDeal.id] : []
  const targetCount = targetList.length
  const panelRef = useRef(null)
  const [confirmReset, setConfirmReset] = useState(false)
  useFocusTrap(panelRef, {
    enabled: simulationOpen,
    onClose: () => {
      setSimulationOpen(false)
      setConfirmReset(false)
    },
  })

  useEffect(() => {
    if (!simulationOpen) setConfirmReset(false)
  }, [simulationOpen])

  useEffect(() => {
    if (!simulationOpen) return undefined
    function onPointerDown(event) {
      if (event.target.closest('[data-sim-trigger]')) return
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setSimulationOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
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
        <IconButton label="Close" data-autofocus onClick={() => setSimulationOpen(false)}>
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

      <p className="sim-help">
        {openedDeal
          ? `Arm ${openedDeal.company}, then move stage or Mark lost in the deal drawer.`
          : 'Select deals or open a deal, arm a conflict or API failure, then Move to… or Mark lost.'}
      </p>
      <div className="sim-actions">
        <Button
          variant="secondary"
          disabled={!targetCount}
          onClick={() => simulateConflict(targetList)}
        >
          {selectedCount ? `Simulate conflict (${formatCount(selectedCount)})` : 'Simulate conflict'}
        </Button>
        <Button
          variant="secondary"
          disabled={!targetCount}
          onClick={() => simulateFailure(targetList)}
        >
          {selectedCount ? `Simulate API failure (${formatCount(selectedCount)})` : 'Simulate API failure'}
        </Button>
      </div>

      <div className="sim-reset">
        <p className="sim-help">Moves stay after reload. Reset restores the original 50,000 deals.</p>
        {confirmReset ? (
          <div className="sim-actions">
            <Button
              variant="danger"
              onClick={() => {
                resetDemoData()
                setConfirmReset(false)
                setSimulationOpen(false)
              }}
            >
              Confirm reset
            </Button>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmReset(true)}>Reset demo data</Button>
        )}
      </div>
    </aside>,
    document.body,
  )
}
