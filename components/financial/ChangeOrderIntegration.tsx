'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'

interface ChangeOrderIntegrationProps {
  projectId: string
  totalApprovedImpact?: number
}

export default function ChangeOrderIntegration({ projectId, totalApprovedImpact }: ChangeOrderIntegrationProps) {
  return (
    <div className="p-3 rounded-lg border bg-gray-50 dark:bg-slate-800/50">
      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Change Order Impact
      </h4>
      {totalApprovedImpact !== undefined && totalApprovedImpact > 0 && (
        <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 mt-1">
          ${totalApprovedImpact.toLocaleString()}
        </p>
      )}
      <Link
        href={`/changes/orders/${projectId}`}
        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block"
      >
        View change orders →
      </Link>
    </div>
  )
}
