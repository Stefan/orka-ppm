'use client'

import { useAuth } from '../providers/SupabaseAuthProvider'
import { useEffect, useState, useMemo } from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts'
import AppLayout from '../../components/AppLayout'
import { Filter, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react'

interface Project {
  id: string
  name: string
  description?: string
  status: string
  health: 'green' | 'yellow' | 'red'
  budget?: number
  actual_cost?: number
  start_date?: string
  end_date?: string
  portfolio_id: string
  created_at: string
}

interface PortfolioMetrics {
  total_projects: number
  health_distribution: { green: number; yellow: number; red: number }
  status_distribution: Record<string, number>
  budget_metrics: {
    total_budget: number
    total_actual: number
    variance: number
    variance_percentage: number
  }
  timeline_metrics: { on_time: number; at_risk: number; overdue: number }
  resource_utilization: { total_resources: number; average_utilization: number }
  calculation_time_ms: number
}

interface KPIs {
  project_success_rate: number
  budget_performance: number
  timeline_performance: number
  average_health_score: number
  resource_efficiency: number
  active_projects_ratio: number
}

interface DashboardFilters {
  status: string
  health: string
  portfolio_id: string
  date_range: string
}

export default function Dashboards() {
  const { session } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null)
  const [kpis, setKPIs] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>({
    status: 'all',
    health: 'all',
    portfolio_id: 'all',
    date_range: 'all'
  })
  const [showFilters, setShowFilters] = useState(false)

  // Filtered projects based on current filters
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (filters.status !== 'all' && project.status !== filters.status) return false
      if (filters.health !== 'all' && project.health !== filters.health) return false
      if (filters.portfolio_id !== 'all' && project.portfolio_id !== filters.portfolio_id) return false
      
      if (filters.date_range !== 'all') {
        const now = new Date()
        const projectDate = new Date(project.created_at)
        const daysDiff = (now.getTime() - projectDate.getTime()) / (1000 * 3600 * 24)
        
        switch (filters.date_range) {
          case '7d':
            if (daysDiff > 7) return false
            break
          case '30d':
            if (daysDiff > 30) return false
            break
          case '90d':
            if (daysDiff > 90) return false
            break
        }
      }
      
      return true
    })
  }, [projects, filters])

  useEffect(() => {
    if (session) {
      fetchDashboardData()
    }
  }, [session])

  // Refetch data when filters change
  useEffect(() => {
    if (session && projects.length > 0) {
      fetchPortfolioMetrics()
    }
  }, [filters, session])

  async function fetchDashboardData() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchProjects(),
        fetchPortfolioMetrics(),
        fetchKPIs()
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchProjects() {
    if (!session) throw new Error('Not authenticated')
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    })
    if (!response.ok) throw new Error('Failed to fetch projects')
    const data = await response.json()
    setProjects(data)
  }

  async function fetchPortfolioMetrics() {
    if (!session) return
    
    const portfolioParam = filters.portfolio_id !== 'all' ? `?portfolio_id=${filters.portfolio_id}` : ''
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/portfolio/metrics${portfolioParam}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    })
    if (!response.ok) throw new Error('Failed to fetch portfolio metrics')
    const data = await response.json()
    setPortfolioMetrics(data)
  }

  async function fetchKPIs() {
    if (!session) return
    
    const portfolioParam = filters.portfolio_id !== 'all' ? `?portfolio_id=${filters.portfolio_id}` : ''
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/portfolio/kpis${portfolioParam}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    })
    if (!response.ok) throw new Error('Failed to fetch KPIs')
    const data = await response.json()
    setKPIs(data.kpis)
  }

  const handleFilterChange = (filterType: keyof DashboardFilters, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }))
  }

  // Chart data preparation
  const healthChartData = portfolioMetrics ? [
    { name: 'Healthy', value: portfolioMetrics.health_distribution.green, color: '#10B981' },
    { name: 'At Risk', value: portfolioMetrics.health_distribution.yellow, color: '#F59E0B' },
    { name: 'Critical', value: portfolioMetrics.health_distribution.red, color: '#EF4444' }
  ] : []

  const statusChartData = portfolioMetrics ? Object.entries(portfolioMetrics.status_distribution).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
    value: count
  })) : []

  const budgetChartData = filteredProjects
    .filter(p => p.budget && p.actual_cost !== undefined)
    .map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      budget: p.budget || 0,
      actual: p.actual_cost || 0,
      variance: (p.actual_cost || 0) - (p.budget || 0)
    }))

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
              <h3 className="text-sm font-medium text-red-800">Error loading dashboard</h3>
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
        {/* Header with Filters */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
            <p className="text-gray-600 mt-1">
              {portfolioMetrics && `${portfolioMetrics.total_projects} projects • Performance calculated in ${portfolioMetrics.calculation_time_ms}ms`}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health</label>
                <select
                  value={filters.health}
                  onChange={(e) => handleFilterChange('health', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Health Levels</option>
                  <option value="green">Healthy</option>
                  <option value="yellow">At Risk</option>
                  <option value="red">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={filters.date_range}
                  onChange={(e) => handleFilterChange('date_range', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ status: 'all', health: 'all', portfolio_id: 'all', date_range: 'all' })}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">{kpis.project_success_rate}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Budget Performance</p>
                  <p className="text-2xl font-bold text-blue-600">{kpis.budget_performance}%</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Timeline Performance</p>
                  <p className="text-2xl font-bold text-purple-600">{kpis.timeline_performance}%</p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Health Score</p>
                  <p className="text-2xl font-bold text-orange-600">{kpis.average_health_score}/3</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Resource Efficiency</p>
                  <p className="text-2xl font-bold text-indigo-600">{kpis.resource_efficiency}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Projects</p>
                  <p className="text-2xl font-bold text-red-600">{kpis.active_projects_ratio}%</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Health Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Health Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={healthChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {healthChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Project Status Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusChartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Budget vs Actual Spending */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual Spending</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={budgetChartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    typeof value === 'number' ? `$${value.toLocaleString()}` : value,
                    name === 'budget' ? 'Budget' : name === 'actual' ? 'Actual' : 'Variance'
                  ]}
                />
                <Legend />
                <Bar dataKey="budget" fill="#10B981" name="Budget" />
                <Bar dataKey="actual" fill="#3B82F6" name="Actual" />
                <Bar dataKey="variance" fill="#EF4444" name="Variance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Projects Table with Health Indicators */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Projects Overview ({filteredProjects.length} of {projects.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Health
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProjects.map((project) => {
                  const variance = (project.actual_cost || 0) - (project.budget || 0)
                  const variancePercentage = project.budget ? (variance / project.budget * 100) : 0
                  
                  return (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{project.name}</div>
                          <div className="text-sm text-gray-500">{project.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          project.status === 'completed' ? 'bg-green-100 text-green-800' :
                          project.status === 'active' ? 'bg-blue-100 text-blue-800' :
                          project.status === 'on-hold' ? 'bg-yellow-100 text-yellow-800' :
                          project.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-2 ${
                            project.health === 'green' ? 'bg-green-500' :
                            project.health === 'yellow' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}></div>
                          <span className="text-sm text-gray-900 capitalize">{project.health}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.budget ? `$${project.budget.toLocaleString()}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.actual_cost !== undefined ? `$${project.actual_cost.toLocaleString()}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {project.budget && project.actual_cost !== undefined ? (
                          <div className={`${variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${Math.abs(variance).toLocaleString()} ({variancePercentage.toFixed(1)}%)
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
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