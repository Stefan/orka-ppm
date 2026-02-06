'use client'

import { useState, useEffect } from 'react'
import { projectControlsApi } from '@/lib/project-controls-api'
import PerformanceGauges from './PerformanceGauges'
import VarianceAnalysisTable from './VarianceAnalysisTable'

interface EarnedValueDashboardProps {
  projectId: string
}

export default function EarnedValueDashboard({ projectId }: EarnedValueDashboardProps) {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null)
  const [variance, setVariance] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [m, v] = await Promise.all([
          projectControlsApi.getEarnedValueMetrics(projectId),
          projectControlsApi.getVarianceAnalysis(projectId).catch(() => null),
        ])
        setMetrics(m)
        setVariance(v)
      } catch {
        setMetrics(null)
        setVariance(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  if (loading) return <div className="p-4">Loading...</div>
  if (!metrics) return <div className="p-4 text-gray-500 dark:text-slate-400">No earned value data</div>

  const cpi = (metrics.cost_performance_index as number) ?? 0
  const spi = (metrics.schedule_performance_index as number) ?? 0
  const tcpi = metrics.to_complete_performance_index as number | undefined

  const costVars = (variance?.cost_variances as Array<{ category: string; variance: number; variance_pct?: number; alert?: string }>) ?? []
  const schedVars = (variance?.schedule_variances as Array<{ category: string; variance: number; variance_pct?: number; alert?: string }>) ?? []

  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border space-y-4">
      <h3 className="font-semibold">Earned Value Metrics</h3>
      <PerformanceGauges cpi={cpi} spi={spi} tcpi={tcpi} />
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500 dark:text-slate-400">EAC:</span> ${(metrics.estimate_at_completion as number)?.toLocaleString() ?? '-'}</div>
        <div><span className="text-gray-500 dark:text-slate-400">% Complete:</span> {(metrics.percent_complete as number)?.toFixed(1) ?? '-'}%</div>
      </div>
      <VarianceAnalysisTable costVariances={costVars} scheduleVariances={schedVars} />
    </div>
  )
}
