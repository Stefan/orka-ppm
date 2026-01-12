'use client'

import React, { useEffect, useState } from 'react'

/**
 * LiveRegion component for announcing dynamic content changes to screen readers
 */
export function LiveRegion({ 
  children, 
  politeness = 'polite',
  atomic = false,
  relevant = 'additions text',
  className = 'sr-only'
}: {
  children: React.ReactNode
  politeness?: 'off' | 'polite' | 'assertive'
  atomic?: boolean
  relevant?: 'additions' | 'removals' | 'text' | 'all' | 'additions text' | 'additions removals' | 'removals text' | 'text additions' | 'text removals' | 'removals additions'
  className?: string
}) {
  return (
    <div
      aria-live={politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={className}
    >
      {children}
    </div>
  )
}

/**
 * ScreenReaderOnly component for content that should only be available to screen readers
 */
export function ScreenReaderOnly({ 
  children,
  as = 'span'
}: { 
  children: React.ReactNode
  as?: keyof JSX.IntrinsicElements
}) {
  const Component = as as any
  
  return (
    <Component className="sr-only">
      {children}
    </Component>
  )
}

/**
 * VisuallyHidden component that can be revealed on focus
 */
export function VisuallyHidden({ 
  children,
  focusable = false
}: { 
  children: React.ReactNode
  focusable?: boolean
}) {
  return (
    <span className={focusable ? 'sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-white p-2 z-50' : 'sr-only'}>
      {children}
    </span>
  )
}

/**
 * AnnouncementManager for managing screen reader announcements
 */
export function AnnouncementManager() {
  const [announcements, setAnnouncements] = useState<Array<{
    id: string
    message: string
    politeness: 'polite' | 'assertive'
    timestamp: number
  }>>([])

  const announce = (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const id = `announcement-${Date.now()}-${Math.random()}`
    const announcement = {
      id,
      message,
      politeness,
      timestamp: Date.now()
    }

    setAnnouncements(prev => [...prev, announcement])

    // Remove announcement after it's been read
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    }, 1000)
  }

  // Expose announce function globally
  useEffect(() => {
    (window as any).announceToScreenReader = announce
    return () => {
      delete (window as any).announceToScreenReader
    }
  }, [])

  return (
    <>
      {announcements.map(announcement => (
        <LiveRegion 
          key={announcement.id}
          politeness={announcement.politeness}
        >
          {announcement.message}
        </LiveRegion>
      ))}
    </>
  )
}

/**
 * DescribedBy component for providing additional descriptions
 */
export function DescribedBy({ 
  id,
  children 
}: { 
  id: string
  children: React.ReactNode 
}) {
  return (
    <div id={id} className="sr-only">
      {children}
    </div>
  )
}

/**
 * ProgressAnnouncer for announcing progress updates
 */
export function ProgressAnnouncer({ 
  value,
  max = 100,
  label,
  description
}: {
  value: number
  max?: number
  label: string
  description?: string
}) {
  const [lastAnnounced, setLastAnnounced] = useState<number>(-1)
  const percentage = Math.round((value / max) * 100)

  useEffect(() => {
    // Only announce significant changes (every 10%)
    const threshold = Math.floor(percentage / 10) * 10
    if (threshold !== lastAnnounced && threshold % 10 === 0) {
      const message = `${label}: ${percentage}% complete${description ? `. ${description}` : ''}`
      if ((window as any).announceToScreenReader) {
        (window as any).announceToScreenReader(message, 'polite')
      }
      setLastAnnounced(threshold)
    }
  }, [percentage, lastAnnounced, label, description])

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      aria-describedby={description ? `progress-desc-${label.replace(/\s+/g, '-')}` : undefined}
    >
      {description && (
        <DescribedBy id={`progress-desc-${label.replace(/\s+/g, '-')}`}>
          {description}
        </DescribedBy>
      )}
    </div>
  )
}

/**
 * TableCaption component for accessible table descriptions
 */
export function TableCaption({ 
  children,
  summary
}: { 
  children: React.ReactNode
  summary?: string
}) {
  return (
    <>
      <caption className="sr-only">
        {children}
        {summary && <span className="block mt-1 text-sm">{summary}</span>}
      </caption>
    </>
  )
}

/**
 * AccessibleTable component with proper ARIA labels and structure
 */
export function AccessibleTable({ 
  caption,
  summary,
  headers,
  data,
  className = '',
  sortable = false,
  onSort
}: {
  caption: string
  summary?: string
  headers: Array<{
    key: string
    label: string
    sortable?: boolean
  }>
  data: Array<Record<string, any>>
  className?: string
  sortable?: boolean
  onSort?: (key: string, direction: 'asc' | 'desc') => void
}) {
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)

  const handleSort = (key: string) => {
    if (!sortable) return

    const direction = sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    setSortConfig({ key, direction })
    
    if (onSort) {
      onSort(key, direction)
    }

    // Announce sort change
    if ((window as any).announceToScreenReader) {
      const header: { key: string; label: string; sortable?: boolean } | undefined = headers.find((h: { key: string; label: string; sortable?: boolean }) => h.key === key)
      if (header) {
        (window as any).announceToScreenReader(
          `Table sorted by ${header.label} in ${direction}ending order`,
          'polite'
        )
      }
    }
  }

  return (
    <table className={`w-full ${className}`} role="table">
      <TableCaption {...(summary && { summary })}>
        {caption}
      </TableCaption>
      
      <thead>
        <tr role="row">
          {headers.map((header) => (
            <th
              key={header.key}
              role="columnheader"
              scope="col"
              className={`px-4 py-2 text-left ${
                sortable && header.sortable !== false 
                  ? 'cursor-pointer hover:bg-gray-100' 
                  : ''
              }`}
              onClick={() => sortable && header.sortable !== false && handleSort(header.key)}
              aria-sort={
                sortConfig?.key === header.key 
                  ? sortConfig.direction === 'asc' ? 'ascending' : 'descending'
                  : sortable && header.sortable !== false ? 'none' : undefined
              }
              tabIndex={sortable && header.sortable !== false ? 0 : undefined}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && sortable && header.sortable !== false) {
                  e.preventDefault()
                  handleSort(header.key)
                }
              }}
            >
              {header.label}
              {sortable && header.sortable !== false && (
                <ScreenReaderOnly>
                  {sortConfig?.key === header.key 
                    ? `, sorted ${sortConfig.direction}ending`
                    : ', sortable'
                  }
                </ScreenReaderOnly>
              )}
            </th>
          ))}
        </tr>
      </thead>
      
      <tbody>
        {data.map((row, index) => (
          <tr key={index} role="row">
            {headers.map((header) => (
              <td
                key={header.key}
                role="gridcell"
                className="px-4 py-2 border-t"
              >
                {row[header.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * FormFieldDescription component for accessible form field descriptions
 */
export function FormFieldDescription({ 
  id,
  children 
}: { 
  id: string
  children: React.ReactNode 
}) {
  return (
    <div id={id} className="text-sm text-gray-600 mt-1">
      {children}
    </div>
  )
}

/**
 * ErrorMessage component for accessible error announcements
 */
export function ErrorMessage({ 
  id,
  children,
  announce = true
}: { 
  id: string
  children: React.ReactNode
  announce?: boolean
}) {
  useEffect(() => {
    if (announce && children && (window as any).announceToScreenReader) {
      (window as any).announceToScreenReader(
        `Error: ${children}`,
        'assertive'
      )
    }
  }, [children, announce])

  return (
    <div 
      id={id} 
      className="text-sm text-red-600 mt-1" 
      role="alert"
      aria-live="assertive"
    >
      {children}
    </div>
  )
}