'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, AlertCircle } from 'lucide-react'
import { changeOrdersApi } from '@/lib/change-orders-api'

interface ChangeOrderWidgetsProps {
  projectIds?: string[]
}

export default function ChangeOrderWidgets({ projectIds = [] }: ChangeOrderWidgetsProps) {
  const [summary, setSummary] = useState<{ total: number; pending: number; cost: number } | null>(null)

  useEffect(() => {
    if (projectIds.length === 0) return
    const load = async () => {
      let total = 0
      let pending = 0
      let cost = 0
      for (const pid of projectIds.slice(0, 5)) {
        try {
          const dash = await changeOrdersApi.getDashboard(pid)
          const s = dash?.summary as Record<string, number> | undefined
          if (s) {
            total += s.total_change_orders ?? 0
            pending += s.pending_change_orders ?? 0
            cost += s.total_cost_impact ?? 0
          }
        } catch {
          // ignore
        }
      }
      setSummary({ total, pending, cost })
    }
    load()
  }, [projectIds.join(',')])

  if (!summary || summary.total === 0) return null

  return (
    <Link
      href="/changes/orders"
      className="block p-4 bg-white dark:bg-slate-800 rounded-lg border hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
        <FileText className="w-5 h-5" />
        <span className="font-medium">Change Orders</span>
        {summary.pending > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {summary.pending} pending
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-4 text-sm">
        <span>{summary.total} total</span>
        <span className="font-medium">${summary.cost.toLocaleString()} impact</span>
      </div>
    </Link>
  )
}
