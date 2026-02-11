'use client'

import React, { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Columns3, GripVertical, RotateCcw } from 'lucide-react'
import type { ColumnDef } from '../../hooks/useTableColumnSettings'

interface TableColumnPickerProps<TKey extends string> {
  allColumnsOrdered: ColumnDef<TKey>[]
  hiddenSet: Set<string>
  onVisibleChange: (key: string, visible: boolean) => void
  onOrderChange: (order: string[]) => void
  onReset: () => void
  label?: string
  columnsLabel?: string
  resetLabel?: string
  hintLabel?: string
  /** t function for column labelKey (e.g. financials columns.xyz) */
  t: (key: string) => string
}

function SortableColumnRow<TKey extends string>({
  column,
  hidden,
  onToggle,
  t,
}: {
  column: ColumnDef<TKey>
  hidden: boolean
  onToggle: (key: string, visible: boolean) => void
  t: (key: string) => string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-1.5 px-2 rounded group ${
        isDragging ? 'bg-gray-200 dark:bg-slate-600 opacity-90' : 'hover:bg-gray-100 dark:hover:bg-slate-700'
      }`}
    >
      <button
        type="button"
        className="p-0.5 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
        <input
          type="checkbox"
          checked={!hidden}
          onChange={(e) => onToggle(column.key, e.target.checked)}
          className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700 dark:text-slate-200 truncate">
          {t(column.labelKey)}
        </span>
      </label>
    </div>
  )
}

export default function TableColumnPicker<TKey extends string>({
  allColumnsOrdered,
  hiddenSet,
  onVisibleChange,
  onOrderChange,
  onReset,
  label = 'Columns',
  columnsLabel = 'Show / reorder columns',
  resetLabel = 'Reset to default',
  hintLabel = 'Drag to reorder, checkbox to show/hide',
  t,
}: TableColumnPickerProps<TKey>) {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = allColumnsOrdered.findIndex((c) => c.key === active.id)
    const newIndex = allColumnsOrdered.findIndex((c) => c.key === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(
      allColumnsOrdered.map((c) => c.key),
      oldIndex,
      newIndex
    )
    onOrderChange(newOrder)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Columns3 className="h-4 w-4 mr-1" />
        {label}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full mt-1 z-20 w-72 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-2"
            role="dialog"
            aria-label={columnsLabel}
          >
            <p className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {columnsLabel}
            </p>
            <p className="px-3 pb-2 text-xs text-gray-500 dark:text-slate-400">
              {hintLabel}
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={allColumnsOrdered.map((c) => c.key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="max-h-80 overflow-y-auto px-2">
                  {allColumnsOrdered.map((column) => (
                    <SortableColumnRow
                      key={column.key}
                      column={column}
                      hidden={hiddenSet.has(column.key)}
                      onToggle={onVisibleChange}
                      t={t}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeId ? (() => {
                  const column = allColumnsOrdered.find((c) => c.key === activeId)
                  if (!column) return null
                  return (
                    <div className="flex items-center gap-2 py-1.5 px-2 rounded bg-white dark:bg-slate-700 shadow-lg border border-gray-200 dark:border-slate-600">
                      <GripVertical className="h-4 w-4 text-gray-400 dark:text-slate-400 shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-slate-200 truncate">
                        {t(column.labelKey)}
                      </span>
                    </div>
                  )
                })() : null}
              </DragOverlay>
            </DndContext>
            <div className="border-t border-gray-200 dark:border-slate-600 mt-2 pt-2 px-2">
              <button
                type="button"
                onClick={() => {
                  onReset()
                  setOpen(false)
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-200"
              >
                <RotateCcw className="h-4 w-4" />
                {resetLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
