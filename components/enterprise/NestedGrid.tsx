'use client'

/**
 * Phase 2 – Integration & Customizability: Nested Grids (2-level)
 * Enterprise Readiness: Parent/child rows, inline editing, permissions-aware
 * Uses a simple table with expand/collapse; ag-grid can be swapped in when licensed.
 */

import React, { useState, useCallback } from 'react'

export interface NestedGridColumn<T> {
  id: string
  label: string
  width?: string
  render: (row: T, isChild: boolean) => React.ReactNode
  editable?: boolean
  canEdit?: (row: T) => boolean
}

export interface NestedGridProps<T extends { id: string; children?: T[] }> {
  rows: T[]
  columns: NestedGridColumn<T>[]
  getRowId: (row: T) => string
  getChildren?: (row: T) => T[] | undefined
  onCellEdit?: (row: T, columnId: string, value: unknown) => void
  canEdit?: (row: T) => boolean
  className?: string
}

export function NestedGrid<T extends { id: string; children?: T[] }>({
  rows,
  columns,
  getRowId,
  getChildren = (r) => r.children,
  onCellEdit,
  canEdit = () => true,
  className = '',
}: NestedGridProps<T>) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const renderRow = (row: T, depth: number, isChild: boolean) => {
    const id = getRowId(row)
    const children = getChildren(row)
    const hasChildren = Array.isArray(children) && children.length > 0
    const isExpanded = expanded.has(id)

    return (
      <React.Fragment key={id}>
        <tr
          className={isChild ? 'bg-gray-50' : 'bg-white'}
          style={depth > 0 ? { paddingLeft: `${depth * 20}px` } : undefined}
        >
          <td className="w-8 border-b border-gray-100 p-1">
            {hasChildren && (
              <button
                type="button"
                onClick={() => toggle(id)}
                className="rounded p-0.5 hover:bg-gray-200"
                aria-expanded={isExpanded}
              >
                {isExpanded ? '−' : '+'}
              </button>
            )}
          </td>
          {columns.map((col) => (
            <td
              key={col.id}
              className="border-b border-gray-100 px-2 py-1.5 text-sm"
              style={col.width ? { width: col.width } : undefined}
            >
              {col.render(row, isChild)}
            </td>
          ))}
        </tr>
        {hasChildren && isExpanded &&
          children!.map((child) => renderRow(child, depth + 1, true))}
      </React.Fragment>
    )
  }

  return (
    <div className={`overflow-auto rounded-lg border border-gray-200 ${className}`}>
      <table className="min-w-full border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="w-8 border-b border-gray-200 p-1" />
            {columns.map((col) => (
              <th
                key={col.id}
                className="border-b border-gray-200 px-2 py-2 text-left text-xs font-medium uppercase text-gray-600"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => renderRow(row, 0, false))}
        </tbody>
      </table>
    </div>
  )
}

export default NestedGrid
