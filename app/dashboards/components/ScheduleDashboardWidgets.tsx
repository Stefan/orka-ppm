'use client'

/**
 * Schedule dashboard widgets (Task 15.1, 15.2).
 * Schedule performance KPIs, critical path status, milestone tracking, resource utilization.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'

interface ScheduleDashboardWidgetsProps {
  accessToken: string | null
}

export default function ScheduleDashboardWidgets({ accessToken }: ScheduleDashboardWidgetsProps) {
  const { t } = useTranslations()
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
      {/* Line 1: Title + Open + count */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2 flex-shrink-0">
          <Calendar className="w-4 h-4" /> {t('dashboard.schedulesTitle')}
        </h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{scheduleCount ?? 0}</span>
          <Link href="/schedules" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
            {t('dashboard.openLink')}
          </Link>
        </div>
      </div>
      {/* Line 2: Subtitle (and optional milestone in same line) */}
      <div className="flex items-center justify-between gap-2 mt-1 text-sm min-w-0">
        <span className="text-gray-600 dark:text-slate-400 truncate">
          {t('dashboard.activeSchedules')}{milestoneAlerts.length > 0 ? ` · ${t('dashboard.milestonesDueIn14Days', { count: milestoneAlerts.length })}` : ''}
        </span>
      </div>
    </div>
  )
}
