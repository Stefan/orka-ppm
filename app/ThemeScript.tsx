import React from 'react'

const THEME_STORAGE_KEY = 'orka-theme'

/**
 * Inline script to prevent flash of incorrect theme.
 * Must be in <head> and must NOT be in a 'use client' file so root layout can export metadata.
 * Keep in sync with ThemeProvider theme logic.
 */
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('${THEME_STORAGE_KEY}') || 'system';
        var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
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
