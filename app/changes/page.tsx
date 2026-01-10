'use client'


import AppLayout from '../../components/shared/AppLayout'
import ChangeRequestManager from './components/ChangeRequestManager'
import { ResponsiveContainer } from '../../components/ui/molecules/ResponsiveContainer'

export default function ChangesPage() {
  return (
    <AppLayout>
      <ResponsiveContainer padding="md">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Change Management</h1>
          <p className="text-gray-600 mt-2">
            Manage project change requests, approvals, and implementation tracking
          </p>
        </div>
        <ChangeRequestManager />
      </ResponsiveContainer>
    </AppLayout>
  )
}