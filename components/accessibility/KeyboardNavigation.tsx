'use client'

import React, { useEffect, useRef } from 'react'
import { useKeyboardShortcuts } from '../../hooks/useKeyboard'
import { useFocusManagement, useSkipLinks } from '../../hooks/useFocusManagement'

interface KeyboardNavigationProps {
  children: React.ReactNode
  enableSkipLinks?: boolean
  shortcuts?: Array<{
    key: string
    description: string
    action: () => void
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    meta?: boolean
  }>
}

/**
 * KeyboardNavigation component provides comprehensive keyboard navigation support
 * including skip links, focus management, and keyboard shortcuts
 */
export default function KeyboardNavigation({ 
  children, 
  enableSkipLinks = true,
  shortcuts = []
}: KeyboardNavigationProps) {
  const { containerRef, trapFocus } = useFocusManagement()
  const { skipLinksRef, addSkipLink } = useSkipLinks()
  const shortcutsHelpRef = useRef<HTMLDivElement>(null)

  // Default keyboard shortcuts
  const defaultShortcuts = [
    {
      key: '/',
      description: 'Focus search',
      action: () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLElement
        if (searchInput) {
          searchInput.focus()
        }
      },
      ctrl: false,
      alt: false,
      shift: false,
      meta: false
    },
    {
      key: 'h',
      description: 'Go to home/dashboard',
      action: () => {
        window.location.href = '/dashboards'
      },
      ctrl: false,
      alt: false,
      shift: false,
      meta: false
    },
    {
      key: 'r',
      description: 'Go to resources',
      action: () => {
        window.location.href = '/resources'
      },
      ctrl: false,
      alt: false,
      shift: false,
      meta: false
    },
    {
      key: 'f',
      description: 'Go to financials',
      action: () => {
        window.location.href = '/financials'
      },
      ctrl: false,
      alt: false,
      shift: false,
      meta: false
    },
    {
      key: '?',
      description: 'Show keyboard shortcuts help',
      action: () => {
        if (shortcutsHelpRef.current) {
          shortcutsHelpRef.current.style.display = 
            shortcutsHelpRef.current.style.display === 'none' ? 'block' : 'none'
          
          if (shortcutsHelpRef.current.style.display === 'block') {
            shortcutsHelpRef.current.focus()
          }
        }
      },
      ctrl: false,
      alt: false,
      shift: true,
      meta: false
    },
    {
      key: 'Escape',
      description: 'Close modals/overlays',
      action: () => {
        // Close any open modals or overlays
        const closeButtons = document.querySelectorAll('[data-close-modal], [aria-label*="close" i]')
        if (closeButtons.length > 0) {
          (closeButtons[0] as HTMLElement).click()
        }
        
        // Hide shortcuts help
        if (shortcutsHelpRef.current) {
          shortcutsHelpRef.current.style.display = 'none'
        }
      }
    }
  ]

  // Combine default and custom shortcuts
  const allShortcuts = [...defaultShortcuts, ...shortcuts]

  // Set up keyboard shortcuts
  useKeyboardShortcuts(
    allShortcuts.map(shortcut => ({
      key: shortcut.key,
      callback: shortcut.action,
      ...(shortcut.ctrl !== undefined && { ctrl: shortcut.ctrl }),
      ...(shortcut.alt !== undefined && { alt: shortcut.alt }),
      ...(shortcut.shift !== undefined && { shift: shortcut.shift }),
      ...(shortcut.meta !== undefined && { meta: shortcut.meta }),
      preventDefault: true
    }))
  )

  // Set up skip links
  useEffect(() => {
    if (!enableSkipLinks) return

    // Add common skip links
    addSkipLink('main-content', 'Skip to main content')
    addSkipLink('navigation', 'Skip to navigation')
    addSkipLink('search', 'Skip to search')
  }, [enableSkipLinks, addSkipLink])

  // Handle focus trapping for modals
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trap focus if we're in a modal or dialog
      const activeModal = document.querySelector('[role="dialog"]:not([aria-hidden="true"])')
      if (activeModal && activeModal.contains(document.activeElement)) {
        trapFocus(event)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [trapFocus])

  return (
    <div ref={containerRef} className="keyboard-navigation-container">
      {/* Skip Links */}
      {enableSkipLinks && (
        <div 
          ref={skipLinksRef} 
          className="skip-links"
          aria-label="Skip navigation links"
        />
      )}

      {/* Keyboard Shortcuts Help */}
      <div
        ref={shortcutsHelpRef}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
        style={{ display: 'none' }}
        role="dialog"
        aria-labelledby="shortcuts-title"
        aria-describedby="shortcuts-description"
        tabIndex={-1}
      >
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 id="shortcuts-title" className="text-xl font-semibold text-gray-900">
              Keyboard Shortcuts
            </h2>
            <button
              onClick={() => {
                if (shortcutsHelpRef.current) {
                  shortcutsHelpRef.current.style.display = 'none'
                }
              }}
              className="text-gray-400 hover:text-gray-600 p-1 rounded"
              aria-label="Close shortcuts help"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div id="shortcuts-description" className="space-y-3">
            {allShortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{shortcut.description}</span>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">
                  {shortcut.ctrl && 'Ctrl + '}
                  {shortcut.alt && 'Alt + '}
                  {shortcut.shift && 'Shift + '}
                  {shortcut.meta && 'Cmd + '}
                  {shortcut.key === ' ' ? 'Space' : shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
          
          <div className="mt-6 text-xs text-gray-500">
            Press <kbd className="px-1 py-0.5 bg-gray-100 border rounded">Escape</kbd> to close
          </div>
        </div>
      </div>

      {/* Main content */}
      {children}
    </div>
  )
}

/**
 * FocusIndicator component provides enhanced focus visibility
 */
export function FocusIndicator({ children }: { children: React.ReactNode }) {
  return (
    <div className="focus-indicator-container">
      <style jsx global>{`
        .focus-indicator-container *:focus {
          outline: 2px solid #3b82f6 !important;
          outline-offset: 2px !important;
          border-radius: 4px;
        }
        
        .focus-indicator-container *:focus:not(:focus-visible) {
          outline: none !important;
        }
        
        .focus-indicator-container *:focus-visible {
          outline: 2px solid #3b82f6 !important;
          outline-offset: 2px !important;
          border-radius: 4px;
        }
        
        /* Skip links styling */
        .sr-only {
          position: absolute !important;
          width: 1px !important;
          height: 1px !important;
          padding: 0 !important;
          margin: -1px !important;
          overflow: hidden !important;
          clip: rect(0, 0, 0, 0) !important;
          white-space: nowrap !important;
          border: 0 !important;
        }
        
        .focus\\:not-sr-only:focus {
          position: static !important;
          width: auto !important;
          height: auto !important;
          padding: 0.5rem 1rem !important;
          margin: 0 !important;
          overflow: visible !important;
          clip: auto !important;
          white-space: normal !important;
        }
      `}</style>
      {children}
    </div>
  )
}