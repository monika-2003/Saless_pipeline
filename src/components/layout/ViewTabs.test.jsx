import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../common/Toast.jsx'
import { generatePipeline } from '../../data/mockData.js'
import { fixturePipeline, makeDeal } from '../../test/fixtures.js'
import { PipelineProvider } from '../../store/PipelineProvider.jsx'
import { ViewTabs } from './ViewTabs.jsx'

vi.mock('../../data/mockData.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, generatePipeline: vi.fn() }
})

describe('ViewTabs keyboard', () => {
  beforeEach(() => {
    generatePipeline.mockReturnValue(fixturePipeline([makeDeal()]))
  })

  it('moves between view tabs with arrow keys', async () => {
    render(
      <ToastProvider>
        <PipelineProvider>
          <ViewTabs />
        </PipelineProvider>
      </ToastProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /All Deals/ })).toBeInTheDocument()
    })

    const all = screen.getByRole('tab', { name: /All Deals/ })
    const mine = screen.getByRole('tab', { name: /My Deals/ })
    expect(all).toHaveAttribute('aria-selected', 'true')
    expect(all).toHaveAttribute('tabindex', '0')
    expect(mine).toHaveAttribute('tabindex', '-1')

    all.focus()
    fireEvent.keyDown(all, { key: 'ArrowRight' })

    expect(mine).toHaveAttribute('aria-selected', 'true')
    expect(mine).toHaveFocus()
    expect(mine).toHaveAttribute('tabindex', '0')
    expect(all).toHaveAttribute('tabindex', '-1')
  })
})
