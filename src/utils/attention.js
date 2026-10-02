import { AlertCircle, AlertTriangle, Clock, IndianRupee, Radio, ShieldAlert } from 'lucide-react'
import { endOfDay, formatCloseRelative, formatMoneyCompact, startOfDay, startOfToday } from './format.js'

const DAY = 24 * 60 * 60 * 1000

/**
 * Needs Attention thresholds.
 * Overdue, closing-soon, and stale items are limited to high-priority
 * or ₹10L+ deals so the queue stays "what should I work on right now."
 * Failed saves and conflicts always appear.
 */
export const ATTENTION_THRESHOLDS = {
  CLOSING_SOON_DAYS: 7,
  STALE_DAYS: 14,
  HIGH_VALUE: 1_000_000,
}

export const ATTENTION_CATEGORIES = [
  {
    id: 'conflict',
    label: 'Conflict requiring attention',
    explanation: 'A teammate changed this deal while a save was in progress.',
    tone: 'danger',
    color: '#7c3aed',
    icon: ShieldAlert,
  },
  {
    id: 'failed',
    label: 'Failed save',
    explanation: 'The last change did not persist. Retry or undo it.',
    tone: 'danger',
    color: '#dc2626',
    icon: AlertTriangle,
  },
  {
    id: 'overdue',
    label: 'Overdue',
    explanation: 'Expected close date has already passed on a high-priority or high-value deal.',
    tone: 'danger',
    color: '#dc2626',
    icon: AlertCircle,
  },
  {
    id: 'closingSoon',
    label: 'Closing soon',
    explanation: `High-priority or high-value deal expected to close within ${ATTENTION_THRESHOLDS.CLOSING_SOON_DAYS} days.`,
    tone: 'warning',
    color: '#b45309',
    icon: Clock,
  },
  {
    id: 'stale',
    label: 'No recent activity',
    explanation: `No contact in ${ATTENTION_THRESHOLDS.STALE_DAYS}+ days on a high-priority or high-value deal.`,
    tone: 'warning',
    color: '#ca8a04',
    icon: Radio,
  },
  {
    id: 'highValue',
    label: 'High-value opportunity',
    explanation: `Open deal worth ₹10L or more that is not already overdue or closing soon.`,
    tone: 'info',
    color: '#4f46e5',
    icon: IndianRupee,
  },
]

export const ATTENTION_CATEGORY_BY_ID = Object.fromEntries(
  ATTENTION_CATEGORIES.map((category) => [category.id, category]),
)

export function isOpenDeal(deal) {
  return deal.stage !== 'won' && deal.stage !== 'lost'
}

export function getAttentionReason(deal, overlays, now = Date.now()) {
  if (overlays.conflicts[deal.id]) return 'conflict'
  if (overlays.failed[deal.id]) return 'failed'
  if (!isOpenDeal(deal)) return null

  const noteworthy = deal.priority === 'high' || deal.value >= ATTENTION_THRESHOLDS.HIGH_VALUE
  if (!noteworthy) return null

  const today = startOfToday()
  if (deal.expectedCloseDate < today) return 'overdue'

  const closingUntil = endOfDay(today + ATTENTION_THRESHOLDS.CLOSING_SOON_DAYS * DAY)
  if (deal.expectedCloseDate <= closingUntil) return 'closingSoon'

  const stale = now - deal.lastContactedAt > ATTENTION_THRESHOLDS.STALE_DAYS * DAY
  if (stale) return 'stale'

  if (deal.value >= ATTENTION_THRESHOLDS.HIGH_VALUE && deal.priority === 'high') return 'highValue'
  return null
}

export function formatAttentionWhy(deal, reason, now = Date.now()) {
  if (reason === 'overdue') {
    const days = Math.max(1, Math.round((startOfToday() - startOfDay(deal.expectedCloseDate)) / DAY))
    return days === 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`
  }
  if (reason === 'closingSoon') return formatCloseRelative(deal.expectedCloseDate)
  if (reason === 'stale') {
    const days = Math.max(ATTENTION_THRESHOLDS.STALE_DAYS, Math.round((now - deal.lastContactedAt) / DAY))
    return `No activity for ${days} days`
  }
  if (reason === 'highValue') return `High-value open deal · ${formatMoneyCompact(deal.value)}`
  if (reason === 'failed') return 'The last save did not reach the server'
  if (reason === 'conflict') return 'A teammate changed this deal while you were saving'
  return 'Needs attention'
}

function sortAttentionDeals(reason, left, right) {
  if (reason === 'overdue') return left.expectedCloseDate - right.expectedCloseDate
  if (reason === 'closingSoon') return left.expectedCloseDate - right.expectedCloseDate
  if (reason === 'stale') return left.lastContactedAt - right.lastContactedAt
  return right.value - left.value
}

export function groupAttentionDeals(ids, getDeal, overlays) {
  const buckets = Object.fromEntries(ATTENTION_CATEGORIES.map((category) => [category.id, []]))

  for (const id of ids) {
    const deal = getDeal(id)
    if (!deal) continue
    const reason = getAttentionReason(deal, overlays)
    if (!reason || !buckets[reason]) continue
    buckets[reason].push(deal)
  }

  return ATTENTION_CATEGORIES
    .map((category) => ({
      ...category,
      deals: buckets[category.id].sort((left, right) => sortAttentionDeals(category.id, left, right)),
    }))
    .filter((group) => group.deals.length > 0)
}

export function groupAttentionIds(ids, getDeal, overlays) {
  const grouped = Object.fromEntries(ATTENTION_CATEGORIES.map((category) => [category.id, []]))

  for (const group of groupAttentionDeals(ids, getDeal, overlays)) {
    grouped[group.id] = group.deals.map((deal) => deal.id)
  }

  return grouped
}
