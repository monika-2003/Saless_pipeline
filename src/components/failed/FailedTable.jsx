import { useMemo } from 'react'
import { STAGES } from '../../data/constants.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { DealTable } from '../deal/DealTable.jsx'

export function FailedTable() {
  const { listIds, getDeal } = usePipeline()
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
      showStatus={false}
      showMove={false}
      showRetryTo
    />
  )
}
