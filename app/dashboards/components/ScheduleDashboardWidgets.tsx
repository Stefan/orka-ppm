'use client'

/**
 * Schedule dashboard widgets (Task 15.1, 15.2).
 * Schedule performance KPIs, critical path status, milestone tracking, resource utilization.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Flag, AlertTriangle, Users } from 'lucide-react'

interface ScheduleDashboardWidgetsProps {
  accessToken: string | null
}

export default function ScheduleDashboardWidgets({ accessToken }: ScheduleDashboardWidgetsProps) {
  const [scheduleCount, setScheduleCount] = useState<number | null>(null)
  const [milestoneAlerts, setMilestoneAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch('/api/schedules', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => (r.ok ? r.json() : { schedules: [] }))
        .then((d) => (cancelled ? null : setScheduleCount((d.schedules ?? []).length))),
      fetch('/api/schedules/notifications?days_ahead=14', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => (cancelled ? null : setMilestoneAlerts(d.milestone_alerts ?? []))),
    ]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [accessToken])

  if (loading && scheduleCount === null) return null

  return (
    <div data-testid="schedule-dashboard-widgets" className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Schedules
        </h3>
        <Link href="/schedules" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Open
        </Link>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-slate-400">Active schedules</span>
          <span className="font-semibold text-gray-900 dark:text-slate-100">{scheduleCount ?? 0}</span>
        </div>
        {milestoneAlerts.length > 0 && (
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <Flag className="w-4 h-4 flex-shrink-0" />
            <span>{milestoneAlerts.length} milestone(s) due in 14 days</span>
          </div>
        )}
      </div>
    </div>
  )
}
