import { useMemo } from 'react'
import { ATTENTION_CATEGORIES, formatAttentionWhy, getAttentionReason, groupAttentionIds } from '../../utils/attention.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { DealTable } from '../deal/DealTable.jsx'

const PRIMARY_TABS = ['overdue', 'closingSoon', 'stale', 'highValue']
const EXTRA_TABS = ['failed', 'conflict']

export function AttentionTable() {
  const { listIds, getDeal, overlays } = usePipeline()
  const idsByTab = useMemo(
    () => groupAttentionIds(listIds || [], getDeal, overlays),
    [getDeal, listIds, overlays],
  )

  const tabs = useMemo(() => {
    const byId = Object.fromEntries(ATTENTION_CATEGORIES.map((category) => [category.id, category]))
    const extras = EXTRA_TABS.filter((id) => (idsByTab[id] || []).length > 0)
    return [...extras, ...PRIMARY_TABS].map((id) => ({
      id,
      label: byId[id].label,
      color: byId[id].color,
    }))
  }, [idsByTab])

  const defaultTabId = tabs.find((tab) => (idsByTab[tab.id] || []).length > 0)?.id || 'overdue'

  return (
    <DealTable
      tablistLabel="Needs attention reasons"
      tabs={tabs}
      idsByTab={idsByTab}
      defaultTabId={defaultTabId}
      getWhy={(deal) => formatAttentionWhy(deal, getAttentionReason(deal, overlays))}
    />
  )
}
