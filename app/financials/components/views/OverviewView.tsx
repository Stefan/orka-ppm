'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from '@/lib/i18n/context'
import { ChevronLeft, ChevronRight, List, BarChart2 } from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart
} from 'recharts'
import { AnalyticsData } from '../../types'
import type { FinancialMetrics as FinancialMetricsType } from '../../types'
import type { CommitmentsActualsSummary, CommitmentsActualsAnalytics } from '../../hooks/useCommitmentsActualsData'
import CommitmentsActualsSummaryCard from '../CommitmentsActualsSummaryCard'
import FinancialMetrics from '../FinancialMetrics'

const PROJECTS_PAGE_SIZE = 20

interface OverviewViewProps {
  analyticsData: AnalyticsData
  selectedCurrency: string
  accessToken?: string
  totalProjectBudget?: number
  metrics?: FinancialMetricsType | null
  /** When set, charts use only portfolio-scoped analyticsData (project budget), not global commitments/actuals. */
  portfolioId?: string | null
  /** From shared Financials data context (single fetch). */
  commitmentsSummary?: CommitmentsActualsSummary | null
  commitmentsAnalytics?: CommitmentsActualsAnalytics | null
  /** When a portfolio is selected: sum of actuals from Actuals table for that portfolio's projects. Shown in KPI instead of metrics.total_actual when set. */
  portfolioActualsTotal?: number | null
}

