'use client'

import { useTranslations } from '../../../../lib/i18n/context'
import type { CommitmentsActualsSummary, CommitmentsActualsAnalytics } from '../../hooks/useCommitmentsActualsData'

interface CommitmentsActualsVarianceTableProps {
  selectedCurrency: string
  /** From shared Financials data context; when provided, no internal fetch. */
  summary?: CommitmentsActualsSummary | null
  analytics?: CommitmentsActualsAnalytics | null
  loading?: boolean
}

export default function CommitmentsActualsVarianceTable({
  selectedCurrency,
  summary = null,
  analytics = null,
  loading = false
}: CommitmentsActualsVarianceTableProps) {
  const { t } = useTranslations()

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (!analytics || !summary) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8">
        <p className="text-gray-500 dark:text-slate-400 text-center">No commitments & actuals data available</p>
      </div>
    )
  }

  const projectData = analytics.projectPerformanceData

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t('financials.varianceAnalysis')} ({projectData.length} {t('financials.projects')})
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-slate-400">
            <span>{t('financials.allAmountsIn')} {selectedCurrency}</span>
            <span>•</span>
            <span>Commitments vs Actuals</span>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('financials.project')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Commitments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('financials.actual')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('financials.variance')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('financials.variancePercent')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Spend Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('financials.status')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {projectData.map((project, index) => {
              const spendRate = project.spend_percentage
              const isOverCommitment = spendRate > 100
              const isUnderUtilized = spendRate < 50
              
              return (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {project.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                    {project.commitments.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                    {project.actuals.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={project.variance >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                      {project.variance >= 0 ? '+' : ''}{project.variance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={project.variance_percentage >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                      {project.variance_percentage >= 0 ? '+' : ''}{project.variance_percentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className={`h-2 rounded-full ${
                            isOverCommitment ? 'bg-red-500' : 
                            isUnderUtilized ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(spendRate, 100)}%` }}
                        />
                      </div>
                      <span className={
                        isOverCommitment ? 'text-red-600 dark:text-red-400' : 
                        isUnderUtilized ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
                      }>
                        {spendRate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      isOverCommitment ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                      isUnderUtilized ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                      'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    }`}>
                      {isOverCommitment ? t('financials.overBudgetStatus') :
                       isUnderUtilized ? t('financials.underUtilized') : 
                       t('financials.onBudgetStatus')}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {/* Table Summary - Improved Layout */}
      <div className="px-6 py-6 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Commitments */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('financials.totalCommitments')}
              </span>
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {summary.totalCommitments.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{selectedCurrency}</div>
          </div>

          {/* Total Actuals */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('financials.totalActuals')}
              </span>
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {summary.totalActuals.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{selectedCurrency} {t('financials.spent')}</div>
          </div>

          {/* Remaining */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('financials.remaining')}
              </span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                summary.totalCommitments > summary.totalActuals 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                <svg className={`w-4 h-4 ${
                  summary.totalCommitments > summary.totalActuals 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className={`text-2xl font-bold ${
              summary.totalCommitments > summary.totalActuals 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {(summary.totalCommitments - summary.totalActuals).toLocaleString()}
            </div>
            <div className={`text-xs mt-1 font-medium ${
              summary.totalCommitments > summary.totalActuals 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {summary.totalCommitments > summary.totalActuals 
                ? t('financials.underCommitments') 
                : t('financials.overCommitments')}
            </div>
          </div>

          {/* Spend Rate */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('financials.overallSpendRate')}
              </span>
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {((summary.totalActuals / summary.totalCommitments) * 100).toFixed(1)}%
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(((summary.totalActuals / summary.totalCommitments) * 100), 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {summary.totalActuals.toLocaleString()} of {summary.totalCommitments.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
