import { actorFromName, payloadActorName } from './pipelineActors.js'

export function copyOverlays(overlays) {
  return {
    pending: { ...overlays.pending },
    failed: { ...overlays.failed },
    conflicts: { ...overlays.conflicts },
    saved: { ...overlays.saved },
  }
}

export function beginDealPending(overlays, dealId, pending) {
  const next = copyOverlays(overlays)
  next.pending[dealId] = pending
  delete next.failed[dealId]
  delete next.conflicts[dealId]
  delete next.saved[dealId]
  return next
}

export function clearDealPending(overlays, dealId) {
  if (!overlays.pending[dealId]) return overlays
  const next = copyOverlays(overlays)
  delete next.pending[dealId]
  return next
}

export function markDealFailed(overlays, dealId, failed) {
  const next = copyOverlays(overlays)
  delete next.pending[dealId]
  next.failed[dealId] = failed
  return next
}

export function markDealConflict(overlays, dealId, conflict) {
  const next = copyOverlays(overlays)
  delete next.pending[dealId]
  delete next.failed[dealId]
  next.conflicts[dealId] = conflict
  return next
}

export function discardFailedOverlay(overlays, dealId) {
  const next = copyOverlays(overlays)
  delete next.failed[dealId]
  delete next.pending[dealId]
  return next
}

export function clearDealResolution(overlays, dealId) {
  const next = copyOverlays(overlays)
  delete next.conflicts[dealId]
  delete next.pending[dealId]
  delete next.failed[dealId]
  return next
}

export function markDealSaved(overlays, dealId) {
  const next = copyOverlays(overlays)
  next.saved[dealId] = true
  delete next.pending[dealId]
  delete next.failed[dealId]
  delete next.conflicts[dealId]
  return next
}

export function clearSavedFlags(overlays, dealIds) {
  let changed = false
  const next = copyOverlays(overlays)
  for (const id of dealIds) {
    if (!next.saved[id]) continue
    delete next.saved[id]
    changed = true
  }
  return changed ? next : overlays
}

export function beginBulkPending(overlays, jobs) {
  const next = copyOverlays(overlays)
  for (const job of jobs) {
    next.pending[job.id] = job
    delete next.failed[job.id]
    delete next.saved[job.id]
  }
  return next
}

export function applyJobFailureOverlay(overlays, job, result, toStage) {
  delete overlays.pending[job.id]
  delete overlays.saved[job.id]
  if (result?.error === 'CONFLICT') {
    const other = actorFromName(payloadActorName(result.serverDeal, result.actorName))
    overlays.conflicts[job.id] = {
      localStage: toStage,
      fromStage: job.fromStage,
      serverDeal: result.serverDeal,
      actorName: other.name,
      actorId: other.id,
    }
    delete overlays.failed[job.id]
    return
  }
  overlays.failed[job.id] = {
    fromStage: job.fromStage,
    toStage,
    clientVersion: job.clientVersion,
  }
  delete overlays.conflicts[job.id]
}

export function applyBulkFinishOverlays(overlays, { jobs, failed, succeededIds, toStage }) {
  const next = copyOverlays(overlays)
  for (const job of jobs) {
    delete next.pending[job.id]
  }
  for (const entry of failed) {
    applyJobFailureOverlay(next, entry.item, entry.result, toStage)
  }
  for (const id of succeededIds) {
    next.saved[id] = true
    delete next.failed[id]
    delete next.conflicts[id]
  }
  return next
}
