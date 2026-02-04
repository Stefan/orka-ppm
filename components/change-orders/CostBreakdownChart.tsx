'use client'

interface CostBreakdownChartProps {
  directCosts: Record<string, number>
  indirectCosts?: Record<string, number>
  total: number
}

export default function CostBreakdownChart({ directCosts, indirectCosts = {}, total }: CostBreakdownChartProps) {
  const entries = [
    ...Object.entries(directCosts).map(([k, v]) => ({ label: k, value: v, type: 'direct' })),
    ...Object.entries(indirectCosts).map(([k, v]) => ({ label: k, value: v, type: 'indirect' })),
  ].filter((e) => e.value > 0)

  const maxVal = Math.max(...entries.map((e) => e.value), 1)

  return (
    <div className="space-y-2">
      {entries.map(({ label, value, type }) => (
        <div key={`${type}-${label}`} className="flex items-center gap-3">
          <div className="w-24 text-sm text-gray-600 capitalize truncate">{label.replace(/_/g, ' ')}</div>
          <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
            <div
              className={`h-full rounded ${type === 'direct' ? 'bg-indigo-500' : 'bg-amber-500'}`}
              style={{ width: `${(value / maxVal) * 100}%` }}
            />
          </div>
          <div className="w-20 text-right text-sm font-medium">${value.toLocaleString()}</div>
        </div>
      ))}
      <div className="pt-2 mt-2 border-t flex justify-between font-semibold">
        <span>Total</span>
        <span>${total.toLocaleString()}</span>
      </div>
    </div>
  )
}
