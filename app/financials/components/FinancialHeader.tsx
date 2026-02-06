
import { AlertTriangle, Filter, Download, Edit } from 'lucide-react'
import { FinancialMetrics, AnalyticsData } from '../types'
import { useTranslations } from '../../../lib/i18n/context'
import PermissionGuard from '../../../components/auth/PermissionGuard'

interface FinancialHeaderProps {
  metrics: FinancialMetrics | null
  analyticsData: AnalyticsData | null
  selectedCurrency: string
  showFilters: boolean
  onCurrencyChange: (currency: string) => void
  onToggleFilters: () => void
  onExport?: () => void
  onEditBudget?: () => void
}

export default function FinancialHeader({
  metrics,
  analyticsData,
  selectedCurrency,
  showFilters: _showFilters,
  onCurrencyChange,
  onToggleFilters,
  onExport,
  onEditBudget
}: FinancialHeaderProps) {
  const { t } = useTranslations()
  
  return (
    <div className="flex justify-between items-start">
      <div>
        <div className="flex items-center space-x-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">{t('financials.title')}</h1>
          {analyticsData && analyticsData.criticalAlerts > 0 && (
            <div className="flex items-center px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {analyticsData.criticalAlerts} {analyticsData.criticalAlerts === 1 ? t('financials.criticalAlert') : t('financials.criticalAlerts')}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-slate-400">
          {metrics && (
            <>
              <span>{t('financials.totalBudget')}: {metrics.total_budget.toLocaleString()} {selectedCurrency}</span>
              <span>{t('financials.variance')}: {metrics.variance_percentage.toFixed(1)}%</span>
              <span>{analyticsData?.totalProjects} {t('financials.projectsTracked')}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <select
          value={selectedCurrency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800 text-sm"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
        
        {onExport && (
          <PermissionGuard permission="financial_read">
            <button
              onClick={onExport}
              className="flex items-center px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm"
              title="Export Financial Report"
            >
              <Download className="h-4 w-4 mr-1" />
              {t('common.export')}
            </button>
          </PermissionGuard>
        )}
        
        {onEditBudget && (
          <PermissionGuard permission="financial_update">
            <button
              onClick={onEditBudget}
              className="flex items-center px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm"
              title="Edit Budget"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit Budget
            </button>
          </PermissionGuard>
        )}
        
        <button
          onClick={onToggleFilters}
          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Filter className="h-4 w-4 mr-1" />
          {t('common.filters')}
        </button>
      </div>
    </div>
  )
}