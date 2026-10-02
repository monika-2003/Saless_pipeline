import { useState } from 'react'
import { ChevronDown, ListFilter } from 'lucide-react'
import { OWNERS, PRIORITIES, STAGES } from '../../data/constants.js'
import { createEmptyFilters } from '../../utils/filters.js'
import { formatCount } from '../../utils/format.js'
import { cx } from '../../utils/cx.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { Button } from '../common/Button.jsx'
import { DateRangePicker } from '../common/DateRangePicker.jsx'
import { MultiSelect } from '../common/MultiSelect.jsx'
import { Select } from '../common/Select.jsx'

function countActiveFilters(draft) {
  let count = 0
  if (draft.owner?.length) count += 1
  if (draft.priority?.length) count += 1
  if (draft.stage?.length) count += 1
  if (draft.minValue) count += 1
  if (draft.closeRange) count += 1
  return count
}

export function FilterBar() {
  const { filterDraft, setFilterDraft, matchingCount } = usePipeline()
  const [open, setOpen] = useState(false)
  const activeCount = countActiveFilters(filterDraft)

  function patch(next) {
    setFilterDraft((current) => ({ ...current, ...next }))
  }

  const matchLabel = `${formatCount(matchingCount)} matching deals`

  return (
    <div className={cx('filter-bar', open && 'is-open')}>
      <div className="filter-bar-mobile">
        <button
          type="button"
          className="filter-toggle"
          aria-expanded={open}
          aria-controls="filter-bar-fields"
          onClick={() => setOpen((current) => !current)}
        >
          <ListFilter size={15} />
          Filters
          {activeCount ? <span className="count-chip">{activeCount}</span> : null}
          <ChevronDown size={14} className="filter-toggle-chevron" aria-hidden="true" />
        </button>
        <div className="match-count">{matchLabel}</div>
      </div>
      <div className="filter-bar-fields" id="filter-bar-fields">
        <MultiSelect
          label="Owner"
          values={filterDraft.owner}
          onChange={(owner) => patch({ owner })}
          placeholder="All owners"
          options={OWNERS.map((owner) => ({ value: owner, label: owner }))}
        />
        <MultiSelect
          label="Priority"
          values={filterDraft.priority}
          onChange={(priority) => patch({ priority })}
          placeholder="All priorities"
          options={PRIORITIES.map((priority) => ({ value: priority.id, label: priority.label }))}
        />
        <MultiSelect
          label="Stage"
          values={filterDraft.stage}
          onChange={(stage) => patch({ stage })}
          placeholder="All stages"
          options={STAGES.map((stage) => ({ value: stage.id, label: stage.label, color: stage.color }))}
        />
        <Select
          label="Value"
          value={String(filterDraft.minValue || '')}
          onChange={(minValue) => patch({ minValue: Number(minValue) || 0 })}
          options={[
            { value: '', label: 'Any value' },
            { value: '100000', label: '₹1L+' },
            { value: '500000', label: '₹5L+' },
            { value: '1000000', label: '₹10L+' },
            { value: '2500000', label: '₹25L+' },
          ]}
        />
        <Select
          label="Close date"
          value={filterDraft.closeRange}
          onChange={(closeRange) => {
            if (closeRange === 'custom') patch({ closeRange })
            else patch({ closeRange, closeFrom: '', closeTo: '' })
          }}
          options={[
            { value: '', label: 'Any date' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'week', label: 'Next 7 days' },
            { value: 'month', label: 'Next 30 days' },
            { value: 'custom', label: 'Custom range' },
          ]}
        />
        {filterDraft.closeRange === 'custom' ? (
          <DateRangePicker
            from={filterDraft.closeFrom}
            to={filterDraft.closeTo}
            defaultOpen={!filterDraft.closeFrom && !filterDraft.closeTo}
            onApply={({ from, to }) => patch({ closeFrom: from, closeTo: to, closeRange: 'custom' })}
          />
        ) : null}
        <Button variant="ghost" onClick={() => setFilterDraft(createEmptyFilters())}>Clear filters</Button>
        <div className="match-count is-desktop">{matchLabel}</div>
      </div>
    </div>
  )
}
