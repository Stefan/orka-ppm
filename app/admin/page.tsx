'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import { Users, Activity, Settings, Layers, ToggleLeft, MessageCircle } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()

  return (
    <AppLayout>
      <div data-testid="admin-page" className="p-8">
        <div data-testid="admin-header" className="mb-8">
          <h1 data-testid="admin-title" className="text-3xl font-bold text-gray-900 dark:text-slate-100">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-2">System administration and management</p>
        </div>

        <div data-testid="admin-dashboard" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => router.push('/admin/users')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">User Management</h2>
            <p className="text-gray-600 dark:text-slate-400">Manage users, roles, and permissions</p>
          </button>

          <button
            onClick={() => router.push('/admin/performance')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <Activity className="h-8 w-8 text-green-600 dark:text-green-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Performance</h2>
            <p className="text-gray-600 dark:text-slate-400">Monitor system performance and metrics</p>
          </button>

          <button
            onClick={() => router.push('/admin/navigation-stats')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <Settings className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Navigation Stats</h2>
            <p className="text-gray-600 dark:text-slate-400">View navigation analytics and statistics</p>
          </button>

          <button
            onClick={() => router.push('/admin/features')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <Layers className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Feature catalog</h2>
            <p className="text-gray-600 dark:text-slate-400">Manage features overview and screenshots</p>
          </button>

          <button
            onClick={() => router.push('/admin/feature-toggles')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <ToggleLeft className="h-8 w-8 text-amber-600 dark:text-amber-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Feature toggles</h2>
            <p className="text-gray-600 dark:text-slate-400">Enable or disable features globally or per organization</p>
          </button>

          <button
            onClick={() => router.push('/admin/help-analytics')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <MessageCircle className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Help Chat Analytics</h2>
            <p className="text-gray-600 dark:text-slate-400">View help chat usage, satisfaction, and top queries</p>
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
