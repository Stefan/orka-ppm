
import { DollarSign, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { FinancialMetrics } from '../types'
import { useTranslations } from '../../../lib/i18n/context'

interface FinancialMetricsProps {
  metrics: FinancialMetrics
  selectedCurrency: string
}

export default function FinancialMetricsComponent({ metrics, selectedCurrency }: FinancialMetricsProps) {
  const { t } = useTranslations()
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-slate-400">{t('financials.totalBudget')}</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {metrics.total_budget.toLocaleString()} {selectedCurrency}
            </p>
          </div>
          <DollarSign className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-slate-400">{t('financials.totalSpent')}</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {metrics.total_actual.toLocaleString()} {selectedCurrency}
            </p>
          </div>
          <Target className="h-8 w-8 text-purple-600 dark:text-purple-400" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-slate-400">{t('financials.variance')}</p>
            <p className={`text-2xl font-bold ${metrics.variance_percentage >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {metrics.variance_percentage >= 0 ? '+' : ''}{metrics.variance_percentage.toFixed(1)}%
            </p>
          </div>
          {metrics.variance_percentage >= 0 ? 
            <TrendingUp className="h-8 w-8 text-red-600 dark:text-red-400" /> : 
            <TrendingDown className="h-8 w-8 text-green-600 dark:text-green-400" />
          }
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-slate-400">{t('financials.avgUtilization')}</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {metrics.average_budget_utilization.toFixed(1)}%
            </p>
          </div>
          <Target className="h-8 w-8 text-orange-600 dark:text-orange-400" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-slate-400">{t('financials.overBudget')}</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {metrics.projects_over_budget}
            </p>
          </div>
          <TrendingUp className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-slate-400">{t('financials.underBudget')}</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {metrics.projects_under_budget}
            </p>
          </div>
          <TrendingDown className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
      </div>
    </div>
  )
}