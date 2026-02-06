'use client'

/**
 * Filter Bar - Add/Remove filters
 * Requirements: 9.1
 */

import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Filter, FilterOperator } from './types'

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'notEquals', label: 'Not equals' },
  { value: 'greaterThan', label: '>' },
  { value: 'lessThan', label: '<' },
]

interface FilterBarProps {
  fields: { field: string; label: string }[]
  filters: Filter[]
  onFiltersChange: (filters: Filter[]) => void
}

export default function FilterBar({ fields, filters, onFiltersChange }: FilterBarProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [newField, setNewField] = useState('')
  const [newOp, setNewOp] = useState<FilterOperator>('equals')
  const [newVal, setNewVal] = useState('')

  const addFilter = () => {
    if (!newField) return
    const label = fields.find((f) => f.field === newField)?.label ?? newField
    onFiltersChange([
      ...filters,
      {
        id: `f-${Date.now()}`,
        field: newField,
        operator: newOp,
        value: newVal,
        label,
      },
    ])
    setNewField('')
    setNewVal('')
    setShowAdd(false)
  }

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter((f) => f.id !== id))
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 dark:bg-slate-800/50 rounded border" data-testid="filter-bar">
      {filters.map((f) => (
        <span
          key={f.id}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border rounded text-sm"
        >
          {f.label} {f.operator} {String(f.value)}
          <button
            type="button"
            onClick={() => removeFilter(f.id)}
            className="p-0.5 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded"
            aria-label="Remove filter"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {showAdd ? (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="">Field</option>
            {fields.map((f) => (
              <option key={f.field} value={f.field}>{f.label}</option>
            ))}
          </select>
          <select
            value={newOp}
            onChange={(e) => setNewOp(e.target.value as FilterOperator)}
            className="text-sm border rounded px-2 py-1"
          >
            {OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            placeholder="Value"
            className="text-sm border rounded px-2 py-1 w-24"
          />
          <button
            type="button"
            onClick={addFilter}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="text-sm text-gray-500 dark:text-slate-400"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <Plus className="w-4 h-4" /> Add filter
        </button>
      )}
    </div>
  )
}
