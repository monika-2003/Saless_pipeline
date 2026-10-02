import { Check, ChevronDown } from 'lucide-react'
import { SWITCHABLE_USERS } from '../../data/constants.js'
import { usePipeline } from '../../store/pipelineContext.js'
import { Avatar } from '../common/Avatar.jsx'
import { Dropdown, DropdownItem } from '../common/Dropdown.jsx'

export function UserSwitcher() {
  const { currentUser, setCurrentUser } = usePipeline()

  return (
    <Dropdown
      align="right"
      trigger={
        <button type="button" className="user-chip" aria-haspopup="menu" aria-label="Switch user">
          <Avatar name={currentUser.name} />
          <span className="user-chip-name">{currentUser.name}</span>
          <ChevronDown size={14} />
        </button>
      }
    >
      <div className="dropdown-label" onClick={(event) => event.stopPropagation()}>Switch user</div>
      {SWITCHABLE_USERS.map((user) => {
        const active = user.id === currentUser.id
        return (
          <DropdownItem
            key={user.id}
            className={active ? 'user-switch-item is-active' : 'user-switch-item'}
            onClick={() => setCurrentUser(user)}
          >
            <span className={active ? 'user-radio is-on' : 'user-radio'} aria-hidden="true" />
            <Avatar name={user.name} />
            <span className="user-switch-copy">
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </span>
            {active ? <Check size={14} style={{ marginLeft: 'auto' }} /> : null}
          </DropdownItem>
        )
      })}
    </Dropdown>
  )
}
