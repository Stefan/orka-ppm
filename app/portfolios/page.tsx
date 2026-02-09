'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { useTranslations } from '@/lib/i18n/context'
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
  Sparkles,
  AlertTriangle,
} from 'lucide-react'

const DRAG_TYPE_PROJECT = 'portfolio-tree-project'
const DROP_TYPE_PROGRAM = 'program'
const DROP_TYPE_UNGROUPED = 'ungrouped'

interface PortfolioItem {
  id: string
  name: string
  description?: string | null
  owner_id: string
}

interface ProgramItem {
  id: string
  portfolio_id: string
  name: string
  description?: string | null
  sort_order: number
  total_budget?: number
  total_actual_cost?: number
  project_count?: number
  alert_count?: number
}

interface ProjectItem {
  id: string
  name: string
  status: string
  health?: string
  budget?: number
  program_id?: string | null
  portfolio_id: string
}

function normalizePortfolios(data: unknown): PortfolioItem[] {
  const list = Array.isArray(data) ? data : (data as { items?: unknown[]; portfolios?: unknown[] })?.items ?? (data as { portfolios?: unknown[] })?.portfolios ?? []
  return list.map((p: { id: string; name: string; description?: string; owner_id: string }) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    owner_id: p.owner_id,
  }))
}

function normalizePrograms(data: unknown): ProgramItem[] {
  return Array.isArray(data) ? (data as ProgramItem[]) : []
}

function normalizeProjects(data: unknown): ProjectItem[] {
  const raw = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? (data as { projects?: unknown[] })?.projects ?? []
  return raw.map((p: { id: string; name: string; status?: string; health?: string; budget?: number; program_id?: string | null; portfolio_id: string }) => ({
    id: p.id,
    name: p.name,
    status: p.status ?? 'planning',
    health: p.health,
    budget: p.budget,
    program_id: p.program_id ?? null,
    portfolio_id: p.portfolio_id,
  }))
}

function DraggableProjectRow({
  project,
  portfolioId,
  isDragging,
}: {
  project: ProjectItem
  portfolioId: string
  isDragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `project-${project.id}`,
    data: { type: DRAG_TYPE_PROJECT, projectId: project.id, portfolioId },
  })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-12 pr-4 py-2 text-sm ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
    >
      <button type="button" className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-gray-400 hover:text-gray-600 dark:text-slate-500" {...attributes} {...listeners} aria-label="Drag to move">
        <GripVertical className="h-4 w-4" />
      </button>
      <FileText className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
      <Link href={`/projects/${project.id}`} className="flex-1 min-w-0 truncate font-medium text-gray-900 dark:text-slate-100 hover:underline">
        {project.name}
      </Link>
      {project.budget != null && (
        <span className="text-gray-500 dark:text-slate-400 text-xs tabular-nums">
          {typeof project.budget === 'number' ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(project.budget) : ''}
        </span>
      )}
    </div>
  )
}

function DroppableProgramRow({
  program,
  children,
}: {
  program: ProgramItem
  children: React.ReactNode
}) {
  const [over, setOver] = useState(false)
  const { setNodeRef, isOver } = useDroppable({
    id: `program-${program.id}`,
    data: { type: DROP_TYPE_PROGRAM, programId: program.id },
  })
  const active = isOver || over
  return (
    <div ref={setNodeRef} className="space-y-1">
      <Link
        href={`/portfolios/${program.portfolio_id}?program=${program.id}`}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
          active
            ? 'border-blue-500 bg-blue-50 dark:bg-slate-700 dark:border-blue-400'
            : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-700/50'
        }`}
        onMouseEnter={() => setOver(true)}
        onMouseLeave={() => setOver(false)}
      >
        <Folder className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <span className="font-medium text-gray-900 dark:text-slate-100">{program.name}</span>
        {(program.alert_count ?? 0) > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" title="Program alerts (e.g. budget overrun)">
            <AlertTriangle className="h-3 w-3" />
            {program.alert_count}
          </span>
        )}
        {program.project_count != null && (
          <span className="text-gray-500 dark:text-slate-400 text-xs">({program.project_count})</span>
        )}
        {program.total_budget != null && program.total_budget > 0 && (
          <span className="text-gray-500 dark:text-slate-400 text-xs tabular-nums ml-auto">
            {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(program.total_budget)}
          </span>
        )}
      </Link>
      {children}
    </div>
  )
}

function DroppableUngroupedRow({
  portfolioId,
  children,
}: {
  portfolioId: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `ungrouped-${portfolioId}`,
    data: { type: DROP_TYPE_UNGROUPED, portfolioId },
  })
  return (
    <div ref={setNodeRef} className="space-y-1">
      <div
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
          isOver ? 'border-amber-500 bg-amber-50 dark:bg-slate-700 dark:border-amber-400' : 'border-dashed border-gray-300 dark:border-slate-600 bg-gray-50/50 dark:bg-slate-800/30'
        }`}
      >
        <FileText className="h-4 w-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
        <span className="text-gray-600 dark:text-slate-400 font-medium">Ungrouped</span>
      </div>
      {children}
    </div>
  )
}

