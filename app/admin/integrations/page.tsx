'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/shared/AppLayout'
import { getApiUrl } from '@/lib/api'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import {
  INTEGRATION_SYSTEMS,
  SYSTEM_DISPLAY_NAMES,
  type IntegrationSystem,
  type IntegrationConfigPayload,
} from '@/lib/integrations/ErpAdapter'
import { Plug, Settings, RefreshCw, AlertTriangle } from 'lucide-react'

interface ConfigItem {
  system: string
  enabled: boolean
  last_sync?: string
  last_error?: string
}

const CONFIG_FIELDS: Record<string, string[]> = {
  sap: ['host', 'client', 'api_key'],
  microsoft: ['base_url', 'api_key'],
  oracle: ['account_id', 'token'],
  jira: ['base_url', 'token'],
  slack: ['webhook_url'],
}

function AdminIntegrationsContent() {
  const router = useRouter()
  const { session } = useAuth()
  const [list, setList] = useState<ConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [configModal, setConfigModal] = useState<IntegrationSystem | null>(null)
  const [configForm, setConfigForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)

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
      const res = await fetch(getApiUrl('/api/integrations/config'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) {
        setForbidden(true)
        setList([])
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { details?: string }).details || (data as { error?: string }).error || res.statusText)
        return
      }
      const data = await res.json()
      setList(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const openConfig = (system: IntegrationSystem) => {
    setConfigModal(system)
    setConfigForm({})
  }

  const saveConfig = async () => {
    if (!configModal || !session?.access_token) return
    setSaving(true)
    try {
      const payload: IntegrationConfigPayload = {}
      CONFIG_FIELDS[configModal]?.forEach((key) => {
        const v = configForm[key]
        if (v !== undefined && v !== '') payload[key] = v
      })
      const res = await fetch(getApiUrl(`/api/integrations/${configModal}/config`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail || (data as { error?: string }).error || res.statusText)
      }
      setConfigModal(null)
      fetchList()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save config')
    } finally {
      setSaving(false)
    }
  }

  const triggerSync = async (system: string) => {
    if (!session?.access_token) return
    setSyncing(system)
    try {
      const res = await fetch(getApiUrl('/api/integrations/sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ system, entity: 'commitments' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { detail?: string }).detail || (data as { error?: string }).error || res.statusText)
      fetchList()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="p-8" data-testid="admin-integrations-page">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="text-sm text-gray-600 dark:text-slate-400 hover:underline mb-2"
        >
          ← Admin
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Plug className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          Integrations
        </h1>
        <p className="text-gray-600 dark:text-slate-400 mt-1">
          SAP, Microsoft Dynamics, Oracle NetSuite, Jira, Slack – configure and sync.
        </p>
      </div>

      {forbidden && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">Access denied</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Only admins can manage integrations.
            </p>
          </div>
        </div>
      )}

      {error && !forbidden && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-200 mb-4">
          {error}
        </div>
      )}

      {loading && <p className="text-gray-500 dark:text-slate-400">Loading…</p>}

      {!loading && !forbidden && (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-800">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-slate-100">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-slate-100">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-slate-100">Last sync</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-slate-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {(list.length ? list : INTEGRATION_SYSTEMS.map((s) => ({ system: s, enabled: false }))).map((row) => (
                <tr key={row.system} className="bg-white dark:bg-slate-800/50">
                  <td className="py-3 px-4 text-gray-900 dark:text-slate-100">
                    {SYSTEM_DISPLAY_NAMES[row.system as IntegrationSystem] ?? row.system}
                  </td>
                  <td className="py-3 px-4">
                    <span className={row.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-slate-400'}>
                      {row.enabled ? 'Enabled' : 'Not configured'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-slate-400 text-sm">
                    {row.last_sync ? new Date(row.last_sync).toLocaleString() : '—'}
                    {row.last_error && (
                      <span className="block text-red-600 dark:text-red-400 text-xs">{row.last_error}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openConfig(row.system as IntegrationSystem)}
                      className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                      aria-label="Config"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerSync(row.system)}
                      disabled={syncing === row.system}
                      className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded disabled:opacity-50"
                      aria-label="Sync"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncing === row.system ? 'animate-spin' : ''}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">
              Config: {SYSTEM_DISPLAY_NAMES[configModal]}
            </h2>
            <div className="space-y-4">
              {(CONFIG_FIELDS[configModal] ?? []).map((key) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <input
                    type={key.includes('key') || key === 'token' ? 'password' : 'text'}
                    value={configForm[key] ?? ''}
                    onChange={(e) => setConfigForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2"
                    placeholder={key}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfigModal(null)}
                className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveConfig}
                disabled={saving}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminIntegrationsPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-8 text-gray-500 dark:text-slate-400">Loading integrations…</div>}>
        <AdminIntegrationsContent />
      </Suspense>
    </AppLayout>
  )
}
