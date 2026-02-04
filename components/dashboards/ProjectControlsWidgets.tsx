'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'

interface ProjectControlsWidgetsProps {
  projectIds: string[]
}

export default function ProjectControlsWidgets({ projectIds }: ProjectControlsWidgetsProps) {
  const [summary, setSummary] = useState<{ etc: number; eac: number } | null>(null)

  useEffect(() => {
    if (projectIds.length === 0) return
    const load = async () => {
      try {
        const { projectControlsApi } = await import('@/lib/project-controls-api')
        let etc = 0, eac = 0
        for (const pid of projectIds.slice(0, 3)) {
          try {
            const [e1, e2] = await Promise.all([
              projectControlsApi.getETC(pid).catch(() => null),
              projectControlsApi.getEAC(pid).catch(() => null),
            ])
            if (e1?.result_value) etc += Number(e1.result_value)
            if (e2?.result_value) eac += Number(e2.result_value)
          } catch {
            // skip
          }
        }
        setSummary({ etc, eac })
      } catch {
        setSummary(null)
      }
    }
    load()
  }, [projectIds.join(',')])

  if (!summary || (summary.etc === 0 && summary.eac === 0)) return null

  return (
    <Link
      href="/project-controls"
      className="block p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 text-gray-700">
        <BarChart3 className="w-5 h-5" />
        <span className="font-medium">Project Controls</span>
      </div>
      <div className="mt-2 flex gap-4 text-sm">
        <span>ETC: ${summary.etc.toLocaleString()}</span>
        <span className="font-medium">EAC: ${summary.eac.toLocaleString()}</span>
      </div>
    </Link>
  )
}
