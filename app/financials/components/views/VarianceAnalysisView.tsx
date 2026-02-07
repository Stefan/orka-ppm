'use client'

import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts'
import { 
  TrendingUp, TrendingDown, Download, 
  AlertTriangle, DollarSign, Target, PieChart, FileText
} from 'lucide-react'
import { getApiUrl } from '../../../../lib/api'
import { logger } from '@/lib/monitoring/logger'

interface FinancialVariance {
  id: string
  project_id: string
  wbs_element: string
  total_commitment: number
  total_actual: number
  variance: number
  variance_percentage: number
  status: 'under' | 'on' | 'over'
  currency_code: string
  calculated_at: string
}

interface VarianceAnalysisViewProps {
  session: any
  selectedCurrency: string
  onRefresh?: () => void
  projectFilter?: string
  onClearProjectFilter?: () => void
}

const VarianceAnalysisView = forwardRef<{ refresh: () => void }, VarianceAnalysisViewProps>(({ 
  session, 
  selectedCurrency, 
  onRefresh,
  projectFilter,
  onClearProjectFilter
}, ref) => {
  const [variances, setVariances] = useState<FinancialVariance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    project: projectFilter || '',
    wbs: '',
    vendor: '',
    status: 'all'
  })
  const [sortBy, setSortBy] = useState<'variance_percentage' | 'variance' | 'project_id'>('variance_percentage')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Update filters when projectFilter prop changes
  useEffect(() => {
    if (projectFilter) {
      setFilters(prev => ({ ...prev, project: projectFilter }))
    }
  }, [projectFilter])

  // Fetch variance data after first paint so tab shows immediately
  useEffect(() => {
    if (!session) return
    const t = setTimeout(() => fetchVarianceData(), 100)
    return () => clearTimeout(t)
  }, [session, selectedCurrency])

  const fetchVarianceData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(getApiUrl('/csv-import/variances'), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch variance data')
      }
      
      const data = await response.json()
      setVariances(data.variances || [])
    } catch (error: unknown) {
      logger.error('Error fetching variance data', { error }, 'VarianceAnalysisView')
      setError(error instanceof Error ? error.message : 'Failed to fetch variance data')
    } finally {
      setLoading(false)
    }
  }

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: fetchVarianceData
  }))

  // Filter and sort data
  const filteredAndSortedVariances = useMemo(() => {
    const filtered = variances.filter(variance => {
      if (filters.project && !variance.project_id.toLowerCase().includes(filters.project.toLowerCase())) {
        return false
      }
      if (filters.wbs && !variance.wbs_element.toLowerCase().includes(filters.wbs.toLowerCase())) {
        return false
      }
      if (filters.status !== 'all' && variance.status !== filters.status) {
        return false
      }
      return true
    })

    // Sort data
    filtered.sort((a, b) => {
      let aValue: number, bValue: number
      
      switch (sortBy) {
        case 'variance_percentage':
          aValue = Math.abs(a.variance_percentage)
          bValue = Math.abs(b.variance_percentage)
          break
        case 'variance':
          aValue = Math.abs(a.variance)
          bValue = Math.abs(b.variance)
          break
        case 'project_id':
          return sortOrder === 'asc' 
            ? a.project_id.localeCompare(b.project_id)
            : b.project_id.localeCompare(a.project_id)
        default:
          aValue = Math.abs(a.variance_percentage)
          bValue = Math.abs(b.variance_percentage)
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    })

    return filtered
  }, [variances, filters, sortBy, sortOrder])

  // Analytics data
  const analyticsData = useMemo(() => {
    if (!variances.length) return null

    const totalCommitments = variances.reduce((sum, v) => sum + v.total_commitment, 0)
    const totalActuals = variances.reduce((sum, v) => sum + v.total_actual, 0)
    const totalVariance = totalActuals - totalCommitments
    const variancePercentage = totalCommitments > 0 ? (totalVariance / totalCommitments * 100) : 0

    const statusCounts = {
      under: variances.filter(v => v.status === 'under').length,
      on: variances.filter(v => v.status === 'on').length,
      over: variances.filter(v => v.status === 'over').length
    }

    // Top 10 variances for chart
    const chartData = filteredAndSortedVariances.slice(0, 10).map(variance => ({
      name: variance.project_id.length > 15 ? variance.project_id.substring(0, 15) + '...' : variance.project_id,
      commitment: variance.total_commitment,
      actual: variance.total_actual,
      variance: variance.variance,
      variance_percentage: variance.variance_percentage,
      wbs: variance.wbs_element
    }))

    return {
      totalCommitments,
      totalActuals,
      totalVariance,
      variancePercentage,
      statusCounts,
      chartData,
      projectCount: variances.length
    }
  }, [variances, filteredAndSortedVariances])

  const exportVarianceData = () => {
    const exportData = {
      variances: filteredAndSortedVariances,
      analytics: analyticsData,
      filters,
      currency: selectedCurrency,
      exported_at: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `commitments-actuals-variance-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error loading variance data</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchVarianceData}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-500"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Commitments vs Actuals Analysis</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Variance analysis between planned commitments and actual expenditures
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={exportVarianceData}
            className="flex items-center px-3 py-2 bg-green-700 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {analyticsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Total Commitments</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {analyticsData.totalCommitments.toLocaleString()} {selectedCurrency}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Total Actuals</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {analyticsData.totalActuals.toLocaleString()} {selectedCurrency}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Total Variance</p>
                <p className={`text-2xl font-bold ${analyticsData.totalVariance >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {analyticsData.totalVariance >= 0 ? '+' : ''}{analyticsData.totalVariance.toLocaleString()} {selectedCurrency}
                </p>
              </div>
              {analyticsData.totalVariance >= 0 ? 
                <TrendingUp className="h-8 w-8 text-red-600 dark:text-red-400" /> : 
                <TrendingDown className="h-8 w-8 text-green-600 dark:text-green-400" />
              }
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Variance %</p>
                <p className={`text-2xl font-bold ${analyticsData.variancePercentage >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {analyticsData.variancePercentage >= 0 ? '+' : ''}{analyticsData.variancePercentage.toFixed(1)}%
                </p>
              </div>
              <PieChart className="h-8 w-8 text-gray-600 dark:text-slate-400" />
            </div>
          </div>
        </div>
      )}

      {/* Status Distribution */}
      {analyticsData && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Project Status Distribution</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {analyticsData.statusCounts.under}
              </div>
              <div className="text-sm text-green-800 dark:text-green-300">Under Budget</div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">Spending less than committed</div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analyticsData.statusCounts.on}
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-300">On Budget</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Within ±5% of commitments</div>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {analyticsData.statusCounts.over}
              </div>
              <div className="text-sm text-red-800 dark:text-red-300">Over Budget</div>
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">Spending more than committed</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Filters & Sorting</h3>
          <button
            onClick={() => {
              setFilters({ project: '', wbs: '', vendor: '', status: 'all' })
              onClearProjectFilter?.()
            }}
            className="text-sm text-gray-600 hover:text-gray-800 dark:text-slate-200"
          >
            Clear All
          </button>
        </div>
        
        {projectFilter && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Filtered by project:</strong> {projectFilter}
              </span>
            </div>
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, project: '' }))
                onClearProjectFilter?.()
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              Clear Filter
            </button>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Project</label>
            <input
              type="text"
              value={filters.project}
              onChange={(e) => setFilters(prev => ({ ...prev, project: e.target.value }))}
              placeholder="Filter by project..."
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">WBS Element</label>
            <input
              type="text"
              value={filters.wbs}
              onChange={(e) => setFilters(prev => ({ ...prev, wbs: e.target.value }))}
              placeholder="Filter by WBS..."
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="under">Under Budget</option>
              <option value="on">On Budget</option>
              <option value="over">Over Budget</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="variance_percentage">Variance %</option>
              <option value="variance">Variance Amount</option>
              <option value="project_id">Project Name</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Order</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="desc">Highest First</option>
              <option value="asc">Lowest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Variance Visualization */}
      {analyticsData && analyticsData.chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
            Top 10 Variance Analysis (by {sortBy.replace('_', ' ')})
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={analyticsData.chartData}>
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={(value, name) => [
                typeof value === 'number' ? 
                  (name === 'variance_percentage' ? `${value.toFixed(1)}%` : `${value.toLocaleString()} ${selectedCurrency}`) : 
                  value,
                name === 'commitment' ? 'Commitment' : 
                name === 'actual' ? 'Actual' : 
                name === 'variance_percentage' ? 'Variance %' : 'Variance'
              ]}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="commitment" fill="#3B82F6" name="Commitment" />
              <Bar yAxisId="left" dataKey="actual" fill="#10B981" name="Actual" />
              <Line yAxisId="right" type="monotone" dataKey="variance_percentage" stroke="#EF4444" strokeWidth={3} name="Variance %" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detailed Variance Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Detailed Variance Analysis ({filteredAndSortedVariances.length} projects)
            </h3>
            <div className="text-sm text-gray-600 dark:text-slate-400">
              All amounts in {selectedCurrency}
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Project / WBS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Commitment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Actual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Variance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Variance %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {filteredAndSortedVariances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-slate-500" />
                    <p>Variance is calculated from Commitments and Actuals.</p>
                    <p className="mt-1 text-sm">Import CSV files (Commitments and Actuals) to see variance analysis.</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedVariances.map((variance) => (
                  <tr key={variance.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {variance.project_id}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-slate-400">
                          WBS: {variance.wbs_element}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                      {variance.total_commitment.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                      {variance.total_actual.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={variance.variance >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                        {variance.variance >= 0 ? '+' : ''}{variance.variance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={variance.variance_percentage >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                        {variance.variance_percentage >= 0 ? '+' : ''}{variance.variance_percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        variance.status === 'over' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                        variance.status === 'under' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                      }`}
                      >
                        {variance.status === 'over' ? 'Over Budget' :
                         variance.status === 'under' ? 'Under Budget' : 'On Budget'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                      {new Date(variance.calculated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
})

VarianceAnalysisView.displayName = 'VarianceAnalysisView'

export default VarianceAnalysisView
