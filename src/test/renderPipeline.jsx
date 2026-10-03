import { act, renderHook, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import { ToastProvider } from '../components/common/Toast.jsx'
import { generatePipeline } from '../data/mockData.js'
import { PipelineProvider } from '../store/PipelineProvider.jsx'
import { usePipeline } from '../store/pipelineContext.js'
import { fixturePipeline, QUIET_SIMULATION } from './fixtures.js'

export function pipelineWrapper({ children }) {
  return (
    <ToastProvider>
      <PipelineProvider>{children}</PipelineProvider>
    </ToastProvider>
  )
}

export function seedPipeline(deals) {
  generatePipeline.mockReturnValue(fixturePipeline(deals))
}

export async function renderPipeline() {
  const hook = renderHook(() => usePipeline(), { wrapper: pipelineWrapper })
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
  act(() => {
    hook.result.current.updateSimulation(QUIET_SIMULATION)
  })
  return hook
}
