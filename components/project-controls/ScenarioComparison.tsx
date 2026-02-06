'use client'

interface ScenarioItem {
  scenario: string
  total: number
  confidence?: number
}

interface ScenarioComparisonProps {
  scenarios: ScenarioItem[]
}

export default function ScenarioComparison({ scenarios }: ScenarioComparisonProps) {
  if (!scenarios.length) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {scenarios.map((s) => (
        <div key={s.scenario} className="p-3 border rounded-lg bg-white dark:bg-slate-800">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase capitalize">{s.scenario.replace(/_/g, ' ')}</p>
          <p className="text-lg font-bold mt-1">${s.total.toLocaleString()}</p>
          {s.confidence !== undefined && (
            <p className="text-xs text-gray-500 dark:text-slate-400">Confidence: {(s.confidence * 100).toFixed(0)}%</p>
          )}
        </div>
      ))}
    </div>
  )
}
