'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/shared/AppLayout'
import { ResponsiveContainer } from '@/components/ui/molecules/ResponsiveContainer'
import { loadDashboardData, type Project } from '@/lib/api/dashboard-loader'
import { FileText } from 'lucide-react'

export default function ChangeOrdersPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
      .then((data) => setProjects(data.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout>
      <ResponsiveContainer padding="md">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Change Orders</h1>
            <p className="text-gray-600 dark:text-slate-400 mt-1">
              Select a project to manage formal change orders with cost impact analysis
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : projects.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-lg border">
              No projects found. Create a project first to manage change orders.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/changes/orders/${project.id}`}
                  className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-lg border hover:border-indigo-300 hover:shadow-md transition-shadow"
                >
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-slate-100 truncate">{project.name}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400 capitalize">{project.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </ResponsiveContainer>
    </AppLayout>
  )
}
