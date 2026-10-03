import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Dropdown, DropdownItem } from '../common/Dropdown.jsx'
import { IconButton } from '../common/IconButton.jsx'
import { STAGE_SORTS } from '../../utils/dealSort.js'
import { cx } from '../../utils/cx.js'

export function StageSortMenu({ stageLabel, sort, onSelect, align = 'right' }) {
  const active = STAGE_SORTS.find((option) => option.id === sort?.key)
  const label = active
    ? `Sort ${stageLabel} by ${active.label}, ${sort.dir === 'asc' ? 'ascending' : 'descending'}`
    : `Sort ${stageLabel}`

  return (
    <Dropdown
      align={align}
      trigger={(
        <IconButton
          label={label}
          className={cx('stage-sort-btn', active && 'is-active')}
          aria-pressed={Boolean(active)}
        >
          {active && sort.dir === 'asc' ? <ArrowUp size={13} /> : active ? <ArrowDown size={13} /> : <ArrowUpDown size={13} />}
        </IconButton>
      )}
    >
      <div className="dropdown-label">Sort by</div>
      {STAGE_SORTS.map((option) => {
        const selected = sort?.key === option.id
        return (
          <DropdownItem
            key={option.id}
            value={option.id}
            className={selected ? 'is-active' : undefined}
            aria-checked={selected}
            onClick={() => onSelect(option.id)}
          >
            <span>{option.label}</span>
            {selected ? (
              <span className="stage-sort-dir">
                {sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              </span>
            ) : null}
          </DropdownItem>
        )
      })}
    </Dropdown>
  )
}
