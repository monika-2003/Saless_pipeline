import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../common/Toast.jsx'
import { DealDrawer } from '../deal/DealDrawer.jsx'
import { generatePipeline } from '../../data/mockData.js'
import { fixturePipeline, makeDeal, QUIET_SIMULATION } from '../../test/fixtures.js'
import { PipelineProvider } from '../../store/PipelineProvider.jsx'
import { PipelineBoard } from './PipelineBoard.jsx'

vi.mock('../../data/mockData.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, generatePipeline: vi.fn() }
})

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, getItemKey }) => ({
    getTotalSize: () => count * 108,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
      index,
      key: getItemKey?.(index) ?? index,
      size: 108,
      start: index * 108,
    })),
    scrollToIndex: () => {},
  }),
}))

function seed() {
  generatePipeline.mockReturnValue(fixturePipeline([
    makeDeal({ id: 'deal-1', company: 'Alpha Co', stage: 'proposal_sent' }),
    makeDeal({ id: 'deal-2', company: 'Beta Co', stage: 'proposal_sent' }),
    makeDeal({ id: 'deal-3', company: 'Gamma Co', stage: 'negotiation' }),
  ]))
}

function Harness() {
  return (
    <ToastProvider>
      <PipelineProvider>
        <PipelineBoard />
        <DealDrawer />
      </PipelineProvider>
    </ToastProvider>
  )
}

async function renderBoard() {
  render(<Harness />)
  await waitFor(() => {
    expect(screen.getByRole('region', { name: 'Sales pipeline board' })).toBeInTheDocument()
    expect(screen.getByText('Alpha Co')).toBeInTheDocument()
  })
}

function card(company) {
  return screen.getByText(company).closest('article')
}

function flushFocus() {
  return act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
}

describe('PipelineBoard keyboard', () => {
  beforeEach(() => {
    seed()
  })

  it('lets Tab reach the board and focuses the first card', async () => {
    await renderBoard()
    const board = screen.getByRole('region', { name: 'Sales pipeline board' })
    expect(board).toHaveAttribute('tabindex', '0')

    act(() => {
      board.focus()
    })
    await flushFocus()

    expect(card('Alpha Co')).toHaveFocus()
    expect(card('Alpha Co')).toHaveAttribute('tabindex', '0')
    expect(card('Beta Co')).toHaveAttribute('tabindex', '-1')
    expect(board).toHaveAttribute('tabindex', '-1')
  })

  it('moves DOM focus between cards with arrow keys', async () => {
    await renderBoard()
    const board = screen.getByRole('region', { name: 'Sales pipeline board' })
    act(() => {
      board.focus()
    })
    await flushFocus()

    fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
    await flushFocus()
    expect(card('Beta Co')).toHaveFocus()

    fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' })
    await flushFocus()
    expect(card('Gamma Co')).toHaveFocus()
  })

  it('toggles selection with Space', async () => {
    await renderBoard()
    const board = screen.getByRole('region', { name: 'Sales pipeline board' })
    act(() => {
      board.focus()
    })
    await flushFocus()

    fireEvent.keyDown(document.activeElement, { key: ' ' })
    expect(card('Alpha Co')).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(document.activeElement, { key: ' ' })
    expect(card('Alpha Co')).toHaveAttribute('aria-selected', 'false')
  })

  it('selects a range with Shift+Space', async () => {
    await renderBoard()
    const board = screen.getByRole('region', { name: 'Sales pipeline board' })
    act(() => {
      board.focus()
    })
    await flushFocus()

    fireEvent.keyDown(document.activeElement, { key: ' ' })
    fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
    await flushFocus()
    fireEvent.keyDown(document.activeElement, { key: ' ', shiftKey: true })

    expect(card('Alpha Co')).toHaveAttribute('aria-selected', 'true')
    expect(card('Beta Co')).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the drawer with Enter and restores focus on Escape', async () => {
    await renderBoard()
    const board = screen.getByRole('region', { name: 'Sales pipeline board' })
    act(() => {
      board.focus()
    })
    await flushFocus()

    fireEvent.keyDown(document.activeElement, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: 'Alpha Co' })).toBeInTheDocument()
    await flushFocus()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Alpha Co' })).not.toBeInTheDocument()
    })
    await flushFocus()
    expect(card('Alpha Co')).toHaveFocus()
  })

  it('keeps Tab inside the drawer', async () => {
    await renderBoard()
    const board = screen.getByRole('region', { name: 'Sales pipeline board' })
    act(() => {
      board.focus()
    })
    await flushFocus()
    fireEvent.keyDown(document.activeElement, { key: 'Enter' })

    const dialog = screen.getByRole('dialog', { name: 'Alpha Co' })
    await flushFocus()
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(board.contains(document.activeElement)).toBe(false)
  })
})
