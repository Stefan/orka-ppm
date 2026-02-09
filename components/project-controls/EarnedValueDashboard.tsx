'use client'

import { useState, useEffect } from 'react'
import { projectControlsApi } from '@/lib/project-controls-api'
import type { WorkPackageSummary } from '@/types/project-controls'
import PerformanceGauges from './PerformanceGauges'
import VarianceAnalysisTable from './VarianceAnalysisTable'

interface EarnedValueDashboardProps {
  projectId: string
  onSwitchToWorkPackages?: () => void
}

export default function EarnedValueDashboard({ projectId, onSwitchToWorkPackages }: EarnedValueDashboardProps) {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null)
  const [variance, setVariance] = useState<Record<string, unknown> | null>(null)
  const [wpSummary, setWpSummary] = useState<WorkPackageSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [m, v, wp] = await Promise.all([
          projectControlsApi.getEarnedValueMetrics(projectId),
          projectControlsApi.getVarianceAnalysis(projectId).catch(() => null),
          projectControlsApi.getWorkPackageSummary(projectId).catch(() => null),
        ])
        setMetrics(m)
        setVariance(v)
        setWpSummary(wp ?? null)
      } catch {
        setMetrics(null)
        setVariance(null)
        setWpSummary(null)
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
      {wpSummary != null && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg text-sm">
          <div><span className="text-gray-500 dark:text-slate-400">WPs:</span> {wpSummary.work_package_count}</div>
          <div><span className="text-gray-500 dark:text-slate-400">Budget:</span> ${wpSummary.total_budget.toLocaleString()}</div>
          <div><span className="text-gray-500 dark:text-slate-400">Earned value:</span> ${wpSummary.total_earned_value.toLocaleString()}</div>
          <div><span className="text-gray-500 dark:text-slate-400">Actual cost:</span> ${wpSummary.total_actual_cost.toLocaleString()}</div>
          <div><span className="text-gray-500 dark:text-slate-400">Avg %:</span> {wpSummary.average_percent_complete.toFixed(1)}%</div>
        </div>
      )}
      {onSwitchToWorkPackages && (
        <p className="text-sm">
          <button type="button" onClick={onSwitchToWorkPackages} className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Manage work packages
          </button>
        </p>
      )}
      <VarianceAnalysisTable costVariances={costVars} scheduleVariances={schedVars} />
    </div>
  )
}
