'use client'


import AppLayout from '../../components/AppLayout'
import ChangeRequestManager from './components/ChangeRequestManager'

export default function ChangesPage() {
  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Change Management</h1>
          <p className="text-gray-600 mt-2">
            Manage project change requests, approvals, and implementation tracking
          </p>
        </div>
        <ChangeRequestManager />
      </div>
    </AppLayout>
  )
}