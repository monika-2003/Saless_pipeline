import { persistDealChange } from '../utils/pipelinePersist.js'
import * as stageLists from './stageLists.js'

export function writeDealSnapshot(dealsRef, deal) {
  const previous = dealsRef.current[deal.id]
  dealsRef.current[deal.id] = { ...previous, ...deal }
  const next = dealsRef.current[deal.id]
  if (next) persistDealChange(next)
  return next
}

export function applyDealSnapshot(dealsRef, setStageIds, deal) {
  const next = writeDealSnapshot(dealsRef, deal)
  if (!next?.stage) return
  setStageIds((current) => stageLists.placeDealInStage(current, deal.id, next.stage))
}

export function moveDealLocal(dealsRef, setStageIds, dealId, toStage) {
  const deal = dealsRef.current[dealId]
  if (!deal || deal.stage === toStage) return deal?.stage
  const fromStage = deal.stage
  deal.stage = toStage
  persistDealChange(deal)
  setStageIds((current) => stageLists.applyMoveToStageIds(current, dealId, fromStage, toStage))
  return fromStage
}
