'use client'

import { FileText } from 'lucide-react'

interface ChangeOrderKPIsProps {
  totalChangeOrders?: number
  pendingApprovals?: number
  totalCostImpact?: number
}

export default function ChangeOrderKPIs({
  totalChangeOrders = 0,
  pendingApprovals = 0,
  totalCostImpact = 0,
}: ChangeOrderKPIsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="p-3 bg-white rounded-lg border">
        <p className="text-xs text-gray-500">Change Orders</p>
        <p className="text-xl font-bold">{totalChangeOrders}</p>
      </div>
      <div className="p-3 bg-white rounded-lg border">
        <p className="text-xs text-gray-500">Pending</p>
        <p className="text-xl font-bold text-amber-600">{pendingApprovals}</p>
      </div>
      <div className="p-3 bg-white rounded-lg border">
        <p className="text-xs text-gray-500">Cost Impact</p>
        <p className="text-xl font-bold">${totalCostImpact.toLocaleString()}</p>
      </div>
    </div>
  )
}
