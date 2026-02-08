'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'

export default function ChangeOrderIntegration() {
  const { t } = useTranslations()
  return (
    <div data-testid="change-order-integration" className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('changes.changeOrderIntegration.title')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            {t('changes.changeOrderIntegration.description')}
          </p>
        </div>
        <Link
          href="/changes/orders"
          className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors self-start"
        >
          <FileText className="w-4 h-4" />
          {t('changes.changeOrderIntegration.openChangeOrders')}
        </Link>
      </div>
    </div>
  )
}
