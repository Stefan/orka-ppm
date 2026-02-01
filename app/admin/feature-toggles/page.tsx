'use client'

import React, {
  useCallback,
  useEffect,
  useMemo,
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
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from 'lucide-react'
import { getApiUrl } from '@/lib/api'
import { supabase } from '@/lib/api/supabase-minimal'
import { filterFlagsBySearch } from '@/lib/feature-flags/filterFlags'
import type { FeatureFlag } from '@/types/feature-flags'

const SEARCH_DEBOUNCE_MS = 300

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
  const { session } = useAuth()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const router = useRouter()
  const toast = useToast()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [filteredFlags, setFilteredFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null)
  const [deletingFlag, setDeletingFlag] = useState<FeatureFlag | null>(null)
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

  useEffect(() => {
    if (!permissionsLoading && !isAdmin && session) {
      const t = setTimeout(() => router.push('/'), 2000)
      return () => clearTimeout(t)
    }
  }, [permissionsLoading, isAdmin, session, router])

  const fetchFlags = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    try {
      const url = getApiUrl('/api/features?list_all=true')
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFlags((data?.flags ?? []) as FeatureFlag[])
    } catch (err) {
      toast.addToast({
        type: 'error',
        title: 'Failed to load feature flags',
        message: err instanceof Error ? err.message : String(err),
      })
      setFlags([])
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, toast])

  useEffect(() => {
    if (session && isAdmin) fetchFlags()
  }, [session, isAdmin, fetchFlags])

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

  useEffect(() => {
    const t = setTimeout(() => {
      setFilteredFlags(filterFlagsBySearch(flags, searchInput))
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchInput, flags])

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
        toast.addToast({
          type: 'success',
          title: updated.enabled ? 'Flag enabled' : 'Flag disabled',
        })
      } catch (err) {
        toast.addToast({
          type: 'error',
          title: 'Failed to update flag',
          message: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setTogglingId(null)
      }
    },
    [session?.access_token, toast]
  )

  const deleteFlag = useCallback(
    async (flag: FeatureFlag) => {
      if (!session?.access_token || !window.confirm(`Delete flag "${flag.name}"?`))
        return
      setDeletingFlag(flag)
      try {
        const url = getApiUrl(`/api/features/${encodeURIComponent(flag.name)}`)
        const orgParam =
          flag.organization_id != null
            ? `?organization_id=${encodeURIComponent(flag.organization_id)}`
            : ''
        const res = await fetch(url + orgParam, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setFlags((prev) => prev.filter((f) => f.id !== flag.id))
        toast.addToast({ type: 'success', title: 'Flag deleted' })
      } catch (err) {
        toast.addToast({
          type: 'error',
          title: 'Failed to delete flag',
          message: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setDeletingFlag(null)
      }
    },
    [session?.access_token, toast]
  )

  if (loading && flags.length === 0) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl p-6" data-testid="admin-feature-toggles-page">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50"
              aria-label="Back to admin"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Feature toggles</h1>
              <p className="text-sm text-gray-600">
                Enable or disable features globally or per organization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            data-testid="admin-feature-toggles-add"
          >
            <Plus className="h-4 w-4" />
            Add new flag
          </button>
        </div>

        <div className="relative mb-6">
          <Search
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="text"
            placeholder="Search flags by name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Scope
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Enabled
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Updated
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredFlags.map((flag) => (
                <tr key={flag.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {flag.name}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600">
                    {flag.description ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {flag.organization_id == null ? 'Global' : 'Organization'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleEnabled(flag)}
                      disabled={togglingId === flag.id}
                      className="focus:outline-none"
                      aria-label={flag.enabled ? 'Disable' : 'Enable'}
                    >
                      {togglingId === flag.id ? (
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      ) : flag.enabled ? (
                        <ToggleRight className="h-6 w-6 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatTimestamp(flag.updated_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingFlag(flag)}
                      className="rounded p-2 text-gray-600 hover:bg-gray-200"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFlag(flag)}
                      disabled={deletingFlag?.id === flag.id}
                      className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label="Delete"
                    >
                      {deletingFlag?.id === flag.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredFlags.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              {searchInput.trim()
                ? 'No flags match your search.'
                : 'No feature flags yet. Add one to get started.'}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <FeatureFlagModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchFlags()
          }}
          session={session}
          toast={toast}
        />
      )}
      {editingFlag && (
        <FeatureFlagModal
          initial={editingFlag}
          onClose={() => setEditingFlag(null)}
          onSuccess={() => {
            setEditingFlag(null)
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
  initial,
  onClose,
  onSuccess,
  session,
  toast,
}: {
  initial?: FeatureFlag
  onClose: () => void
  onSuccess: () => void
  session: { access_token?: string } | null
  toast: { addToast: (t: { type: string; title: string; message?: string }) => void }
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? false)
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const validateName = (v: string) =>
    /^[a-zA-Z0-9_-]+$/.test(v) ? null : 'Name: only letters, numbers, underscore, hyphen'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = isEdit ? null : validateName(name)
    setValidationError(err ?? null)
    if (err || !session?.access_token) return
    setSaving(true)
    try {
      if (isEdit) {
        const url = getApiUrl(`/api/features/${encodeURIComponent(initial!.name)}`)
        const orgParam =
          initial!.organization_id != null
            ? `?organization_id=${encodeURIComponent(initial!.organization_id)}`
            : ''
        const res = await fetch(url + orgParam, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ description: description || undefined, enabled }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.detail || `HTTP ${res.status}`)
        }
        toast.addToast({ type: 'success', title: 'Flag updated' })
      } else {
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
        toast.addToast({ type: 'success', title: 'Flag created' })
      }
      onSuccess()
    } catch (err) {
      toast.addToast({
        type: 'error',
        title: isEdit ? 'Failed to update flag' : 'Failed to create flag',
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit flag' : 'Add new flag'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!isEdit) setValidationError(validateName(e.target.value))
              }}
              disabled={isEdit}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
            {validationError && <p className="mt-1 text-sm text-red-600">{validationError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="modal-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="modal-enabled" className="text-sm font-medium text-gray-700">
              Enabled
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (!isEdit && !name.trim())}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
