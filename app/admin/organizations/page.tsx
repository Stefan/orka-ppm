'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/shared/AppLayout'
import { getApiUrl } from '@/lib/api'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { Building2, Plus, Pencil, AlertTriangle } from 'lucide-react'

interface Organization {
  id: string
  name: string
  code?: string
  slug?: string
  logo_url?: string
  is_active: boolean
  settings?: Record<string, unknown>
  created_at: string
  updated_at?: string
}

export default function AdminOrganizationsPage() {
  const router = useRouter()
  const { session } = useAuth()
  const [list, setList] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Organization | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', is_active: true })
  const [submitLoading, setSubmitLoading] = useState(false)

  const fetchList = useCallback(async () => {
    const token = session?.access_token
    if (!token) {
      setError('Not authenticated')
      setLoading(false)
      return
    }
    setError(null)
    setForbidden(false)
    try {
      const res = await fetch(getApiUrl('/api/admin/organizations'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) {
        setForbidden(true)
        setList([])
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.details || data?.error || res.statusText)
        return
      }
      const data = await res.json()
      setList(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', slug: '', is_active: true })
    setShowModal(true)
  }

  const openEdit = (org: Organization) => {
    setEditing(org)
    setForm({
      name: org.name,
      slug: org.slug ?? '',
      is_active: org.is_active,
    })
    setShowModal(true)
  }

  const submit = async () => {
    const token = session?.access_token
    if (!token) return
    setSubmitLoading(true)
    try {
      if (editing) {
        const res = await fetch(getApiUrl(`/api/admin/organizations/${editing.id}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: form.name,
            slug: form.slug || undefined,
            is_active: form.is_active,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.details || data?.error || res.statusText)
        }
      } else {
        const res = await fetch(getApiUrl('/api/admin/organizations'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: form.name,
            slug: form.slug || undefined,
            is_active: form.is_active,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.details || data?.error || res.statusText)
        }
      }
      setShowModal(false)
      fetchList()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="p-8" data-testid="admin-organizations-page">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="text-sm text-gray-600 dark:text-slate-400 hover:underline mb-2"
            >
              ← Admin
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              Organisations
            </h1>
            <p className="text-gray-600 dark:text-slate-400 mt-1">
              Tenant management (Super-Admin only)
            </p>
          </div>
          {!forbidden && !error && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" /> Add organisation
            </button>
          )}
        </div>

        {forbidden && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Access denied</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Only users with the <strong>super_admin</strong> role can manage organisations.
              </p>
            </div>
          </div>
        )}

        {error && !forbidden && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-gray-500 dark:text-slate-400">Loading…</p>
        )}

        {!loading && !forbidden && !error && (
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            {list.length === 0 ? (
              <p className="p-6 text-gray-500 dark:text-slate-400">No organisations yet. Create one to get started.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-slate-100">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-slate-100">Slug</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-slate-100">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-slate-100">Created</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {list.map((org) => (
                    <tr key={org.id} className="bg-white dark:bg-slate-800/50">
                      <td className="py-3 px-4 text-gray-900 dark:text-slate-100">{org.name}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{org.slug ?? '—'}</td>
                      <td className="py-3 px-4">
                        <span className={org.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-slate-400'}>
                          {org.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-400 text-sm">
                        {org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => openEdit(org)}
                          className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">
                {editing ? 'Edit organisation' : 'New organisation'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Slug (optional)</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2"
                    placeholder="e.g. acme-corp"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-slate-600"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-slate-300">Active</label>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!form.name.trim() || submitLoading}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {submitLoading ? 'Saving…' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
