import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { STAGE_BY_ID } from '../../data/constants.js'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { filterActivityEvents, formatActivityHeadline, groupActivityEvents } from '../../utils/activity.js'
import { Avatar } from '../common/Avatar.jsx'
import { IconButton } from '../common/IconButton.jsx'
import { Input } from '../common/Input.jsx'
import { cx } from '../../utils/cx.js'

export function ActivityPanel() {
  const { activityOpen, setActivityOpen, activityEvents, openedDealId, openDeal } = usePipeline()
  const [query, setQuery] = useState('')
  const panelRef = useRef(null)
  useFocusTrap(panelRef, {
    enabled: activityOpen,
    onClose: () => setActivityOpen(false),
  })

  useEffect(() => {
    if (!activityOpen) return undefined
    function onPointerDown(event) {
      if (event.target.closest('[data-activity-trigger]')) return
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setActivityOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [activityOpen, setActivityOpen])

  useEffect(() => {
    if (!activityOpen) setQuery('')
  }, [activityOpen])

  const groups = useMemo(
    () => groupActivityEvents(filterActivityEvents(activityEvents, query)),
    [activityEvents, query],
  )

  if (!activityOpen) return null

  const hasEvents = activityEvents.length > 0
  const hasMatches = groups.some((group) => group.events.length > 0)

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

      <div className="activity-search">
        <Input
          icon="search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search activity"
          aria-label="Search activity"
          data-autofocus
        />
      </div>

      <div className="activity-feed">
        {!hasEvents ? (
          <p className="sim-help">Moves, failures, conflicts, and bulk jobs will show up here.</p>
        ) : !hasMatches ? (
          <p className="sim-help">No activity matches “{query.trim()}”.</p>
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
