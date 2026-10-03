import { STAGES } from '../data/constants.js'

export const STAGE_INDEX = Object.fromEntries(STAGES.map((stage, index) => [stage.id, index]))

export function stageIndex(stageId) {
  return STAGE_INDEX[stageId] ?? -1
}

export function canMoveStage(fromStage, toStage) {
  if (!fromStage || !toStage || fromStage === toStage) return false
  return stageIndex(toStage) > stageIndex(fromStage)
}

export function movableStages(fromStage) {
  return STAGES.filter((stage) => canMoveStage(fromStage, stage.id))
}

export function pickForwardStage(fromStage, except) {
  const options = movableStages(fromStage)
    .map((stage) => stage.id)
    .filter((id) => id !== except)
  if (!options.length) return null
  return options[Math.floor(Math.random() * options.length)]
}
