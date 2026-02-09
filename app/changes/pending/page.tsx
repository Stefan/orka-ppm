'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/shared/AppLayout'
import { changeOrdersApi } from '@/lib/change-orders-api'
import type { PendingApproval } from '@/lib/change-orders-api'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { Clock, DollarSign, FileText } from 'lucide-react'

export default function PendingApprovalsPage() {
  const { session } = useAuth()
  const [list, setList] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    changeOrdersApi
      .getPendingApprovals(session.user.id)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load')
        setList([])
      })
      .finally(() => setLoading(false))
  }, [session?.user?.id])

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold mb-4">My Pending Approvals</h1>
        {loading && <p className="text-gray-500 dark:text-slate-400">Loading…</p>}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}
        {!loading && !error && list.length === 0 && (
          <p className="text-gray-500 dark:text-slate-400">No pending approvals.</p>
        )}
        {!loading && list.length > 0 && (
          <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700/50">
                <tr>
                  <th className="text-left p-3">Change order</th>
                  <th className="text-left p-3">Title</th>
                  <th className="text-right p-3">Cost impact</th>
                  <th className="text-left p-3">Due</th>
                  <th className="w-24 p-3" />
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-medium">{item.change_order_number}</td>
                    <td className="p-3">{item.change_order_title}</td>
                    <td className="p-3 text-right">${(item.proposed_cost_impact ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-gray-600 dark:text-slate-400">
                      {item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/changes/${item.change_order_id}`}
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <FileText className="w-4 h-4" /> Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
