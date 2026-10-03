import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeDeal } from '../../test/fixtures.js'
import { DealCard } from './DealCard.jsx'

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    isDragging: false,
  }),
}))

function renderCard(overlay, handlers = {}) {
  const onOpen = vi.fn()
  const onToggleSelect = vi.fn()
  const onRetry = vi.fn()
  const onUndo = vi.fn()
  const onKeepMine = vi.fn()
  const onUseLatest = vi.fn()
  render(
    <DealCard
      deal={makeDeal()}
      overlay={overlay}
      selected={false}
      focused
      onOpen={onOpen}
      onToggleSelect={onToggleSelect}
      onRetry={onRetry}
      onUndo={onUndo}
      onKeepMine={onKeepMine}
      onUseLatest={onUseLatest}
      {...handlers}
    />,
  )
  return { onOpen, onToggleSelect, onRetry, onUndo, onKeepMine, onUseLatest }
}

describe('DealCard keyboard', () => {
  it('opens and selects from the card itself', () => {
    const { onOpen, onToggleSelect } = renderCard(null)
    const card = screen.getByRole('article')

    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onOpen).toHaveBeenCalledWith('deal-1')

    fireEvent.keyDown(card, { key: ' ' })
    expect(onToggleSelect).toHaveBeenCalledWith('deal-1', expect.any(Object))
  })

  it('does not steal Enter or Space from Retry and Undo', () => {
    const { onOpen, onToggleSelect } = renderCard({
      failed: { fromStage: 'proposal_sent', toStage: 'negotiation' },
    })

    fireEvent.keyDown(screen.getByRole('button', { name: 'Retry' }), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Undo' }), { key: ' ' })

    expect(onOpen).not.toHaveBeenCalled()
    expect(onToggleSelect).not.toHaveBeenCalled()
  })

  it('does not steal Enter or Space from conflict actions', () => {
    const { onOpen, onToggleSelect } = renderCard({
      conflict: {
        localStage: 'negotiation',
        actorName: 'Rahul Mehta',
        serverDeal: makeDeal({ stage: 'won' }),
      },
    })

    fireEvent.keyDown(screen.getByRole('button', { name: 'Keep my change' }), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Use latest' }), { key: ' ' })

    expect(onOpen).not.toHaveBeenCalled()
    expect(onToggleSelect).not.toHaveBeenCalled()
  })
})
