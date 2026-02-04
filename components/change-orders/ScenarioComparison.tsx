'use client'

import type { CostScenario } from '@/lib/change-orders-api'

interface ScenarioComparisonProps {
  scenarios: CostScenario[]
}

export default function ScenarioComparison({ scenarios }: ScenarioComparisonProps) {
  if (!scenarios.length) return null

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">Cost Scenarios</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {scenarios.map((s) => (
          <div
            key={s.scenario_name}
            className="p-4 rounded-lg border bg-white"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide capitalize">
              {s.scenario_name.replace(/_/g, ' ')}
            </p>
            <p className="text-xl font-bold mt-1">${s.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-gray-500 mt-1">
              Confidence: {(s.confidence_level * 100).toFixed(0)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
