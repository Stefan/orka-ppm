'use client'

interface MetricsDashboardProps {
  metrics: Record<string, unknown>
}

export default function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const items = [
    { key: 'total_change_orders', label: 'Total Change Orders', icon: '📋' },
    { key: 'approved_change_orders', label: 'Approved', icon: '✓' },
    { key: 'rejected_change_orders', label: 'Rejected', icon: '✗' },
    { key: 'pending_change_orders', label: 'Pending', icon: '⏳' },
    { key: 'total_cost_impact', label: 'Total Cost Impact', icon: '💰', format: (v: number) => `$${v?.toLocaleString() ?? 0}` },
    { key: 'average_processing_time_days', label: 'Avg Processing (days)', icon: '📅' },
    { key: 'average_approval_time_days', label: 'Avg Approval (days)', icon: '⏱️' },
    { key: 'change_order_velocity', label: 'Velocity (/month)', icon: '📈' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map(({ key, label, icon, format }) => {
        const val = metrics[key]
        const display = format && typeof val === 'number' ? format(val) : String(val ?? '-')
        return (
          <div key={key} className="p-4 bg-white dark:bg-slate-800 rounded-lg border">
            <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
            <p className="text-xl font-bold mt-1">{display}</p>
          </div>
        )
      })}
    </div>
  )
}
