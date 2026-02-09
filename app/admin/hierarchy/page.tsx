'use client'

/**
 * Admin hierarchy page: Portfolio > Program > Project (Tree + Detail-Card + Modals).
 * Spec: .kiro/specs/entity-hierarchy/
 * Layout: No-scroll; Tree left, Detail right. Create via modals; Drag&Drop to reassign project.
 */

import { useCallback, useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import {
  buildHierarchyTree,
  type HierarchyNode,
  type Portfolio,
  type Program,
  type Project,
  type EntityType,
} from '@/lib/domain/entities'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import {
  FolderOpen,
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  Plus,
  X,
  GripVertical,
} from 'lucide-react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

const DRAG_PROJECT = 'hierarchy-project'
const DROP_PROGRAM = 'program'
const DROP_UNGROUPED = 'ungrouped'

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  onDropTarget,
}: {
  node: HierarchyNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string, type: EntityType, entity: Portfolio | Program | Project) => void
  selectedId: string | null
  onDropTarget: (id: string, type: 'program' | 'ungrouped', programId?: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const isSelected = selectedId === node.id
  const canDrop = node.type === 'program' || (node.type === 'portfolio' && node.children.some((c) => c.type === 'project'))
  const dropId = node.type === 'program' ? `program-${(node.entity as Program).id}` : node.type === 'portfolio' ? `ungrouped-${(node.entity as Portfolio).id}` : null
  const { setNodeRef, isOver } = useDroppable(
    dropId ? { id: dropId, data: { type: node.type === 'program' ? DROP_PROGRAM : DROP_UNGROUPED, programId: node.type === 'program' ? (node.entity as Program).id : null, portfolioId: node.type === 'portfolio' ? (node.entity as Portfolio).id : (node.entity as Program).portfolio_id } } : { id: node.id, data: {} }
  )
  const pl = depth * 16 + 8
  return (
    <div ref={canDrop ? setNodeRef : undefined} className="space-y-0.5">
      <button
        type="button"
        onClick={() => {
          if (hasChildren) onToggle(node.id)
          onSelect(node.id, node.type, node.entity)
        }}
        className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition-colors ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-slate-700 dark:border-blue-400' : isOver ? 'border-amber-500 bg-amber-50 dark:bg-slate-700' : 'border-transparent hover:bg-gray-100 dark:hover:bg-slate-700/50'}`}
        style={{ paddingLeft: pl }}
      >
        {hasChildren ? (
          isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
        ) : (
          <span className="w-4" />
        )}
        {node.type === 'portfolio' && <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />}
        {node.type === 'program' && <Folder className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
        {node.type === 'project' && <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />}
        <span className="truncate font-medium text-gray-900 dark:text-slate-100">{node.label}</span>
      </button>
      {hasChildren && isExpanded && (
        <div className="pl-0">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
              onDropTarget={onDropTarget}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DraggableProjectRow({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  isDragging,
}: {
  node: HierarchyNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string, type: EntityType, entity: Portfolio | Program | Project) => void
  selectedId: string | null
  isDragging: boolean
}) {
  const project = node.entity as Project
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `drag-${project.id}`,
    data: { type: DRAG_PROJECT, projectId: project.id, portfolioId: project.portfolio_id },
  })
  const pl = depth * 16 + 8
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
      <div
        className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${selectedId === node.id ? 'border-blue-500 bg-blue-50 dark:bg-slate-700' : 'border-transparent hover:bg-gray-100 dark:hover:bg-slate-700/50'}`}
        style={{ paddingLeft: pl }}
      >
        <span className="w-4 shrink-0" />
        <button type="button" className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-gray-400" aria-label="Drag" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <button
          type="button"
          onClick={() => onSelect(node.id, 'project', node.entity)}
          className="flex-1 text-left truncate font-medium text-gray-900 dark:text-slate-100 hover:underline"
        >
          {node.label}
        </button>
      </div>
    </div>
  )
}

function RecursiveTree({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  activeDragId,
}: {
  node: HierarchyNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string, type: EntityType, entity: Portfolio | Program | Project) => void
  selectedId: string | null
  activeDragId: string | null
}) {
  if (node.type === 'project') {
    return (
      <DraggableProjectRow
        node={node}
        depth={depth}
        expanded={expanded}
        onToggle={onToggle}
        onSelect={onSelect}
        selectedId={selectedId}
        isDragging={activeDragId === `drag-${(node.entity as Project).id}`}
      />
    )
  }
  return (
    <div>
      <TreeRow
        node={node}
        depth={depth}
        expanded={expanded}
        onToggle={onToggle}
        onSelect={onSelect}
        selectedId={selectedId}
        onDropTarget={() => {}}
      />
      {expanded.has(node.id) && node.children.length > 0 && (
        <div className="pl-0">
          {node.children.map((child) => (
            <RecursiveTree
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
              activeDragId={activeDragId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AdminHierarchyContent() {
  const { session, loading: authLoading } = useAuth()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [programsByPortfolio, setProgramsByPortfolio] = useState<Record<string, Program[]>>({})
  const [projectsByPortfolio, setProjectsByPortfolio] = useState<Record<string, Project[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<{ type: EntityType; entity: Portfolio | Program | Project } | null>(null)
  const [modal, setModal] = useState<'portfolio' | 'program' | 'project' | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!session?.access_token) return
    setLoading(true)
    const token = session.access_token
    Promise.all([
      fetch('/api/portfolios', { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : [])),
      fetch('/api/programs?portfolio_id=', { headers: { Authorization: `Bearer ${token}` } }).then(() => []),
    ])
      .then(([portfoliosData]) => {
        const list = Array.isArray(portfoliosData) ? portfoliosData : portfoliosData?.items ?? []
        setPortfolios(list)
        const ids = list.map((p: { id: string }) => p.id)
        return Promise.all(
          ids.flatMap((pid: string) => [
            fetch(`/api/programs?portfolio_id=${encodeURIComponent(pid)}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : [])),
            fetch(`/api/projects?portfolio_id=${encodeURIComponent(pid)}&limit=500`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : { items: [] })),
          ])
        ).then((flat) => {
          const programsMap: Record<string, Program[]> = {}
          const projectsMap: Record<string, Project[]> = {}
          ids.forEach((pid: string, i: number) => {
            programsMap[pid] = flat[i * 2] as Program[]
            const raw = flat[i * 2 + 1] as { items?: Project[] }
            projectsMap[pid] = Array.isArray(raw) ? raw : raw?.items ?? []
          })
          setProgramsByPortfolio(programsMap)
          setProjectsByPortfolio(projectsMap)
        })
      })
      .finally(() => setLoading(false))
  }, [session?.access_token])

  useEffect(() => {
    load()
  }, [load])

  const tree = buildHierarchyTree(portfolios, programsByPortfolio, projectsByPortfolio)
  const toggle = (id: string) => setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const select = (id: string, type: EntityType, entity: Portfolio | Program | Project) => {
    setSelectedId(id)
    setSelectedEntity({ type, entity })
  }

  const handleDragStart = (e: DragStartEvent) => {
    if (e.active.data.current?.type === DRAG_PROJECT) setActiveDragId(e.active.id as string)
  }
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null)
    const over = e.over?.data?.current
    const active = e.active.data?.current
    if (!over || active?.type !== DRAG_PROJECT || !session?.access_token) return
    const projectId = active.projectId as string
    const newProgramId = over.type === DROP_PROGRAM ? (over.programId as string) : over.type === DROP_UNGROUPED ? null : undefined
    if (newProgramId === undefined) return
    fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ program_id: newProgramId }),
    }).then((r) => r.ok && load())
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  if (authLoading || !session) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-6 flex flex-col h-[calc(100vh-8rem)]">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Hierarchy (Portfolio → Program → Project)</h1>
          <div className="flex gap-2">
            <button type="button" onClick={() => setModal('portfolio')} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Portfolio
            </button>
            <button type="button" onClick={() => setModal('program')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> Program
            </button>
            <button type="button" onClick={() => setModal('project')} className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700">
              <Plus className="h-4 w-4" /> Project
            </button>
          </div>
        </header>
        <div className="flex flex-1 min-h-0 gap-6">
          <div className="w-[380px] shrink-0 flex flex-col rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <div className="p-2 border-b border-gray-200 dark:border-slate-700 font-medium text-gray-700 dark:text-slate-300">Tree</div>
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} sensors={sensors}>
                  {tree.map((node) => (
                    <RecursiveTree
                      key={node.id}
                      node={node}
                      depth={0}
                      expanded={expanded}
                      onToggle={toggle}
                      onSelect={select}
                      selectedId={selectedId}
                      activeDragId={activeDragId}
                    />
                  ))}
                </DndContext>
              )}
            </div>
          </div>
          <div className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Detail</h2>
            {selectedEntity ? (
              <div className="space-y-2">
                <p><span className="text-gray-500 dark:text-slate-400">Type:</span> {selectedEntity.type}</p>
                <p><span className="text-gray-500 dark:text-slate-400">Name:</span> {'name' in selectedEntity.entity ? selectedEntity.entity.name : ''}</p>
                {selectedEntity.type === 'portfolio' && (
                  <Link href={`/portfolios/${(selectedEntity.entity as Portfolio).id}`} className="text-blue-600 dark:text-blue-400 hover:underline">Open portfolio →</Link>
                )}
                {selectedEntity.type === 'project' && (
                  <Link href={`/projects/${(selectedEntity.entity as Project).id}`} className="text-blue-600 dark:text-blue-400 hover:underline">Open project →</Link>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-slate-400">Select a node in the tree.</p>
            )}
          </div>
        </div>
      </div>
      {modal === 'portfolio' && (
        <NewPortfolioModal
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load() }}
          token={session?.access_token ?? ''}
        />
      )}
      {modal === 'program' && (
        <NewProgramModal
          portfolios={portfolios}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load() }}
          token={session?.access_token ?? ''}
        />
      )}
      {modal === 'project' && (
        <NewProjectModal
          portfolios={portfolios}
          programsByPortfolio={programsByPortfolio}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load() }}
          token={session?.access_token ?? ''}
        />
      )}
    </AppLayout>
  )
}

