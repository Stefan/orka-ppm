'use client'

/**
 * Phase 2 – Integration & Customizability: Dynamic Column Customizer
 * Enterprise Readiness: Admin-UI Drag&Drop, Save as View
 */

import React, { useState } from 'react'
import type { ColumnView } from '@/types/enterprise'

export interface ColumnCustomizerProps {
  entity: string
  availableColumns: { id: string; label: string }[]
  selectedColumns: string[]
  savedViews?: ColumnView[]
  onColumnsChange: (columns: string[]) => void
  onSaveView?: (name: string, columns: string[]) => void
  onLoadView?: (view: ColumnView) => void
  className?: string
}

export function ColumnCustomizer({
  entity,
  availableColumns,
  selectedColumns,
  savedViews = [],
  onColumnsChange,
  onSaveView,
  onLoadView,
  className = '',
}: ColumnCustomizerProps) {
  const [viewName, setViewName] = useState('')
  const [showSave, setShowSave] = useState(false)

  const toggleColumn = (id: string) => {
    if (selectedColumns.includes(id)) {
      onColumnsChange(selectedColumns.filter((c) => c !== id))
    } else {
      onColumnsChange([...selectedColumns, id])
    }
  }

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 ${className}`}>
      <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-slate-300">Spalten: {entity}</h3>
      <div className="space-y-2">
        {availableColumns.map((col) => (
          <label key={col.id} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={selectedColumns.includes(col.id)}
              onChange={() => toggleColumn(col.id)}
              className="rounded border-gray-300 dark:border-slate-600"
            />
            <span className="text-sm">{col.label}</span>
          </label>
        ))}
      </div>
      {savedViews.length > 0 && (
        <div className="mt-4 border-t border-gray-100 dark:border-slate-700 pt-3">
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-slate-400">Gespeicherte Ansichten</p>
          <div className="flex flex-wrap gap-2">
            {savedViews.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onLoadView?.(v)}
                className="rounded bg-gray-100 dark:bg-slate-700 px-2 py-1 text-xs hover:bg-gray-200 dark:hover:bg-slate-600"
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {onSaveView && (
        <div className="mt-4 border-t border-gray-100 dark:border-slate-700 pt-3">
          {!showSave ? (
            <button
              type="button"
              onClick={() => setShowSave(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Als Ansicht speichern
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Ansichtsname"
                className="flex-1 rounded border border-gray-300 dark:border-slate-600 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  if (viewName.trim()) {
                    onSaveView(viewName.trim(), selectedColumns)
                    setViewName('')
                    setShowSave(false)
                  }
                }}
                className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
              >
                Speichern
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ColumnCustomizer
