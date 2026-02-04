'use client'

import { useState, useEffect } from 'react'
import { projectControlsApi } from '@/lib/project-controls-api'
import TrendAnalysis from './TrendAnalysis'
import PerformancePredictions from './PerformancePredictions'

interface PerformanceAnalyticsProps {
  projectId: string
}

export default function PerformanceAnalytics({ projectId }: PerformanceAnalyticsProps) {
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null)
  const [prediction, setPrediction] = useState<Record<string, unknown> | null>(null)
  const [trends, setTrends] = useState<Array<{ period: number; cpi?: number; spi?: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [d, p, t] = await Promise.all([
          projectControlsApi.getPerformanceDashboard(projectId),
          projectControlsApi.getCompletionPrediction(projectId),
          projectControlsApi.getPerformanceTrends(projectId).catch(() => []),
        ])
        setDashboard(d)
        setPrediction(p)
        setTrends(Array.isArray(t) ? t : [])
      } catch {
        setDashboard(null)
        setPrediction(null)
        setTrends([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  if (loading) return <div className="p-4">Loading...</div>

  const pred = prediction as { cost_forecast?: number; completion_date_forecast?: string; confidence_interval?: { lower: number; upper: number }; performance_trend?: string } | null

  return (
    <div className="p-4 bg-white rounded-lg border space-y-4">
      <h3 className="font-semibold">Performance Analytics</h3>
      <PerformancePredictions
        costForecast={pred?.cost_forecast}
        completionDate={pred?.completion_date_forecast}
        confidenceInterval={pred?.confidence_interval}
        performanceTrend={pred?.performance_trend}
      />
      <TrendAnalysis trends={trends} />
      {dashboard?.variance_analysis && (
        <div>
          <h4 className="text-sm text-gray-600 mb-1">Variance Analysis</h4>
          <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(dashboard.variance_analysis, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
