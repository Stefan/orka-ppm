'use client'

import Link from 'next/link'
import { BarChart3 } from 'lucide-react'

interface ProjectControlsReportsProps {
  projectId?: string
}

export default function ProjectControlsReports({ projectId }: ProjectControlsReportsProps) {
  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border">
      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 flex items-center gap-2">
        <BarChart3 className="w-4 h-4" />
        Project Controls Reports
      </h4>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
        ETC/EAC, earned value, variance, and performance analytics.
      </p>
      <Link
        href={projectId ? `/project-controls?project=${projectId}` : '/project-controls'}
        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block"
      >
        View reports →
      </Link>
    </div>
  )
}
