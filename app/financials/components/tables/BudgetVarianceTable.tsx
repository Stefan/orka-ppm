'use client'

import { Project, BudgetVariance, AnalyticsData } from '../../types'
import { useTranslations } from '../../../../lib/i18n/context'

interface BudgetVarianceTableProps {
  budgetVariances: BudgetVariance[]
  projects: Project[]
  selectedCurrency: string
  analyticsData: AnalyticsData | null
}

export default function BudgetVarianceTable({ 
  budgetVariances, 
  projects, 
  selectedCurrency, 
  analyticsData 
}: BudgetVarianceTableProps) {
  const { t } = useTranslations()
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t('financials.varianceAnalysis')} ({budgetVariances.length} {t('financials.projects')})
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-slate-400">
            <span>{t('financials.allAmountsIn')} {selectedCurrency}</span>
            {analyticsData && (
              <>
                <span>•</span>
                <span>{t('financials.avgEfficiency')}: {analyticsData.avgEfficiency.toFixed(1)}%</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('financials.project')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('financials.budget')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('financials.actual')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('financials.variance')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('financials.variancePercent')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('financials.efficiency')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('financials.status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('financials.health')}</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {budgetVariances
              .sort((a, b) => Math.abs(b.variance_percentage || 0) - Math.abs(a.variance_percentage || 0))
              .map((variance) => {
                const project = projects.find(p => p.id === variance.project_id)
                const totalPlanned = variance.total_planned ?? 0
                const totalActual = variance.total_actual ?? 0
                const varianceAmount = variance.variance_amount ?? 0
                const variancePercentage = variance.variance_percentage ?? 0
                const efficiency = totalPlanned > 0 ? 
                  Math.max(0, 100 - Math.abs(variancePercentage)) : 0
                
                return (
                  <tr key={variance.project_id} className="hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {project?.name || t('financials.unknownProject')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                      {totalPlanned.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                      {totalActual.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={varianceAmount >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                        {varianceAmount >= 0 ? '+' : ''}{varianceAmount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={variancePercentage >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                        {variancePercentage >= 0 ? '+' : ''}{variancePercentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`h-2 rounded-full ${
                              efficiency >= 80 ? 'bg-green-500' : 
                              efficiency >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(efficiency, 100)}%` }}
                          >
                          </div>
                        </div>
                        <span className={
                          efficiency >= 80 ? 'text-green-600 dark:text-green-400' : 
                          efficiency >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                        }
                        >
                          {efficiency.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        variance.status === 'over_budget' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                        variance.status === 'under_budget' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                      }`}
                      >
                        {variance.status === 'over_budget' ? t('financials.overBudgetStatus') :
                         variance.status === 'under_budget' ? t('financials.underBudgetStatus') : 
                         t('financials.onBudgetStatus')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        project?.health === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        project?.health === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                        project?.health === 'red' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                        'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
                      }`}
                      >
                        {project?.health === 'green' ? t('financials.good') :
                         project?.health === 'yellow' ? t('financials.warningStatus') :
                         project?.health === 'red' ? t('financials.critical') : 
                         t('financials.unknown')}
                      </span>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
      
      {/* Table Summary */}
      {analyticsData && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-slate-400">{t('financials.totalSavings')}:</span>
              <div className="font-semibold text-green-600 dark:text-green-400">
                {analyticsData.totalSavings.toLocaleString()} {selectedCurrency}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-slate-400">{t('financials.totalOverruns')}:</span>
              <div className="font-semibold text-red-600 dark:text-red-400">
                {analyticsData.totalOverruns.toLocaleString()} {selectedCurrency}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-slate-400">{t('financials.netVariance')}:</span>
              <div className={`font-semibold ${analyticsData.netVariance >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {analyticsData.netVariance >= 0 ? '+' : ''}{analyticsData.netVariance.toLocaleString()} {selectedCurrency}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-slate-400">{t('financials.portfolioEfficiency')}:</span>
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                {analyticsData.avgEfficiency.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}