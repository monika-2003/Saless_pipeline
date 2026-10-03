import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ACTIVITY_TYPES, createActivityEvent } from '../../utils/activity.js'
import { ActivityPanel } from './ActivityPanel.jsx'

const openDeal = vi.fn()
const setActivityOpen = vi.fn()

vi.mock('../../store/pipelineContext.js', () => ({
  usePipeline: () => ({
    activityOpen: true,
    setActivityOpen,
    openedDealId: null,
    openDeal,
    activityEvents: [
      createActivityEvent({
        type: ACTIVITY_TYPES.DEAL_MOVED,
        dealId: 'deal-1',
        dealName: 'Indigo Infotech',
        actorName: 'Rohan Mehta',
        metadata: { toStage: 'proposal_sent' },
      }),
      createActivityEvent({
        type: ACTIVITY_TYPES.SAVE_FAILED,
        dealId: 'deal-2',
        dealName: 'Apex Labs',
        actorName: 'Priya Sharma',
        metadata: { toStage: 'lost' },
      }),
    ],
  }),
}))

describe('ActivityPanel search', () => {
  it('filters the feed by company and shows an empty match state', () => {
    render(<ActivityPanel />)
    expect(screen.getByText('Indigo Infotech')).toBeInTheDocument()
    expect(screen.getByText(/Apex Labs/)).toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search activity' }), {
      target: { value: 'indigo' },
    })
    expect(screen.getByText('Indigo Infotech')).toBeInTheDocument()
    expect(screen.queryByText(/Apex Labs/)).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search activity' }), {
      target: { value: 'zzzz' },
    })
    expect(screen.getByText('No activity matches “zzzz”.')).toBeInTheDocument()
  })
})
