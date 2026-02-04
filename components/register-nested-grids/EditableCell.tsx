'use client'

/**
 * Editable Cell - Inline editing without popups
 * Requirements: 7.1, 7.2, 7.5
 */

import React, { useState, useCallback } from 'react'
import { validateField, type ValidationRule } from './validation'

interface EditableCellProps {
  value: unknown
  editable?: boolean
  validationRules?: ValidationRule[]
  onSave?: (value: unknown) => Promise<void>
}

export default function EditableCell({
  value,
  editable = false,
  validationRules = [],
  onSave,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(String(value ?? ''))
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    const result = validateField(inputVal, validationRules)
    if (!result.valid) {
      setError(result.message ?? 'Invalid')
      return
    }
    setError(null)
    try {
      await onSave?.(inputVal)
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [inputVal, validationRules, onSave])

  const displayVal = value == null ? '-' : String(value)

  if (!editable || !onSave) {
    return <span className="py-1">{displayVal}</span>
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') {
              setInputVal(String(value ?? ''))
              setEditing(false)
              setError(null)
            }
          }}
          className={`flex-1 px-2 py-0.5 text-sm border rounded ${error ? 'border-red-400' : 'border-gray-300'}`}
          data-testid="editable-cell-input"
          autoFocus
        />
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-left w-full px-1 py-0.5 rounded hover:bg-indigo-50 border border-transparent hover:border-indigo-200 text-sm"
      data-testid="editable-cell"
    >
      {displayVal}
      <span className="ml-1 opacity-50 text-xs">✎</span>
    </button>
  )
}
