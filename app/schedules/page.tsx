'use client'

/**
 * Schedules page – Schedule Management Interface (Task 12).
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import { ScheduleManager } from '@/components/schedule/ScheduleManager'
import type { ScheduleListItem } from '@/types/schedule'

export default function SchedulesPage() {
  const router = useRouter()
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
      const res = await fetch(`/api/schedules?project_id=${encodeURIComponent(data.project_id)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description ?? null,
          start_date: data.start_date,
          end_date: data.end_date,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to create schedule')
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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Schedules</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Manage project schedules, tasks, and dependencies.
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
