'use client'

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/shared/AppLayout'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { usePermissions } from '@/app/providers/EnhancedAuthProvider'
import { useToast } from '@/components/shared/Toast'
import {
  Search,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from 'lucide-react'
import { getApiUrl } from '@/lib/api'
import { supabase } from '@/lib/api/supabase-minimal'
import { PREDEFINED_FEATURE_FLAGS } from '@/lib/feature-flags/constants'
import { filterFlagsBySearch } from '@/lib/feature-flags/filterFlags'
import type { FeatureFlag } from '@/types/feature-flags'

/** Row shown in the table: real flag from API or placeholder for a predefined flag not yet in DB */
type FlagRow = (FeatureFlag & { displayName?: string }) | { id: ''; name: string; displayName: string; description: string; enabled: false; organization_id: null; created_at: ''; updated_at: '' }

function isPlaceholder(row: FlagRow): row is { id: ''; name: string; displayName: string; description: string; enabled: false; organization_id: null; created_at: ''; updated_at: '' } {
  return row.id === ''
}

const SEARCH_DEBOUNCE_MS = 300

/** No-op for any leftover or cached debug calls; remove when not needed. */
const DEBUG_LOG = (..._args: unknown[]) => {}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function AdminFeatureTogglesPage() {
  const DEBUG_LOG = (..._args: unknown[]) => {}
  const { session } = useAuth()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const router = useRouter()
  const toast = useToast()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createPrefill, setCreatePrefill] = useState<{ name: string; displayName: string; description: string } | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const isDevelopment =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
  const [permissionTimeout, setPermissionTimeout] = useState(false)
  useEffect(() => {
    if (isDevelopment && permissionsLoading) {
      const t = setTimeout(() => setPermissionTimeout(true), 3000)
      return () => clearTimeout(t)
    }
  }, [isDevelopment, permissionsLoading])
  const isAdmin =
    hasPermission('user_manage') ||
    (isDevelopment && (permissionTimeout || !permissionsLoading))

  const hasLoadedOnce = useRef(false)
  const fetchFlagsRef = useRef<() => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    if (!permissionsLoading && !isAdmin && session) {
      const t = setTimeout(() => router.push('/'), 2000)
      return () => clearTimeout(t)
    }
  }, [permissionsLoading, isAdmin, session, router])

  const fetchFlags = useCallback(async () => {
    if (!session?.access_token) return
    setLoading((prev) => (hasLoadedOnce.current ? prev : true))
    try {
      const url = getApiUrl('/api/features?list_all=true')
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const next = (data?.flags ?? []) as FeatureFlag[]
      setFlags(next)
      hasLoadedOnce.current = true
    } catch (err) {
      toast.error(
        'Failed to load feature flags',
        err instanceof Error ? err.message : String(err)
      )
      setFlags([])
      hasLoadedOnce.current = true
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, toast])

  fetchFlagsRef.current = fetchFlags
  useEffect(() => {
    if (session && isAdmin) {
      fetchFlagsRef.current()
    }
  }, [session, isAdmin])

  useEffect(() => {
    const channel = supabase.channel('feature_flags_changes')
    const handler = (payload: { payload?: { action?: string; flag?: FeatureFlag } }) => {
      const { action, flag } = payload?.payload ?? {}
      if (!flag) return
      setFlags((prev) => {
        if (action === 'created') return [...prev, flag as FeatureFlag]
        if (action === 'updated')
          return prev.map((f) => (f.id === (flag as FeatureFlag).id ? (flag as FeatureFlag) : f))
        if (action === 'deleted') {
          const name = (flag as { name?: string }).name
          return prev.filter((f) => f.name !== name)
        }
        return prev
      })
    }
    channel.on('broadcast', { event: 'flag_change' }, handler).subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const mergedFlags: FlagRow[] = useMemo(() => {
    const byName = new Map<string, FeatureFlag>()
    for (const f of flags) {
      if (f.organization_id == null) byName.set(f.name, f)
    }
    const rows: FlagRow[] = []
    for (const pre of PREDEFINED_FEATURE_FLAGS) {
      const existing = byName.get(pre.name)
      if (existing) {
        // Merge database flag with predefined metadata
        rows.push({
          ...existing,
          displayName: pre.displayName,
          description: pre.description
        })
      } else {
        // Placeholder for predefined flag not in database
        rows.push({
          id: '',
          name: pre.name,
          displayName: pre.displayName,
          description: pre.description,
          enabled: false,
          organization_id: null,
          created_at: '',
          updated_at: ''
        })
      }
    }
    return rows
  }, [flags])

  const filteredFlags = useMemo(
    () => filterFlagsBySearch(mergedFlags, searchInput),
    [mergedFlags, searchInput]
  )

  const toggleEnabled = useCallback(
    async (flag: FeatureFlag) => {
      if (!session?.access_token) return
      setTogglingId(flag.id)
      try {
        const url = getApiUrl(`/api/features/${encodeURIComponent(flag.name)}`)
        const orgParam =
          flag.organization_id != null
            ? `?organization_id=${encodeURIComponent(flag.organization_id)}`
            : ''
        const res = await fetch(url + orgParam, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ enabled: !flag.enabled }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.detail || `HTTP ${res.status}`)
        }
        const updated = (await res.json()) as FeatureFlag
        setFlags((prev) =>
          prev.map((f) => (f.id === flag.id ? updated : f))
        )
        toast.success(updated.enabled ? 'Flag enabled' : 'Flag disabled')
      } catch (err) {
        toast.error(
          'Failed to update flag',
          err instanceof Error ? err.message : String(err)
        )
      } finally {
        setTogglingId(null)
      }
    },
    [session?.access_token, toast]
  )

  const showSpinner = loading && flags.length === 0
  if (showSpinner) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl p-6" data-testid="admin-feature-toggles-page">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
              aria-label="Back to admin"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Feature Management</h1>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Enable or disable predefined application features
              </p>
            </div>
          </div>
        </div>

        <div className="relative mb-6">
          <Search
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-slate-500"
            aria-hidden
          />
          <input
            type="text"
            placeholder="Search flags by name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700">
                  <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Enabled
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {filteredFlags.map((flag) => {
                const placeholder = isPlaceholder(flag)
                  return (
                    <tr key={placeholder ? `predefined-${flag.name}` : flag.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                    <td className="whitespace-nowrap px-6 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                      {'displayName' in flag ? flag.displayName : flag.name}
                    </td>
                    <td className="max-w-md px-6 py-3 text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                      {'displayName' in flag ? flag.description : (flag.description ?? '—')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-600 dark:text-slate-400">
                      {flag.organization_id == null ? 'Global' : 'Organization'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3">
                      {placeholder ? (
                        <span className="text-gray-400 dark:text-slate-500 text-xs">Not in DB</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleEnabled(flag)}
                          disabled={togglingId === flag.id}
                          className="focus:outline-none hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 rounded p-1 transition-colors"
                          aria-label={flag.enabled ? 'Disable' : 'Enable'}
                        >
                          {togglingId === flag.id ? (
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                          ) : flag.enabled ? (
                            <ToggleRight className="h-6 w-6 text-green-600 dark:text-green-400" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-gray-400 dark:text-slate-500" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-500 dark:text-slate-400">
                      {placeholder ? '—' : formatTimestamp(flag.updated_at)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-right">
                      {placeholder ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCreatePrefill({ name: flag.name, displayName: 'displayName' in flag ? flag.displayName : flag.name, description: flag.description })
                            setShowCreateModal(true)
                          }}
                          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                          data-testid="admin-feature-toggles-enable-predefined"
                        >
                          Enable
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredFlags.length === 0 && (
            <div className="py-12 text-center text-gray-500 dark:text-slate-400">
              {searchInput.trim()
                ? 'No flags match your search.'
                : 'No feature flags yet. Add one to get started.'}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && createPrefill && (
        <FeatureFlagModal
          key={`create-${createPrefill.name}`}
          prefill={createPrefill}
          onClose={() => {
            setShowCreateModal(false)
            setCreatePrefill(null)
          }}
          onSuccess={() => {
            setShowCreateModal(false)
            setCreatePrefill(null)
            fetchFlags()
          }}
          session={session}
          toast={toast}
        />
      )}
    </AppLayout>
  )
}

function FeatureFlagModal({
  prefill,
  onClose,
  onSuccess,
  session,
  toast,
}: {
  prefill: { name: string; displayName: string; description: string }
  onClose: () => void
  onSuccess: () => void
  session: { access_token?: string } | null
  toast: {
    success: (title: string, message?: string) => void
    error: (title: string, message?: string) => void
    warning: (title: string, message?: string) => void
    info: (title: string, message?: string) => void
    custom: (toast: any) => void
    remove: (id: string) => void
    clear: () => void
  }
}) {
  const [name, setName] = useState(prefill.name)
  const [displayName, setDisplayName] = useState(prefill.displayName)
  const [description, setDescription] = useState(prefill.description)
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token) return
    setSaving(true)
    try {
      const res = await fetch(getApiUrl('/api/features'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description || undefined,
          enabled,
          organization_id: null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail || `HTTP ${res.status}`)
      }
      toast.success('Feature flag enabled')
      onSuccess()
    } catch (err) {
      toast.error(
        'Failed to enable feature flag',
        err instanceof Error ? err.message : String(err)
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-slate-100">
          Enable Feature Flag
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Feature</label>
            <input
              type="text"
              value={displayName}
              disabled
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm disabled:bg-gray-100 dark:bg-slate-700 dark:disabled:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
            <textarea
              value={description}
              disabled
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm disabled:bg-gray-100 dark:bg-slate-700 dark:disabled:bg-slate-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="modal-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 dark:text-blue-400"
            />
            <label htmlFor="modal-enabled" className="text-sm font-medium text-gray-700 dark:text-slate-300">
              Enable this feature
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Enabling…' : 'Enable Feature'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
