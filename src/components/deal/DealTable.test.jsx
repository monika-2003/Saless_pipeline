import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyFilters } from '../../utils/filters.js'
import { makeDeal } from '../../test/fixtures.js'

const pipeline = {
  getDeal: (id) => dealsById[id],
  overlays: { pending: {}, failed: {}, conflicts: {}, saved: {} },
  selectedIds: new Set(),
  pinSelected: false,
  toggleSelect: vi.fn(),
  selectMany: vi.fn(),
  openDeal: vi.fn(),
  requestMove: vi.fn(),
  retryDeal: vi.fn(),
  discardFailed: vi.fn(),
  filters: createEmptyFilters(),
  stageSorts: {},
  setStageSort: vi.fn(),
}

const dealsById = Object.create(null)

vi.mock('../../store/pipelineContext.js', () => ({
  usePipeline: () => pipeline,
}))

import { DealTable } from './DealTable.jsx'

function idsFor(count) {
  const ids = []
  for (let i = 0; i < count; i += 1) {
    const id = `deal-${i}`
    ids.push(id)
    dealsById[id] = makeDeal({
      id,
      company: `Company ${i}`,
      stage: 'new_lead',
    })
  }
  return ids
}

function Harness({ initialIds }) {
  const [ids, setIds] = useState(initialIds)
  pipeline.visibleStageIds = { new_lead: ids, contacted: [], demo_done: [], proposal_sent: [], negotiation: [], won: [], lost: [] }
  return (
    <div>
      <button type="button" onClick={() => setIds((current) => current.slice(0, -1))}>
        Drop last
      </button>
      <DealTable />
    </div>
  )
}

describe('DealTable pagination', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    pipeline.selectedIds = new Set()
    pipeline.pinSelected = false
    pipeline.filters = createEmptyFilters()
    pipeline.overlays = { pending: {}, failed: {}, conflicts: {}, saved: {} }
    for (const key of Object.keys(dealsById)) delete dealsById[key]
  })

  it('stays on the current page when the list length changes', () => {
    render(<Harness initialIds={idsFor(25)} />)

    fireEvent.click(screen.getByRole('button', { name: '10' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
    expect(screen.getByText('Company 20')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Drop last' }))

    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
    expect(screen.getByText('Company 20')).toBeInTheDocument()
    expect(screen.queryByText('Page 1 of 3')).not.toBeInTheDocument()
  })

  it('clamps to the last page when the current page no longer exists', () => {
    render(<Harness initialIds={idsFor(25)} />)

    fireEvent.click(screen.getByRole('button', { name: '10' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Drop last' }))
    fireEvent.click(screen.getByRole('button', { name: 'Drop last' }))
    fireEvent.click(screen.getByRole('button', { name: 'Drop last' }))
    fireEvent.click(screen.getByRole('button', { name: 'Drop last' }))
    fireEvent.click(screen.getByRole('button', { name: 'Drop last' }))

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.queryByText('Page 1 of 2')).not.toBeInTheDocument()
  })

  it('returns to page 1 when the stage tab changes', () => {
    pipeline.visibleStageIds = {
      new_lead: idsFor(25),
      contacted: ['deal-0'],
      demo_done: [],
      proposal_sent: [],
      negotiation: [],
      won: [],
      lost: [],
    }
    render(<DealTable />)

    fireEvent.click(screen.getByRole('button', { name: '10' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Contacted/ }))
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
  })

  it('shows a Retry to column instead of Why, Status, and Move when asked', () => {
    const ids = idsFor(1)
    pipeline.visibleStageIds = {
      new_lead: ids,
      contacted: [],
      demo_done: [],
      proposal_sent: [],
      negotiation: [],
      won: [],
      lost: [],
    }
    pipeline.overlays = {
      pending: {},
      failed: { 'deal-0': { fromStage: 'new_lead', toStage: 'demo_done' } },
      conflicts: {},
      saved: {},
    }

    render(<DealTable showStatus={false} showMove={false} showRetryTo />)

    expect(screen.getByRole('columnheader', { name: 'Retry to' })).toBeInTheDocument()
    expect(document.querySelector('td.col-retry-to').textContent).toBe('Demo Done')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Why' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Move' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry to/ })).not.toBeInTheDocument()
  })
})
