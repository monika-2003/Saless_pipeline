export const SWITCHABLE_USERS = [
  { id: 'priya-sharma', name: 'Priya Sharma', role: 'Sales Manager' },
  { id: 'rahul-mehta', name: 'Rahul Mehta', role: 'Account Executive' },
  { id: 'ananya-iyer', name: 'Ananya Iyer', role: 'Account Executive' },
  { id: 'vikram-singh', name: 'Vikram Singh', role: 'Account Executive' },
  { id: 'neha-patel', name: 'Neha Patel', role: 'Account Executive' },
]

export const USER_BY_ID = Object.fromEntries(SWITCHABLE_USERS.map((user) => [user.id, user]))
export const USER_BY_NAME = Object.fromEntries(SWITCHABLE_USERS.map((user) => [user.name, user]))
export const DEFAULT_USER = SWITCHABLE_USERS[0]
export const CURRENT_USER = DEFAULT_USER.name

export const STAGES = [
  { id: 'new_lead', label: 'New Lead', color: '#2563eb' },
  { id: 'contacted', label: 'Contacted', color: '#4f46e5' },
  { id: 'demo_done', label: 'Demo Done', color: '#0891b2' },
  { id: 'proposal_sent', label: 'Proposal Sent', color: '#7c3aed' },
  { id: 'negotiation', label: 'Negotiation', color: '#b45309' },
  { id: 'won', label: 'Won', color: '#15803d' },
  { id: 'lost', label: 'Lost', color: '#dc2626' },
]

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((stage) => [stage.id, stage]))

export const OPEN_STAGE_IDS = STAGES.filter(
  (stage) => stage.id !== 'won' && stage.id !== 'lost',
).map((stage) => stage.id)

export const PRIORITIES = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

export const OWNERS = [
  'Priya Sharma',
  'Rahul Mehta',
  'Neha Patel',
  'Arjun Reddy',
  'Ananya Iyer',
  'Vikram Singh',
  'Sneha Kulkarni',
  'Rohan Mehta',
  'Kavya Nair',
  'Aditya Joshi',
  'Meera Gupta',
  'Siddharth Rao',
  'Pooja Desai',
  'Karthik Menon',
  'Ishita Bansal',
  'Nikhil Kapoor',
  'Divya Pillai',
  'Aman Khanna',
  'Riya Malhotra',
  'Harsh Vardhan',
]

export const DEAL_COUNT = 50_000

export const STAGE_COUNTS = {
  new_lead: 10_000,
  contacted: 8_500,
  demo_done: 7_200,
  proposal_sent: 6_800,
  negotiation: 7_500,
  won: 5_200,
  lost: 4_800,
}

export const DEFAULT_SIMULATION = {
  latencyMin: 300,
  latencyMax: 1500,
  failureRate: 0.1,
  teammateEnabled: true,
}

export const BULK_CONCURRENCY = 10
export const ACTIVITY_LIMIT = 150
export const REALTIME_CHANNEL = 'sales-pipeline'
export const TABLE_PAGE_SIZE = 50
export const TABLE_PAGE_SIZES = [10, 20, 50, 100]

export const VIEWS = [
  { id: 'all', label: 'All Deals', color: '#2563eb' },
  { id: 'mine', label: 'My Deals', color: '#0891b2' },
  { id: 'attention', label: 'Needs Attention', color: '#b45309' },
  { id: 'failed', label: 'Failed Saves', color: '#dc2626' },
]
