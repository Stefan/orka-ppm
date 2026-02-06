'use client'

/**
 * Container for nested grid with loading, permission guard and error boundary
 * Requirements: 4.2, 6.1, 18.3
 */

import React, { useRef } from 'react'
import { useNestedGridData } from '@/lib/register-nested-grids/hooks'
import { detectChanges } from '@/lib/register-nested-grids/change-detection'
import type { Section } from './types'
import NestedGrid from './NestedGrid'
import AIChangeHighlight from './AIChangeHighlight'
import NestedGridErrorBoundary from './NestedGridErrorBoundary'

interface NestedGridContainerProps {
  parentRowId: string
  sections: Section[]
  registerId: string
  nestingLevel?: number
}

const MAX_NESTING_LEVEL = 2

export default function NestedGridContainer({
  parentRowId,
  sections,
  registerId,
  nestingLevel = 0,
}: NestedGridContainerProps) {
  if (nestingLevel >= MAX_NESTING_LEVEL) return null

  const firstSection = sections[0]
  const itemType = firstSection?.itemType ?? 'tasks'

  const { data, isLoading, error } = useNestedGridData(parentRowId, itemType)

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-slate-400">Loading...</div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500 dark:text-red-400">
        Failed to load: {(error as Error).message}
      </div>
    )
  }

  const rows = Array.isArray(data) ? data : []
  const prevRef = useRef<Record<string, unknown>[]>([])
  const prevRows = prevRef.current
  const highlights = prevRows.length && rows.length ? detectChanges(prevRows, rows) : []
  const newCount = highlights.filter((c) => c.changeType === 'added').length
  if (rows.length) prevRef.current = rows

  return (
    <NestedGridErrorBoundary>
      <div className="border-l-4 border-indigo-200 pl-2 py-2 space-y-1">
        {highlights.length > 0 && newCount > 0 && <AIChangeHighlight changes={highlights} newCount={newCount} />}
        <NestedGrid
          parentRowId={parentRowId}
          section={firstSection}
          rows={rows}
          registerId={registerId}
          nestingLevel={nestingLevel}
        />
      </div>
    </NestedGridErrorBoundary>
  )
}
