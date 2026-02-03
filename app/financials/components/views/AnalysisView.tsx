'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts'
import { BudgetPerformanceMetrics, CostAnalysis, AnalyticsData } from '../../types'
import { useCommitmentsActualsData } from '../../hooks/useCommitmentsActualsData'
import { useTranslations } from '../../../../lib/i18n/context'

interface AnalysisViewProps {
  budgetPerformance: BudgetPerformanceMetrics | null
  costAnalysis: CostAnalysis[]
  analyticsData: AnalyticsData | null
  selectedCurrency: string
  accessToken?: string
}

export default function AnalysisView({ 
  budgetPerformance, 
  costAnalysis, 
  analyticsData, 
  selectedCurrency,
  accessToken
}: AnalysisViewProps) {
  const { t } = useTranslations()
  const [viewMode, setViewMode] = useState<'project-budgets' | 'commitments-actuals'>('commitments-actuals')
  
  // Dark mode detection for Recharts tooltips
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const checkDarkMode = () => setIsDark(document.documentElement.classList.contains('dark'))
    checkDarkMode()
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const tooltipStyle = isDark 
    ? { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }
    : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }

  // Fetch commitments & actuals data
  const { summary, analytics } = useCommitmentsActualsData({
    accessToken,
    selectedCurrency
  })

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'down': return <TrendingDown className="h-4 w-4 text-green-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-red-600'
      case 'down': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  // Prepare variance chart data for commitments vs actuals
  const varianceChartData = analytics?.projectPerformanceData.map(p => ({
    name: p.name,
    commitments: p.commitments,
    actuals: p.actuals,
    variance: Math.abs(p.variance)
  })) || []

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('financials.analysisView')}</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('project-budgets')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'project-budgets'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('financials.projectBudgets')}
            </button>
            <button
              onClick={() => setViewMode('commitments-actuals')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'commitments-actuals'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('financials.commitmentsAndActuals')}
            </button>
          </div>
        </div>
      </div>
      {/* Commitments & Actuals View */}
      {viewMode === 'commitments-actuals' && summary && analytics && (
        <>
          {/* Performance Overview - Compact */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('financials.performanceOverview')}</h3>
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {(summary.totalCommitments / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-gray-600 dark:text-slate-400">{t('financials.commitments')}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">
                    {(summary.totalActuals / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-gray-600 dark:text-slate-400">{t('financials.actuals')}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {(summary.totalSpend / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-gray-600 dark:text-slate-400">{t('financials.combinedTotal')}</div>
                </div>
                <div className="text-center">
                  <div className={`text-xl font-bold ${
                    summary.totalActuals <= summary.totalCommitments ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {((summary.totalActuals / summary.totalCommitments) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600 dark:text-slate-400">{t('financials.spendRate')}</div>
                </div>
              </div>
            </div>

            {/* Variance Chart - Larger */}
            <ResponsiveContainer width="100%" height={450}>
              <BarChart data={varianceChartData.slice(0, 10)}>
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number | undefined) => `${(value || 0).toLocaleString()} ${selectedCurrency}`} />
                <Legend />
                <Bar dataKey="commitments" fill="#3B82F6" name={t('financials.commitments')} />
                <Bar dataKey="actuals" fill="#EF4444" name={t('financials.actuals')} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Analysis - Side by Side, Larger */}
          <div className="category-analysis-grid gap-6">
            {/* Category Chart */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('financials.spendingByCategory')}</h3>
              <ResponsiveContainer width="100%" height={450}>
                <BarChart data={analytics.categoryData.slice(0, 8)}>
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number | undefined) => `${(value || 0).toLocaleString()} ${selectedCurrency}`} />
                  <Legend />
                  <Bar dataKey="commitments" fill="#3B82F6" name={t('financials.commitments')} />
                  <Bar dataKey="actuals" fill="#EF4444" name={t('financials.actuals')} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Table */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('financials.categoryPerformance')}</h3>
              <div className="space-y-3 max-h-[450px] overflow-y-auto">
                {analytics.categoryData.slice(0, 8).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-slate-100 text-base">{item.name}</div>
                      <div className="text-sm text-gray-600 dark:text-slate-300 mt-1">
                        {t('financials.commitments')}: {item.commitments.toLocaleString()} {selectedCurrency}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        {t('financials.actuals')}: {item.actuals.toLocaleString()} {selectedCurrency}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-lg font-bold ${
                        item.variance < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {item.variance >= 0 ? '+' : ''}{item.variance_percentage.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">{t('financials.variance')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Project Status Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('financials.projectStatusDistribution')}</h3>
            
            <div className="project-status-grid gap-4">
              {analytics.statusDistribution.map((status, index) => (
                <div key={index} className="p-4 rounded-lg" style={{ backgroundColor: `${status.color}15` }}>
                  <div className="text-3xl font-bold" style={{ color: status.color }}>
                    {status.value}
                  </div>
                  <div className="text-sm font-medium text-gray-700">{status.name}</div>
                  <div className="text-xs text-gray-500">
                    {((status.value / summary.projectCount) * 100).toFixed(1)}% {t('financials.ofProjects')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Project Budgets View (Original) */}
      {viewMode === 'project-budgets' && (
        <>
          {/* Budget Performance Overview */}
          {budgetPerformance && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('financials.budgetPerformanceOverview')}</h3>
              
              <div className="budget-performance-grid gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{budgetPerformance.on_track_projects}</div>
                  <div className="text-sm text-gray-600">{t('financials.onTrackProjects')}</div>
                  <div className="text-xs text-gray-500">{t('financials.within5Variance')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">{budgetPerformance.at_risk_projects}</div>
                  <div className="text-sm text-gray-600">{t('financials.atRiskProjects')}</div>
                  <div className="text-xs text-gray-500">{t('financials.fiveTo15Over')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{budgetPerformance.over_budget_projects}</div>
                  <div className="text-sm text-gray-600">{t('financials.overBudgetProjects')}</div>
                  <div className="text-xs text-gray-500">{t('financials.moreThan15Over')}</div>
                </div>
              </div>

              {/* Savings vs Overruns */}
              <div className="savings-overruns-grid gap-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-green-800 mb-2">{t('financials.totalSavings')}</h4>
                  <div className="text-2xl font-bold text-green-600">
                    {budgetPerformance.total_savings.toLocaleString()} {selectedCurrency}
                  </div>
                  <div className="text-sm text-green-700">{t('financials.fromUnderBudget')}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-red-800 mb-2">{t('financials.totalOverruns')}</h4>
                  <div className="text-2xl font-bold text-red-600">
                    {budgetPerformance.total_overruns.toLocaleString()} {selectedCurrency}
                  </div>
                  <div className="text-sm text-red-700">{t('financials.fromOverBudget')}</div>
                </div>
              </div>
            </div>
          )}

          {/* Cost Analysis by Category */}
          {costAnalysis.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('financials.costAnalysisByCategory')}</h3>
              
              <div className="cost-analysis-grid gap-6">
                {/* Cost Trends Chart */}
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">{t('financials.monthlyCostTrends')}</h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={costAnalysis}>
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number | undefined) => `${(value || 0).toLocaleString()} ${selectedCurrency}`} />
                      <Bar dataKey="previous_month" fill="#94A3B8" name={t('financials.previousMonth')} />
                      <Bar dataKey="current_month" fill="#3B82F6" name={t('financials.currentMonth')} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Cost Analysis Table */}
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">{t('financials.categoryPerformance')}</h4>
                  <div className="space-y-3">
                    {costAnalysis.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{item.category}</div>
                          <div className="text-sm text-gray-600">
                            {item.current_month.toLocaleString()} {selectedCurrency}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getTrendIcon(item.trend)}
                          <span className={`font-medium ${getTrendColor(item.trend)}`}>
                            {item.percentage_change >= 0 ? '+' : ''}{item.percentage_change.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Project Efficiency Analysis */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('financials.projectEfficiencyAnalysis')}</h3>
            
            {analyticsData && (analyticsData.totalSavings > 0 || analyticsData.totalOverruns > 0 || analyticsData.avgEfficiency > 0) ? (
              <div className="efficiency-metrics-grid gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{analyticsData.avgEfficiency.toFixed(1)}%</div>
                  <div className="text-sm text-blue-700">{t('financials.avgEfficiency')}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{analyticsData.totalSavings.toLocaleString()}</div>
                  <div className="text-sm text-green-700">{t('financials.totalSavings')} ({selectedCurrency})</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600">{analyticsData.totalOverruns.toLocaleString()}</div>
                  <div className="text-sm text-red-700">{t('financials.totalOverruns')} ({selectedCurrency})</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-lg font-medium">{t('financials.noProjectBudgetData')}</p>
                <p className="text-sm mt-2">{t('financials.switchToCommitmentsActuals')}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
