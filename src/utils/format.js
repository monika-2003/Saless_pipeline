const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const dateShort = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  day: 'numeric',
})

const dateLong = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const dateChip = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const timeFmt = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
})

export function formatMoney(value) {
  return inr.format(value)
}

export function formatMoneyCompact(value) {
  if (value >= 1_00_00_000) {
    const crore = value / 1_00_00_000
    const digits = crore >= 100 ? 0 : 1
    return `₹${crore.toLocaleString('en-IN', { maximumFractionDigits: digits })} Cr`
  }
  if (value >= 1_00_000) {
    return `₹${(value / 1_00_000).toFixed(1)} L`
  }
  return formatMoney(value)
}

export function formatDate(timestamp) {
  return dateShort.format(timestamp)
}

export function formatCloseRelative(timestamp) {
  const today = startOfToday()
  const target = new Date(timestamp)
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today) / 86_400_000)
  if (days === 0) return 'Closes today'
  if (days === 1) return 'Closes tomorrow'
  if (days === -1) return 'Closed yesterday'
  if (days < 0) return `Overdue ${Math.abs(days)}d`
  if (days > 21) return `Close ${dateShort.format(timestamp)}`
  return `Close in ${days} days`
}

export function formatDateLong(timestamp) {
  return dateLong.format(timestamp)
}

export function formatTime(timestamp) {
  return timeFmt.format(timestamp)
}

export function formatCount(value) {
  return value.toLocaleString('en-IN')
}

export function formatSelectedOfTotal(selected, total) {
  if (selected > 0) return `${formatCount(selected)} of ${formatCount(total)}`
  return formatCount(total)
}

export function initials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function isSameDay(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function startOfDay(timestamp) {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function endOfDay(timestamp) {
  const date = new Date(timestamp)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

export function parseDateInput(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day).getTime()
}

export function toDateInput(timestamp) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateChip(timestamp) {
  return dateChip.format(timestamp)
}
