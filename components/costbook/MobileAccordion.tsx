'use client'

import React, { useState, useCallback, ReactNode } from 'react'
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react'

export interface AccordionSection {
  /** Unique identifier for the section */
  id: string
  /** Section title */
  title: string
  /** Optional icon component */
  icon?: LucideIcon
  /** Section content (rendered when expanded) */
  content: ReactNode
  /** Whether the section is disabled */
  disabled?: boolean
  /** Badge text (e.g., count) */
  badge?: string | number
}

export interface MobileAccordionProps {
  /** Array of accordion sections */
  sections: AccordionSection[]
  /** Initially expanded section IDs */
  initialExpandedIds?: string[]
  /** Allow multiple sections open at once */
  allowMultiple?: boolean
  /** Handler when section expands/collapses */
  onSectionChange?: (expandedIds: string[]) => void
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * MobileAccordion component for mobile responsive layout
 * Full-width stacked sections with 44x44px minimum touch targets
 */
export function MobileAccordion({
  sections,
  initialExpandedIds = [],
  allowMultiple = true,
  onSectionChange,
  className = '',
  'data-testid': testId = 'mobile-accordion'
}: MobileAccordionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(initialExpandedIds)
  )

  // Handle section toggle
  const handleToggle = useCallback((sectionId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      
      if (next.has(sectionId)) {
        // Collapse
        next.delete(sectionId)
      } else {
        // Expand
        if (!allowMultiple) {
          // Clear other expanded sections
          next.clear()
        }
        next.add(sectionId)
      }
      
      // Notify parent
      onSectionChange?.(Array.from(next))
      
      return next
    })
  }, [allowMultiple, onSectionChange])

  // Check if section is expanded
  const isExpanded = useCallback((sectionId: string) => 
    expandedIds.has(sectionId),
    [expandedIds]
  )

  if (sections.length === 0) {
    return (
      <div 
        className={`text-center py-8 text-gray-500 dark:text-gray-400 ${className}`}
        data-testid={testId}
      >
        No sections available
      </div>
    )
  }

  return (
    <div 
      className={`divide-y divide-gray-200 dark:divide-gray-700 ${className}`}
      data-testid={testId}
    >
      {sections.map((section, index) => {
        const Icon = section.icon
        const expanded = isExpanded(section.id)
        
        return (
          <div 
            key={section.id}
            className="bg-white dark:bg-gray-900"
            data-testid={`accordion-section-${section.id}`}
          >
            {/* Section header - minimum 44px touch target */}
            <button
              type="button"
              onClick={() => !section.disabled && handleToggle(section.id)}
              disabled={section.disabled}
              className={`
                w-full flex items-center justify-between
                min-h-[44px] px-4 py-3
                text-left transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                ${section.disabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700'
                }
              `}
              aria-expanded={expanded}
              aria-controls={`accordion-content-${section.id}`}
            >
              {/* Left side: icon and title */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                  <Icon className={`w-5 h-5 flex-shrink-0 ${
                    section.disabled 
                      ? 'text-gray-400' 
                      : expanded 
                        ? 'text-blue-500' 
                        : 'text-gray-500 dark:text-gray-400'
                  }`} />
                )}
                <span className={`text-base font-medium truncate ${
                  section.disabled 
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {section.title}
                </span>
              </div>

              {/* Right side: badge and chevron */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {section.badge !== undefined && (
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {section.badge}
                  </span>
                )}
                
                {/* Chevron with minimum 44x44 touch area */}
                <span className="w-6 h-6 flex items-center justify-center">
                  {expanded 
                    ? <ChevronDown className="w-5 h-5 text-gray-400" />
                    : <ChevronRight className="w-5 h-5 text-gray-400" />
                  }
                </span>
              </div>
            </button>

            {/* Section content */}
            <div
              id={`accordion-content-${section.id}`}
              role="region"
              aria-labelledby={`accordion-header-${section.id}`}
              className={`
                overflow-hidden transition-all duration-300 ease-in-out
                ${expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
              `}
            >
              <div className="px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/50">
                {section.content}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Single accordion item for standalone use
 */
export interface AccordionItemProps {
  /** Section title */
  title: string
  /** Optional icon component */
  icon?: LucideIcon
  /** Section content */
  children: ReactNode
  /** Whether initially expanded */
  defaultExpanded?: boolean
  /** Controlled expanded state */
  expanded?: boolean
  /** Handler for expand/collapse */
  onToggle?: (expanded: boolean) => void
  /** Whether the item is disabled */
  disabled?: boolean
  /** Badge text */
  badge?: string | number
  /** Additional CSS classes */
  className?: string
}

export function AccordionItem({
  title,
  icon: Icon,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  disabled = false,
  badge,
  className = ''
}: AccordionItemProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  
  // Use controlled or uncontrolled state
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded
  
  const handleToggle = useCallback(() => {
    if (disabled) return
    
    const newExpanded = !isExpanded
    
    if (controlledExpanded === undefined) {
      setInternalExpanded(newExpanded)
    }
    
    onToggle?.(newExpanded)
  }, [disabled, isExpanded, controlledExpanded, onToggle])

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between
          min-h-[44px] px-4 py-3
          text-left transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset
          ${disabled 
            ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800' 
            : 'hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700'
          }
        `}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {Icon && (
            <Icon className={`w-5 h-5 flex-shrink-0 ${
              disabled 
                ? 'text-gray-400' 
                : isExpanded 
                  ? 'text-blue-500' 
                  : 'text-gray-500 dark:text-gray-400'
            }`} />
          )}
          <span className={`text-base font-medium truncate ${
            disabled 
              ? 'text-gray-400 dark:text-gray-500'
              : 'text-gray-900 dark:text-gray-100'
          }`}>
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {badge !== undefined && (
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {badge}
            </span>
          )}
          
          <span className="w-6 h-6 flex items-center justify-center">
            {isExpanded 
              ? <ChevronDown className="w-5 h-5 text-gray-400" />
              : <ChevronRight className="w-5 h-5 text-gray-400" />
            }
          </span>
        </div>
      </button>

      <div
        className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton loader for MobileAccordion
 */
export function MobileAccordionSkeleton({
  sectionCount = 4,
  className = ''
}: {
  sectionCount?: number
  className?: string
}) {
  return (
    <div className={`divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
      {Array.from({ length: sectionCount }).map((_, i) => (
        <div key={i} className="px-4 py-3 min-h-[44px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export default MobileAccordion
