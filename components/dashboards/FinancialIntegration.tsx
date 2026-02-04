'use client'

import Link from 'next/link'
import { DollarSign } from 'lucide-react'

interface FinancialIntegrationProps {
  projectId?: string
}

export default function FinancialIntegration({ projectId }: FinancialIntegrationProps) {
  return (
    <div className="p-3 bg-white rounded-lg border">
      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <DollarSign className="w-4 h-4" />
        Financial Integration
      </h4>
      <p className="text-xs text-gray-500 mt-1">
        Project controls sync with financial tracking and budgets.
      </p>
      <Link
        href={projectId ? `/financials?project=${projectId}` : '/financials'}
        className="text-xs text-indigo-600 hover:underline mt-2 inline-block"
      >
        View financials →
      </Link>
    </div>
  )
}
