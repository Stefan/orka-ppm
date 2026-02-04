'use client'

/**
 * Nested Grids Admin Tab
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2
 */

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { NestedGridConfig, Section, ItemType } from './types'
import { COLUMN_DEFINITIONS } from './COLUMN_DEFINITIONS'
import AISuggestionPanel from './AISuggestionPanel'

interface NestedGridsTabProps {
  registerId: string
  enableLinkedItems: boolean
  config: NestedGridConfig | null
  onConfigChange: (config: NestedGridConfig) => void
  readOnly?: boolean
}

export default function NestedGridsTab({
  registerId,
  enableLinkedItems,
  config,
  onConfigChange,
  readOnly = false,
}: NestedGridsTabProps) {
  const sections = config?.sections ?? []
  const isReadOnly = readOnly || !enableLinkedItems

  const addSection = () => {
    if (isReadOnly) return
    const newSection: Section = {
      id: `section-${Date.now()}`,
      itemType: 'tasks',
      columns: COLUMN_DEFINITIONS.tasks.slice(0, 5).map((c, i) => ({
        id: `col-${Date.now()}-${i}`,
        field: c.field,
        headerName: c.headerName,
        order: i,
      })),
      displayOrder: sections.length,
    }
    onConfigChange({
      sections: [...sections, newSection],
      enableLinkedItems,
    })
  }

  const removeSection = (id: string) => {
    if (isReadOnly) return
    if (!confirm('Remove this section?')) return
    onConfigChange({
      sections: sections.filter((s) => s.id !== id),
      enableLinkedItems,
    })
  }

  const updateSection = (id: string, updates: Partial<Section>) => {
    if (isReadOnly) return
    onConfigChange({
      sections: sections.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      enableLinkedItems,
    })
  }

  return (
    <div className="space-y-4 p-4">
      <div
        className={`rounded-lg border p-4 ${isReadOnly ? 'bg-gray-50' : 'bg-white'}`}
        data-testid="nested-grids-tab"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Nested Grids</h3>
          {!isReadOnly && (
            <button
              type="button"
              onClick={addSection}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:underline"
            >
              <Plus className="w-4 h-4" /> Add Section
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {enableLinkedItems
            ? 'Configure sections and columns for expandable rows.'
            : 'Enable Linked Items to edit nested grid configuration.'}
        </p>
        {sections.map((section) => (
          <SectionItem
            key={section.id}
            section={section}
            onUpdate={(u) => updateSection(section.id, u)}
            onRemove={() => removeSection(section.id)}
            readOnly={isReadOnly}
          />
        ))}
        {sections.length === 0 && (
          <p className="text-sm text-gray-400 italic">No sections configured.</p>
        )}
      </div>
    </div>
  )
}

function SectionItem({
  section,
  onUpdate,
  onRemove,
  readOnly,
}: {
  section: Section
  onUpdate: (u: Partial<Section>) => void
  onRemove: () => void
  readOnly: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const itemTypes: ItemType[] = ['tasks', 'registers', 'cost_registers']
  const availableCols = COLUMN_DEFINITIONS[section.itemType] ?? []

  return (
    <div className="border rounded-lg p-3 mb-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 hover:bg-gray-100 rounded"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <select
          value={section.itemType}
          onChange={(e) => onUpdate({ itemType: e.target.value as ItemType })}
          disabled={readOnly}
          className="text-sm border rounded px-2 py-1"
        >
          {itemTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{section.columns.length} columns</span>
        {!readOnly && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto text-red-500 hover:text-red-700 p-1"
            aria-label="Remove section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-2 pl-6 text-sm space-y-2">
          <p className="text-gray-500 mb-1">Available columns ({availableCols.length}):</p>
          <div className="flex flex-wrap gap-1">
            {availableCols.slice(0, 10).map((c) => (
              <span key={c.field} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                {c.headerName}
              </span>
            ))}
          </div>
          <AISuggestionPanel
            itemType={section.itemType}
            onApply={(cols) => {
              const newCols = cols
                .map((f) => availableCols.find((a) => a.field === f))
                .filter(Boolean) as typeof availableCols
              if (newCols.length) {
                onUpdate({
                  columns: newCols.map((c, i) => ({
                    id: `col-${Date.now()}-${i}`,
                    field: c.field,
                    headerName: c.headerName,
                    order: i,
                  })),
                })
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
