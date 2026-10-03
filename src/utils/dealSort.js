export const STAGE_SORTS = [
  { id: 'priority', label: 'Priority', defaultDir: 'desc' },
  { id: 'date', label: 'Date', defaultDir: 'asc' },
  { id: 'name', label: 'Name', defaultDir: 'asc' },
  { id: 'price', label: 'Price', defaultDir: 'desc' },
]

export const STAGE_SORT_BY_ID = Object.fromEntries(STAGE_SORTS.map((item) => [item.id, item]))

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 }

function compareValue(left, right, dir) {
  if (left < right) return dir === 'asc' ? -1 : 1
  if (left > right) return dir === 'asc' ? 1 : -1
  return 0
}

export function dealSortValue(deal, key) {
  if (key === 'priority') return PRIORITY_RANK[deal.priority] || 0
  if (key === 'date') return deal.expectedCloseDate || 0
  if (key === 'name') return (deal.company || '').toLowerCase()
  if (key === 'price') return deal.value || 0
  return 0
}

export function sortDealIds(ids, getDeal, sort) {
  if (!ids?.length || !sort?.key) return ids
  const dir = sort.dir === 'asc' ? 'asc' : 'desc'
  const ranked = ids.map((id, index) => {
    const deal = getDeal(id)
    return { id, index, value: deal ? dealSortValue(deal, sort.key) : 0 }
  })
  ranked.sort((left, right) => compareValue(left.value, right.value, dir) || left.index - right.index)
  return ranked.map((item) => item.id)
}

export function nextStageSort(current, key) {
  const option = STAGE_SORT_BY_ID[key]
  if (!option) return current
  if (current?.key === key) {
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { key, dir: option.defaultDir }
}
