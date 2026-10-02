import { STAGES } from '../data/constants.js'

export function applyMoveToStageIds(stageIds, dealId, fromStage, toStage) {
  if (fromStage === toStage) return stageIds
  return {
    ...stageIds,
    [fromStage]: stageIds[fromStage].filter((id) => id !== dealId),
    [toStage]: [dealId, ...stageIds[toStage].filter((id) => id !== dealId)],
  }
}

export function applyBulkMoveToStageIds(stageIds, ids, toStage) {
  const idSet = new Set(ids)
  const next = {}
  for (const stage of STAGES) {
    if (stage.id === toStage) {
      next[stage.id] = [...ids, ...stageIds[stage.id].filter((id) => !idSet.has(id))]
    } else {
      next[stage.id] = stageIds[stage.id].filter((id) => !idSet.has(id))
    }
  }
  return next
}

export function emptyOverlays() {
  return {
    pending: Object.create(null),
    failed: Object.create(null),
    conflicts: Object.create(null),
    saved: Object.create(null),
  }
}
