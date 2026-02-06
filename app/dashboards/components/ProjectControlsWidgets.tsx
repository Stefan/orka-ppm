'use client'

import Link from 'next/link'
import { Sliders } from 'lucide-react'

interface ProjectControlsWidgetsProps {
  projectIds: string[]
}

export default function ProjectControlsWidgets({ projectIds }: ProjectControlsWidgetsProps) {
  return (
    <div data-testid="project-controls-widgets" className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
          <Sliders className="w-4 h-4" />
          Project Controls
        </h3>
        <Link href="/projects" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Open
        </Link>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
        {projectIds.length} project{projectIds.length !== 1 ? 's' : ''} for controls
      </p>
    </div>
  )
}
