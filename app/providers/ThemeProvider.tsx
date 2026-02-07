'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// Key for localStorage
const THEME_STORAGE_KEY = 'orka-theme'

/**
 * Get the resolved theme (light or dark) based on system preference
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Apply theme to document.
 * Also strips any leftover inline styles that a previous script (DarkModeForcer)
 * might have stamped onto elements.
 */
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark')

  // 1. data-theme attribute for CSS custom properties
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')

  // 2. .dark class for Tailwind dark: variant
  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // 3. color-scheme for native elements (scrollbars, inputs)
  root.style.colorScheme = isDark ? 'dark' : 'light'

  // 4. Strip ALL inline background-color / color styles from every element
  document.querySelectorAll('[style]').forEach(el => {
    if (el instanceof HTMLElement) {
      if (el.style.backgroundColor) el.style.removeProperty('background-color')
      if (el.style.color) el.style.removeProperty('color')
      if (el.style.borderColor) el.style.removeProperty('border-color')
    }
  })

  // 5. Body colors
  const bg = isDark ? '#0f172a' : '#ffffff'
  const fg = isDark ? '#f1f5f9' : '#111827'
  document.body.style.backgroundColor = bg
  document.body.style.color = fg
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true)
    
    // Get stored theme or default to system
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    const initialTheme = storedTheme || 'system'
    
    setThemeState(initialTheme)
    applyTheme(initialTheme)
    
    // Set resolved theme
    if (initialTheme === 'system') {
      setResolvedTheme(getSystemTheme())
    } else {
      setResolvedTheme(initialTheme)
    }

  }, [])

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        setResolvedTheme(e.matches ? 'dark' : 'light')
        applyTheme('system')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, mounted])

  // Theme is loaded from localStorage only on mount (see effect above).
  // Synced theme from /api/sync/preferences is applied via useSettings/CrossDeviceSyncService
  // when the user is authenticated and the API accepts the token; we do not fetch here
  // to avoid 401 console noise when the token is missing or rejected.

  // Set theme function
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    if (newTheme === 'system') {
      setResolvedTheme(getSystemTheme())
    } else {
      setResolvedTheme(newTheme)
    }
  }, [])

  // Prevent flash by not rendering until mounted
  // But we still need to render children to avoid hydration mismatch
  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Hook to access theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

/**
 * Script to prevent flash of incorrect theme
 * Add this to <head> to apply theme before page renders
 */
export const ThemeScript = () => {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('${THEME_STORAGE_KEY}') || 'system';
        var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        // Always set data-theme to 'light' or 'dark' (never 'system')
        // so CSS [data-theme="light"]/[data-theme="dark"] selectors always match
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.style.colorScheme = 'dark';
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.colorScheme = 'light';
        }
        document.addEventListener('DOMContentLoaded', function() {
          document.body.style.backgroundColor = isDark ? '#0f172a' : '#ffffff';
          document.body.style.color = isDark ? '#f1f5f9' : '#111827';
        });
      } catch (e) {}
    })();
  `
  
  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  )
}
