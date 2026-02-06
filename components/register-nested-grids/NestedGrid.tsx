'use client'

/**
 * Nested Grid display - max 2 levels
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */

import React from 'react'
import type { Section, ColumnConfig } from './types'

interface NestedGridProps {
  parentRowId: string
  section: Section
  rows: Record<string, unknown>[]
  registerId: string
  nestingLevel: number
}

export default function NestedGrid({
  parentRowId,
  section,
  rows,
  registerId,
  nestingLevel,
}: NestedGridProps) {
  const columns = [...(section?.columns ?? [])].sort((a, b) => a.order - b.order)

  const getCellValue = (row: Record<string, unknown>, col: ColumnConfig) => {
    const v = row[col.field]
    if (v == null) return '-'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  return (
    <div className="overflow-auto max-h-48">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-gray-100 dark:bg-slate-700">
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                className="border-b border-gray-200 dark:border-slate-700 px-2 py-1.5 text-left text-xs font-medium text-gray-600 dark:text-slate-400"
              >
                {col.headerName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={(row.id as string) ?? i} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
              {columns.map((col) => (
                <td key={col.id} className="px-2 py-1.5">
                  {getCellValue(row, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="p-4 text-sm text-gray-400 dark:text-slate-500 text-center">No items</div>
      )}
    </div>
  )
}
