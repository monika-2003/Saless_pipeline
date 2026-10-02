import { CURRENT_USER } from '../data/constants.js'
import { getAttentionReason } from './attention.js'
import { endOfDay, parseDateInput, startOfToday } from './format.js'

const DAY = 24 * 60 * 60 * 1000

export function dealMatchesSearch(deal, query) {
  if (!query) return true
  return (
    deal.company.toLowerCase().includes(query) ||
    deal.contactName.toLowerCase().includes(query) ||
    deal.owner.toLowerCase().includes(query)
  )
}

function selected(values) {
  return Array.isArray(values) ? values : values ? [values] : []
}

export function dealMatchesFilters(deal, filters) {
  const owners = selected(filters.owner)
  const priorities = selected(filters.priority)
  const stages = selected(filters.stage)
  if (owners.length && !owners.includes(deal.owner)) return false
  if (priorities.length && !priorities.includes(deal.priority)) return false
  if (stages.length && !stages.includes(deal.stage)) return false
  if (filters.minValue && deal.value < filters.minValue) return false
  if (!matchesCloseDate(deal.expectedCloseDate, filters)) return false
  return true
}

function matchesCloseDate(closeDate, filters) {
  const today = startOfToday()

  if (filters.closeRange === 'overdue') return closeDate < today
  if (filters.closeRange === 'week') {
    return closeDate >= today && closeDate <= endOfDay(today + 7 * DAY)
  }
  if (filters.closeRange === 'month') {
    return closeDate >= today && closeDate <= endOfDay(today + 30 * DAY)
  }

  let from = parseDateInput(filters.closeFrom)
  let to = parseDateInput(filters.closeTo)
  if (from != null && to != null && from > to) {
    const swap = from
    from = to
    to = swap
  }
  if (from != null && closeDate < from) return false
  if (to != null && closeDate > endOfDay(to)) return false
  return true
}

export function isNeedsAttention(deal, overlays) {
  return getAttentionReason(deal, overlays) != null
}

export function matchesView(deal, view, overlays, currentUserName = CURRENT_USER) {
  if (view === 'mine') return deal.owner === currentUserName
  if (view === 'failed') return Boolean(overlays.failed[deal.id])
  if (view === 'attention') return isNeedsAttention(deal, overlays)
  return true
}

export function createEmptyFilters() {
  return {
    search: '',
    owner: [],
    priority: [],
    stage: [],
    minValue: 0,
    closeRange: '',
    closeFrom: '',
    closeTo: '',
  }
}

export const EMPTY_FILTERS = createEmptyFilters()