export default function PortfoliosPage() {
  const router = useRouter()
  const { session, loading: authLoading } = useAuth()
  const { portfolios, setPortfolios } = usePortfolio()
  const { t } = useTranslations()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [programsByPortfolio, setProgramsByPortfolio] = useState<Record<string, ProgramItem[]>>({})
  const [projectsByPortfolio, setProjectsByPortfolio] = useState<Record<string, ProjectItem[]>>({})
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [suggestOpen, setSuggestOpen] = useState<string | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<{ program_name: string; project_ids: string[] }[]>([])
  const [applySuggestLoading, setApplySuggestLoading] = useState(false)
  const [addProgramPortfolioId, setAddProgramPortfolioId] = useState<string | null>(null)
  const [addProgramName, setAddProgramName] = useState('')
  const [addProgramSubmitting, setAddProgramSubmitting] = useState(false)

  const loadPortfolios = useCallback(() => {
    if (!session?.access_token) return
    setLoading(true)
    setError(null)
    fetch('/api/portfolios', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch portfolios')
        return res.json()
      })
      .then((data) => setPortfolios(normalizePortfolios(data)))
      .catch(() => setError(t('portfolios.loadError')))
      .finally(() => setLoading(false))
  }, [session?.access_token, setPortfolios, t])

  const loadProgramsAndProjects = useCallback(
    (portfolioIds: string[]) => {
      if (!session?.access_token || portfolioIds.length === 0) return
      const token = session.access_token
      Promise.all(
        portfolioIds.flatMap((pid) => [
          fetch(`/api/programs?portfolio_id=${encodeURIComponent(pid)}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : [])).then(normalizePrograms),
          fetch(`/api/projects?portfolio_id=${encodeURIComponent(pid)}&limit=500`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : { items: [] })).then((d) => normalizeProjects(Array.isArray(d) ? d : d?.items ?? [])),
        ])
      ).then((flat) => {
        const programsMap: Record<string, ProgramItem[]> = {}
        const projectsMap: Record<string, ProjectItem[]> = {}
        portfolioIds.forEach((pid, i) => {
          programsMap[pid] = flat[i * 2] as ProgramItem[]
          projectsMap[pid] = flat[i * 2 + 1] as ProjectItem[]
        })
        setProgramsByPortfolio((prev) => ({ ...prev, ...programsMap }))
        setProjectsByPortfolio((prev) => ({ ...prev, ...projectsMap }))
      })
    },
    [session?.access_token]
  )

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/')
    }
  }, [authLoading, session, router])

  useEffect(() => {
    if (session?.access_token) loadPortfolios()
  }, [session?.access_token, loadPortfolios])

  useEffect(() => {
    if (portfolios.length > 0 && session?.access_token) {
      loadProgramsAndProjects(portfolios.map((p) => p.id))
    }
  }, [portfolios.length, portfolios.map((p) => p.id).join(','), session?.access_token, loadProgramsAndProjects])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = () => {
    if (!session?.access_token || !session?.user?.id || !createName.trim()) return
    setCreateSubmitting(true)
    setCreateError(null)
    fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        name: createName.trim(),
        description: createDescription.trim() || null,
        owner_id: session.user.id,
      }),
    })
      .then((res) => res.json().then((body: { detail?: string; error?: string }) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body?.detail ?? body?.error ?? 'Failed to create')
        setCreateOpen(false)
        setCreateName('')
        setCreateDescription('')
        loadPortfolios()
      })
      .catch((err) => setCreateError(err?.message ?? t('portfolios.loadError')))
      .finally(() => setCreateSubmitting(false))
  }

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === DRAG_TYPE_PROJECT && data.projectId) setActiveProjectId(data.projectId as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveProjectId(null)
    const { active, over } = event
    if (!over?.data?.current || !session?.access_token) return
    const dragData = active.data.current
    const dropData = over.data.current
    if (dragData?.type !== DRAG_TYPE_PROJECT || !dragData.projectId) return
    const projectId = dragData.projectId as string
    const newProgramId: string | null =
      dropData.type === DROP_TYPE_PROGRAM ? (dropData.programId as string) : dropData.type === DROP_TYPE_UNGROUPED ? null : undefined
    if (newProgramId === undefined) return
    fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ program_id: newProgramId }),
    }).then((res) => {
      if (res.ok) {
        setProjectsByPortfolio((prev) => {
          const next = { ...prev }
          for (const pid of Object.keys(next)) {
            const list = next[pid]
            const idx = list.findIndex((p) => p.id === projectId)
            if (idx >= 0) {
              next[pid] = list.map((p) => (p.id === projectId ? { ...p, program_id: newProgramId } : p))
              break
            }
          }
          return next
        })
      }
    })
  }

  const handleSuggest = (portfolioId: string) => {
    setSuggestOpen(portfolioId)
    setSuggestions([])
    if (!session?.access_token) return
    setSuggestLoading(true)
    fetch('/api/programs/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ portfolio_id: portfolioId }),
    })
      .then((r) => r.json())
      .then((data: { suggestions?: { program_name: string; project_ids: string[] }[] }) => {
        setSuggestions(data?.suggestions ?? [])
      })
      .finally(() => setSuggestLoading(false))
  }

  const handleAddProgram = (portfolioId: string) => {
    if (!session?.access_token || !addProgramName.trim()) return
    setAddProgramSubmitting(true)
    fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ portfolio_id: portfolioId, name: addProgramName.trim() }),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((b: { detail?: string }) => Promise.reject(new Error(b?.detail ?? 'Failed')))))
      .then((program: ProgramItem) => {
        setAddProgramPortfolioId(null)
        setAddProgramName('')
        setProgramsByPortfolio((prev) => ({
          ...prev,
          [portfolioId]: [...(prev[portfolioId] ?? []), program],
        }))
      })
      .finally(() => setAddProgramSubmitting(false))
  }

  const handleApplySuggest = (portfolioId: string) => {
    if (!session?.access_token || suggestions.length === 0) return
    setApplySuggestLoading(true)
    const token = session.access_token
    const createProgram = (name: string) =>
      fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ portfolio_id: portfolioId, name }),
      }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Create program failed'))))
    Promise.all(suggestions.map((s) => createProgram(s.program_name)))
      .then((programs: { id: string }[]) => {
        return Promise.all(
          suggestions.flatMap((s, i) =>
            (s.project_ids || []).map((projectId) =>
              fetch(`/api/projects/${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ program_id: programs[i]?.id ?? null }),
              })
            )
          )
        )
      })
      .then(() => {
        setSuggestOpen(null)
        setSuggestions([])
        loadProgramsAndProjects([portfolioId])
        loadPortfolios()
      })
      .finally(() => setApplySuggestLoading(false))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

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
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
                {t('nav.portfolios')}
              </h1>
              <p className="text-gray-600 dark:text-slate-400 mt-1">
                {t('portfolios.pageDescription')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <Plus className="h-4 w-4" />
              {t('portfolios.create')}
            </button>
          </header>

          {createOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="create-portfolio-title">
              <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 id="create-portfolio-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('portfolios.createTitle')}</h2>
                  <button type="button" onClick={() => setCreateOpen(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700" aria-label={t('portfolios.cancel')}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {createError && (
                  <p className="mb-3 text-sm text-red-600 dark:text-red-400">{createError}</p>
                )}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{t('portfolios.nameLabel')}</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-slate-100"
                    placeholder={t('portfolios.nameLabel')}
                  />
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{t('portfolios.descriptionLabel')}</label>
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-slate-100"
                    placeholder={t('portfolios.descriptionLabel')}
                  />
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                    {t('portfolios.cancel')}
                  </button>
                  <button type="button" onClick={handleCreate} disabled={createSubmitting || !createName.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600">
                    {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} {t('portfolios.save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {suggestOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="suggest-title">
              <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 id="suggest-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">Gruppier thematisch (AI)</h2>
                  <button type="button" onClick={() => { setSuggestOpen(null); setSuggestions([]) }} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {suggestLoading ? (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" /> Vorschläge werden erstellt…
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="text-gray-600 dark:text-slate-400">Keine Vorschläge oder keine Projekte im Portfolio.</p>
                ) : (
                  <>
                    <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <li key={i} className="rounded border border-gray-200 dark:border-slate-600 p-2">
                          <span className="font-medium text-gray-900 dark:text-slate-100">{s.program_name}</span>
                          <span className="text-gray-500 dark:text-slate-400 text-sm ml-2">({s.project_ids?.length ?? 0} Projekte)</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => { setSuggestOpen(null); setSuggestions([]) }} className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300">
                        Abbrechen
                      </button>
                      <button type="button" onClick={() => handleApplySuggest(suggestOpen)} disabled={applySuggestLoading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {applySuggestLoading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} Anwenden
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
          ) : portfolios.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
              <FolderOpen className="h-12 w-12 mx-auto text-gray-400 dark:text-slate-500 mb-4" />
              <p className="text-gray-600 dark:text-slate-400">{t('portfolios.empty')}</p>
            </div>
          ) : (
            <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} sensors={sensors}>
              <ul className="space-y-4">
                {portfolios.map((p) => {
                  const isExpanded = expanded.has(p.id)
                  const programs = programsByPortfolio[p.id] ?? []
                  const projects = projectsByPortfolio[p.id] ?? []
                  const ungrouped = projects.filter((proj) => !proj.program_id)
                  const projectsByProgram = (programId: string) => projects.filter((proj) => proj.program_id === programId)
                  return (
                    <li key={p.id} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleExpand(p.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(p.id); } }}
                        className="w-full flex items-center gap-2 p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                      >
                        {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
                        <FolderOpen className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <span className="font-semibold text-gray-900 dark:text-slate-100 flex-1">{p.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAddProgramPortfolioId(p.id); setAddProgramName('') }}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                        >
                          <Plus className="h-3.5 w-3.5" /> Program
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSuggest(p.id) }}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Gruppier thematisch
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-gray-200 dark:border-slate-700 pb-4">
                          <div className="pt-2 px-4 space-y-4">
                            {addProgramPortfolioId === p.id && (
                              <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 p-2">
                                <input
                                  type="text"
                                  value={addProgramName}
                                  onChange={(e) => setAddProgramName(e.target.value)}
                                  placeholder="Programmname"
                                  className="flex-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddProgram(p.id)}
                                />
                                <button type="button" onClick={() => handleAddProgram(p.id)} disabled={addProgramSubmitting || !addProgramName.trim()} className="rounded bg-blue-600 px-2 py-1.5 text-sm text-white disabled:opacity-50">
                                  {addProgramSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Anlegen'}
                                </button>
                                <button type="button" onClick={() => { setAddProgramPortfolioId(null); setAddProgramName('') }} className="rounded border border-gray-300 dark:border-slate-600 px-2 py-1.5 text-sm">Abbrechen</button>
                              </div>
                            )}
                            {programs.map((prog) => (
                              <DroppableProgramRow key={prog.id} program={prog}>
                                <div className="pl-4 space-y-1 mt-1">
                                  {projectsByProgram(prog.id).map((proj) => (
                                    <DraggableProjectRow
                                      key={proj.id}
                                      project={proj}
                                      portfolioId={p.id}
                                      isDragging={activeProjectId === proj.id}
                                    />
                                  ))}
                                </div>
                              </DroppableProgramRow>
                            ))}
                            <DroppableUngroupedRow portfolioId={p.id}>
                              <div className="pl-4 space-y-1 mt-1">
                                {ungrouped.map((proj) => (
                                  <DraggableProjectRow
                                    key={proj.id}
                                    project={proj}
                                    portfolioId={p.id}
                                    isDragging={activeProjectId === proj.id}
                                  />
                                ))}
                              </div>
                            </DroppableUngroupedRow>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </DndContext>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
