export const THEMES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

export const DEFAULT_THEME = 'system'

const LEGACY = {
  sand: 'light',
  slate: 'light',
  indigo: 'light',
  midnight: 'dark',
}

export function normalizeTheme(value) {
  if (LEGACY[value]) return LEGACY[value]
  if (THEMES.some((item) => item.id === value)) return value
  return DEFAULT_THEME
}

export function resolveTheme(preference) {
  const normalized = normalizeTheme(preference)
  if (normalized !== 'system') return normalized
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
