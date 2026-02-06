'use client'

import { useParams } from 'next/navigation'
import ChangeOrdersDashboard from '@/components/change-orders/ChangeOrdersDashboard'

export default function ChangeOrdersProjectPage() {
  const params = useParams()
  const projectId = params.projectId as string

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500 dark:text-slate-400">No project selected</p>
      </div>
    )
  }

  return <ChangeOrdersDashboard projectId={projectId} projectName="Project" />
}
