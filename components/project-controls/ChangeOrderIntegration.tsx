'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'

interface ChangeOrderIntegrationProps {
  projectId: string
  approvedCostImpact?: number
}

export default function ChangeOrderIntegration({ projectId, approvedCostImpact }: ChangeOrderIntegrationProps) {
  return (
    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border">
      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Change Orders
      </h4>
      {approvedCostImpact !== undefined && approvedCostImpact > 0 && (
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
          Approved impact: ${approvedCostImpact.toLocaleString()}
        </p>
      )}
      <Link
        href={`/changes/orders/${projectId}`}
        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block"
      >
        Manage →
      </Link>
    </div>
  )
}
