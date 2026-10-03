import { useCallback, useEffect, useRef } from 'react'
import { pipelineApi } from '../api/pipelineApi.js'
import { createRealtimeChannel, createRealtimeEvent } from '../services/realtimeChannel.js'
import { ACTIVITY_TYPES } from '../utils/activity.js'
import { actorFromName } from './pipelineActors.js'
import { markDealConflict } from './pipelineOverlays.js'
import { applyDealSnapshot } from './pipelineSnapshots.js'
import * as stageLists from './stageLists.js'

export function useRealtimeSync({
  dealsRef,
  pendingRef,
  currentUserRef,
  bulkRunningRef,
  setOverlays,
  setStageIds,
  pushActivity,
  ready,
  teammateEnabled,
}) {
  const realtimeRef = useRef(null)

  const publishRealtime = useCallback((event) => {
    realtimeRef.current?.publish(event)
  }, [])

  const applyIncomingMove = useCallback((payload) => {
    const dealId = payload.dealId || payload.deal?.id
    if (!dealId) return
    const incomingDeal = payload.deal || pipelineApi.getDeal(dealId)
    if (!incomingDeal) return

    const local = dealsRef.current[dealId]
    const fromStage = payload.fromStage || local?.stage
    const toStage = payload.toStage || incomingDeal.stage
    const actor = actorFromName(payload.actorName)

    if (!pendingRef.current[dealId] && local && incomingDeal.version < local.version) return

    pipelineApi.applyRemoteDeal(incomingDeal)

    if (pendingRef.current[dealId]) {
      setOverlays((current) => markDealConflict(current, dealId, {
        localStage: pendingRef.current[dealId].toStage,
        fromStage: pendingRef.current[dealId].fromStage,
        serverDeal: incomingDeal,
        actorName: actor.name,
        actorId: actor.id,
      }))
      pushActivity({
        type: ACTIVITY_TYPES.CONFLICT_DETECTED,
        dealId,
        dealName: incomingDeal.company,
        actorId: actor.id,
        actorName: actor.name,
        metadata: {
          localStage: pendingRef.current[dealId].toStage,
          toStage,
        },
      })
      return
    }

    applyDealSnapshot(dealsRef, setStageIds, incomingDeal)
    if (local && local.stage !== incomingDeal.stage) {
      setStageIds((current) => stageLists.applyMoveToStageIds(current, dealId, local.stage, incomingDeal.stage))
    } else if (!local && fromStage && toStage && fromStage !== toStage) {
      setStageIds((current) => stageLists.applyMoveToStageIds(current, dealId, fromStage, toStage))
    }

    pushActivity({
      type: ACTIVITY_TYPES.DEAL_MOVED,
      dealId,
      dealName: incomingDeal.company,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { fromStage, toStage, source: payload.source },
    })
  }, [dealsRef, pendingRef, pushActivity, setOverlays, setStageIds])

  const dispatchMove = useCallback((payload, { broadcast = true } = {}) => {
    applyIncomingMove(payload)
    if (broadcast) {
      publishRealtime(createRealtimeEvent({
        type: ACTIVITY_TYPES.DEAL_MOVED,
        source: payload.source || 'teammate',
        actorId: payload.actorId,
        actorName: payload.actorName,
        dealId: payload.dealId || payload.deal?.id,
        deal: payload.deal,
        fromStage: payload.fromStage,
        toStage: payload.toStage,
      }))
    }
  }, [applyIncomingMove, publishRealtime])

  useEffect(() => {
    const channel = createRealtimeChannel((event) => {
      if (event.type !== ACTIVITY_TYPES.DEAL_MOVED) return
      applyIncomingMove(event)
    })
    realtimeRef.current = channel
    return () => {
      channel.close()
      realtimeRef.current = null
    }
  }, [applyIncomingMove])

  useEffect(() => {
    if (!ready || !teammateEnabled) return undefined
    let timer
    const tick = () => {
      const delay = 5500 + Math.random() * 4000
      timer = window.setTimeout(() => {
        if (typeof document !== 'undefined' && !document.hasFocus()) {
          tick()
          return
        }
        if (bulkRunningRef.current) {
          tick()
          return
        }
        const id = pipelineApi.pickRandomOpenDealId()
        if (id && !pendingRef.current[id]) {
          const deal = pipelineApi.getDeal(id)
          const toStage = pipelineApi.pickRandomStage(deal.stage)
          if (!toStage) {
            tick()
            return
          }
          const actorName = pipelineApi.pickRandomActor(currentUserRef.current.name)
          const actor = actorFromName(actorName)
          const moved = pipelineApi.teammateMove(id, toStage, actorName, { silent: true })
          if (moved) {
            dispatchMove({
              type: ACTIVITY_TYPES.DEAL_MOVED,
              source: 'teammate',
              actorId: actor.id,
              actorName: actor.name,
              dealId: id,
              deal: moved.deal,
              fromStage: moved.fromStage,
              toStage: moved.toStage,
            })
          }
        }
        tick()
      }, delay)
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [bulkRunningRef, currentUserRef, dispatchMove, pendingRef, ready, teammateEnabled])

  return { publishRealtime, dispatchMove, applyIncomingMove }
}
