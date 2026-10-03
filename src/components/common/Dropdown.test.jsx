import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dropdown, DropdownItem } from './Dropdown.jsx'

async function flushFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
}

function Menu() {
  return (
    <Dropdown trigger={<button type="button">Appearance</button>}>
      <DropdownItem className="is-active">Dark</DropdownItem>
      <DropdownItem>Light</DropdownItem>
      <DropdownItem>System</DropdownItem>
    </Dropdown>
  )
}

describe('Dropdown keyboard', () => {
  it('opens from the trigger and moves between items with arrows', async () => {
    render(<Menu />)

    const trigger = screen.getByRole('button', { name: 'Appearance' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await flushFrame()

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Dark' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Dark' }), { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: 'Light' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Light' }), { key: 'ArrowUp' })
    expect(screen.getByRole('menuitem', { name: 'Dark' })).toHaveFocus()
  })

  it('calls onHighlight with the item value while arrowing', async () => {
    const onHighlight = vi.fn()
    render(
      <Dropdown trigger={<button type="button">Appearance</button>} onHighlight={onHighlight}>
        <DropdownItem className="is-active" value="dark">Dark</DropdownItem>
        <DropdownItem value="light">Light</DropdownItem>
      </Dropdown>,
    )

    screen.getByRole('button', { name: 'Appearance' }).focus()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Appearance' }), { key: 'ArrowDown' })
    await flushFrame()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Dark' }), { key: 'ArrowDown' })
    expect(onHighlight).toHaveBeenCalledWith('light')
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    render(
      <Dropdown trigger={<button type="button">Appearance</button>}>
        <DropdownItem>Dark</DropdownItem>
      </Dropdown>,
    )

    screen.getByRole('button', { name: 'Appearance' }).focus()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Appearance' }), { key: 'ArrowDown' })
    await flushFrame()
    expect(screen.getByRole('menuitem', { name: 'Dark' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Dark' }), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Appearance' })).toHaveFocus()
  })
})
