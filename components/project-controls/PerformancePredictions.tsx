'use client'

interface PerformancePredictionsProps {
  costForecast?: number
  completionDate?: string
  confidenceInterval?: { lower: number; upper: number }
  performanceTrend?: string
}

export default function PerformancePredictions({
  costForecast,
  completionDate,
  confidenceInterval,
  performanceTrend,
}: PerformancePredictionsProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Predictions</h4>
      <div className="space-y-1 text-sm">
        {costForecast !== undefined && (
          <p><span className="text-gray-500 dark:text-slate-400">Cost at completion:</span> ${costForecast.toLocaleString()}</p>
        )}
        {completionDate && (
          <p><span className="text-gray-500 dark:text-slate-400">Estimated completion:</span> {completionDate}</p>
        )}
        {confidenceInterval && (
          <p><span className="text-gray-500 dark:text-slate-400">Confidence range:</span> ${confidenceInterval.lower.toLocaleString()} – ${confidenceInterval.upper.toLocaleString()}</p>
        )}
        {performanceTrend && (
          <p><span className="text-gray-500 dark:text-slate-400">Trend:</span> {performanceTrend}</p>
        )}
      </div>
    </div>
  )
}
