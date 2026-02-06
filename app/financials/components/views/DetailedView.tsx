'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ComprehensiveFinancialReport } from '../../types'
import { useCommitmentsActualsData } from '../../hooks/useCommitmentsActualsData'
import { useTranslations } from '../../../../lib/i18n/context'

interface DetailedViewProps {
  comprehensiveReport: ComprehensiveFinancialReport | null
  selectedCurrency: string
  accessToken?: string
}

export default function DetailedView({ 
  comprehensiveReport, 
  selectedCurrency,
  accessToken 
}: DetailedViewProps) {
  const { t } = useTranslations()
  const [sortBy, setSortBy] = useState<'name' | 'commitments' | 'actuals' | 'variance'>('variance')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterStatus, setFilterStatus] = useState<'all' | 'over' | 'under' | 'on'>('all')
  
  // Fetch commitments & actuals data
  const { analytics, summary, loading } = useCommitmentsActualsData({
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

  if (!analytics || !summary) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <p className="text-gray-500 dark:text-slate-400">{t('financials.noDetailedData')}</p>
      </div>
    )
  }

  // Prepare project data for table
  const projectData = analytics.projectPerformanceData.map(p => ({
    name: p.name,
    commitments: p.commitments,
    actuals: p.actuals,
    variance: p.variance,
    variance_percentage: p.variance_percentage,
    spend_percentage: p.spend_percentage,
    status: p.spend_percentage > 100 ? 'over' : p.spend_percentage > 50 ? 'on' : 'under'
  }))

  // Filter data
  const filteredData = projectData.filter(p => {
    if (filterStatus === 'all') return true
    return p.status === filterStatus
  })

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'commitments':
        comparison = a.commitments - b.commitments
        break
      case 'actuals':
        comparison = a.actuals - b.actuals
        break
      case 'variance':
        comparison = Math.abs(a.variance) - Math.abs(b.variance)
        break
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="text-sm text-gray-600 dark:text-slate-400">{t('stats.totalProjects')}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{projectData.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="text-sm text-gray-600 dark:text-slate-400">{t('financials.totalCommitments')}</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {summary.totalCommitments.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-500">{selectedCurrency}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="text-sm text-gray-600 dark:text-slate-400">{t('financials.totalActuals')}</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {summary.totalActuals.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-500">{selectedCurrency}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="text-sm text-gray-600 dark:text-slate-400">{t('financials.avgSpendRate')}</div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {((summary.totalActuals / summary.totalCommitments) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Project Breakdown Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {t('financials.projectLevelBreakdown')}
            </h3>
            <div className="flex items-center space-x-4">
              {/* Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
              >
                <option value="all">{t('financials.allProjects')} ({projectData.length})</option>
                <option value="over">{t('financials.overBudget')} ({projectData.filter(p => p.status === 'over').length})</option>
                <option value="on">{t('financials.onTrack')} ({projectData.filter(p => p.status === 'on').length})</option>
                <option value="under">{t('financials.underUtilized')} ({projectData.filter(p => p.status === 'under').length})</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-600"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>{t('financials.project')}</span>
                    {sortBy === 'name' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-600"
                  onClick={() => handleSort('commitments')}
                >
                  <div className="flex items-center space-x-1">
                    <span>{t('financials.commitments')}</span>
                    {sortBy === 'commitments' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-600"
                  onClick={() => handleSort('actuals')}
                >
                  <div className="flex items-center space-x-1">
                    <span>{t('financials.actuals')}</span>
                    {sortBy === 'actuals' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-600"
                  onClick={() => handleSort('variance')}
                >
                  <div className="flex items-center space-x-1">
                    <span>{t('financials.variance')}</span>
                    {sortBy === 'variance' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('financials.spendRate')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('financials.status')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {sortedData.map((project, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{project.name}</div>
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
                    <div className="text-xs text-gray-500 dark:text-slate-500">
                      {project.variance_percentage >= 0 ? '+' : ''}{project.variance_percentage.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-20 bg-gray-200 dark:bg-slate-600 rounded-full h-2 mr-2">
                        <div 
                          className={`h-2 rounded-full ${
                            project.spend_percentage > 100 ? 'bg-red-500' :
                            project.spend_percentage > 50 ? 'bg-green-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${Math.min(project.spend_percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-slate-400">
                        {project.spend_percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      project.status === 'over' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' :
                      project.status === 'on' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                      'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
                    }`}>
                      {project.status === 'over' ? t('financials.overBudget') :
                       project.status === 'on' ? t('financials.onTrack') : t('financials.underUtilized')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 border-t border-gray-200 dark:border-slate-700">
          <div className="text-sm text-gray-600 dark:text-slate-400">
            {t('financials.showingProjects', { shown: sortedData.length, total: projectData.length })}
          </div>
        </div>
      </div>
    </div>
  )
}