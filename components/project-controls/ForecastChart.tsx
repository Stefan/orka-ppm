'use client'

interface ForecastChartProps {
  data: Array<{ forecast_date: string; forecasted_cost: number }>
}

export default function ForecastChart({ data }: ForecastChartProps) {
  if (!data.length) return null
  const maxVal = Math.max(...data.map((d) => d.forecasted_cost), 1)

  return (
    <div className="space-y-2">
      {data.slice(0, 12).map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-sm text-gray-600 dark:text-slate-400 truncate">{d.forecast_date}</div>
          <div className="flex-1 h-5 bg-gray-100 dark:bg-slate-700 rounded overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded"
              style={{ width: `${(d.forecasted_cost / maxVal) * 100}%` }}
            />
          </div>
          <div className="w-20 text-right text-sm font-medium">${d.forecasted_cost.toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}
