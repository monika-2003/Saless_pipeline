import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateRangePicker } from './DateRangePicker.jsx'

function flush() {
  return act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
}

describe('DateRangePicker keyboard', () => {
  it('moves between days with arrows and selects with Enter', async () => {
    const onApply = vi.fn()
    render(<DateRangePicker from="2026-10-03" to="" defaultOpen onApply={onApply} />)

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Close date range' })).toBeInTheDocument()
    })
    await flush()

    const start = document.querySelector('[data-cal-day="2026-10-03"]')
    expect(start).toHaveAttribute('tabindex', '0')
    start.focus()

    fireEvent.keyDown(start, { key: 'ArrowRight' })
    await flush()
    const next = document.querySelector('[data-cal-day="2026-10-04"]')
    expect(next).toHaveFocus()
    expect(next).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(next, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith({ from: '2026-10-03', to: '2026-10-04' })
  })

  it('closes on Escape and restores the trigger', async () => {
    render(<DateRangePicker from="2026-10-03" to="" defaultOpen onApply={() => {}} />)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Close date range' })).toBeInTheDocument()
    })
    await flush()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Close date range' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Oct 3/ })).toHaveFocus()
  })
})
