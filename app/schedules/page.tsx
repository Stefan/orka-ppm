'use client'

/**
 * Schedules page – Schedule Management Interface (Task 12).
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import { ScheduleManager } from '@/components/schedule/ScheduleManager'
import { useTranslations } from '@/lib/i18n/context'
import type { ScheduleListItem } from '@/types/schedule'

export default function SchedulesPage() {
  const router = useRouter()
  const { t } = useTranslations()
  const { session, loading: authLoading } = useAuth()
  const [schedules, setSchedules] = useState<ScheduleListItem[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSchedules = useCallback(async () => {
    if (!session?.access_token) return
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/schedules', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch schedules')
      const data = await res.json()
      setSchedules(data.schedules ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedules')
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  const fetchProjects = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.items ?? data.projects ?? []
      setProjects(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
    } catch {
      setProjects([])
    }
  }, [session?.access_token])

  useEffect(() => {
    if (!authLoading && !session) router.push('/')
  }, [authLoading, session, router])

  useEffect(() => {
    if (session?.access_token) {
      fetchSchedules()
      fetchProjects()
    }
  }, [session?.access_token, fetchSchedules, fetchProjects])

  const handleCreateSchedule = useCallback(
    async (data: { project_id: string; name: string; description?: string; start_date: string; end_date: string }) => {
      const body = {
        project_id: data.project_id,
        name: data.name,
        description: data.description ?? null,
        start_date: data.start_date,
        end_date: data.end_date,
      }
      // #region agent log
      const ingestUrl = 'http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1'
      fetch(ingestUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app/schedules/page.tsx:handleCreateSchedule', message: 'before create', data: { hasProjectIdInBody: true, bodyKeys: Object.keys(body) }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {})
      // #endregion
      const res = await fetch(`/api/schedules?project_id=${encodeURIComponent(data.project_id)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // #region agent log
        fetch(ingestUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app/schedules/page.tsx:handleCreateSchedule', message: 'create failed', data: { status: res.status, err }, timestamp: Date.now(), hypothesisId: 'H2' }) }).catch(() => {})
        // #endregion
        const detail = err.detail
        const detailStr = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg).join(', ') : detail ? String(detail) : undefined
        let msg = detailStr ?? err.error ?? 'Failed to create schedule'
        if (msg.includes("table 'public.schedules'") || msg.includes('PGRST205')) {
          msg = "Schedule tables are not set up. Run the migration: Supabase Dashboard → SQL Editor → execute backend/migrations/017_integrated_master_schedule.sql (see docs/SCHEDULE_MIGRATION.md)."
        }
        throw new Error(msg)
      }
    },
    [session?.access_token]
  )

  const handleScheduleClick = useCallback(
    (schedule: ScheduleListItem) => {
      router.push(`/schedules/${schedule.id}`)
    },
    [router]
  )

  if (authLoading || !session) {
    return (
      <AppLayout>
        <div className="p-8 text-gray-500 dark:text-slate-400">Loading...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('schedules.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          {t('schedules.pageDescription')}
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}
        <ScheduleManager
          schedules={schedules}
          projects={projects}
          loading={loading}
          onRefresh={fetchSchedules}
          onCreateSchedule={handleCreateSchedule}
          onScheduleClick={handleScheduleClick}
        />
      </div>
    </AppLayout>
  )
}
