'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'

interface ChangeOrderWidgetsProps {
  projectIds: string[]
}

export default function ChangeOrderWidgets({ projectIds }: ChangeOrderWidgetsProps) {
  return (
    <div data-testid="change-order-widgets" className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
      {/* Line 1: Title + Open */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2 flex-shrink-0">
          <FileText className="w-4 h-4" />
          Change Orders
        </h3>
        <Link href="/changes/orders" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0">
          Open
        </Link>
      </div>
      {/* Line 2: Subtitle */}
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 truncate">
        {projectIds.length} project{projectIds.length !== 1 ? 's' : ''} available for change orders
      </p>
    </div>
  )
}
