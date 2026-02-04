'use client'

/**
 * Register Grid with expandable nested rows
 * Requirements: 4.1, 4.2, 4.6, 5.1
 */

import React, { useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useNestedGridStore } from '@/lib/register-nested-grids/store'
import type { NestedGridConfig, ColumnConfig } from './types'
import NestedGridContainer from './NestedGridContainer'

interface RegisterGridProps<T extends { id: string }> {
  registerId: string
  rows: T[]
  config: NestedGridConfig | null
  getRowId: (row: T) => string
  columns: { field: string; headerName: string }[]
  renderCell: (row: T, field: string) => React.ReactNode
  getLinkedCount?: (row: T) => number
}

export default function RegisterGrid<T extends { id: string }>({
  registerId,
  rows,
  config,
  getRowId,
  columns,
  renderCell,
  getLinkedCount = () => 0,
}: RegisterGridProps<T>) {
  const { toggleRow, isExpanded } = useNestedGridStore()

  const handleExpand = useCallback(
    (rowId: string) => {
      toggleRow(registerId, rowId)
    },
    [registerId, toggleRow]
  )

  return (
    <div className="overflow-auto rounded-lg border border-gray-200">
      <table className="min-w-full border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="w-10 border-b border-gray-200 p-2" />
            {columns.map((col) => (
              <th
                key={col.field}
                className="border-b border-gray-200 px-3 py-2 text-left text-xs font-medium uppercase text-gray-600"
              >
                {col.headerName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowId = getRowId(row)
            const hasLinked = getLinkedCount(row) > 0
            const expanded = hasLinked && isExpanded(registerId, rowId)

            return (
              <React.Fragment key={rowId}>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="w-10 border-b border-gray-100 p-2">
                    {hasLinked && (
                      <button
                        type="button"
                        onClick={() => handleExpand(rowId)}
                        className="rounded p-0.5 hover:bg-gray-200"
                        aria-expanded={expanded}
                        data-testid={`expand-row-${rowId}`}
                      >
                        {expanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.field}
                      className="border-b border-gray-100 px-3 py-2 text-sm"
                    >
                      {renderCell(row, col.field)}
                    </td>
                  ))}
                </tr>
                {expanded && config?.enableLinkedItems && config.sections.length > 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="p-0 bg-gray-50">
                      <NestedGridContainer
                        parentRowId={rowId}
                        sections={config.sections}
                        registerId={registerId}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
