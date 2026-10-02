import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { STAGE_BY_ID } from '../../data/constants.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { formatActivityHeadline, groupActivityEvents } from '../../utils/activity.js'
import { Avatar } from '../common/Avatar.jsx'
import { IconButton } from '../common/IconButton.jsx'
import { cx } from '../../utils/cx.js'

export function ActivityPanel() {
  const { activityOpen, setActivityOpen, activityEvents, openedDealId, openDeal } = usePipeline()
  const panelRef = useRef(null)

  useEffect(() => {
    if (!activityOpen) return undefined
    function onKey(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setActivityOpen(false)
    }
    function onPointerDown(event) {
      if (event.target.closest('[data-activity-trigger]')) return
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setActivityOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [activityOpen, setActivityOpen])

  if (!activityOpen) return null

  const groups = groupActivityEvents(activityEvents)

  return createPortal(
    <aside
      ref={panelRef}
      className={cx('activity-popover', openedDealId && 'is-with-drawer')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-title"
    >
      <div className="sim-head">
        <div>
          <h2 id="activity-title">Activity</h2>
          <p className="sim-help" style={{ marginBottom: 0 }}>
            Recent teammate and save events for this session.
          </p>
        </div>
        <IconButton label="Close activity" onClick={() => setActivityOpen(false)}>
          <X size={14} />
        </IconButton>
      </div>

      <div className="activity-feed">
        {groups.length === 0 ? (
          <p className="sim-help">Moves, failures, conflicts, and bulk jobs will show up here.</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="activity-feed-group">
              <h3>{group.label}</h3>
              {group.events.map((event) => {
                const stage = STAGE_BY_ID[event.metadata?.toStage]
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="activity-feed-item"
                    onClick={() => {
                      if (event.dealId) openDeal(event.dealId)
                    }}
                  >
                    <Avatar name={event.actorName || 'Team'} />
                    <span>
                      {event.type === 'DEAL_MOVED' ? (
                        <>
                          <strong>{event.actorName}</strong> moved <strong>{event.dealName}</strong>
                          {stage ? (
                            <span className="activity-stage-chip" style={{ '--stage': stage.color }}>
                              {stage.label}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <strong>{event.actorName || 'Pipeline'}</strong>{' '}
                          {formatActivityHeadline(event)}
                        </>
                      )}
                    </span>
                  </button>
                )
              })}
            </section>
          ))
        )}
      </div>
    </aside>,
    document.body,
  )
}
