import { useMemo } from 'react'
import { STAGES, STAGE_BY_ID } from '../../data/constants.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { DealTable } from '../deal/DealTable.jsx'

function formatFailedWhy(deal, overlays) {
  const failed = overlays.failed[deal.id]
  const dest = failed?.toStage ? STAGE_BY_ID[failed.toStage] : null
  if (dest) return `Could not save move to ${dest.label}`
  return 'The last save did not reach the server'
}

export function FailedTable() {
  const { listIds, getDeal, overlays } = usePipeline()
  const idsByTab = useMemo(() => {
    const grouped = Object.fromEntries(STAGES.map((stage) => [stage.id, []]))
    for (const id of listIds || []) {
      const deal = getDeal(id)
      if (!deal || !grouped[deal.stage]) continue
      grouped[deal.stage].push(id)
    }
    return grouped
  }, [getDeal, listIds])

  const tabs = useMemo(
    () => STAGES.map((stage) => ({ id: stage.id, label: stage.label, color: stage.color })),
    [],
  )

  const defaultTabId = tabs.find((tab) => (idsByTab[tab.id] || []).length > 0)?.id || tabs[0]?.id

  return (
    <DealTable
      tablistLabel="Failed saves by stage"
      tabs={tabs}
      idsByTab={idsByTab}
      defaultTabId={defaultTabId}
      getWhy={(deal) => formatFailedWhy(deal, overlays)}
    />
  )
}
