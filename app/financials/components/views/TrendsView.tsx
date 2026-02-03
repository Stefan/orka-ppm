'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import { ComprehensiveFinancialReport } from '../../types'
import { useCommitmentsActualsTrends } from '../../hooks/useCommitmentsActualsTrends'
import { useTranslations } from '../../../../lib/i18n/context'

interface TrendsViewProps {
  comprehensiveReport: ComprehensiveFinancialReport | null
  selectedCurrency: string
  accessToken?: string
}

export default function TrendsView({ 
  comprehensiveReport, 
  selectedCurrency,
  accessToken 
}: TrendsViewProps) {
  const { t } = useTranslations()
  const [timeRange, setTimeRange] = useState<'12' | '24' | '36' | 'all'>('24')
  
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
  
  const { monthlyData, summary, loading } = useCommitmentsActualsTrends({
    accessToken,
    selectedCurrency
  })

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (!monthlyData.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <p className="text-gray-500 dark:text-slate-400">{t('financials.noTrendData')}</p>
      </div>
    )
  }

  // Filter data based on selected time range
  const filteredData = timeRange === 'all' 
    ? monthlyData 
    : monthlyData.slice(-parseInt(timeRange))

  // Format month for display (YYYY-MM -> MMM YYYY)
  const formatMonth = (month: string) => {
    const date = new Date(month + '-01')
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const chartData = filteredData.map(m => ({
    month: formatMonth(m.month),
    commitments: m.commitments,
    actuals: m.actuals,
    cumulativeCommitments: m.cumulativeCommitments,
    cumulativeActuals: m.cumulativeActuals,
    variance: m.variance,
    spendRate: m.spendRate
  }))

  return (
    <div className="space-y-6">
      {/* Time Range Filter */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('financials.timeRangeFilter')}</h3>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
              {t('financials.totalDataRange')}: {formatMonth(monthlyData[0].month)} - {formatMonth(monthlyData[monthlyData.length - 1].month)} ({monthlyData.length} {t('financials.months')})
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setTimeRange('12')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange === '12'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('financials.last12Months')}
            </button>
            <button
              onClick={() => setTimeRange('24')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange === '24'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('financials.last24Months')}
            </button>
            <button
              onClick={() => setTimeRange('36')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange === '36'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('financials.last36Months')}
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('financials.allTime')}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">{t('financials.avgMonthlyCommitments')}</div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {summary ? (summary.avgMonthlyCommitments / 1000).toFixed(0) : '0'}K
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">{selectedCurrency}</div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <div className="text-sm text-red-700 dark:text-red-300 mb-1">{t('financials.burnRate')}</div>
          <div className="text-2xl font-bold text-red-900 dark:text-red-100">
            {summary ? (summary.burnRate / 1000).toFixed(0) : '0'}K
          </div>
          <div className="text-xs text-red-600 dark:text-red-400 mt-1">{t('financials.perMonth')}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">{t('financials.avgSpendRate')}</div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {summary ? summary.avgSpendRate.toFixed(1) : '0'}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-sm text-green-700 dark:text-green-300 mb-1">{t('financials.projectedAnnual')}</div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">
            {summary ? (summary.projectedAnnualSpend / 1000000).toFixed(1) : '0'}M
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">{selectedCurrency}</div>
        </div>
      </div>

      {/* Monthly Commitments vs Actuals */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('financials.monthlyTrend')}</h3>
          <span className="text-sm text-gray-500 dark:text-slate-400">{filteredData.length} {t('financials.months')}</span>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData}>
            <XAxis 
              dataKey="month" 
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip 
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => {
                if (name === t('financials.spendRate')) {
                  return `${value.toFixed(1)}%`
                }
                return `${value.toLocaleString()} ${selectedCurrency}`
              }}
            />
            <Legend />
            <Bar dataKey="commitments" fill="#3B82F6" name={t('financials.commitments')} />
            <Bar dataKey="actuals" fill="#EF4444" name={t('financials.actuals')} />
            <Line 
              type="monotone" 
              dataKey="spendRate" 
              stroke="#10B981" 
              strokeWidth={2}
              yAxisId="right"
              name={t('financials.spendRate')}
            />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative Trend */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('financials.cumulativeTrend')}</h3>
          <div className="text-sm text-gray-500 dark:text-slate-400">
            {t('financials.totalPeriod')}: {formatMonth(filteredData[0].month)} - {formatMonth(filteredData[filteredData.length - 1].month)}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <XAxis 
              dataKey="month" 
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip 
              contentStyle={tooltipStyle}
              formatter={(value: number) => `${value.toLocaleString()} ${selectedCurrency}`}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="cumulativeCommitments" 
              stroke="#3B82F6" 
              fill="#3B82F6" 
              fillOpacity={0.3}
              name={t('financials.cumulativeCommitments')}
            />
            <Area 
              type="monotone" 
              dataKey="cumulativeActuals" 
              stroke="#EF4444" 
              fill="#EF4444" 
              fillOpacity={0.3}
              name={t('financials.cumulativeActuals')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Variance Trend */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('financials.varianceTrend')}</h3>
          <span className="text-sm text-gray-500 dark:text-slate-400">{t('financials.actualsMinusCommitments')}</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis 
              dataKey="month" 
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip 
              contentStyle={tooltipStyle}
              formatter={(value: number) => `${value.toLocaleString()} ${selectedCurrency}`}
            />
            <Legend />
            <Bar 
              dataKey="variance" 
              fill="#F59E0B"
              name={t('financials.variance')}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Forecast Summary */}
      {summary && (
        <div 
          className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200 dark:border-slate-700"
          ref={(el) => {
            // Apply dark mode background via JS (Tailwind v4 gradient classes override CSS rules)
            if (el && typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
              el.style.setProperty('background', '#1e293b', 'important');
            }
          }}
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('financials.forecastSummary')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-slate-400 mb-1">{t('financials.forecastCompletion')}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-slate-100">{formatMonth(summary.forecastCompletion)}</div>
              <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">{t('financials.basedOnBurnRate')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-slate-400 mb-1">{t('financials.remainingBudget')}</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {((monthlyData[monthlyData.length - 1].cumulativeCommitments - 
                   monthlyData[monthlyData.length - 1].cumulativeActuals) / 1000000).toFixed(2)}M
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">{selectedCurrency}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-slate-400 mb-1">{t('financials.monthsOfData')}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-slate-100">{summary.totalMonths}</div>
              <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">{t('financials.dataPoints')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
