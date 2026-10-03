import { DEFAULT_USER, USER_BY_ID, USER_BY_NAME } from '../data/constants.js'

export const USER_STORAGE_KEY = 'sales-pipeline-current-user'

export function readStoredUser() {
  try {
    const id = sessionStorage.getItem(USER_STORAGE_KEY)
    if (id && USER_BY_ID[id]) return USER_BY_ID[id]
  } catch {
    /* ignore */
  }
  return DEFAULT_USER
}

export function actorFromName(name) {
  return USER_BY_NAME[name] || { id: name, name, role: 'Teammate' }
}

export function payloadActorName(serverDeal, fallback) {
  return fallback || serverDeal?.owner || 'A teammate'
}
