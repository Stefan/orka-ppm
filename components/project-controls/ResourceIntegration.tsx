'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'

interface ResourceIntegrationProps {
  projectId: string
  plannedHours?: number
  estimatedCost?: number
}

export default function ResourceIntegration({
  projectId,
  plannedHours = 0,
  estimatedCost = 0,
}: ResourceIntegrationProps) {
  return (
    <div className="p-3 bg-white rounded-lg border">
      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Users className="w-4 h-4" />
        Resource Forecast
      </h4>
      {(plannedHours > 0 || estimatedCost > 0) && (
        <div className="mt-2 text-sm">
          <p>Hours: {plannedHours.toLocaleString()}</p>
          <p className="font-medium">Est. cost: ${estimatedCost.toLocaleString()}</p>
        </div>
      )}
      <Link
        href={`/resources?project=${projectId}`}
        className="text-xs text-indigo-600 hover:underline mt-2 inline-block"
      >
        Manage resources →
      </Link>
    </div>
  )
}
