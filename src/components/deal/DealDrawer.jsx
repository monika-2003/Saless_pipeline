import { Calendar, CircleDollarSign, Phone, User } from 'lucide-react'
import { STAGE_BY_ID } from '../../data/constants.js'
import { canMoveStage, movableStages } from '../../utils/stageOrder.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { getDealActivity, groupActivityByDay } from '../../utils/dealActivity.js'
import { formatDateLong, formatMoney, formatTime } from '../../utils/format.js'
import { Avatar } from '../common/Avatar.jsx'
import { Badge } from '../common/Badge.jsx'
import { Button } from '../common/Button.jsx'
import { Drawer } from '../common/Drawer.jsx'
import { Select } from '../common/Select.jsx'
import './deal.css'

export function DealDrawer() {
  const {
    openedDealId,
    closeDeal,
    getDeal,
    overlays,
    requestMove,
    retryDeal,
    discardFailed,
    resolveConflict,
    currentUser,
  } = usePipeline()
  const deal = openedDealId ? getDeal(openedDealId) : null
  if (!deal) return null

  const failed = overlays.failed[deal.id]
  const conflict = overlays.conflicts[deal.id]
  const pending = overlays.pending[deal.id]
  const saved = overlays.saved?.[deal.id]
  const groups = groupActivityByDay(getDealActivity(deal, currentUser.name))

  return (
    <Drawer title={deal.company} labelledBy="deal-drawer-title" onClose={closeDeal}>
      <div className="drawer-grid">
        <div>
          <div className="detail-label">Contact</div>
          <div className="detail-value">{deal.contactName}</div>
        </div>
        <div>
          <div className="detail-label">Deal value</div>
          <div className="detail-value">{formatMoney(deal.value)}</div>
        </div>
        <div>
          <div className="detail-label">Owner</div>
          <div className="detail-value" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Avatar name={deal.owner} /> {deal.owner}
          </div>
        </div>
        <div>
          <div className="detail-label">Stage</div>
          <div className="detail-value">{STAGE_BY_ID[deal.stage].label}</div>
        </div>
        <div>
          <div className="detail-label">Probability</div>
          <div className="detail-value">{Math.max(0, Math.min(100, deal.probability))}%</div>
        </div>
        <div>
          <div className="detail-label">Priority</div>
          <div className="detail-value"><Badge tone={deal.priority}>{deal.priority}</Badge></div>
        </div>
        <div>
          <div className="detail-label">Expected close</div>
          <div className="detail-value">{formatDateLong(deal.expectedCloseDate)}</div>
        </div>
        <div>
          <div className="detail-label">Last contacted</div>
          <div className="detail-value">{formatDateLong(deal.lastContactedAt)}</div>
        </div>
        <div className="wide">
          <div className="detail-label">Created</div>
          <div className="detail-value">{formatDateLong(deal.createdAt)}</div>
        </div>
      </div>

      <div className="drawer-actions">
        <Select
          label="Move stage"
          value={deal.stage}
          onChange={(stage) => requestMove(deal.id, stage)}
          options={[
            { value: deal.stage, label: STAGE_BY_ID[deal.stage].label, color: STAGE_BY_ID[deal.stage].color },
            ...movableStages(deal.stage).map((stage) => ({
              value: stage.id,
              label: stage.label,
              color: stage.color,
            })),
          ]}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          {canMoveStage(deal.stage, 'won') ? (
            <Button variant="primary" onClick={() => requestMove(deal.id, 'won')}>Mark won</Button>
          ) : null}
          {canMoveStage(deal.stage, 'lost') ? (
            <Button variant="danger" onClick={() => requestMove(deal.id, 'lost')}>Mark lost</Button>
          ) : null}
        </div>
      </div>

      {pending ? <p className="deal-status is-saving">Saving…</p> : null}
      {saved && !pending ? <p className="deal-status is-saved">Saved</p> : null}
      {failed ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => retryDeal(deal.id)}>Retry</Button>
          <Button onClick={() => discardFailed(deal.id)}>Undo</Button>
        </div>
      ) : null}
      {conflict ? (
        <div className="conflict-box">
          <strong>Deal updated by another teammate</strong>
          <p>
            Your change: {STAGE_BY_ID[conflict.localStage].label}
            <br />
            Latest teammate change: {STAGE_BY_ID[conflict.serverDeal.stage].label}
            {conflict.actorName ? (
              <>
                <br />
                Updated by: {conflict.actorName}
              </>
            ) : null}
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" variant="primary" onClick={() => resolveConflict(deal.id, 'mine')}>Keep my change</Button>
            <Button size="sm" onClick={() => resolveConflict(deal.id, 'server')}>Use latest</Button>
          </div>
        </div>
      ) : null}

      <div className="activity-group">
        <h3>Activity</h3>
        {groups.map((group) => (
          <div key={group.label}>
            <h3>{group.label}</h3>
            {group.events.map((event) => (
              <div className="activity-item" key={event.id}>
                <Avatar name={event.actor} />
                <div>
                  <p>
                    {event.actor} {event.text}
                  </p>
                  <small>{formatTime(event.at)}</small>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="deal-contact" style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span><User size={12} /> {deal.owner}</span>
        <span><CircleDollarSign size={12} /> {formatMoney(deal.value)}</span>
        <span><Calendar size={12} /> {formatDateLong(deal.expectedCloseDate)}</span>
        <span><Phone size={12} /> {formatDateLong(deal.lastContactedAt)}</span>
      </p>
    </Drawer>
  )
}
