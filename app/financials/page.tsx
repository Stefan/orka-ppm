'use client'

import { useAuth } from '../providers/SupabaseAuthProvider'
import { useEffect, useState, useMemo } from 'react'
import { 
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, PieChart, BarChart3,
  Calendar, Filter, Download, RefreshCw, Eye, EyeOff, Target, Zap
} from 'lucide-react'
import AppLayout from '../../components/AppLayout'
import { getApiUrl } from '../../lib/api'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
  ComposedChart
} from 'recharts'

interface Project {
  id: string
  name: string
  budget?: number | null
  actual_cost?: number | null
  status: string
  health: 'green' | 'yellow' | 'red'
}

interface BudgetVariance {
  project_id: string
  total_planned: number
  total_actual: number
  variance_amount: number
  variance_percentage: number
  currency: string
  categories: Array<{
    category: string
    planned: number
    actual: number
    variance: number
    variance_percentage: number
  }>
  status: string
}

interface FinancialAlert {
  project_id: string
  project_name: string
  budget: number
  actual_cost: number
  utilization_percentage: number
  variance_amount: number
  alert_level: 'warning' | 'critical'
  message: string
}

interface FinancialMetrics {
  total_budget: number
  total_actual: number
  total_variance: number
  variance_percentage: number
  projects_over_budget: number
  projects_under_budget: number
  average_budget_utilization: number
  currency_distribution: Record<string, number>
}

