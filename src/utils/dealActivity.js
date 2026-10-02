import { CURRENT_USER, OWNERS, STAGE_BY_ID } from '../data/constants.js'
import { mulberry32 } from '../data/mockData.js'

const DAY = 24 * 60 * 60 * 1000

function hashId(id) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return hash >>> 0
}

export function getDealActivity(deal, currentUserName = CURRENT_USER) {
  const random = mulberry32(hashId(deal.id) || 1)
  const count = 3 + Math.floor(random() * 3)
  const people = [deal.owner, currentUserName, OWNERS[Math.floor(random() * OWNERS.length)]]
  const actions = [
    `moved deal to ${STAGE_BY_ID[deal.stage].label}`,
    'updated deal value',
    'changed expected close date',
    'logged a customer call',
    'added a follow-up note',
  ]

  const events = []
  let cursor = Date.now() - Math.floor(random() * 6 * 60 * 60 * 1000)
  for (let i = 0; i < count; i += 1) {
    events.push({
      id: `${deal.id}-act-${i}`,
      actor: people[Math.floor(random() * people.length)],
      text: actions[Math.floor(random() * actions.length)],
      at: cursor,
    })
    cursor -= (4 + Math.floor(random() * 20)) * 60 * 60 * 1000
    if (random() > 0.6) cursor -= DAY
  }
  return events
}

export function groupActivityByDay(events) {
  const groups = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = today.getTime() - DAY

  for (const event of events) {
    const day = new Date(event.at)
    day.setHours(0, 0, 0, 0)
    let label = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(day)
    if (day.getTime() === today.getTime()) label = 'Today'
    else if (day.getTime() === yesterday) label = 'Yesterday'

    const last = groups[groups.length - 1]
    if (last && last.label === label) last.events.push(event)
    else groups.push({ label, events: [event] })
  }
  return groups
}
