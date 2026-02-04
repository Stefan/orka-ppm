'use client'

interface TrendData {
  period: string
  count: number
  cost: number
  approved?: number
}

interface TrendAnalysisChartProps {
  trends?: TrendData[]
}

export default function TrendAnalysisChart({ trends = [] }: TrendAnalysisChartProps) {
  if (!trends.length) {
    return (
      <div className="p-6 text-center text-gray-500 border rounded-lg">
        No trend data available
      </div>
    )
  }

  const maxCount = Math.max(...trends.map((t) => t.count), 1)

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Change Order Trends</h4>
      <div className="space-y-2">
        {trends.map((t) => (
          <div key={t.period} className="flex items-center gap-3">
            <div className="w-20 text-sm text-gray-600">{t.period}</div>
            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded"
                style={{ width: `${(t.count / maxCount) * 100}%` }}
              />
            </div>
            <div className="w-24 text-right text-sm">{t.count} orders</div>
            <div className="w-24 text-right text-sm font-medium">${t.cost?.toLocaleString() ?? 0}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
