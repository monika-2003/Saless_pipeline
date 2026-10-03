import { ChevronDown } from 'lucide-react'
import { movableStages } from '../../utils/stageOrder.js'
import { Button } from '../common/Button.jsx'
import { Dropdown, DropdownItem } from '../common/Dropdown.jsx'

export function DealMoveMenu({ deal, onMove, label = 'Move to', disabled = false, tabIndex }) {
  const stages = movableStages(deal.stage)
  if (stages.length === 0) return null
  if (disabled) {
    return (
      <Button size="sm" variant="ghost" disabled tabIndex={tabIndex} aria-label={`Move ${deal.company} to another stage`}>
        {label}
        <ChevronDown size={12} />
      </Button>
    )
  }

  return (
    <Dropdown
      trigger={
        <Button
          size="sm"
          variant="ghost"
          tabIndex={tabIndex}
          aria-label={`Move ${deal.company} to another stage`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {label}
          <ChevronDown size={12} />
        </Button>
      }
    >
      <div className="dropdown-label" onClick={(event) => event.stopPropagation()}>Move to</div>
      {stages.map((stage) => (
        <DropdownItem
          key={stage.id}
          onClick={() => onMove(deal.id, stage.id)}
        >
          <span className="color-dot" style={{ background: stage.color }} />
          {stage.label}
        </DropdownItem>
      ))}
    </Dropdown>
  )
}
