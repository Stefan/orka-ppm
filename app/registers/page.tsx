'use client'

import { Suspense, useState, useCallback } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
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
  useDeleteRegister,
  useRegisterRecommend,
} from '@/hooks/useRegisters'
import RegisterTypeSelector from './components/RegisterTypeSelector'
import RegisterGrid from './components/RegisterGrid'
import RegisterCard from './components/RegisterCard'
import { Plus, Sparkles, LayoutGrid, LayoutList, Loader2 } from 'lucide-react'

const REGISTERS_PAGE_SIZE = 50

function RegistersContent() {
  const { session } = useAuth()
  const accessToken = session?.access_token ?? undefined
  const [registerType, setRegisterType] = useState<RegisterType>('risk')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addFormData, setAddFormData] = useState<Record<string, unknown>>({})
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false)

  const filters: RegisterFilters = {
    limit: REGISTERS_PAGE_SIZE,
    offset: 0,
    ...(statusFilter ? { status: statusFilter } : {}),
  }

  const { data, isLoading, refetch } = useRegisters(registerType, filters, accessToken)
  const createRegister = useCreateRegister(registerType, accessToken)
  const deleteRegister = useDeleteRegister(registerType, accessToken)
  const recommendMutation = useRegisterRecommend(registerType, accessToken)

  const entries = data?.items ?? []
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
          setAddFormData({ ...entry.data, ...json.data })
        } else {
          setAddFormData(json.data ?? {})
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

  const handleCreate = useCallback(async () => {
    try {
      await createRegister.mutateAsync({
        data: addFormData,
        status: (addFormData.status as string) || 'open',
      })
      setShowAddPanel(false)
      setAddFormData({})
      refetch()
    } catch (e) {
      console.error(e)
    }
  }, [addFormData, createRegister, refetch])

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
            className="w-full sm:w-auto"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="closed">Closed</option>
          </select>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-slate-600 dark:bg-slate-800">
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
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
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
            onClick={() => {
              setAddFormData({})
              setShowAddPanel(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {showAddPanel && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-slate-100">
            New {REGISTER_TYPE_LABELS[registerType]} entry
          </h2>
          <pre className="mb-3 max-h-40 overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-slate-900">
            {JSON.stringify(addFormData, null, 2)}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={createRegister.isPending}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createRegister.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddPanel(false); setAddFormData({}) }}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 dark:text-slate-400">
        {total} {registerType} entries
      </p>

      {viewMode === 'table' ? (
        <RegisterGrid
          entries={entries}
          loading={isLoading}
          onAISuggest={handleAISuggest}
          onEdit={(e) => { setAddFormData(e.data); setShowAddPanel(true) }}
          onDelete={handleDelete}
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
                  onEdit={(e) => { setAddFormData(e.data); setShowAddPanel(true) }}
                  onDelete={handleDelete}
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
