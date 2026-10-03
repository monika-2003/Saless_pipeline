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
  if (!stageIds || !ids.length || !toStage) return stageIds
  const idSet = new Set(ids)
  const next = {}
  for (const stage of STAGES) {
    const current = stageIds[stage.id] || []
    if (stage.id === toStage) {
      next[stage.id] = [...ids, ...current.filter((id) => !idSet.has(id))]
    } else {
      next[stage.id] = current.filter((id) => !idSet.has(id))
    }
  }
  return next
}

export function applyGroupedStageMoves(stageIds, destByStage) {
  if (!stageIds || !destByStage) return stageIds
  const destById = new Map()
  for (const stage of STAGES) {
    const ids = destByStage[stage.id]
    if (!ids?.length) continue
    for (const id of ids) destById.set(id, stage.id)
  }
  if (!destById.size) return stageIds

  let misplaced = 0
  let seen = 0
  for (const stage of STAGES) {
    for (const id of stageIds[stage.id] || []) {
      const dest = destById.get(id)
      if (!dest) continue
      seen += 1
      if (dest !== stage.id) misplaced += 1
    }
  }
  if (misplaced === 0 && seen === destById.size) return stageIds

  const next = {}
  for (const stage of STAGES) {
    next[stage.id] = (stageIds[stage.id] || []).filter((id) => {
      const dest = destById.get(id)
      return !dest || dest === stage.id
    })
  }
  for (const stage of STAGES) {
    const ids = destByStage[stage.id]
    if (!ids?.length) continue
    const existing = new Set(next[stage.id])
    const prepend = ids.filter((id) => !existing.has(id))
    if (prepend.length) next[stage.id] = prepend.concat(next[stage.id])
  }
  return next
}

export function groupIdsByStage(ids, getStage) {
  const groups = Object.create(null)
  for (const id of ids) {
    const stage = getStage(id)
    if (!stage) continue
    const list = groups[stage] || (groups[stage] = [])
    list.push(id)
  }
  return groups
}

export function placeDealInStage(stageIds, dealId, toStage) {
  if (!stageIds || !dealId || !toStage) return stageIds
  const alreadyThere = (stageIds[toStage] || []).includes(dealId)
  let fromStage = null
  for (const stage of STAGES) {
    if (stage.id === toStage) continue
    if ((stageIds[stage.id] || []).includes(dealId)) {
      fromStage = stage.id
      break
    }
  }
  if (alreadyThere && !fromStage) return stageIds
  if (!fromStage) {
    return {
      ...stageIds,
      [toStage]: [dealId, ...(stageIds[toStage] || []).filter((id) => id !== dealId)],
    }
  }
  return applyMoveToStageIds(stageIds, dealId, fromStage, toStage)
}

export function cloneStageIds(stageIds) {
  const next = {}
  for (const stage of STAGES) {
    next[stage.id] = [...(stageIds?.[stage.id] || [])]
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

export function createVisibleIdSet(visibleStageIds, listIds) {
  if (listIds) return new Set(listIds)
  const ids = new Set()
  if (!visibleStageIds) return ids
  for (const stage of STAGES) {
    for (const id of visibleStageIds[stage.id] || []) ids.add(id)
  }
  return ids
}

export function intersectSelectedIds(selectedIds, visibleIds) {
  if (!selectedIds.size) return selectedIds
  let changed = false
  const next = new Set()
  for (const id of selectedIds) {
    if (visibleIds.has(id)) next.add(id)
    else changed = true
  }
  return changed ? next : selectedIds
}
