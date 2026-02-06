'use client'

import { useEffect, useCallback } from 'react'
import { useTheme } from '@/app/providers/ThemeProvider'

// Dark mode color palette
const DARK_COLORS = {
  bg: '#0f172a',
  bgSecondary: '#1e293b',
  bgTertiary: '#334155',
  text: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  border: '#475569',
  borderLight: '#334155',
}

const LIGHT_COLORS = {
  bg: '#ffffff',
  bgSecondary: '#f9fafb',
  bgTertiary: '#f3f4f6',
  text: '#111827',
  textSecondary: '#4b5563',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
}

// RGB values for comparison
const WHITE_BACKGROUNDS = [
  'rgb(255, 255, 255)',
  'rgba(255, 255, 255, 1)',
  'rgb(249, 250, 251)', // gray-50
  'rgb(243, 244, 246)', // gray-100
  'rgb(229, 231, 235)', // gray-200
]

const DARK_TEXT_COLORS = [
  'rgb(17, 24, 39)',   // gray-900
  'rgb(31, 41, 55)',   // gray-800
  'rgb(55, 65, 81)',   // gray-700
  'rgb(75, 85, 99)',   // gray-600
  'rgb(107, 114, 128)', // gray-500
  'rgb(156, 163, 175)', // gray-400
]

const LIGHT_BORDERS = [
  'rgb(229, 231, 235)', // gray-200
  'rgb(209, 213, 219)', // gray-300
  'rgb(243, 244, 246)', // gray-100
]

/**
 * Force dark mode styles via JavaScript
 * Comprehensive workaround for Tailwind v4 CSS variable issues
 */
export function DarkModeForcer() {
  const { resolvedTheme } = useTheme()

  const updateElement = useCallback((el: HTMLElement, isDark: boolean) => {
    const computed = window.getComputedStyle(el)
    const colors = isDark ? DARK_COLORS : LIGHT_COLORS
    
    // Skip elements that already have correct styles or are hidden
    if (computed.display === 'none' || computed.visibility === 'hidden') return
    
    const bg = computed.backgroundColor
    const color = computed.color
    const borderColor = computed.borderColor

    if (isDark) {
      // Update backgrounds
      if (WHITE_BACKGROUNDS.includes(bg)) {
        // Cards and elevated surfaces get secondary bg
        if (el.classList.contains('rounded-xl') || 
            el.classList.contains('rounded-lg') ||
            el.classList.contains('shadow') ||
            el.classList.contains('shadow-sm') ||
            el.classList.contains('shadow-md') ||
            el.tagName === 'CARD' ||
            el.getAttribute('role') === 'dialog' ||
            el.getAttribute('role') === 'listbox' ||
            el.getAttribute('role') === 'menu') {
          el.style.backgroundColor = colors.bgSecondary
        } else {
          el.style.backgroundColor = colors.bgSecondary
        }
      }
      
      // Update text colors
      if (DARK_TEXT_COLORS.slice(0, 3).includes(color)) {
        el.style.color = colors.text
      } else if (DARK_TEXT_COLORS.slice(3).includes(color)) {
        el.style.color = colors.textSecondary
      }
      
      // Update borders
      if (LIGHT_BORDERS.includes(borderColor)) {
        el.style.borderColor = colors.border
      }
      
      // Special handling for inputs
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
        el.style.backgroundColor = colors.bgSecondary
        el.style.color = colors.text
        el.style.borderColor = colors.border
      }
      
      // Special handling for buttons with light backgrounds
      if (el.tagName === 'BUTTON' && WHITE_BACKGROUNDS.includes(bg)) {
        el.style.backgroundColor = colors.bgTertiary
        el.style.color = colors.text
      }
    } else {
      // Reset to light mode - remove inline styles we added
      // Only reset if we previously set these
      if (el.style.backgroundColor && !el.getAttribute('data-original-bg')) {
        el.style.backgroundColor = ''
      }
      if (el.style.color && !el.getAttribute('data-original-color')) {
        el.style.color = ''
      }
      if (el.style.borderColor && !el.getAttribute('data-original-border')) {
        el.style.borderColor = ''
      }
    }
  }, [])

  useEffect(() => {
    // Respect explicit light choice: data-theme="light" must never show dark body
    const dataTheme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null
    const forceLight = dataTheme === 'light'
    const isDark = !forceLight && resolvedTheme === 'dark'
    const colors = isDark ? DARK_COLORS : LIGHT_COLORS

    // Apply to body (ThemeProvider uses !important for light; we don't override that)
    document.body.style.backgroundColor = colors.bg
    document.body.style.color = colors.text

    // Update all current elements
    const updateAllElements = () => {
      const allElements = document.querySelectorAll('*')
      allElements.forEach((el) => {
        if (el instanceof HTMLElement) {
          updateElement(el, isDark)
        }
      })
    }

    // Initial update
    updateAllElements()

    // Watch for new elements being added to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            updateElement(node, isDark)
            // Also update children of the new node
            node.querySelectorAll('*').forEach((child) => {
              if (child instanceof HTMLElement) {
                updateElement(child, isDark)
              }
            })
          }
        })
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [resolvedTheme, updateElement])

  return null
}
