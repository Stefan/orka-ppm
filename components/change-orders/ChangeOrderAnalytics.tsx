'use client'

import { useState, useEffect } from 'react'
import { changeOrdersApi, type ChangeOrder } from '@/lib/change-orders-api'
import MetricsDashboard from './MetricsDashboard'
import TrendAnalysisChart from './TrendAnalysisChart'

interface ChangeOrderAnalyticsProps {
  projectId: string
}

export default function ChangeOrderAnalytics({ projectId }: ChangeOrderAnalyticsProps) {
  const [dashboard, setDashboard] = useState<{
    summary: Record<string, unknown>
    recent_change_orders: ChangeOrder[]
  } | null>(null)
  const [metrics, setMetrics] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [dash, m] = await Promise.all([
          changeOrdersApi.getDashboard(projectId).catch(() => null),
          changeOrdersApi.getMetrics(projectId).catch(() => ({})),
        ])
        setDashboard(dash)
        setMetrics(m)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const summary = (dashboard?.summary ?? metrics) as Record<string, unknown>
  const recent = dashboard?.recent_change_orders ?? []

  return (
    <div className="space-y-6">
      <MetricsDashboard metrics={summary} />
      <TrendAnalysisChart trends={[]} />
      {recent.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Change Orders</h4>
          <div className="space-y-2">
            {recent.slice(0, 5).map((co) => (
              <div key={co.id} className="flex justify-between items-center p-2 border rounded">
                <span className="font-mono text-sm">{co.change_order_number}</span>
                <span className="text-sm">{co.title}</span>
                <span className="text-sm font-medium">${co.proposed_cost_impact?.toLocaleString() ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
