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

  // Fetch commitments & actuals after first paint so tab shows immediately
  const { summary, analytics } = useCommitmentsActualsData({
    accessToken,
    selectedCurrency,
    deferMs: 150
  })

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-red-500 dark:text-red-400" />
      case 'down': return <TrendingDown className="h-4 w-4 text-green-500 dark:text-green-400" />
      default: return <Minus className="h-4 w-4 text-gray-500 dark:text-slate-400" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-red-600 dark:text-red-400'
      case 'down': return 'text-green-600 dark:text-green-400'
      default: return 'text-gray-600 dark:text-slate-400'
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
    <div className="w-full max-w-full space-y-4">
      {/* View Toggle */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">{t('financials.analysisView')}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('project-budgets')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'project-budgets'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('financials.projectBudgets')}
            </button>
            <button
              onClick={() => setViewMode('commitments-actuals')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
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
          {/* Performance Overview - Karten + Chart volle Breite */}
          <div className="bg-white dark:bg-slate-800 p-3 xl:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('financials.performanceOverview')}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 xl:gap-3 mb-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 xl:p-3 text-center border border-blue-100 dark:border-blue-800/50">
                <div className="text-lg xl:text-xl font-bold text-blue-600 dark:text-blue-400">
                  {(summary.totalCommitments / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{t('financials.commitments')}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 xl:p-3 text-center border border-red-100 dark:border-red-800/50">
                <div className="text-lg xl:text-xl font-bold text-red-600 dark:text-red-400">
                  {(summary.totalActuals / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{t('financials.actuals')}</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2.5 xl:p-3 text-center border border-purple-100 dark:border-purple-800/50">
                <div className="text-lg xl:text-xl font-bold text-purple-600 dark:text-purple-400">
                  {(summary.totalSpend / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{t('financials.combinedTotal')}</div>
              </div>
              <div className={`rounded-lg p-2.5 xl:p-3 text-center border ${
                summary.totalActuals <= summary.totalCommitments
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/50'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50'
              }`}>
                <div className={`text-lg xl:text-xl font-bold ${
                  summary.totalActuals <= summary.totalCommitments ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {((summary.totalActuals / summary.totalCommitments) * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{t('financials.spendRate')}</div>
              </div>
            </div>

            {/* Variance Chart - volle Breite, feste Höhe */}
            <div className="min-w-0">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={varianceChartData.slice(0, 10)}>
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={72} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number | undefined) => `${(value || 0).toLocaleString()} ${selectedCurrency}`} />
                <Legend />
                <Bar dataKey="commitments" fill="#3B82F6" name={t('financials.commitments')} />
                <Bar dataKey="actuals" fill="#EF4444" name={t('financials.actuals')} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* Category Analysis - Chart + Tabelle nebeneinander auf xl */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 p-3 xl:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('financials.spendingByCategory')}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.categoryData.slice(0, 8)}>
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={72} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number | undefined) => `${(value || 0).toLocaleString()} ${selectedCurrency}`} />
                  <Legend />
                  <Bar dataKey="commitments" fill="#3B82F6" name={t('financials.commitments')} />
                  <Bar dataKey="actuals" fill="#EF4444" name={t('financials.actuals')} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Table */}
            <div className="bg-white dark:bg-slate-800 p-3 xl:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('financials.categoryPerformance')}</h3>
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {analytics.categoryData.slice(0, 8).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-700 rounded-md hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-slate-100 text-sm truncate">{item.name}</div>
                      <div className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">
                        {t('financials.commitments')}: {item.commitments.toLocaleString()} {selectedCurrency}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-slate-300">
                        {t('financials.actuals')}: {item.actuals.toLocaleString()} {selectedCurrency}
                      </div>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <div className={`text-sm font-bold ${
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
          <div className="bg-white dark:bg-slate-800 p-3 xl:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('financials.projectStatusDistribution')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {analytics.statusDistribution.map((status, index) => (
                <div key={index} className="p-2.5 xl:p-3 rounded-lg border border-gray-200 dark:border-slate-600" style={{ backgroundColor: `${status.color}15` }}>
                  <div className="text-xl xl:text-2xl font-bold" style={{ color: status.color }}>
                    {status.value}
                  </div>
                  <div className="text-xs font-medium text-gray-700 dark:text-slate-300">{status.name}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
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
            <div className="bg-white dark:bg-slate-800 p-3 xl:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('financials.budgetPerformanceOverview')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2.5 xl:p-3 text-center border border-green-100 dark:border-green-800/50">
                  <div className="text-xl xl:text-2xl font-bold text-green-600 dark:text-green-400">{budgetPerformance.on_track_projects}</div>
                  <div className="text-xs text-gray-600 dark:text-slate-400">{t('financials.onTrackProjects')}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-500">{t('financials.within5Variance')}</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2.5 xl:p-3 text-center border border-yellow-100 dark:border-yellow-800/50">
                  <div className="text-xl xl:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{budgetPerformance.at_risk_projects}</div>
                  <div className="text-xs text-gray-600 dark:text-slate-400">{t('financials.atRiskProjects')}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-500">{t('financials.fiveTo15Over')}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 xl:p-3 text-center border border-red-100 dark:border-red-800/50">
                  <div className="text-xl xl:text-2xl font-bold text-red-600 dark:text-red-400">{budgetPerformance.over_budget_projects}</div>
                  <div className="text-xs text-gray-600 dark:text-slate-400">{t('financials.overBudgetProjects')}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-500">{t('financials.moreThan15Over')}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800/50">
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">{t('financials.totalSavings')}</h4>
                  <div className="text-lg xl:text-xl font-bold text-green-600 dark:text-green-400">
                    {budgetPerformance.total_savings.toLocaleString()} {selectedCurrency}
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-500">{t('financials.fromUnderBudget')}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800/50">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">{t('financials.totalOverruns')}</h4>
                  <div className="text-lg xl:text-xl font-bold text-red-600 dark:text-red-400">
                    {budgetPerformance.total_overruns.toLocaleString()} {selectedCurrency}
                  </div>
                  <div className="text-xs text-red-700 dark:text-red-500">{t('financials.fromOverBudget')}</div>
                </div>
              </div>
            </div>
          )}

          {/* Cost Analysis by Category - Chart + Tabelle nebeneinander auf xl */}
          {costAnalysis.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-3 xl:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('financials.costAnalysisByCategory')}</h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-slate-200 mb-2">{t('financials.monthlyCostTrends')}</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={costAnalysis}>
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number | undefined) => `${(value || 0).toLocaleString()} ${selectedCurrency}`} />
                      <Bar dataKey="previous_month" fill="#94A3B8" name={t('financials.previousMonth')} />
                      <Bar dataKey="current_month" fill="#3B82F6" name={t('financials.currentMonth')} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-slate-200 mb-2">{t('financials.categoryPerformance')}</h4>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {costAnalysis.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-700 rounded-md">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-slate-100 text-sm truncate">{item.category}</div>
                          <div className="text-xs text-gray-600 dark:text-slate-400">
                            {item.current_month.toLocaleString()} {selectedCurrency}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
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
          <div className="bg-white dark:bg-slate-800 p-3 xl:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('financials.projectEfficiencyAnalysis')}</h3>
            {analyticsData && (analyticsData.totalSavings > 0 || analyticsData.totalOverruns > 0 || analyticsData.avgEfficiency > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 xl:p-3 rounded-lg text-center border border-blue-100 dark:border-blue-800/50">
                  <div className="text-lg xl:text-xl font-bold text-blue-600 dark:text-blue-400">{analyticsData.avgEfficiency.toFixed(1)}%</div>
                  <div className="text-xs text-blue-700 dark:text-blue-400">{t('financials.avgEfficiency')}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-2.5 xl:p-3 rounded-lg text-center border border-green-100 dark:border-green-800/50">
                  <div className="text-lg xl:text-xl font-bold text-green-600 dark:text-green-400">{analyticsData.totalSavings.toLocaleString()}</div>
                  <div className="text-xs text-green-700 dark:text-green-400">{t('financials.totalSavings')} ({selectedCurrency})</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-2.5 xl:p-3 rounded-lg text-center border border-red-100 dark:border-red-800/50">
                  <div className="text-lg xl:text-xl font-bold text-red-600 dark:text-red-400">{analyticsData.totalOverruns.toLocaleString()}</div>
                  <div className="text-xs text-red-700 dark:text-red-400">{t('financials.totalOverruns')} ({selectedCurrency})</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 dark:text-slate-400">
                <p className="text-base font-medium">{t('financials.noProjectBudgetData')}</p>
                <p className="text-xs mt-1">{t('financials.switchToCommitmentsActuals')}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
