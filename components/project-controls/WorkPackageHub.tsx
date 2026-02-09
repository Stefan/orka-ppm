'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { projectControlsApi } from '@/lib/project-controls-api'
import {
  useWorkPackages,
  useCreateWorkPackage,
  useUpdateWorkPackage,
  useDeleteWorkPackage,
} from '@/lib/work-package-queries'
import type { WorkPackage, WorkPackageCreate, WorkPackageUpdate } from '@/types/project-controls'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Loader2, GripVertical, Copy, FileUp, Layers } from 'lucide-react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core'
import { List } from 'react-window'
import { CopyFromProjectModal, BulkEditModal, ImportCsvModal, ApplyTemplateModal } from './WorkPackageModals'

interface TreeNode {
  wp: WorkPackage
  children: TreeNode[]
}

interface WorkPackageHubProps {
  projectId: string
}

function buildTree(items: WorkPackage[], parentId: string | null): TreeNode[] {
  return items
    .filter((wp) => (parentId == null ? !wp.parent_package_id : wp.parent_package_id === parentId))
    .map((wp) => ({
      wp,
      children: buildTree(items, wp.id),
    }))
}

function flattenTree(nodes: TreeNode[], expanded: Set<string>, depth: number = 0): { node: TreeNode; depth: number }[] {
  const out: { node: TreeNode; depth: number }[] = []
  for (const n of nodes) {
    out.push({ node: n, depth })
    if (expanded.has(n.wp.id) && n.children.length > 0) {
      out.push(...flattenTree(n.children, expanded, depth + 1))
    }
  }
  return out
}

function computeRollup(wp: WorkPackage, items: WorkPackage[]): { budget: number; actual_cost: number; earned_value: number; percent_complete: number } {
  const children = items.filter((p) => p.parent_package_id === wp.id)
  if (children.length === 0) {
    return {
      budget: wp.budget ?? 0,
      actual_cost: wp.actual_cost ?? 0,
      earned_value: wp.earned_value ?? 0,
      percent_complete: wp.percent_complete ?? 0,
    }
  }
  let budget = wp.budget ?? 0
  let actual_cost = wp.actual_cost ?? 0
  let earned_value = wp.earned_value ?? 0
  let totalPct = wp.percent_complete ?? 0
  for (const c of children) {
    const r = computeRollup(c, items)
    budget += r.budget
    actual_cost += r.actual_cost
    earned_value += r.earned_value
    totalPct += r.percent_complete
  }
  return {
    budget,
    actual_cost,
    earned_value,
    percent_complete: children.length > 0 ? totalPct / (children.length + 1) : totalPct,
  }
}

function DraggableDroppableRow({
  wpId,
  children,
  className,
  dragHandle,
}: {
  wpId: string
  children: React.ReactNode
  className?: string
  dragHandle: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id: `wp-${wpId}`, data: { wpId } })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `drop-${wpId}` })
  const ref = (el: HTMLTableRowElement | null) => {
    setDropRef(el)
  }
  return (
    <tr ref={ref} className={`${className ?? ''} ${isOver ? 'ring-1 ring-indigo-400' : ''}`}>
      <td className="p-2 w-8" ref={setDragRef} {...attributes} {...listeners}>
        {dragHandle}
      </td>
      {children}
    </tr>
  )
}

type EditableField = 'name' | 'budget' | 'start_date' | 'end_date' | 'percent_complete' | 'responsible_manager'

