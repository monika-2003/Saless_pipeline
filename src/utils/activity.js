import { STAGE_BY_ID } from '../data/constants.js'
import { formatCount } from './format.js'

export const ACTIVITY_TYPES = {
  DEAL_MOVED: 'DEAL_MOVED',
  DEAL_UPDATED: 'DEAL_UPDATED',
  SAVE_FAILED: 'SAVE_FAILED',
  SAVE_RETRIED: 'SAVE_RETRIED',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  CONFLICT_RESOLVED: 'CONFLICT_RESOLVED',
  BULK_OPERATION_STARTED: 'BULK_OPERATION_STARTED',
  BULK_OPERATION_COMPLETED: 'BULK_OPERATION_COMPLETED',
  BULK_OPERATION_PARTIAL_FAILURE: 'BULK_OPERATION_PARTIAL_FAILURE',
}

export function createActivityEvent({
  type,
  dealId = null,
  dealName = '',
  actorId = '',
  actorName = '',
  metadata = {},
}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    dealId,
    dealName,
    actorId,
    actorName,
    timestamp: Date.now(),
    metadata,
  }
}

export function stageLabel(stageId) {
  return STAGE_BY_ID[stageId]?.label || stageId || 'Unknown'
}

export function formatActivityHeadline(event) {
  const name = event.dealName || 'a deal'
  const to = stageLabel(event.metadata?.toStage)
  const from = stageLabel(event.metadata?.fromStage)

  switch (event.type) {
    case ACTIVITY_TYPES.DEAL_MOVED:
      return `moved ${name} to ${to}`
    case ACTIVITY_TYPES.DEAL_UPDATED:
      return `updated ${name}`
    case ACTIVITY_TYPES.SAVE_FAILED:
      return `could not save ${name}`
    case ACTIVITY_TYPES.SAVE_RETRIED:
      return `retried saving ${name}`
    case ACTIVITY_TYPES.CONFLICT_DETECTED:
      return `Conflict detected for ${name}`
    case ACTIVITY_TYPES.CONFLICT_RESOLVED:
      return event.metadata?.choice === 'mine'
        ? `kept their change to ${to}`
        : `used the latest change for ${name}`
    case ACTIVITY_TYPES.BULK_OPERATION_STARTED:
      return `started moving ${formatCount(event.metadata?.total || 0)} deals to ${to}`
    case ACTIVITY_TYPES.BULK_OPERATION_COMPLETED:
      return `moved ${formatCount(event.metadata?.succeeded || 0)} deals to ${to}`
    case ACTIVITY_TYPES.BULK_OPERATION_PARTIAL_FAILURE:
      return `moved ${formatCount(event.metadata?.succeeded || 0)} deals to ${to}, ${formatCount(event.metadata?.failed || 0)} failed`
    default:
      return from && to ? `updated ${name}` : name
  }
}

export function formatRelativeActivity(timestamp, now = Date.now()) {
  const delta = Math.max(0, now - timestamp)
  if (delta < 45_000) return 'Just now'
  if (delta < 90_000) return '1 minute ago'
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)} minutes ago`
  if (delta < 5_400_000) return '1 hour ago'
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)} hours ago`
  return `${Math.round(delta / 86_400_000)}d ago`
}

export function groupActivityEvents(events, now = Date.now()) {
  const groups = []
  for (const event of events) {
    const label = formatRelativeActivity(event.timestamp, now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.events.push(event)
    else groups.push({ label, events: [event] })
  }
  return groups
}

const STORAGE_KEY = 'sales-pipeline-activity'

export function loadStoredActivity(limit) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, limit)
  } catch {
    return []
  }
}

export function persistActivity(events, limit) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, limit)))
  } catch {
    /* quota or private mode */
  }
}

export function clearStoredActivity() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
