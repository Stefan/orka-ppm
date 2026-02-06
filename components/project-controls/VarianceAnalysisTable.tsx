'use client'

interface VarianceRow {
  category: string
  variance: number
  variancePct?: number
  alert?: string
}

interface VarianceAnalysisTableProps {
  costVariances?: VarianceRow[]
  scheduleVariances?: VarianceRow[]
}

export default function VarianceAnalysisTable({ costVariances = [], scheduleVariances = [] }: VarianceAnalysisTableProps) {
  const renderTable = (title: string, rows: VarianceRow[]) => {
    if (!rows.length) return null
    return (
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{title}</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1">Category</th>
              <th className="text-right py-1">Variance</th>
              <th className="text-right py-1">%</th>
              <th className="text-left py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="py-1">{r.category}</td>
                <td className="text-right">${r.variance?.toLocaleString() ?? 0}</td>
                <td className="text-right">{r.variancePct?.toFixed(1) ?? '-'}%</td>
                <td>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${r.alert === 'critical_variance' ? 'bg-red-100 dark:bg-red-900/30' : r.alert === 'significant_variance' ? 'bg-amber-100' : 'bg-green-100 dark:bg-green-900/30'}`}>
                    {r.alert ?? 'on_track'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {renderTable('Cost Variances', costVariances)}
      {renderTable('Schedule Variances', scheduleVariances)}
    </div>
  )
}
