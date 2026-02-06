'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'

interface ChangeOrderIntegrationProps {
  projectId?: string
}

export default function ChangeOrderIntegration({ projectId }: ChangeOrderIntegrationProps) {
  return (
    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
      <h4 className="text-sm font-medium text-indigo-900 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Change Orders
      </h4>
      <p className="text-sm text-indigo-700 mt-1">
        Formal change orders with cost impact analysis and approval workflows.
      </p>
      <Link
        href={projectId ? `/changes/orders/${projectId}` : '/changes/orders'}
        className="inline-block mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800"
      >
        Manage Change Orders →
      </Link>
    </div>
  )
}
