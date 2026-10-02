import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_THEME, THEMES, normalizeTheme, resolveTheme } from './themes.js'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'pipeline-theme'

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => normalizeTheme(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME))
  const [resolved, setResolved] = useState(() => resolveTheme(theme))

  useEffect(() => {
    const next = resolveTheme(theme)
    setResolved(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem(STORAGE_KEY, theme)

    if (theme !== 'system') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function onChange() {
      const system = resolveTheme('system')
      setResolved(system)
      document.documentElement.setAttribute('data-theme', system)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const value = useMemo(
    () => ({ theme, setTheme, resolved, themes: THEMES }),
    [theme, resolved],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
