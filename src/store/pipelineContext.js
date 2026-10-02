import { createContext, useContext } from 'react'

export const PipelineContext = createContext(null)

export function usePipeline() {
  const value = useContext(PipelineContext)
  if (!value) throw new Error('usePipeline must be used inside PipelineProvider')
  return value
}
