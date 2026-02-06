'use client'

/**
 * Schedule detail page – Gantt + TaskManager (Task 12).
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import { GanttChart } from '@/components/schedule/GanttChart'
import { ResourceAssignmentDialog } from '@/components/schedule/ResourceAssignmentDialog'
import { Button } from '@/components/ui/Button'
import type { ScheduleWithTasks, ScheduleTask, ScheduleDependency, ScheduleMilestone } from '@/types/schedule'
import { ArrowLeft, Calendar, Users } from 'lucide-react'
import Link from 'next/link'

export default function ScheduleDetailPage() {
  const router = useRouter()
  const params = useParams()
  const scheduleId = params?.scheduleId as string
  const { session, loading: authLoading } = useAuth()
  const [schedule, setSchedule] = useState<ScheduleWithTasks | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'gantt' | 'tasks' | 'resources'>('gantt')
  const [resources, setResources] = useState<{ id: string; name: string }[]>([])
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false)

  const fetchSchedule = useCallback(async () => {
    if (!scheduleId || !session?.access_token) return
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch schedule')
      const data = await res.json()
      setSchedule(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule')
      setSchedule(null)
    } finally {
      setLoading(false)
    }
  }, [scheduleId, session?.access_token])

  useEffect(() => {
    if (!authLoading && !session) router.push('/')
  }, [authLoading, session, router])

  useEffect(() => {
    if (scheduleId && session) fetchSchedule()
  }, [scheduleId, session, fetchSchedule])

  useEffect(() => {
    if (!session?.access_token) return
    fetch('/api/resources', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setResources(Array.isArray(data) ? data : data.resources ?? []))
      .catch(() => setResources([]))
  }, [session?.access_token])

  const handleTaskUpdate = useCallback(
    async (taskId: string, updates: { planned_start_date?: string; planned_end_date?: string; progress_percentage?: number }) => {
      if (!session?.access_token) return
      const res = await fetch(`/api/schedules/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      if (res.ok) fetchSchedule()
    },
    [session?.access_token, fetchSchedule]
  )

  const handleDependencyCreate = useCallback(
    async (predecessorId: string, successorId: string) => {
      if (!session?.access_token) return
      const res = await fetch(`/api/schedules/tasks/${successorId}/dependencies`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          predecessor_task_id: predecessorId,
          successor_task_id: successorId,
          dependency_type: 'finish_to_start',
          lag_days: 0,
        }),
      })
      if (res.ok) fetchSchedule()
    },
    [session?.access_token, fetchSchedule]
  )

  if (authLoading || !session) {
    return (
      <AppLayout>
        <div className="p-8 text-gray-500 dark:text-slate-400">Loading...</div>
      </AppLayout>
    )
  }

  if (loading && !schedule) {
    return (
      <AppLayout>
        <div className="p-8 text-gray-500 dark:text-slate-400">Loading schedule...</div>
      </AppLayout>
    )
  }

  if (error || !schedule) {
    return (
      <AppLayout>
        <div className="p-8">
          <p className="text-red-600 dark:text-red-400 mb-4">{error ?? 'Schedule not found'}</p>
          <Link href="/schedules" className="text-blue-600 dark:text-blue-400 hover:underline">Back to schedules</Link>
        </div>
      </AppLayout>
    )
  }

  const tasks = schedule.tasks ?? []
  const dependencies = schedule.dependencies ?? []
  const milestones = schedule.milestones ?? []
  const startDate = new Date(schedule.start_date)
  const endDate = new Date(schedule.end_date)
  if (tasks.length > 0) {
    const minStart = Math.min(...tasks.map((t) => new Date(t.planned_start_date).getTime()))
    const maxEnd = Math.max(...tasks.map((t) => new Date(t.planned_end_date).getTime()))
    if (minStart < startDate.getTime()) startDate.setTime(minStart)
    if (maxEnd > endDate.getTime()) endDate.setTime(maxEnd)
  }
  const pad = 7 * 24 * 60 * 60 * 1000
  startDate.setTime(startDate.getTime() - pad)
  endDate.setTime(endDate.getTime() + pad)

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/schedules"
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4" /> Schedules
          </Link>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">{schedule.name}</h1>
            {schedule.description && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{schedule.description}</p>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {schedule.start_date} – {schedule.end_date} · {schedule.status}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('gantt')}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg ${
              activeTab === 'gantt' ? 'bg-white dark:bg-slate-800 border border-b-0 border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
            }`}
          >
            Gantt
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg ${
              activeTab === 'tasks' ? 'bg-white dark:bg-slate-800 border border-b-0 border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
            }`}
          >
            Task list
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('resources')}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg flex items-center gap-1 ${
              activeTab === 'resources' ? 'bg-white dark:bg-slate-800 border border-b-0 border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
            }`}
          >
            <Users className="w-4 h-4" /> Resources
          </button>
        </div>

        {activeTab === 'gantt' && (
          <GanttChart
            tasks={tasks}
            dependencies={dependencies}
            milestones={milestones}
            startDate={startDate}
            endDate={endDate}
            showCriticalPath
            showFloat
            showBaseline
            onTaskUpdate={handleTaskUpdate}
            onDependencyCreate={handleDependencyCreate}
            className="min-h-[400px]"
          />
        )}

        {activeTab === 'tasks' && (
          <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700 dark:text-slate-300">WBS</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700 dark:text-slate-300">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700 dark:text-slate-300">Start</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700 dark:text-slate-300">End</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700 dark:text-slate-300">Progress</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                    <td className="px-4 py-2 font-mono text-gray-500 dark:text-slate-400">{t.wbs_code}</td>
                    <td className="px-4 py-2 font-medium">{t.name}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-slate-400">{t.planned_start_date}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-slate-400">{t.planned_end_date}</td>
                    <td className="px-4 py-2">{t.progress_percentage}%</td>
                    <td className="px-4 py-2">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length === 0 && (
              <div className="py-8 text-center text-gray-500 dark:text-slate-400">No tasks in this schedule.</div>
            )}
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setResourceDialogOpen(true)} className="flex items-center gap-2">
                <Users className="w-4 h-4" /> Assign resource
              </Button>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Open &quot;Assign resource&quot; to assign resources to tasks. Conflicts and utilization are shown in the dialog.
            </p>
          </div>
        )}

        <ResourceAssignmentDialog
          open={resourceDialogOpen}
          onOpenChange={setResourceDialogOpen}
          scheduleId={scheduleId}
          tasks={tasks.map((t) => ({ id: t.id, name: t.name, wbs_code: t.wbs_code }))}
          resources={resources}
          accessToken={session?.access_token ?? null}
          onAssigned={fetchSchedule}
        />
      </div>
    </AppLayout>
  )
}
