import { canMoveStage } from '../utils/stageOrder.js'

export function planBulkJobs(ids, toStage, options, { getDeal, isPending, failedOverlays }) {
  const jobs = []
  for (const id of ids) {
    const deal = getDeal(id)
    if (!deal) continue
    if (isPending(id)) continue
    const sameStage = deal.stage === toStage
    if (sameStage && !options.resubmit) continue
    if (!sameStage && !canMoveStage(deal.stage, toStage) && !options.allowBackward) continue
    jobs.push({
      id,
      fromStage: sameStage ? (failedOverlays[id]?.fromStage || deal.stage) : deal.stage,
      toStage,
      clientVersion: deal.version,
      company: deal.company,
    })
  }
  return jobs
}

export function collectFailedBulkJobs(failed) {
  const failedSet = new Set()
  const failedIds = []
  const rollbackByStage = Object.create(null)
  for (const entry of failed) {
    if (entry.result?.error === 'CANCELLED') continue
    const job = entry.item
    failedSet.add(job.id)
    failedIds.push(job.id)
    const group = rollbackByStage[job.fromStage] || (rollbackByStage[job.fromStage] = [])
    group.push(job.id)
  }
  return { failedSet, failedIds, rollbackByStage }
}

export function groupRetryIdsByStage(ids, failedOverlays, exists) {
  const groups = new Map()
  for (const id of ids) {
    const failed = failedOverlays[id]
    if (!failed || !exists(id)) continue
    const group = groups.get(failed.toStage) || []
    group.push(id)
    groups.set(failed.toStage, group)
  }
  return groups
}
