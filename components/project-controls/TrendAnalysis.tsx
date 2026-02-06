'use client'

interface TrendPoint {
  period: number
  cpi?: number
  spi?: number
}

interface TrendAnalysisProps {
  trends: TrendPoint[]
}

export default function TrendAnalysis({ trends }: TrendAnalysisProps) {
  if (!trends.length) return <p className="text-sm text-gray-500 dark:text-slate-400">No trend data</p>

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">CPI/SPI Trends</h4>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {trends.slice(0, 12).map((t, i) => (
          <div key={i} className="flex gap-4 text-sm">
            <span className="w-12">P{t.period}</span>
            <span>CPI: {t.cpi?.toFixed(2) ?? '-'}</span>
            <span>SPI: {t.spi?.toFixed(2) ?? '-'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
