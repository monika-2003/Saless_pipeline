export const EMPTY_STAGE_IDS = {
  new_lead: [],
  contacted: [],
  demo_done: [],
  proposal_sent: [],
  negotiation: [],
  won: [],
  lost: [],
}

export const QUIET_SIMULATION = {
  latencyMin: 0,
  latencyMax: 0,
  failureRate: 0,
  teammateEnabled: false,
}

export function makeDeal(overrides = {}) {
  const now = Date.now()
  return {
    id: 'deal-1',
    company: 'Apex Labs',
    contactName: 'Nisha Chopra',
    owner: 'Priya Sharma',
    value: 1_200_000,
    stage: 'proposal_sent',
    probability: 55,
    expectedCloseDate: now + 10 * 24 * 60 * 60 * 1000,
    lastContactedAt: now,
    priority: 'high',
    createdAt: now - 20 * 24 * 60 * 60 * 1000,
    closedAt: null,
    version: 1,
    ...overrides,
  }
}

export function emptyOverlays(overrides = {}) {
  return {
    pending: {},
    failed: {},
    conflicts: {},
    saved: {},
    ...overrides,
  }
}

export function fixturePipeline(deals) {
  const dealsById = Object.create(null)
  const dealIdsByStage = {
    new_lead: [],
    contacted: [],
    demo_done: [],
    proposal_sent: [],
    negotiation: [],
    won: [],
    lost: [],
  }
  for (const deal of deals) {
    dealsById[deal.id] = { ...deal }
    dealIdsByStage[deal.stage].push(deal.id)
  }
  return { dealsById, dealIdsByStage }
}