export default function Financials() {
  const { session } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [budgetVariances, setBudgetVariances] = useState<BudgetVariance[]>([])
  const [financialAlerts, setFinancialAlerts] = useState<FinancialAlert[]>([])
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [dateRange, setDateRange] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'trends'>('overview')

  // Enhanced analytics data
  const analyticsData = useMemo(() => {
    if (!metrics || !budgetVariances.length) return null

    const budgetStatusData = [
      { name: 'Under Budget', value: metrics.projects_under_budget, color: '#10B981' },
      { name: 'Over Budget', value: metrics.projects_over_budget, color: '#EF4444' },
      { name: 'On Budget', value: projects.length - metrics.projects_over_budget - metrics.projects_under_budget, color: '#3B82F6' }
    ]

    const categorySpending = budgetVariances.reduce((acc, variance) => {
      variance.categories.forEach(cat => {
        if (!acc[cat.category]) {
          acc[cat.category] = { planned: 0, actual: 0, variance: 0 }
        }
        acc[cat.category].planned += cat.planned
        acc[cat.category].actual += cat.actual
        acc[cat.category].variance += cat.variance
      })
      return acc
    }, {} as Record<string, { planned: number, actual: number, variance: number }>)

    const categoryData = Object.entries(categorySpending).map(([category, data]) => ({
      name: category,
      planned: data.planned,
      actual: data.actual,
      variance: data.variance,
      variance_percentage: data.planned > 0 ? (data.variance / data.planned * 100) : 0
    }))

    const projectPerformanceData = budgetVariances.map(variance => {
      const project = projects.find(p => p.id === variance.project_id)
      return {
        name: project?.name.substring(0, 15) + '...' || 'Unknown',
        budget: variance.total_planned,
        actual: variance.total_actual,
        variance: variance.variance_amount,
        variance_percentage: variance.variance_percentage,
        health: project?.health || 'unknown'
      }
    }).sort((a, b) => Math.abs(b.variance_percentage) - Math.abs(a.variance_percentage))

    return {
      budgetStatusData,
      categoryData,
      projectPerformanceData,
      totalProjects: projects.length,
      criticalAlerts: financialAlerts.filter(a => a.alert_level === 'critical').length,
      warningAlerts: financialAlerts.filter(a => a.alert_level === 'warning').length
    }
  }, [metrics, budgetVariances, projects, financialAlerts])

  useEffect(() => {
    if (session) {
      fetchFinancialData()
    }
  }, [session, selectedCurrency])

  async function fetchFinancialData() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchProjects(),
        fetchBudgetVariances(),
        fetchFinancialAlerts(),
        fetchFinancialMetrics()
      ])
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchProjects() {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/projects/'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data = await response.json()
      setProjects(Array.isArray(data) ? data as Project[] : [])
    } catch (error: unknown) {
      console.error('Error fetching projects:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch projects')
    }
  }

  async function fetchBudgetVariances() {
    if (!session?.access_token) return
    
    const variances: BudgetVariance[] = []
    
    for (const project of projects) {
      try {
        const response = await fetch(getApiUrl(`/projects/${project.id}/budget-variance?currency=${selectedCurrency}`), {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          }
        })
        
        if (response.ok) {
          const variance = await response.json()
          variances.push(variance)
        }
      } catch (error) {
        console.error(`Failed to fetch variance for project ${project.id}:`, error)
      }
    }
    
    setBudgetVariances(variances)
  }

  async function fetchFinancialAlerts() {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/financial-tracking/budget-alerts?threshold_percentage=80'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setFinancialAlerts(data.alerts || [])
      }
    } catch (error) {
      console.error('Failed to fetch financial alerts:', error)
    }
  }

  async function fetchFinancialMetrics() {
    if (!budgetVariances.length) return
    
    const totalBudget = budgetVariances.reduce((sum, v) => sum + v.total_planned, 0)
    const totalActual = budgetVariances.reduce((sum, v) => sum + v.total_actual, 0)
    const totalVariance = totalActual - totalBudget
    const variancePercentage = totalBudget > 0 ? (totalVariance / totalBudget * 100) : 0
    
    const projectsOverBudget = budgetVariances.filter(v => v.variance_amount > 0).length
    const projectsUnderBudget = budgetVariances.filter(v => v.variance_amount < 0).length
    
    const avgUtilization = budgetVariances.length > 0 
      ? budgetVariances.reduce((sum, v) => sum + (v.total_planned > 0 ? (v.total_actual / v.total_planned * 100) : 0), 0) / budgetVariances.length
      : 0

    setMetrics({
      total_budget: totalBudget,
      total_actual: totalActual,
      total_variance: totalVariance,
      variance_percentage: variancePercentage,
      projects_over_budget: projectsOverBudget,
      projects_under_budget: projectsUnderBudget,
      average_budget_utilization: avgUtilization,
      currency_distribution: { [selectedCurrency]: totalBudget }
    })
  }

  const exportFinancialData = () => {
    const exportData = {
      metrics,
      budgetVariances,
      financialAlerts,
      analytics: analyticsData,
      currency: selectedCurrency,
      exported_at: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    </AppLayout>
  )

  if (error) return (
    <AppLayout>
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading financial data</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Enhanced Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900">Financial Management</h1>
              {analyticsData && analyticsData.criticalAlerts > 0 && (
                <div className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {analyticsData.criticalAlerts} Critical Alert{analyticsData.criticalAlerts !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
              {metrics && (
                <>
                  <span>Total Budget: {metrics.total_budget.toLocaleString()} {selectedCurrency}</span>
                  <span>Variance: {metrics.variance_percentage.toFixed(1)}%</span>
                  <span>{analyticsData?.totalProjects} projects tracked</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
            
            <button
              onClick={() => setViewMode(viewMode === 'overview' ? 'detailed' : viewMode === 'detailed' ? 'trends' : 'overview')}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {viewMode === 'overview' ? <BarChart3 className="h-4 w-4 mr-2" /> : 
               viewMode === 'detailed' ? <TrendingUp className="h-4 w-4 mr-2" /> : 
               <PieChart className="h-4 w-4 mr-2" />}
              {viewMode === 'overview' ? 'Detailed' : viewMode === 'detailed' ? 'Trends' : 'Overview'}
            </button>
            
            <button
              onClick={exportFinancialData}
              className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            
            <button
              onClick={fetchFinancialData}
              className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>
        </div>

        {/* Financial Metrics Dashboard */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Budget</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {metrics.total_budget.toLocaleString()} {selectedCurrency}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Spent</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {metrics.total_actual.toLocaleString()} {selectedCurrency}
                  </p>
                </div>
                <Target className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Variance</p>
                  <p className={`text-2xl font-bold ${metrics.variance_percentage >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {metrics.variance_percentage >= 0 ? '+' : ''}{metrics.variance_percentage.toFixed(1)}%
                  </p>
                </div>
                {metrics.variance_percentage >= 0 ? 
                  <TrendingUp className="h-8 w-8 text-red-600" /> : 
                  <TrendingDown className="h-8 w-8 text-green-600" />
                }
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg. Utilization</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {metrics.average_budget_utilization.toFixed(1)}%
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </div>
        )}

        {/* Critical Alerts */}
        {financialAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-900">Budget Alerts</h3>
              <span className="text-sm text-red-700">{financialAlerts.length} alert{financialAlerts.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {financialAlerts.slice(0, 5).map((alert, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{alert.project_name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>Budget: {alert.budget.toLocaleString()} {selectedCurrency}</span>
                        <span>Spent: {alert.actual_cost.toLocaleString()} {selectedCurrency}</span>
                        <span>Utilization: {alert.utilization_percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.alert_level === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {alert.alert_level}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="1y">Last Year</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Budget Status</label>
                <select className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="all">All Projects</option>
                  <option value="over">Over Budget</option>
                  <option value="under">Under Budget</option>
                  <option value="on">On Budget</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alert Level</label>
                <select className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="all">All Levels</option>
                  <option value="critical">Critical Only</option>
                  <option value="warning">Warning Only</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Charts and Analytics */}
        {analyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget Status Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Status Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={analyticsData.budgetStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData.budgetStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            {/* Category Spending Analysis */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.categoryData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    typeof value === 'number' ? `${value.toLocaleString()} ${selectedCurrency}` : value,
                    name === 'planned' ? 'Planned' : name === 'actual' ? 'Actual' : 'Variance'
                  ]} />
                  <Legend />
                  <Bar dataKey="planned" fill="#3B82F6" name="Planned" />
                  <Bar dataKey="actual" fill="#10B981" name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Project Performance */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Budget Performance</h3>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={analyticsData.projectPerformanceData.slice(0, 10)}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    typeof value === 'number' ? `${value.toLocaleString()} ${selectedCurrency}` : value,
                    name === 'budget' ? 'Budget' : name === 'actual' ? 'Actual' : 'Variance %'
                  ]} />
                  <Legend />
                  <Bar dataKey="budget" fill="#3B82F6" name="Budget" />
                  <Bar dataKey="actual" fill="#10B981" name="Actual" />
                  <Line type="monotone" dataKey="variance_percentage" stroke="#EF4444" name="Variance %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Detailed Budget Variance Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Budget Variance Analysis ({budgetVariances.length} projects)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance %</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {budgetVariances.map((variance) => {
                  const project = projects.find(p => p.id === variance.project_id)
                  return (
                    <tr key={variance.project_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {project?.name || 'Unknown Project'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {variance.total_planned.toLocaleString()} {variance.currency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {variance.total_actual.toLocaleString()} {variance.currency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={variance.variance_amount >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {variance.variance_amount >= 0 ? '+' : ''}{variance.variance_amount.toLocaleString()} {variance.currency}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={variance.variance_percentage >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {variance.variance_percentage >= 0 ? '+' : ''}{variance.variance_percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          variance.status === 'over_budget' ? 'bg-red-100 text-red-800' :
                          variance.status === 'under_budget' ? 'bg-green-100 text-green-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {variance.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}