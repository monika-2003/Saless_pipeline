import { initials } from '../../utils/format.js'

const COLORS = ['#4f46e5', '#0f766e', '#b45309', '#be185d', '#0369a1', '#15803d', '#7c3aed']

function colorFor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function Avatar({ name }) {
  return (
    <span className="avatar" style={{ background: colorFor(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
