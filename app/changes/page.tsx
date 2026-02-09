'use client'

import Link from 'next/link'
import AppLayout from '../../components/shared/AppLayout'
import ChangeRequestManager from './components/ChangeRequestManager'
import ChangeOrderIntegration from './components/ChangeOrderIntegration'
import { ResponsiveContainer } from '../../components/ui/molecules/ResponsiveContainer'
import { useTranslations } from '@/lib/i18n/context'
import { FileText } from 'lucide-react'

export default function ChangesPage() {
  const { t } = useTranslations()
  return (
    <AppLayout>
      <ResponsiveContainer padding="md" className="min-w-0">
        <div data-testid="changes-page" className="min-w-0">
          <div data-testid="changes-header" className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 data-testid="changes-title" className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">
                  {t('changes.title')}
                </h1>
                <p className="text-gray-600 dark:text-slate-400 mt-2">
                  {t('changes.pageDescription')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 self-start">
                <Link
                  href="/changes/pending"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  My Pending Approvals
                </Link>
                <Link
                  href="/changes/orders"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <FileText className="w-4 h-4" />
                  {t('changes.changeOrders')}
                </Link>
              </div>
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