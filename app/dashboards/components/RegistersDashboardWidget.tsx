'use client'

/**
 * Dashboard widget: open risks and issues count with link to Registers.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, AlertTriangle } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'

interface RegistersDashboardWidgetProps {
  accessToken: string | null
}

export default function RegistersDashboardWidget({ accessToken }: RegistersDashboardWidgetProps) {
  const { t } = useTranslations()
  const [openRisks, setOpenRisks] = useState<number | null>(null)
  const [openIssues, setOpenIssues] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch('/api/registers/risk?limit=1&offset=0&status=open&count_exact=true', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => (r.ok ? r.json() : { total: 0 }))
        .then((d) => (cancelled ? null : setOpenRisks(d.total ?? 0))),
      fetch('/api/registers/issue?limit=1&offset=0&status=open&count_exact=true', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => (r.ok ? r.json() : { total: 0 }))
        .then((d) => (cancelled ? null : setOpenIssues(d.total ?? 0))),
    ]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  if (loading && openRisks === null && openIssues === null) return null

  const totalOpen = (openRisks ?? 0) + (openIssues ?? 0)

  return (
    <div
      data-testid="registers-dashboard-widget"
      className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2 flex-shrink-0">
          <BookOpen className="w-4 h-4" />
          {t('dashboard.registersTitle', 'Risks & Issues')}
        </h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          {totalOpen > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-sm font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {totalOpen} {t('dashboard.open', 'open')}
            </span>
          )}
          <Link
            href="/registers"
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('dashboard.openLink')}
          </Link>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1 text-sm min-w-0">
        <span className="text-gray-600 dark:text-slate-400">
          {openRisks ?? 0} {t('dashboard.risks', 'risks')} · {openIssues ?? 0} {t('dashboard.issues', 'issues')} {t('dashboard.open', 'open')}
        </span>
      </div>
    </div>
  )
}
