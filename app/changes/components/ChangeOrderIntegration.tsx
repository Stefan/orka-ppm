'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'

export default function ChangeOrderIntegration() {
  return (
    <div data-testid="change-order-integration" className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Change Orders
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage formal change orders with cost impact and approval workflows per project.
          </p>
        </div>
        <Link
          href="/changes/orders"
          className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors self-start"
        >
          <FileText className="w-4 h-4" />
          Open Change Orders
        </Link>
      </div>
    </div>
  )
}
