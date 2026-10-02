import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePipeline } from './pipelineContext.js'

describe('usePipeline', () => {
  it('throws when used outside PipelineProvider', () => {
    expect(() => renderHook(() => usePipeline())).toThrow(
      /usePipeline must be used inside PipelineProvider/,
    )
  })
})
