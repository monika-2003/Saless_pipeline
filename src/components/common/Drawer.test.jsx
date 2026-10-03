import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Drawer } from './Drawer.jsx'

function flush() {
  return act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
}

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Open details</button>
      {open ? (
        <Drawer title="Acme" labelledBy="drawer-title" onClose={() => setOpen(false)}>
          <button type="button">Inside action</button>
        </Drawer>
      ) : null}
    </div>
  )
}

describe('Drawer focus', () => {
  it('moves focus inside, traps Tab, and restores the opener on Escape', async () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open details' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Acme' })
    await flush()
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(opener).not.toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Acme' })).not.toBeInTheDocument()
    })
    expect(opener).toHaveFocus()
  })
})
