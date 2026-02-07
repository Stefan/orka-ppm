'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/shared/AppLayout'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { usePermissions } from '@/app/providers/EnhancedAuthProvider'
import { useToast } from '@/components/shared/Toast'
import { getApiUrl } from '@/lib/api'
import { ArrowLeft, Settings, Loader2, Check, X } from 'lucide-react'

export type SSOProvider = {
  id: string
  name: string
  enabled: boolean
  last_error: string | null
}

export default function AdminSSOPage() {
  const { session } = useAuth()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const router = useRouter()
  const toast = useToast()
  const [providers, setProviders] = useState<SSOProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [modalProvider, setModalProvider] = useState<SSOProvider | null>(null)
  const [saving, setSaving] = useState(false)
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

  const fetchConfig = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    try {
      const res = await fetch(getApiUrl('/api/auth/sso/config'), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProviders(data?.providers ?? [])
    } catch (err) {
      toast.error(
        'Failed to load SSO config',
        err instanceof Error ? err.message : String(err)
      )
      setProviders([])
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, toast])

  useEffect(() => {
    if (!permissionsLoading && !isAdmin && session) {
      const t = setTimeout(() => router.push('/'), 2000)
      return () => clearTimeout(t)
    }
  }, [permissionsLoading, isAdmin, session, router])

  useEffect(() => {
    if (session && isAdmin) fetchConfig()
  }, [session, isAdmin, fetchConfig])

  const openModal = (p: SSOProvider) => setModalProvider({ ...p })
  const closeModal = () => setModalProvider(null)

  const saveModal = async () => {
    if (!modalProvider || !session?.access_token) return
    setSaving(true)
    try {
      const res = await fetch(getApiUrl('/api/auth/sso/config'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          providers: [{ id: modalProvider.id, enabled: modalProvider.enabled }],
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setProviders((prev) =>
        prev.map((q) =>
          q.id === modalProvider.id ? { ...q, enabled: modalProvider.enabled } : q
        )
      )
      closeModal()
      toast.success('SSO provider updated')
    } catch (err) {
      toast.error(
        'Failed to update SSO config',
        err instanceof Error ? err.message : String(err)
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="p-8" data-testid="admin-sso-page">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-5 w-5" /> Back to Admin
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          SSO (Single Sign-On)
        </h1>
        <p className="text-gray-600 dark:text-slate-400 mb-6">
          Enable or disable SSO providers. Client ID and Secret are configured in Supabase Dashboard → Authentication → Providers.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-800/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Last Error
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {providers.map((p) => (
                  <tr key={p.id} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">
                      {p.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {p.enabled ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4" /> Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-500 dark:text-slate-400">
                          <X className="h-4 w-4" /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400 max-w-xs truncate" title={p.last_error ?? undefined}>
                      {p.last_error ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => openModal(p)}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        data-testid={`sso-config-${p.id}`}
                      >
                        <Settings className="h-4 w-4" /> Config
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modalProvider && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sso-modal-title"
          >
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h2 id="sso-modal-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                {modalProvider.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                Configure Client ID and Secret in Supabase Dashboard under Authentication → Providers. Here you can only enable or disable the provider for the login page.
              </p>
              <label className="flex items-center gap-2 cursor-pointer mb-6">
                <input
                  type="checkbox"
                  checked={modalProvider.enabled}
                  onChange={(e) =>
                    setModalProvider((prev) => prev ? { ...prev, enabled: e.target.checked } : null)
                  }
                  className="rounded border-gray-300 dark:border-slate-600"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">Enabled (show on login page)</span>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
