'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { getApiUrl } from '@/lib/api'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { useTranslations } from '@/lib/i18n/context'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface OrgData {
  id: string
  name: string
  slug?: string
  logo_url?: string
  is_active?: boolean
  settings?: {
    audit?: { actuals_commitments?: boolean }
  }
}

export default function OrganizationSettings() {
  const { t } = useTranslations()
  const { session } = useAuth()
  const [org, setOrg] = useState<OrgData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLogoUrl, setEditLogoUrl] = useState('')
  const [auditActualsCommitments, setAuditActualsCommitments] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const token = session?.access_token
    if (!token) {
      setLoading(false)
      setError('Not authenticated')
      return
    }
    let cancelled = false
    fetch(getApiUrl('/api/admin/organizations/me'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Access denied (admin, org_admin or super_admin)' : r.statusText)
        return r.json()
      })
      .then((data) => {
        if (!cancelled) {
          setOrg(data)
          setEditName(data.name ?? '')
          setEditLogoUrl(data.logo_url ?? '')
          setAuditActualsCommitments(data.settings?.audit?.actuals_commitments !== false)
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [session?.access_token])

  const handleSave = async () => {
    if (!session?.access_token || !org) return
    setSaving(true)
    setError(null)
    try {
      const body: {
        name?: string
        logo_url?: string
        settings?: { audit?: { actuals_commitments?: boolean } }
      } = {
        name: editName || undefined,
        logo_url: editLogoUrl || undefined,
      }
      if (org.settings?.audit?.actuals_commitments !== auditActualsCommitments) {
        body.settings = { audit: { actuals_commitments: auditActualsCommitments } }
      }
      const r = await fetch(getApiUrl('/api/admin/organizations/me'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error((data.details ?? data.error) || r.statusText)
      }
      const data = await r.json()
      setOrg(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Loading…</p>
  }
  if (error && !org) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
          Only users with the admin, org_admin or super_admin role can view and edit the organization here.
        </p>
      </div>
    )
  }
  if (!org) return null

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Logo URL</label>
        <input
          type="url"
          value={editLogoUrl}
          onChange={(e) => setEditLogoUrl(e.target.value)}
          placeholder="https://…"
          className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
        />
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
        <h3 className="text-sm font-medium text-gray-800 dark:text-slate-200 mb-2">
          {t('settings.auditSection') || 'Compliance & Audit'}
        </h3>
        <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
          <div className="flex-1">
            <Label htmlFor="audit-actuals-commitments" className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {t('settings.auditActualsCommitments') || 'Audit trail for financial data (actuals & commitments)'}
            </Label>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {t('settings.auditActualsCommitmentsDesc') || 'When on, every change is logged. Turning off improves import performance but may affect compliance.'}
            </p>
          </div>
          <Switch
            id="audit-actuals-commitments"
            checked={auditActualsCommitments}
            onCheckedChange={setAuditActualsCommitments}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
