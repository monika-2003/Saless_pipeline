import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { Dropdown, DropdownItem } from '../common/Dropdown.jsx'
import { IconButton } from '../common/IconButton.jsx'
import { useTheme } from '../../theme/ThemeProvider.jsx'

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

export function AppearanceMenu() {
  const { theme, setTheme, resolved, themes } = useTheme()
  const TriggerIcon = resolved === 'dark' ? Moon : Sun

  return (
    <Dropdown
      align="right"
      onHighlight={setTheme}
      trigger={
        <IconButton label="Appearance">
          <TriggerIcon size={15} />
        </IconButton>
      }
    >
          <div className="dropdown-label" onClick={(event) => event.stopPropagation()}>Appearance</div>
      {themes.map((item) => {
        const Icon = ICONS[item.id]
        const active = theme === item.id
        return (
          <DropdownItem
            key={item.id}
            value={item.id}
            className={active ? 'is-active' : undefined}
            onClick={() => setTheme(item.id)}
          >
            <Icon size={14} />
            {item.label}
            {active ? <Check size={14} style={{ marginLeft: 'auto' }} /> : null}
          </DropdownItem>
        )
      })}
    </Dropdown>
  )
}
