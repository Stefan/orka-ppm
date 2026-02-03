'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './SupabaseAuthProvider'

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
 * Apply theme to document
 */
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark')

  // Set data-theme for CSS variables
  root.removeAttribute('data-theme')
  root.setAttribute('data-theme', theme)

  // Set .dark class for Tailwind dark: variant
  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // color-scheme for native elements (inputs, scrollbars)
  root.style.colorScheme = isDark ? 'dark' : 'light'

  // Set body colors directly via JavaScript
  const darkBg = '#0f172a'
  const darkText = '#f1f5f9'
  const lightBg = '#ffffff'
  const lightText = '#111827'
  
  document.body.style.backgroundColor = isDark ? darkBg : lightBg
  document.body.style.color = isDark ? darkText : lightText
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
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

  // Load theme from user preferences when authenticated
  useEffect(() => {
    if (!session?.user?.id || !mounted) return
    
    // Try to load from user preferences
    const loadUserTheme = async () => {
      try {
        const response = await fetch(`/api/sync/preferences?userId=${session.user.id}`)
        if (response.ok) {
          const prefs = await response.json()
          if (prefs?.theme && ['light', 'dark', 'system'].includes(prefs.theme)) {
            // Only update if different from current
            if (prefs.theme !== theme) {
              setThemeState(prefs.theme)
              applyTheme(prefs.theme)
              localStorage.setItem(THEME_STORAGE_KEY, prefs.theme)
              
              if (prefs.theme === 'system') {
                setResolvedTheme(getSystemTheme())
              } else {
                setResolvedTheme(prefs.theme)
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load theme from preferences:', error)
      }
    }
    
    loadUserTheme()
  }, [session?.user?.id, mounted])

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
        document.documentElement.setAttribute('data-theme', theme);
        var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.style.colorScheme = 'dark';
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.colorScheme = 'light';
        }
        // Set body colors directly
        var darkBg = '#0f172a';
        var darkText = '#f1f5f9';
        var lightBg = '#ffffff';
        var lightText = '#111827';
        document.addEventListener('DOMContentLoaded', function() {
          document.body.style.backgroundColor = isDark ? darkBg : lightBg;
          document.body.style.color = isDark ? darkText : lightText;
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
