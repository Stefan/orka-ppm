'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'

interface ChangeOrderWidgetsProps {
  projectIds: string[]
}

export default function ChangeOrderWidgets({ projectIds }: ChangeOrderWidgetsProps) {
  return (
    <div data-testid="change-order-widgets" className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Change Orders
        </h3>
        <Link href="/changes/orders" className="text-xs font-medium text-blue-600 hover:underline">
          Open
        </Link>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {projectIds.length} project{projectIds.length !== 1 ? 's' : ''} available for change orders
      </p>
    </div>
  )
}
