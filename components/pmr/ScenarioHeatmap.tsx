'use client'

import React from 'react'
import {
  getScenarioMetricRow,
  getHeatmapRows,
  type ScenarioMetricRow,
} from '@/lib/pmr/scenario-heatmap-utils'
import { getScenarioCO2 } from '@/lib/pmr/co2-heuristic'
import type { MonteCarloResults } from './types'

export interface ScenarioHeatmapProps {
  scenarios: Array<{
    id: string
    name: string
    results?: MonteCarloResults
  }>
  baselineIndex?: number
  showCO2?: boolean
  onApplyScenario: (scenarioId: string) => void
}

const METRIC_HEADERS: Record<string, string> = {
  p50Budget: 'P50 Budget',
  p90Budget: 'P90 Budget',
  expectedCost: 'Expected Cost',
  p50Schedule: 'P50 Schedule (d)',
  co2Tco2e: 'CO₂ (tCO2e)',
}

export function ScenarioHeatmap({
  scenarios,
  baselineIndex = 0,
  showCO2 = false,
  onApplyScenario,
}: ScenarioHeatmapProps) {
  const rows: ScenarioMetricRow[] = scenarios.map((s) => {
    const co2 = showCO2
      ? getScenarioCO2(
          s.results?.results?.budget_analysis?.expected_final_cost ?? 0,
          s.results?.results?.schedule_analysis?.percentiles?.p50 ??
            s.results?.results?.schedule_analysis?.expected_final_duration ?? 0
        )
      : undefined
    return getScenarioMetricRow(s.id, s.name, s.results, co2)
  })

  const heatmapRows = getHeatmapRows(rows, baselineIndex)
  if (heatmapRows.length === 0) return null

  const metricKeys = showCO2
    ? (['p50Budget', 'p90Budget', 'expectedCost', 'p50Schedule', 'co2Tco2e'] as const)
    : (['p50Budget', 'p90Budget', 'expectedCost', 'p50Schedule'] as const)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-100 dark:bg-slate-700">
            <th className="text-left px-3 py-2 border-b border-gray-200 dark:border-slate-700 font-medium">Scenario</th>
            {metricKeys.map((k) => (
              <th key={k} className="text-right px-3 py-2 border-b border-gray-200 dark:border-slate-700 font-medium">
                {METRIC_HEADERS[k] ?? k}
              </th>
            ))}
            <th className="text-right px-3 py-2 border-b border-gray-200 dark:border-slate-700 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {heatmapRows.map((row, idx) => (
            <tr key={row.scenarioId} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
              <td className="px-3 py-2 font-medium">
                {row.scenarioName}
                {idx === baselineIndex && (
                  <span className="ml-1 text-xs text-gray-500 dark:text-slate-400">(Baseline)</span>
                )}
              </td>
              {metricKeys.map((key) => {
                const cell = row.cells[key]
                if (!cell) return <td key={key} className="px-3 py-2 text-right">—</td>
                const bg =
                  cell.color === 'green'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                    : cell.color === 'red'
                      ? 'bg-red-50 text-red-800 dark:text-red-300'
                      : 'bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300'
                return (
                  <td key={key} className={`px-3 py-2 text-right ${bg}`}>
                    {cell.value}
                  </td>
                )
              })}
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => onApplyScenario(row.scenarioId)}
                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 rounded hover:bg-blue-200"
                >
                  Apply
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 mt-2 text-xs text-gray-600 dark:text-slate-400">
        <span><span className="inline-block w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" /> Better than baseline</span>
        <span><span className="inline-block w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700" /> Worse than baseline</span>
      </div>
    </div>
  )
}
