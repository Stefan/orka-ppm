'use client'

import Link from 'next/link'
import AppLayout from '../../components/shared/AppLayout'
import ChangeRequestManager from './components/ChangeRequestManager'
import ChangeOrderIntegration from './components/ChangeOrderIntegration'
import { ResponsiveContainer } from '../../components/ui/molecules/ResponsiveContainer'
import { FileText } from 'lucide-react'

export default function ChangesPage() {
  return (
    <AppLayout>
      <ResponsiveContainer padding="md">
        <div data-testid="changes-page">
          <div data-testid="changes-header" className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 data-testid="changes-title" className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Change Management
                </h1>
                <p className="text-gray-600 mt-2">
                  Manage project change requests, approvals, and implementation tracking
                </p>
              </div>
              <Link
                href="/changes/orders"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 self-start"
              >
                <FileText className="w-4 h-4" />
                Change Orders
              </Link>
            </div>
          </div>
          <div className="mb-6">
            <ChangeOrderIntegration />
          </div>
          <div data-testid="changes-list">
            <ChangeRequestManager />
          </div>
        </div>
      </ResponsiveContainer>
    </AppLayout>
  )
}