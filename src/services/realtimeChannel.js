import { REALTIME_CHANNEL } from '../data/constants.js'

export const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export function createRealtimeChannel(onEvent) {
  if (typeof BroadcastChannel === 'undefined') {
    return {
      tabId: TAB_ID,
      publish() {},
      close() {},
    }
  }

  const channel = new BroadcastChannel(REALTIME_CHANNEL)

  channel.onmessage = (message) => {
    const event = message.data
    if (!event || event.sourceTabId === TAB_ID) return
    onEvent(event)
  }

  return {
    tabId: TAB_ID,
    publish(event) {
      channel.postMessage({
        ...event,
        sourceTabId: TAB_ID,
        timestamp: event.timestamp || Date.now(),
      })
    },
    close() {
      channel.close()
    },
  }
}

export function createRealtimeEvent({
  type,
  source = 'user',
  actorId,
  actorName,
  dealId,
  deal = null,
  fromStage = null,
  toStage = null,
  metadata = {},
}) {
  return {
    id: `${TAB_ID}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    source,
    sourceTabId: TAB_ID,
    actorId,
    actorName,
    dealId,
    deal,
    fromStage,
    toStage,
    timestamp: Date.now(),
    metadata,
  }
}