export default function WorkPackageHub({ projectId }: WorkPackageHubProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ wpId: string; field: EditableField } | null>(null)
  const [inlineValue, setInlineValue] = useState<string>('')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [parentForCreate, setParentForCreate] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<WorkPackageCreate> & Partial<WorkPackageUpdate>>({})
  const [error, setError] = useState<string | null>(null)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const tableRef = useRef<HTMLTableElement>(null)

  const { data: list = [], isLoading: loading, error: queryError } = useWorkPackages(projectId, false)
  const createMutation = useCreateWorkPackage(projectId)
  const updateMutation = useUpdateWorkPackage(projectId)
  const deleteMutation = useDeleteWorkPackage(projectId)
  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  useEffect(() => {
    setError(queryError?.message ?? null)
  }, [queryError])


  const expandAll = () => {
    setExpanded(new Set(list.map((w) => w.id)))
  }
  const collapseAll = () => {
    setExpanded(new Set())
  }
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openCreate = (parentId: string | null) => {
    setParentForCreate(parentId)
    setForm({
      project_id: projectId,
      name: '',
      description: '',
      budget: 0,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      responsible_manager: '',
      parent_package_id: parentId ?? undefined,
    })
    setModal('create')
  }
  const openEdit = (wp: WorkPackage) => {
    setSelectedId(wp.id)
    setForm({
      name: wp.name,
      description: wp.description ?? '',
      budget: wp.budget,
      start_date: wp.start_date?.slice(0, 10),
      end_date: wp.end_date?.slice(0, 10),
      percent_complete: wp.percent_complete,
      actual_cost: wp.actual_cost,
      earned_value: wp.earned_value,
      responsible_manager: wp.responsible_manager,
    })
    setModal('edit')
  }
  const closeModal = () => {
    setModal(null)
    setForm({})
    setParentForCreate(null)
    setSelectedId(null)
  }

  const saveCreate = async () => {
    if (!form.name || form.budget == null || !form.start_date || !form.end_date || !form.responsible_manager) {
      setError('Name, budget, dates and responsible manager are required')
      return
    }
    setError(null)
    try {
      await createMutation.mutateAsync({
        project_id: projectId,
        name: form.name,
        description: form.description ?? null,
        budget: Number(form.budget),
        start_date: form.start_date,
        end_date: form.end_date,
        responsible_manager: form.responsible_manager,
        parent_package_id: parentForCreate ?? null,
      })
      closeModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    }
  }
  const saveEdit = async () => {
    if (!selectedId) return
    setError(null)
    try {
      const payload: Record<string, unknown> = {}
      if (form.name !== undefined) payload.name = form.name
      if (form.description !== undefined) payload.description = form.description
      if (form.budget !== undefined) payload.budget = form.budget
      if (form.start_date !== undefined) payload.start_date = form.start_date
      if (form.end_date !== undefined) payload.end_date = form.end_date
      if (form.percent_complete !== undefined) payload.percent_complete = form.percent_complete
      if (form.actual_cost !== undefined) payload.actual_cost = form.actual_cost
      if (form.earned_value !== undefined) payload.earned_value = form.earned_value
      if (form.responsible_manager !== undefined) payload.responsible_manager = form.responsible_manager
      await updateMutation.mutateAsync({ wpId: selectedId, body: payload })
      closeModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }
  const doDelete = async (id: string) => {
    setError(null)
    try {
      await deleteMutation.mutateAsync(id)
      setDeleteConfirm(null)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const validateInline = (field: EditableField, value: string, wp: WorkPackage): string | null => {
    if (field === 'percent_complete') {
      const n = Number(value)
      if (Number.isNaN(n) || n < 0 || n > 100) return '0–100'
    }
    if (field === 'end_date' && wp.start_date) {
      if (value < wp.start_date.slice(0, 10)) return 'End must be ≥ start'
    }
    if (field === 'start_date' && wp.end_date) {
      if (value > wp.end_date.slice(0, 10)) return 'Start must be ≤ end'
    }
    return null
  }
  const startInlineEdit = (wp: WorkPackage, field: EditableField) => {
    const v = wp[field]
    setEditingCell({ wpId: wp.id, field })
    setInlineValue(v != null ? String(v) : '')
    setInlineError(null)
  }
  const cancelInlineEdit = () => {
    setEditingCell(null)
    setInlineValue('')
    setInlineError(null)
  }
  const saveInlineEdit = useCallback(
    async (wpId: string, field: EditableField) => {
      const wp = list.find((w) => w.id === wpId)
      if (!wp) return
      const err = validateInline(field, inlineValue, wp)
      if (err) {
        setInlineError(err)
        return
      }
      setInlineError(null)
      const payload: Record<string, unknown> = {}
      if (field === 'name') payload.name = inlineValue
      if (field === 'budget') payload.budget = Number(inlineValue)
      if (field === 'start_date') payload.start_date = inlineValue
      if (field === 'end_date') payload.end_date = inlineValue
      if (field === 'percent_complete') payload.percent_complete = Number(inlineValue)
      if (field === 'responsible_manager') payload.responsible_manager = inlineValue
      try {
        await updateMutation.mutateAsync({ wpId, body: payload })
        setEditingCell(null)
        setInlineValue('')
      } catch (e) {
        setInlineError(e instanceof Error ? e.message : 'Save failed')
      }
    },
    [inlineValue, list, updateMutation]
  )

  const flatIndex = useMemo(() => {
    const roots = buildTree(list, null)
    const f = flattenTree(roots, expanded)
    return f.map((item, idx) => ({ ...item, index: idx }))
  }, [list, expanded])
  const flat = useMemo(() => flatIndex.map(({ node, depth }) => ({ node, depth })), [flatIndex])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) {
        if (e.key === 'Enter') {
          e.preventDefault()
          saveInlineEdit(editingCell.wpId, editingCell.field)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancelInlineEdit()
        }
        return
      }
      if (e.key === 'ArrowDown' && flatIndex.length > 0) {
        e.preventDefault()
        const idx = selectedId ? flatIndex.findIndex(({ node }) => node.wp.id === selectedId) : -1
        const nextIdx = Math.min(idx + 1, flatIndex.length - 1)
        setSelectedId(flatIndex[nextIdx].node.wp.id)
      } else if (e.key === 'ArrowUp' && flatIndex.length > 0) {
        e.preventDefault()
        const idx = selectedId ? flatIndex.findIndex(({ node }) => node.wp.id === selectedId) : 0
        const nextIdx = Math.max(idx - 1, 0)
        setSelectedId(flatIndex[nextIdx].node.wp.id)
      } else if (e.key === 'Enter' && selectedId) {
        e.preventDefault()
        const wp = list.find((w) => w.id === selectedId)
        if (wp) openEdit(wp)
      } else if (e.key === 'F2' && selectedId) {
        e.preventDefault()
        const wp = list.find((w) => w.id === selectedId)
        if (wp) startInlineEdit(wp, 'name')
      }
    },
    [editingCell, flatIndex, list, selectedId, saveInlineEdit]
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const draggedId = String(active.id).replace(/^wp-/, '')
      const targetId = String(over.id).replace(/^drop-/, '')
      if (!draggedId || !targetId || draggedId === targetId) return
      updateMutation.mutate({ wpId: draggedId, body: { parent_package_id: targetId } })
    },
    [updateMutation]
  )

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center gap-2 text-gray-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading work packages…
      </div>
    )
  }

  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Work Packages</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openCreate(null)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add work package
          </button>
          <button type="button" onClick={() => selectedId && openCreate(selectedId)} disabled={!selectedId} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-sm disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add child
          </button>
          <button type="button" onClick={expandAll} className="text-sm text-gray-600 dark:text-slate-400 hover:underline">Expand all</button>
          <button type="button" onClick={collapseAll} className="text-sm text-gray-600 dark:text-slate-400 hover:underline">Collapse all</button>
          <button type="button" onClick={() => setCopyModalOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-sm">
            <Copy className="w-4 h-4" /> Copy from project
          </button>
          <button type="button" onClick={() => selectedIds.size > 0 && setBulkModalOpen(true)} disabled={selectedIds.size === 0} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-sm disabled:opacity-50">
            Bulk edit ({selectedIds.size})
          </button>
          <button type="button" onClick={() => setImportModalOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-sm">
            <FileUp className="w-4 h-4" /> Import CSV
          </button>
          <button type="button" onClick={() => setTemplateModalOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-sm">
            <Layers className="w-4 h-4" /> Apply template
          </button>
        </div>
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-2">
          {error}
        </div>
      )}
      <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg" ref={tableRef} onKeyDown={handleKeyDown} tabIndex={0}>
        {inlineError && editingCell && (
          <div className="px-2 py-1 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
            {inlineError}
          </div>
        )}
        <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
                <th className="text-left p-2 w-8" />
                <th className="text-left p-2 w-6" />
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Responsible</th>
                <th className="text-right p-2">Budget</th>
                <th className="text-right p-2">Actual cost</th>
                <th className="text-right p-2">Earned value</th>
                <th className="text-right p-2">% Complete</th>
                <th className="text-left p-2">Start</th>
                <th className="text-left p-2">End</th>
                <th className="w-20 p-2" />
              </tr>
            </thead>
            <tbody>
              {flat.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-gray-500 dark:text-slate-400">
                    No work packages. Add one to get started.
                  </td>
                </tr>
              ) : flat.length > 50 ? (
                <tr>
                  <td colSpan={11} className="p-0">
                    <div style={{ height: 400 }}>
                      <List
                        rowCount={flat.length}
                        rowHeight={40}
                        rowComponent={function WPListRow ({ index, style, ariaAttributes, flat, expanded, list, toggle, editingCell, setSelectedId, openEdit, setDeleteConfirm }) {
                          const { node, depth } = flat[index]
                          const wp = node.wp
                          const hasChildren = node.children.length > 0
                          const isExpanded = expanded.has(wp.id)
                          const rollup = computeRollup(wp, list)
                          const isEditing = editingCell?.wpId === wp.id && editingCell?.field
                          return (
                            <div {...ariaAttributes} style={style} className="flex items-center border-b border-gray-100 dark:border-slate-700/50 text-sm">
                              <div className="p-2 w-8 flex-shrink-0">
                                <button type="button" onClick={() => hasChildren && toggle(wp.id)} className="p-0.5">
                                  {hasChildren ? (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : <span className="w-4 inline-block" />}
                                </button>
                              </div>
                              <div className="p-2 w-6 flex-shrink-0" />
                              <div className="p-2 flex-1 min-w-0 truncate font-medium" style={{ paddingLeft: `${depth * 16}px` }}>{wp.name}</div>
                              <div className="p-2 w-28 truncate text-gray-600 dark:text-slate-400">{wp.responsible_manager ? `${wp.responsible_manager.slice(0, 8)}…` : '-'}</div>
                              <div className="p-2 w-20 text-right">{rollup.budget.toLocaleString()}</div>
                              <div className="p-2 w-20 text-right">{rollup.actual_cost.toLocaleString()}</div>
                              <div className="p-2 w-20 text-right">{rollup.earned_value.toLocaleString()}</div>
                              <div className="p-2 w-16 text-right">{rollup.percent_complete.toFixed(1)}%</div>
                              <div className="p-2 w-24">{wp.start_date?.slice(0, 10) ?? '-'}</div>
                              <div className="p-2 w-24">{wp.end_date?.slice(0, 10) ?? '-'}</div>
                              <div className="p-2 flex gap-1">
                                <button type="button" onClick={() => { setSelectedId(wp.id); openEdit(wp) }} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-600" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                                <button type="button" onClick={() => setDeleteConfirm(wp.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          )
                        }}
                        rowProps={{
                          flat,
                          expanded,
                          list,
                          toggle,
                          editingCell: editingCell ?? null,
                          setSelectedId,
                          openEdit,
                          setDeleteConfirm,
                        }}
                        style={{ height: 400, width: '100%' }}
                      />
                    </div>
                  </td>
                </tr>
              ) : (
                flat.map(({ node, depth }) => {
                  const wp = node.wp
                  const hasChildren = node.children.length > 0
                  const isExpanded = expanded.has(wp.id)
                  const rollup = computeRollup(wp, list)
                  const isEditing = editingCell?.wpId === wp.id && editingCell?.field
                  const dragHandle = (
                    <span className="inline-flex items-center gap-0.5 cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <button type="button" onClick={(e) => { e.stopPropagation(); hasChildren && toggle(wp.id) }} className="p-0.5">
                        {hasChildren ? (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : <span className="w-4 inline-block" />}
                      </button>
                    </span>
                  )
                  return (
                    <DraggableDroppableRow
                      key={wp.id}
                      wpId={wp.id}
                      className={`border-b border-gray-100 dark:border-slate-700/50 ${selectedId === wp.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'}`}
                      dragHandle={dragHandle}
                    >
                      <td className="p-2 w-6"><input type="checkbox" checked={selectedIds.has(wp.id)} onChange={(e) => setSelectedIds((prev) => { const n = new Set(prev); if (e.target.checked) n.add(wp.id); else n.delete(wp.id); return n })} onClick={(e) => e.stopPropagation()} aria-label="Select" /></td>
                      <td className="p-2">
                        {isEditing && editingCell?.field === 'name' ? (
                          <input type="text" value={inlineValue} onChange={(e) => setInlineValue(e.target.value)} onBlur={() => saveInlineEdit(wp.id, 'name')} onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(wp.id, 'name'); if (e.key === 'Escape') cancelInlineEdit() }} className="w-full max-w-[200px] rounded border px-1 py-0.5 text-sm" style={{ paddingLeft: `${depth * 16}px` }} autoFocus />
                        ) : (
                          <button type="button" onClick={() => setSelectedId(wp.id)} onDoubleClick={() => startInlineEdit(wp, 'name')} className="text-left font-medium truncate max-w-[200px] block" style={{ paddingLeft: `${depth * 16}px` }}>{wp.name}</button>
                        )}
                      </td>
                      <td className="p-2 text-gray-600 dark:text-slate-400 max-w-[120px]">
                        {isEditing && editingCell?.field === 'responsible_manager' ? (
                          <input type="text" value={inlineValue} onChange={(e) => setInlineValue(e.target.value)} onBlur={() => saveInlineEdit(wp.id, 'responsible_manager')} onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(wp.id, 'responsible_manager'); if (e.key === 'Escape') cancelInlineEdit() }} className="w-full rounded border px-1 py-0.5 text-sm" autoFocus />
                        ) : (
                          <button type="button" onClick={() => setSelectedId(wp.id)} onDoubleClick={() => startInlineEdit(wp, 'responsible_manager')} className="truncate block w-full text-left">{wp.responsible_manager ? `${wp.responsible_manager.slice(0, 8)}…` : '-'}</button>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {isEditing && editingCell?.field === 'budget' ? (
                          <input type="number" min={0} step={0.01} value={inlineValue} onChange={(e) => setInlineValue(e.target.value)} onBlur={() => saveInlineEdit(wp.id, 'budget')} onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(wp.id, 'budget'); if (e.key === 'Escape') cancelInlineEdit() }} className="w-20 rounded border px-1 py-0.5 text-sm text-right" autoFocus />
                        ) : (
                          <button type="button" onClick={() => setSelectedId(wp.id)} onDoubleClick={() => startInlineEdit(wp, 'budget')} className="w-full text-right">{rollup.budget.toLocaleString()}</button>
                        )}
                      </td>
                      <td className="p-2 text-right">{rollup.actual_cost.toLocaleString()}</td>
                      <td className="p-2 text-right">{rollup.earned_value.toLocaleString()}</td>
                      <td className="p-2 text-right">
                        {isEditing && editingCell?.field === 'percent_complete' ? (
                          <input type="number" min={0} max={100} step={0.1} value={inlineValue} onChange={(e) => setInlineValue(e.target.value)} onBlur={() => saveInlineEdit(wp.id, 'percent_complete')} onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(wp.id, 'percent_complete'); if (e.key === 'Escape') cancelInlineEdit() }} className="w-14 rounded border px-1 py-0.5 text-sm text-right" autoFocus />
                        ) : (
                          <button type="button" onClick={() => setSelectedId(wp.id)} onDoubleClick={() => startInlineEdit(wp, 'percent_complete')} className="w-full text-right">{rollup.percent_complete.toFixed(1)}%</button>
                        )}
                      </td>
                      <td className="p-2">
                        {isEditing && editingCell?.field === 'start_date' ? (
                          <input type="date" value={inlineValue} onChange={(e) => setInlineValue(e.target.value)} onBlur={() => saveInlineEdit(wp.id, 'start_date')} onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(wp.id, 'start_date'); if (e.key === 'Escape') cancelInlineEdit() }} className="rounded border px-1 py-0.5 text-sm" autoFocus />
                        ) : (
                          <button type="button" onClick={() => setSelectedId(wp.id)} onDoubleClick={() => startInlineEdit(wp, 'start_date')}>{wp.start_date?.slice(0, 10) ?? '-'}</button>
                        )}
                      </td>
                      <td className="p-2">
                        {isEditing && editingCell?.field === 'end_date' ? (
                          <input type="date" value={inlineValue} onChange={(e) => setInlineValue(e.target.value)} onBlur={() => saveInlineEdit(wp.id, 'end_date')} onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(wp.id, 'end_date'); if (e.key === 'Escape') cancelInlineEdit() }} className="rounded border px-1 py-0.5 text-sm" autoFocus />
                        ) : (
                          <button type="button" onClick={() => setSelectedId(wp.id)} onDoubleClick={() => startInlineEdit(wp, 'end_date')}>{wp.end_date?.slice(0, 10) ?? '-'}</button>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => openEdit(wp)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-600" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                          <button type="button" onClick={() => setDeleteConfirm(wp.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </DraggableDroppableRow>
                  )
                })
              )}
            </tbody>
          </table>
        </DndContext>
      </div>

      {/* Create/Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeModal}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold">{modal === 'create' ? 'New work package' : 'Edit work package'}</h4>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Name</label>
              <input
                type="text"
                value={form.name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
              />
              <label className="text-sm font-medium">Description (optional)</label>
              <input
                type="text"
                value={form.description ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
                className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
              />
              <label className="text-sm font-medium">Budget</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.budget ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value ? Number(e.target.value) : 0 }))}
                className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
              />
              <label className="text-sm font-medium">Start date</label>
              <input
                type="date"
                value={form.start_date ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
              />
              <label className="text-sm font-medium">End date</label>
              <input
                type="date"
                value={form.end_date ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
              />
              {modal === 'edit' && (
                <>
                  <label className="text-sm font-medium">% Complete</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.percent_complete ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, percent_complete: e.target.value ? Number(e.target.value) : 0 }))}
                    className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                  />
                  <label className="text-sm font-medium">Actual cost</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.actual_cost ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, actual_cost: e.target.value ? Number(e.target.value) : 0 }))}
                    className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                  />
                  <label className="text-sm font-medium">Earned value</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.earned_value ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, earned_value: e.target.value ? Number(e.target.value) : 0 }))}
                    className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                  />
                </>
              )}
              <label className="text-sm font-medium">Responsible manager (user ID)</label>
              <input
                type="text"
                value={form.responsible_manager ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, responsible_manager: e.target.value }))}
                placeholder="UUID"
                className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeModal} className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={modal === 'create' ? saveCreate : saveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {modal === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-sm w-full mx-4 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm">Delete this work package? Children will be unlinked (not deleted).</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
              <button type="button" onClick={() => doDelete(deleteConfirm)} disabled={saving} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy from project modal */}
      {copyModalOpen && (
        <CopyFromProjectModal
          currentProjectId={projectId}
          onClose={() => setCopyModalOpen(false)}
          onCopied={() => { setCopyModalOpen(false); createMutation.reset() }}
        />
      )}
      {/* Bulk edit modal */}
      {bulkModalOpen && selectedIds.size > 0 && (
        <BulkEditModal
          projectId={projectId}
          wpIds={Array.from(selectedIds)}
          onClose={() => setBulkModalOpen(false)}
          onSaved={() => { setBulkModalOpen(false); setSelectedIds(new Set()); updateMutation.reset() }}
        />
      )}
      {/* Import CSV modal */}
      {importModalOpen && (
        <ImportCsvModal
          projectId={projectId}
          onClose={() => setImportModalOpen(false)}
          onImported={() => { setImportModalOpen(false); createMutation.reset() }}
        />
      )}
      {/* Apply template modal */}
      {templateModalOpen && (
        <ApplyTemplateModal
          projectId={projectId}
          onClose={() => setTemplateModalOpen(false)}
          onApplied={() => { setTemplateModalOpen(false); createMutation.reset() }}
        />
      )}
    </div>
  )
}