export default function OverviewView({
  analyticsData,
  selectedCurrency,
  accessToken,
  totalProjectBudget,
  metrics,
  portfolioId,
  commitmentsSummary: summary = null,
  commitmentsAnalytics: analytics = null,
  portfolioActualsTotal = null
}: OverviewViewProps) {
  const t = useTranslations('financials')
  const usePortfolioScopedCharts = Boolean(portfolioId)
  const portfolioActuals = usePortfolioScopedCharts ? (portfolioActualsTotal ?? metrics?.total_actual ?? 0) : 0
  const portfolioBudget = usePortfolioScopedCharts ? (metrics?.total_budget ?? 0) : 0
  const hasPortfolioTotals = portfolioActuals > 0 || portfolioBudget > 0
  const displayActuals = usePortfolioScopedCharts
    ? (hasPortfolioTotals ? portfolioActuals : (summary?.totalActuals ?? 0))
    : (summary?.totalActuals ?? 0)
  const displayBudget = usePortfolioScopedCharts
    ? (hasPortfolioTotals ? portfolioBudget : (summary?.totalCommitments ?? 0))
    : (summary?.totalCommitments ?? 0)
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

  // When a portfolio is selected, use only portfolio-scoped analyticsData for charts. Otherwise prefer commitments/actuals when available.
  const displayCategoryData = usePortfolioScopedCharts
    ? analyticsData.categoryData
    : (analytics?.categoryData.length
      ? analytics.categoryData.map(c => {
          const spendRate = c.commitments > 0 ? (c.actuals / c.commitments * 100) : 0
          let efficiency = 0
          if (spendRate >= 80 && spendRate <= 100) efficiency = 100
          else if (spendRate > 100) efficiency = Math.max(0, 100 - (spendRate - 100))
          else efficiency = (spendRate / 80) * 100
          return {
            name: c.name,
            planned: c.commitments,
            actual: c.actuals,
            variance: c.variance,
            variance_percentage: c.variance_percentage,
            efficiency: Math.min(100, Math.max(0, efficiency))
          }
        })
      : analyticsData.categoryData)

  const displayProjectData = usePortfolioScopedCharts
    ? analyticsData.projectPerformanceData
    : (analytics?.projectPerformanceData.length
      ? analytics.projectPerformanceData.map(p => {
          let efficiency_score = 0
          if (p.spend_percentage >= 80 && p.spend_percentage <= 100) efficiency_score = 100
          else if (p.spend_percentage > 100) efficiency_score = Math.max(0, 100 - (p.spend_percentage - 100))
          else efficiency_score = (p.spend_percentage / 80) * 100
          return {
            name: p.name,
            budget: p.commitments,
            actual: p.actuals,
            variance: p.variance,
            variance_percentage: p.variance_percentage,
            health: p.spend_percentage > 100 ? 'red' : p.spend_percentage > 80 ? 'yellow' : 'green',
            efficiency_score: Math.min(100, Math.max(0, efficiency_score))
          }
        })
      : analyticsData.projectPerformanceData)

  const displayStatusData = usePortfolioScopedCharts
    ? analyticsData.budgetStatusData
    : (analytics?.statusDistribution.length ? analytics.statusDistribution : analyticsData.budgetStatusData)

  // List vs chart for project performance; list is default
  const [projectsPerformanceView, setProjectsPerformanceView] = useState<'list' | 'chart'>('list')
  // Pagination for project performance list/chart
  const [projectsPage, setProjectsPage] = useState(0)
  const totalProjects = displayProjectData.length
  const totalProjectPages = Math.max(1, Math.ceil(totalProjects / PROJECTS_PAGE_SIZE))
  const paginatedProjectData = displayProjectData.slice(
    projectsPage * PROJECTS_PAGE_SIZE,
    (projectsPage + 1) * PROJECTS_PAGE_SIZE
  )
  useEffect(() => {
    setProjectsPage(0)
  }, [totalProjects])

  return (
    <div className="space-y-6">
      {/* Quick Summary Bar - Compact */}
      <div
        data-financials-kpi-card
        className="rounded-lg p-4 border border-gray-200 dark:border-slate-700 bg-[linear-gradient(to_right,#eff6ff,#faf5ff)]"
        ref={(el) => {
          // Apply dark mode styles via JS (Tailwind v4 gradient/border classes can be overridden)
          if (el && typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
            el.style.setProperty('background', '#1e293b', 'important');
            el.style.setProperty('border-color', '#334155', 'important'); // slate-700
          }
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-600 dark:text-slate-300 mb-1">
              {usePortfolioScopedCharts
                ? 'Projects'
                : summary && summary.totalProjectsWithActivity > summary.projectCount
                  ? 'Projects (top by spend)'
                  : 'Projects'}
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {usePortfolioScopedCharts
                ? (analyticsData.totalProjects ?? 0)
                : (summary?.projectCount ?? 0)}
              {!usePortfolioScopedCharts && summary && summary.totalProjectsWithActivity > summary.projectCount && (
                <span className="text-sm font-normal text-gray-500 dark:text-slate-400 ml-1">
                  of {(summary.totalProjectsWithActivity).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 dark:text-slate-300 mb-1">
              {usePortfolioScopedCharts ? 'Budget' : 'Commitments'}
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">
              {(displayBudget / 1000000).toFixed(1)}M
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 dark:text-slate-300 mb-1">Actuals</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-300">
              {(displayActuals / 1000000).toFixed(1)}M
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 dark:text-slate-300 mb-1">Spend Rate</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">
              {displayBudget > 0 ? ((displayActuals / displayBudget) * 100).toFixed(0) : '0'}%
            </div>
          </div>
        </div>
      </div>

      {/* Financial Metrics – Gesamtbudget, Gesamt ausgegeben, Varianz, etc. (directly under KPI card) */}
      {metrics && (
        <div data-testid="financials-metrics">
          <FinancialMetrics metrics={metrics} selectedCurrency={selectedCurrency} />
        </div>
      )}

      {/* Existing Charts */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Enhanced Budget Status Distribution - 1/3 width */}
        <div
          className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 lg:w-1/3"
          style={{ contain: 'layout style paint' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Budget Status Distribution</h3>
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {summary
                ? (summary.totalProjectsWithActivity > summary.projectCount
                  ? `Top ${summary.projectCount} of ${summary.totalProjectsWithActivity.toLocaleString()} projects (by spend)`
                  : `${summary.projectCount} projects`)
                : `${analyticsData.totalProjects} projects`}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={displayStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }: any) => `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {displayStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category Spending: WBS/Cost Center breakdown (all data), top 8 */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 lg:w-2/3">
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('spendingByCategory')}</h3>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {!usePortfolioScopedCharts && analytics ? 'Commitments vs Actuals' : 'Planned vs Actual'}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400">{t('categorySpendingChartDescription')}</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={displayCategoryData}>
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number | undefined) => `${(value || 0).toLocaleString()} ${selectedCurrency}`} />
              <Legend />
              <Bar dataKey="planned" fill="#3B82F6" name={!usePortfolioScopedCharts && analytics ? "Commitments" : "Planned"} />
              <Bar dataKey="actual" fill="#EF4444" name="Actuals" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Project Performance - Full Width (list default, chart optional) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Project Performance Overview</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-slate-400">
              <span>{totalProjects} projects</span>
              {summary && summary.totalProjectsWithActivity > (summary.projectCount || 0) && (
                <span className="text-gray-500 dark:text-slate-500">(of {(summary.totalProjectsWithActivity).toLocaleString()} by spend)</span>
              )}
              {!usePortfolioScopedCharts && analytics && (
                <>
                  <span>•</span>
                  <span>By variance</span>
                </>
              )}
            </div>
            <div className="flex rounded-lg border border-gray-300 dark:border-slate-600 p-0.5 bg-gray-100 dark:bg-slate-700/50">
              <button
                type="button"
                onClick={() => setProjectsPerformanceView('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${projectsPerformanceView === 'list' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'}`}
                aria-pressed={projectsPerformanceView === 'list'}
              >
                <List className="h-4 w-4" /> List
              </button>
              <button
                type="button"
                onClick={() => setProjectsPerformanceView('chart')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${projectsPerformanceView === 'chart' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'}`}
                aria-pressed={projectsPerformanceView === 'chart'}
              >
                <BarChart2 className="h-4 w-4" /> Chart
              </button>
            </div>
          </div>
        </div>
        {projectsPerformanceView === 'list' ? (
          <>
            <div className="overflow-x-auto -mx-6">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{!usePortfolioScopedCharts && analytics ? 'Commitments' : 'Budget'}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Actuals</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Variance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Variance %</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Efficiency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {paginatedProjectData.map((row, index) => (
                    <tr key={`${row.name}-${index}`} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">{row.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 dark:text-slate-100 text-right whitespace-nowrap">{(row.budget ?? 0).toLocaleString()} {selectedCurrency}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 dark:text-slate-100 text-right whitespace-nowrap">{(row.actual ?? 0).toLocaleString()} {selectedCurrency}</td>
                      <td className="px-6 py-3 text-sm text-right whitespace-nowrap">{((row.variance as number) ?? 0).toLocaleString()} {selectedCurrency}</td>
                      <td className="px-6 py-3 text-sm text-right whitespace-nowrap">{((row.variance_percentage as number) ?? 0).toFixed(1)}%</td>
                      <td className="px-6 py-3 text-sm text-right whitespace-nowrap">{(row.efficiency_score ?? 0).toFixed(1)}%</td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${row.health === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : row.health === 'yellow' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {row.health === 'green' ? 'On track' : row.health === 'yellow' ? 'Watch' : 'Over'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalProjectPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  Page {projectsPage + 1} of {totalProjectPages} ({PROJECTS_PAGE_SIZE} per page)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProjectsPage(p => Math.max(0, p - 1))}
                    disabled={projectsPage === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectsPage(p => Math.min(totalProjectPages - 1, p + 1))}
                    disabled={projectsPage >= totalProjectPages - 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={paginatedProjectData}>
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number | undefined, name: string | undefined) => {
                    const safeValue = value || 0
                    const safeName = name || ''
                    if (safeName === 'Efficiency Score') return [`${safeValue.toFixed(1)}%`, safeName]
                    return [`${safeValue.toLocaleString()} ${selectedCurrency}`, safeName]
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="budget" fill="#3B82F6" name={!usePortfolioScopedCharts && analytics ? "Commitments" : "Budget"} />
                <Bar yAxisId="left" dataKey="actual" fill="#EF4444" name="Actuals" />
                <Bar yAxisId="right" dataKey="efficiency_score" fill="#10B981" name="Efficiency Score" />
              </ComposedChart>
            </ResponsiveContainer>
            {totalProjectPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  Page {projectsPage + 1} of {totalProjectPages} ({PROJECTS_PAGE_SIZE} per page)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProjectsPage(p => Math.max(0, p - 1))}
                    disabled={projectsPage === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectsPage(p => Math.min(totalProjectPages - 1, p + 1))}
                    disabled={projectsPage >= totalProjectPages - 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}