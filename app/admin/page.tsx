'use client'

import { useRouter } from 'next/navigation'
import AppLayout from '../../components/shared/AppLayout'
import { useTranslations } from '@/lib/i18n/context'
import { Users, Activity, Settings, Layers, ToggleLeft, MessageCircle, Building2, LogIn, GitBranch } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const { t } = useTranslations()

  return (
    <AppLayout>
      <div data-testid="admin-page" className="p-8">
        <div data-testid="admin-header" className="mb-8">
          <h1 data-testid="admin-title" className="text-3xl font-bold text-gray-900 dark:text-slate-100">{t('adminDashboard.title')}</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-2">{t('adminDashboard.subtitle')}</p>
        </div>

        <div data-testid="admin-dashboard" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => router.push('/admin/users')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('adminDashboard.userManagementTitle')}</h2>
            <p className="text-gray-600 dark:text-slate-400">{t('adminDashboard.userManagementDesc')}</p>
          </button>

          <button
            onClick={() => router.push('/admin/performance')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <Activity className="h-8 w-8 text-green-600 dark:text-green-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('adminDashboard.performanceTitle')}</h2>
            <p className="text-gray-600 dark:text-slate-400">{t('adminDashboard.performanceDesc')}</p>
          </button>

          <button
            onClick={() => router.push('/admin/navigation-stats')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <Settings className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('adminDashboard.navigationStatsTitle')}</h2>
            <p className="text-gray-600 dark:text-slate-400">{t('adminDashboard.navigationStatsDesc')}</p>
          </button>

          <button
            onClick={() => router.push('/admin/features')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <Layers className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('adminDashboard.featureCatalogTitle')}</h2>
            <p className="text-gray-600 dark:text-slate-400">{t('adminDashboard.featureCatalogDesc')}</p>
          </button>

          <button
            onClick={() => router.push('/admin/feature-toggles')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <ToggleLeft className="h-8 w-8 text-amber-600 dark:text-amber-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('adminDashboard.featureTogglesTitle')}</h2>
            <p className="text-gray-600 dark:text-slate-400">{t('adminDashboard.featureTogglesDesc')}</p>
          </button>

          <button
            onClick={() => router.push('/admin/help-analytics')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <MessageCircle className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('adminDashboard.helpChatAnalyticsTitle')}</h2>
            <p className="text-gray-600 dark:text-slate-400">{t('adminDashboard.helpChatAnalyticsDesc')}</p>
          </button>

          <button
            onClick={() => router.push('/admin/organizations')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <Building2 className="h-8 w-8 text-teal-600 dark:text-teal-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('adminDashboard.organisationsTitle')}</h2>
            <p className="text-gray-600 dark:text-slate-400">{t('adminDashboard.organisationsDesc')}</p>
          </button>

          <button
            onClick={() => router.push('/admin/workflow-builder')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <GitBranch className="h-8 w-8 text-violet-600 dark:text-violet-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('adminDashboard.workflowBuilderTitle')}</h2>
            <p className="text-gray-600 dark:text-slate-400">{t('adminDashboard.workflowBuilderDesc')}</p>
          </button>

          <button
            onClick={() => router.push('/admin/sso')}
            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow text-left"
          >
            <LogIn className="h-8 w-8 text-sky-600 dark:text-sky-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('adminDashboard.ssoTitle')}</h2>
            <p className="text-gray-600 dark:text-slate-400">{t('adminDashboard.ssoDesc')}</p>
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
