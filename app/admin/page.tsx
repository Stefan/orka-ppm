'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import AppLayout from '../../components/shared/AppLayout'
import { Users, Activity, Settings, Layers } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()

  return (
    <AppLayout>
      <div data-testid="admin-page" className="p-8">
        <div data-testid="admin-header" className="mb-8">
          <h1 data-testid="admin-title" className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">System administration and management</p>
        </div>

        <div data-testid="admin-dashboard" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => router.push('/admin/users')}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left"
          >
            <Users className="h-8 w-8 text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">User Management</h2>
            <p className="text-gray-600">Manage users, roles, and permissions</p>
          </button>

          <button
            onClick={() => router.push('/admin/performance')}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left"
          >
            <Activity className="h-8 w-8 text-green-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Performance</h2>
            <p className="text-gray-600">Monitor system performance and metrics</p>
          </button>

          <button
            onClick={() => router.push('/admin/navigation-stats')}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left"
          >
            <Settings className="h-8 w-8 text-purple-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Navigation Stats</h2>
            <p className="text-gray-600">View navigation analytics and statistics</p>
          </button>

          <button
            onClick={() => router.push('/admin/features')}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left"
          >
            <Layers className="h-8 w-8 text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Feature catalog</h2>
            <p className="text-gray-600">Manage features overview and screenshots</p>
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
