import { DEAL_COUNT, OWNERS, STAGE_COUNTS } from './constants.js'

const COMPANY_PREFIXES = [
  'Apex', 'Nimbus', 'Harbor', 'Vertex', 'Lotus', 'Orbit', 'Cedar', 'Pinnacle',
  'Silver', 'Nova', 'Indigo', 'Summit', 'Bright', 'North', 'Atlas', 'Zenith',
  'Amber', 'Coral', 'Maple', 'River', 'Golden', 'Prime', 'Unity', 'Horizon',
]

const COMPANY_SUFFIXES = [
  'Labs', 'Systems', 'Digital', 'Foods', 'Health', 'Logistics', 'Capital',
  'Retail', 'Energy', 'Infotech', 'Solutions', 'Works', 'Traders', 'Bio',
]

const FIRST_NAMES = [
  'Aarav', 'Diya', 'Ishaan', 'Kiara', 'Dev', 'Anika', 'Reyansh', 'Myra',
  'Kabir', 'Aisha', 'Vihaan', 'Sara', 'Advait', 'Tara', 'Yash', 'Nisha',
]

const LAST_NAMES = [
  'Shah', 'Reddy', 'Nair', 'Bose', 'Chopra', 'Iyer', 'Khan', 'Das',
  'Jain', 'Pillai', 'Agarwal', 'Banerjee', 'Ghosh', 'Saxena', 'Dutta', 'Kulkarni',
]

const PRIORITY_WEIGHTS = [
  ['high', 0.18],
  ['medium', 0.55],
  ['low', 1],
]

const PROBABILITY_BY_STAGE = {
  new_lead: 10,
  contacted: 22,
  demo_done: 40,
  proposal_sent: 55,
  negotiation: 72,
  won: 100,
  lost: 0,
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted(random, weights) {
  const value = random()
  for (const [item, limit] of weights) {
    if (value < limit) return item
  }
  return weights[weights.length - 1][0]
}

function buildStageList() {
  const stages = []
  for (const [stage, count] of Object.entries(STAGE_COUNTS)) {
    for (let i = 0; i < count; i += 1) stages.push(stage)
  }
  return stages
}

function makeDeal(index, stage, random, now) {
  const owner = OWNERS[Math.floor(random() * OWNERS.length)]
  const createdDaysAgo = Math.floor(random() * 400)
  const createdAt = now - createdDaysAgo * 24 * 60 * 60 * 1000
  const lastContactedAt = now - Math.floor(1 + random() * 75) * 24 * 60 * 60 * 1000
  const expectedCloseDate = now + Math.floor(random() * 120 - 20) * 24 * 60 * 60 * 1000
  const value = 40_000 + Math.floor(random() * 48) * 50_000 + Math.floor(random() * 40_000)
  const closedAt =
    stage === 'won' || stage === 'lost'
      ? now - Math.floor(random() * 400) * 24 * 60 * 60 * 1000
      : null

  return {
    id: `deal-${index}`,
    company: `${COMPANY_PREFIXES[index % COMPANY_PREFIXES.length]} ${COMPANY_SUFFIXES[Math.floor(index / COMPANY_PREFIXES.length) % COMPANY_SUFFIXES.length]} ${1000 + (index % 9000)}`,
    contactName: `${FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]}`,
    owner,
    value,
    stage,
    probability: Math.max(0, Math.min(100, PROBABILITY_BY_STAGE[stage] + Math.floor(random() * 8) - 3)),
    expectedCloseDate,
    lastContactedAt,
    priority: pickWeighted(random, PRIORITY_WEIGHTS),
    createdAt,
    closedAt,
    version: 1,
  }
}

let cachedPipeline = null

export function generatePipeline() {
  if (cachedPipeline) return cachedPipeline

  const random = mulberry32(20261001)
  const now = Date.now()
  const stages = buildStageList()
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

  for (let i = 0; i < DEAL_COUNT; i += 1) {
    const deal = makeDeal(i, stages[i], random, now)
    dealsById[deal.id] = deal
    dealIdsByStage[deal.stage].push(deal.id)
  }

  cachedPipeline = { dealsById, dealIdsByStage }
  return cachedPipeline
}

export function cloneDealsById(dealsById) {
  const clone = Object.create(null)
  for (const id in dealsById) clone[id] = { ...dealsById[id] }
  return clone
}
