'use client'

import { Suspense, useState, useCallback, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { usePortfolio } from '@/contexts/PortfolioContext'
import AppLayout from '@/components/shared/AppLayout'
import { getApiUrl } from '@/lib/api/client'
import {
  REGISTER_TYPE_LABELS,
  type RegisterType,
  type RegisterEntry,
  type RegisterFilters,
} from '@/types/registers'
import {
  useRegisters,
  useCreateRegister,
  useUpdateRegister,
  useDeleteRegister,
} from '@/hooks/useRegisters'
import { useProjectsQuery } from '@/lib/projects-queries'
import RegisterTypeSelector from './components/RegisterTypeSelector'
import RegisterGrid from './components/RegisterGrid'
import RegisterCard from './components/RegisterCard'
import RegisterInlinePanel from './components/RegisterInlinePanel'
import Select from '@/components/ui/Select'
import { Plus, Sparkles, LayoutGrid, LayoutList, Loader2, X } from 'lucide-react'

const REGISTERS_PAGE_SIZE = 50
type SortKey = 'updated_at' | 'title'

const REGISTER_TYPES_ARR: RegisterType[] = ['risk', 'change', 'cost', 'issue', 'benefits', 'lessons_learned', 'decision', 'opportunities']

function RegistersContent() {
  const searchParams = useSearchParams()
  const { session } = useAuth()
  const { currentPortfolioId } = usePortfolio()
  const accessToken = session?.access_token ?? undefined
  const userId = session?.user?.id
  const [registerType, setRegisterType] = useState<RegisterType>('risk')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortKey>('updated_at')
  const [offset, setOffset] = useState(0)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [editingEntry, setEditingEntry] = useState<RegisterEntry | null>(null)
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false)

  // Portfolio scope: URL ?portfolio_id= overrides context (for deep links)
  const portfolioIdFromUrl = searchParams.get('portfolio_id')
  const portfolioIdForQuery = portfolioIdFromUrl || currentPortfolioId || null

  // Prefill from URL (e.g. /registers?project_id=xxx&task_id=yyy&portfolio_id= or from project/schedule links)
  const taskIdFromUrl = searchParams.get('task_id')
  const [taskFilter, setTaskFilter] = useState<string>('')
  useEffect(() => {
    const projectId = searchParams.get('project_id')
    const typeParam = searchParams.get('type')
    const tid = searchParams.get('task_id')
    if (projectId) setProjectFilter(projectId)
    if (tid) setTaskFilter(tid)
    if (typeParam && REGISTER_TYPES_ARR.includes(typeParam as RegisterType)) setRegisterType(typeParam as RegisterType)
  }, [searchParams])

  const { data: projectsList } = useProjectsQuery(accessToken, userId, portfolioIdForQuery)
  useEffect(() => { setOffset(0) }, [registerType])

  useEffect(() => {
    if (showAddPanel) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [showAddPanel])
  const projectNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of projectsList ?? []) m[p.id] = p.name
    return m
  }, [projectsList])

  const filters: RegisterFilters = {
    limit: REGISTERS_PAGE_SIZE,
    offset,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(projectFilter ? { project_id: projectFilter } : {}),
    ...(taskFilter ? { task_id: taskFilter } : {}),
  }

  const { data, isLoading, refetch } = useRegisters(registerType, filters, accessToken)
  const createRegister = useCreateRegister(registerType, accessToken)
  const updateRegister = useUpdateRegister(registerType, accessToken)
  const deleteRegister = useDeleteRegister(registerType, accessToken)

  const rawEntries = data?.items ?? []
  const entries = useMemo(() => {
    if (sortBy === 'title') {
      return [...rawEntries].sort((a, b) => {
        const ta = (a.data?.title as string) || (a.data?.name as string) || ''
        const tb = (b.data?.title as string) || (b.data?.name as string) || ''
        return ta.localeCompare(tb, undefined, { sensitivity: 'base' })
      })
    }
    return rawEntries
  }, [rawEntries, sortBy])
  const total = data?.total ?? 0

  const handleAISuggest = useCallback(
    async (entry?: RegisterEntry) => {
      if (!accessToken) return
      setAiSuggestLoading(true)
      try {
        const url = getApiUrl(`/api/registers/${registerType}/ai-recommend`)
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry ? { context: entry.data } : {}),
        })
        if (!res.ok) throw new Error('Recommend failed')
        const json = await res.json()
        if (entry) {
          setEditingEntry({ ...entry, data: { ...entry.data, ...json.data } })
        } else {
          setEditingEntry({
            id: '',
            type: registerType,
            project_id: null,
            organization_id: '',
            data: json.data ?? {},
            status: 'open',
            created_at: '',
            updated_at: '',
          })
        }
        setShowAddPanel(true)
      } catch (e) {
        console.error(e)
      } finally {
        setAiSuggestLoading(false)
      }
    },
    [registerType, accessToken]
  )

  const handleSavePanel = useCallback(
    async (data: Record<string, unknown>, status: string, project_id?: string | null, task_id?: string | null) => {
      try {
        if (editingEntry && editingEntry.id) {
          await updateRegister.mutateAsync({
            id: editingEntry.id,
            data,
            status,
            project_id: project_id ?? undefined,
            task_id: task_id ?? undefined,
          })
        } else {
          await createRegister.mutateAsync({
            data,
            status,
            project_id: project_id ?? undefined,
            task_id: task_id ?? (taskFilter || undefined),
          })
        }
        setShowAddPanel(false)
        setEditingEntry(null)
        refetch()
      } catch (e) {
        console.error(e)
      }
    },
    [editingEntry, createRegister, updateRegister, refetch, taskFilter]
  )

  const handleSaveEntry = useCallback(
    async (entry: RegisterEntry, data: Record<string, unknown>, status: string) => {
      try {
        await updateRegister.mutateAsync({ id: entry.id, data, status })
        refetch()
      } catch (e) {
        console.error(e)
      }
    },
    [updateRegister, refetch]
  )

  const handleDelete = useCallback(
    async (entry: RegisterEntry) => {
      if (!confirm('Delete this entry?')) return
      try {
        await deleteRegister.mutateAsync(entry.id)
        refetch()
      } catch (e) {
        console.error(e)
      }
    },
    [deleteRegister, refetch]
  )

  const openAdd = useCallback(() => {
    setEditingEntry(null)
    setShowAddPanel(true)
  }, [])

  const openEdit = useCallback((entry: RegisterEntry) => {
    setEditingEntry(entry)
    setShowAddPanel(true)
  }, [])

  if (!session) {
    return null
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
          Registers
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <RegisterTypeSelector
            value={registerType}
            onChange={setRegisterType}
            className="w-full sm:w-auto sm:min-w-[180px]"
          />
          <Select
            value={projectFilter}
            onChange={(v) => { setProjectFilter(v); setOffset(0) }}
            options={[
              { value: '', label: 'All projects' },
              ...(projectsList ?? []).map((p) => ({ value: p.id, label: p.name })),
            ]}
            searchable
            searchPlaceholder="Filter projects..."
            className="w-full sm:w-auto min-w-[140px]"
          />
          <Select
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setOffset(0) }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'closed', label: 'Closed' },
            ]}
            className="w-full sm:w-auto min-w-[140px]"
          />
          {taskFilter && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-1 text-xs">
              Linked to task
              <button
                type="button"
                onClick={() => setTaskFilter('')}
                className="rounded hover:bg-slate-200 dark:hover:bg-slate-600 p-0.5"
                aria-label="Clear task filter"
              >
                ×
              </button>
            </span>
          )}
          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v as SortKey)}
            options={[
              { value: 'updated_at', label: 'Updated' },
              { value: 'title', label: 'Title' },
            ]}
            className="w-full sm:w-auto min-w-[120px]"
          />
          <div className="flex h-10 items-center gap-1 rounded-lg border border-gray-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded p-1.5 ${viewMode === 'table' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
              aria-label="Table view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded p-1.5 ${viewMode === 'grid' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleAISuggest()}
            disabled={aiSuggestLoading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-100 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
          >
            {aiSuggestLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AI Suggest
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' &&
        showAddPanel &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-full min-w-full items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            {/* Backdrop: semi-transparent, not solid black */}
            <div
              className="absolute inset-0 bg-neutral-900/50 dark:bg-black/40 backdrop-blur-sm"
              aria-hidden
              onClick={() => {
                setShowAddPanel(false)
                setEditingEntry(null)
              }}
            />
            {/* Content: centered card */}
            <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowAddPanel(false)
                  setEditingEntry(null)
                }}
                className="absolute right-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <RegisterInlinePanel
                initialTaskId={taskFilter || null}
                type={registerType}
                entry={editingEntry}
                onSave={handleSavePanel}
                onCancel={() => {
                  setShowAddPanel(false)
                  setEditingEntry(null)
                }}
                isPending={createRegister.isPending || updateRegister.isPending}
                projects={projectsList ?? []}
              />
            </div>
          </div>,
          document.body
        )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {total} {registerType} entries
          {total > REGISTERS_PAGE_SIZE && (
            <span className="ml-1">
              (showing {offset + 1}–{Math.min(offset + entries.length, total)})
            </span>
          )}
        </p>
        {total > REGISTERS_PAGE_SIZE && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - REGISTERS_PAGE_SIZE))}
              disabled={offset === 0}
              className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => o + REGISTERS_PAGE_SIZE)}
              disabled={offset + entries.length >= total}
              className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {viewMode === 'table' ? (
        <RegisterGrid
          registerType={registerType}
          entries={entries}
          loading={isLoading}
          onAISuggest={handleAISuggest}
          onEdit={openEdit}
          onDelete={handleDelete}
          onSaveEntry={handleSaveEntry}
          saveEntryPending={updateRegister.isPending}
          projectNameById={projectNameById}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-700"
                />
              ))
            : entries.map((entry) => (
                <RegisterCard
                  key={entry.id}
                  entry={entry}
                  onAISuggest={handleAISuggest}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  projectName={entry.project_id ? projectNameById[entry.project_id] : undefined}
                />
              ))}
        </div>
      )}
    </div>
  )
}

function RegistersLoading() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-slate-700" />
      <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
    </div>
  )
}

export default function RegistersPage() {
  return (
    <AppLayout>
      <Suspense fallback={<RegistersLoading />}>
        <RegistersContent />
      </Suspense>
    </AppLayout>
  )
}
