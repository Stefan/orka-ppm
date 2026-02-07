'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart
} from 'recharts'
import { AnalyticsData } from '../../types'
import type { FinancialMetrics as FinancialMetricsType } from '../../types'
import CommitmentsActualsSummaryCard from '../CommitmentsActualsSummaryCard'
import FinancialMetrics from '../FinancialMetrics'
import { useCommitmentsActualsData } from '../../hooks/useCommitmentsActualsData'

interface OverviewViewProps {
  analyticsData: AnalyticsData
  selectedCurrency: string
  accessToken?: string
  totalProjectBudget?: number
  metrics?: FinancialMetricsType | null
}

export default function OverviewView({ 
  analyticsData, 
  selectedCurrency,
  accessToken,
  totalProjectBudget,
  metrics 
}: OverviewViewProps) {
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

  // Fetch commitments & actuals after first paint so Overview shows project-based metrics immediately
  const { summary, analytics, loading: commitmentsLoading } = useCommitmentsActualsData({
    accessToken,
    selectedCurrency,
    deferMs: 150
  })

  // Use commitments/actuals analytics if available, otherwise fall back to project budget analytics
  const displayCategoryData = analytics?.categoryData.length 
    ? analytics.categoryData.map(c => {
        // For commitments vs actuals, efficiency based on spend rate
        const spendRate = c.commitments > 0 ? (c.actuals / c.commitments * 100) : 0
        let efficiency = 0
        if (spendRate >= 80 && spendRate <= 100) {
          efficiency = 100
        } else if (spendRate > 100) {
          efficiency = Math.max(0, 100 - (spendRate - 100))
        } else {
          efficiency = (spendRate / 80) * 100
        }
        
        return {
          name: c.name,
          planned: c.commitments,
          actual: c.actuals,
          variance: c.variance,
          variance_percentage: c.variance_percentage,
          efficiency: Math.min(100, Math.max(0, efficiency))
        }
      })
    : analyticsData.categoryData

  const displayProjectData = analytics?.projectPerformanceData.length
    ? analytics.projectPerformanceData.map(p => {
        // For commitments vs actuals, efficiency should be based on spend rate
        // Ideal spend rate is around 80-100% (spending commitments efficiently)
        // Calculate efficiency: 100% if spend rate is 80-100%, lower if outside this range
        let efficiency_score = 0
        if (p.spend_percentage >= 80 && p.spend_percentage <= 100) {
          efficiency_score = 100 // Perfect efficiency
        } else if (p.spend_percentage > 100) {
          // Over-spending: reduce efficiency based on how much over
          efficiency_score = Math.max(0, 100 - (p.spend_percentage - 100))
        } else {
          // Under-spending: efficiency based on utilization
          efficiency_score = (p.spend_percentage / 80) * 100
        }
        
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
    : analyticsData.projectPerformanceData

  const displayStatusData = analytics?.statusDistribution.length
    ? analytics.statusDistribution
    : analyticsData.budgetStatusData

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
            <div className="text-xs text-gray-600 dark:text-slate-300 mb-1">Projects</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.projectCount || 0}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 dark:text-slate-300 mb-1">Commitments</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">
              {summary ? (summary.totalCommitments / 1000000).toFixed(1) : '0'}M
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 dark:text-slate-300 mb-1">Actuals</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-300">
              {summary ? (summary.totalActuals / 1000000).toFixed(1) : '0'}M
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 dark:text-slate-300 mb-1">Spend Rate</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">
              {summary && summary.totalCommitments > 0
                ? ((summary.totalActuals / summary.totalCommitments) * 100).toFixed(0)
                : '0'}%
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
            <span className="text-sm text-gray-500 dark:text-slate-400">{summary?.projectCount || analyticsData.totalProjects} projects</span>
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

        {/* Enhanced Category Spending Analysis - 2/3 width */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 lg:w-2/3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Category Spending</h3>
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {analytics ? 'Commitments vs Actuals' : 'Planned vs Actual'}
            </span>
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
              <Bar dataKey="planned" fill="#3B82F6" name={analytics ? "Commitments" : "Planned"} />
              <Bar dataKey="actual" fill="#EF4444" name="Actuals" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Project Performance - Full Width */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Project Performance Overview</h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-slate-400">
            <span>Top {displayProjectData.length} Projects</span>
            {analytics && (
              <>
                <span>•</span>
                <span>By Variance</span>
              </>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={displayProjectData.slice(0, 10)}>
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
            <Bar yAxisId="left" dataKey="budget" fill="#3B82F6" name={analytics ? "Commitments" : "Budget"} />
            <Bar yAxisId="left" dataKey="actual" fill="#EF4444" name="Actuals" />
            <Bar yAxisId="right" dataKey="efficiency_score" fill="#10B981" name="Efficiency Score" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}