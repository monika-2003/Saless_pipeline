import { STAGE_BY_ID } from '../data/constants.js'

export function failedDestinationLabel(failed) {
  return STAGE_BY_ID[failed?.toStage]?.label || null
}

export function formatFailedSave(failed) {
  const dest = failedDestinationLabel(failed)
  return dest ? `Save failed · ${dest}` : 'Save failed'
}

export function formatRetryLabel(failed) {
  const dest = failedDestinationLabel(failed)
  return dest ? `Retry to ${dest}` : 'Retry'
}
