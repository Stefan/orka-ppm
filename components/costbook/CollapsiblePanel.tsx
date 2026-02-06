'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react'

export interface CollapsiblePanelProps {
  /** Panel title */
  title: string
  /** Icon to display in header */
  icon?: React.ReactNode
  /** Whether panel is initially open */
  defaultOpen?: boolean
  /** Controlled open state */
  isOpen?: boolean
  /** Callback when open state changes */
  onToggle?: (isOpen: boolean) => void
  /** Default height when expanded */
  defaultHeight?: number | string
  /** Children content */
  children: React.ReactNode
  /** Additional header content */
  headerContent?: React.ReactNode
  /** Whether to persist state in session storage */
  persistState?: boolean
  /** Storage key for persistence */
  storageKey?: string
  /** Additional CSS classes for container */
  className?: string
  /** Additional CSS classes for content */
  contentClassName?: string
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * CollapsiblePanel component for Costbook
 * Provides smooth height transitions and optional state persistence
 */
export function CollapsiblePanel({
  title,
  icon,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggle,
  defaultHeight,
  children,
  headerContent,
  persistState = false,
  storageKey,
  className = '',
  contentClassName = '',
  'data-testid': testId = 'collapsible-panel'
}: CollapsiblePanelProps) {
  // Determine if component is controlled
  const isControlled = controlledIsOpen !== undefined

  // Internal state for uncontrolled mode
  const [internalIsOpen, setInternalIsOpen] = useState(() => {
    if (isControlled) return controlledIsOpen
    
    // Try to load from session storage if persistence is enabled
    if (persistState && storageKey && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(`collapsible-panel-${storageKey}`)
      if (stored !== null) {
        return stored === 'true'
      }
    }
    
    return defaultOpen
  })

  // Content ref for height animation
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto')

  // Get current open state
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen

  // Update content height when children change
  useEffect(() => {
    if (contentRef.current && isOpen) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [children, isOpen])

  // Persist state to session storage
  useEffect(() => {
    if (persistState && storageKey && typeof window !== 'undefined') {
      sessionStorage.setItem(`collapsible-panel-${storageKey}`, String(isOpen))
    }
  }, [isOpen, persistState, storageKey])

  const handleToggle = () => {
    const newState = !isOpen
    
    if (!isControlled) {
      setInternalIsOpen(newState)
    }
    
    if (onToggle) {
      onToggle(newState)
    }
  }

  return (
    <div
      className={`
        bg-gray-50 dark:bg-slate-800
        rounded-lg
        border border-gray-200 dark:border-slate-700
        overflow-hidden
        transition-all duration-300
        ${className}
      `}
      data-testid={testId}
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        className={`
          w-full
          flex items-center justify-between
          px-4 py-3
          bg-white dark:bg-slate-700
          hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-600
          transition-colors
          cursor-pointer
          focus:outline-none
          focus:ring-2 focus:ring-blue-500 focus:ring-inset
        `}
        aria-expanded={isOpen}
        aria-controls={`${testId}-content`}
        data-testid={`${testId}-header`}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-gray-500 dark:text-slate-400">{icon}</span>
          )}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {headerContent}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      <div
        id={`${testId}-content`}
        className={`
          overflow-hidden
          transition-all duration-300 ease-in-out
        `}
        style={{
          height: isOpen ? (defaultHeight || contentHeight) : 0,
          opacity: isOpen ? 1 : 0
        }}
        data-testid={`${testId}-content`}
      >
        <div ref={contentRef} className={`p-4 ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Panel group that allows only one panel open at a time (accordion)
 */
export function CollapsiblePanelGroup({
  panels,
  allowMultiple = false,
  className = ''
}: {
  panels: Array<{
    id: string
    title: string
    icon?: React.ReactNode
    content: React.ReactNode
    defaultOpen?: boolean
  }>
  allowMultiple?: boolean
  className?: string
}) {
  const [openPanels, setOpenPanels] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    panels.forEach(panel => {
      if (panel.defaultOpen) {
        initial.add(panel.id)
      }
    })
    return initial
  })

  const handleToggle = (panelId: string, isOpen: boolean) => {
    setOpenPanels(prev => {
      const next = new Set(prev)
      
      if (isOpen) {
        if (!allowMultiple) {
          next.clear()
        }
        next.add(panelId)
      } else {
        next.delete(panelId)
      }
      
      return next
    })
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {panels.map(panel => (
        <CollapsiblePanel
          key={panel.id}
          title={panel.title}
          icon={panel.icon}
          isOpen={openPanels.has(panel.id)}
          onToggle={(isOpen) => handleToggle(panel.id, isOpen)}
          data-testid={`panel-${panel.id}`}
        >
          {panel.content}
        </CollapsiblePanel>
      ))}
    </div>
  )
}

/**
 * Expandable card with full-screen toggle
 */
export function ExpandableCard({
  title,
  icon,
  children,
  className = '',
  'data-testid': testId = 'expandable-card'
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      {/* Normal view */}
      <div
        className={`
          bg-white dark:bg-slate-800
          rounded-lg
          border border-gray-200 dark:border-slate-700
          shadow-sm
          ${isExpanded ? 'hidden' : ''}
          ${className}
        `}
        data-testid={testId}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {icon && <span className="text-gray-500 dark:text-slate-400">{icon}</span>}
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="p-1 text-gray-600 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
            title="Expand"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {children}
        </div>
      </div>

      {/* Expanded (full-screen) view */}
      {isExpanded && (
        <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              {icon && <span className="text-gray-500 dark:text-slate-400">{icon}</span>}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
              title="Minimize"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {children}
          </div>
        </div>
      )}
    </>
  )
}

export default CollapsiblePanel