function NewPortfolioModal({ onClose, onSuccess, token }: { onClose: () => void; onSuccess: () => void; token: string }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const handle = () => {
    if (!name.trim() || !token) return
    setSubmitting(true)
    fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name.trim() }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed'))))
      .then(onSuccess)
      .finally(() => setSubmitting(false))
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">New Portfolio</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-slate-100 mb-4" placeholder="Portfolio name" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handle} disabled={submitting || !name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} Create</button>
        </div>
      </div>
    </div>
  )
}

function NewProgramModal({ portfolios, onClose, onSuccess, token }: { portfolios: Portfolio[]; onClose: () => void; onSuccess: () => void; token: string }) {
  const [name, setName] = useState('')
  const [portfolioId, setPortfolioId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const handle = () => {
    if (!name.trim() || !portfolioId || !token) return
    setSubmitting(true)
    fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name.trim(), portfolio_id: portfolioId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed'))))
      .then(onSuccess)
      .finally(() => setSubmitting(false))
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">New Program</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Portfolio</label>
        <select value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-slate-100 mb-3">
          <option value="">Select</option>
          {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-slate-100 mb-4" placeholder="Program name" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handle} disabled={submitting || !name.trim() || !portfolioId} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} Create</button>
        </div>
      </div>
    </div>
  )
}

function NewProjectModal({
  portfolios,
  programsByPortfolio,
  onClose,
  onSuccess,
  token,
}: {
  portfolios: Portfolio[]
  programsByPortfolio: Record<string, Program[]>
  onClose: () => void
  onSuccess: () => void
  token: string
}) {
  const [name, setName] = useState('')
  const [portfolioId, setPortfolioId] = useState('')
  const [programId, setProgramId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const programs = portfolioId ? (programsByPortfolio[portfolioId] ?? []) : []
  const handle = () => {
    if (!name.trim() || !portfolioId || !token) return
    setSubmitting(true)
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name.trim(), portfolio_id: portfolioId, program_id: programId || null }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed'))))
      .then(onSuccess)
      .finally(() => setSubmitting(false))
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">New Project</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Portfolio</label>
        <select value={portfolioId} onChange={(e) => { setPortfolioId(e.target.value); setProgramId('') }} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-slate-100 mb-3">
          <option value="">Select</option>
          {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Program (optional)</label>
        <select value={programId} onChange={(e) => setProgramId(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-slate-100 mb-3">
          <option value="">Ungrouped</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-slate-100 mb-4" placeholder="Project name" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handle} disabled={submitting || !name.trim() || !portfolioId} className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} Create</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminHierarchyPage() {
  return (
    <Suspense fallback={<AppLayout><div className="p-8 flex items-center justify-center min-h-[200px]"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div></AppLayout>}>
      <AdminHierarchyContent />
    </Suspense>
  )
}
