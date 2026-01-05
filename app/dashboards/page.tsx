'use client'

import { useAuth } from '../providers/SupabaseAuthProvider'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, ComposedChart
} from 'recharts'
import AppLayout from '../../components/AppLayout'
import { getApiUrl } from '../../lib/api'
import { 
  Filter, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, DollarSign,
  RefreshCw, Eye, EyeOff, Maximize2, Minimize2, Download, Settings, Bell
} from 'lucide-react'
import { supabase } from '../../lib/supabase-minimal'

interface Project {
  id: string
  name: string
  description?: string | null
  status: string
  health: 'green' | 'yellow' | 'red'
  budget?: number | null
  actual_cost?: number | null
  start_date?: string | null
  end_date?: string | null
  portfolio_id: string
  created_at: string
}

interface PortfolioMetrics {
  total_projects: number
  active_projects: number
  completed_projects: number
  health_distribution: { green: number; yellow: number; red: number }
  budget_summary: {
    total_budget: number
    total_actual: number
    variance: number
  }
  // Enhanced metrics from the API
  resource_utilization?: number
  risk_score?: number
  on_time_delivery?: number
  cost_performance_index?: number
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

interface TrendData {
  date: string
  projects: number
  budget: number
  actual: number
  health_score: number
}

interface AlertItem {
  id: string
  type: 'budget' | 'timeline' | 'health' | 'resource'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  project_id?: string
  created_at: string
}

interface DashboardSettings {
  autoRefresh: boolean
  refreshInterval: number // seconds
  showAdvancedMetrics: boolean
  compactView: boolean
  enableNotifications: boolean
}

export default function Dashboards() {
  const { session } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null)
  const [kpis, setKPIs] = useState<KPIs | null>(null)
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filters, setFilters] = useState<DashboardFilters>({
    status: 'all',
    health: 'all',
    portfolio_id: 'all',
    date_range: 'all'
  })
  const [showFilters, setShowFilters] = useState(false)
  const [settings, setSettings] = useState<DashboardSettings>({
    autoRefresh: true,
    refreshInterval: 30,
    showAdvancedMetrics: true,
    compactView: false,
    enableNotifications: true
  })
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set())
  const [hiddenCharts, setHiddenCharts] = useState<Set<string>>(new Set())

  // Real-time updates with Supabase subscriptions
  useEffect(() => {
    if (!session) return

    const projectsSubscription = supabase
      .channel('projects-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          console.log('Project change detected:', payload)
          // Refresh data when projects change
          fetchDashboardData()
        }
      )
      .subscribe()

    const risksSubscription = supabase
      .channel('risks-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'risks' },
        (payload) => {
          console.log('Risk change detected:', payload)
          generateAlerts()
        }
      )
      .subscribe()

    return () => {
      projectsSubscription.unsubscribe()
      risksSubscription.unsubscribe()
    }
  }, [session])

  // Auto-refresh functionality
  useEffect(() => {
    if (!settings.autoRefresh || !session) return

    const interval = setInterval(() => {
      fetchDashboardData()
    }, settings.refreshInterval * 1000)

    return () => clearInterval(interval)
  }, [settings.autoRefresh, settings.refreshInterval, session])

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

  // Critical alerts calculation
  const criticalAlerts = useMemo(() => {
    return alerts.filter(alert => alert.severity === 'critical' || alert.severity === 'high')
  }, [alerts])

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

  const refreshData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchDashboardData()
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  async function fetchDashboardData() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchProjects(),
        fetchPortfolioMetrics(),
        fetchKPIs(),
        fetchTrendData(),
        generateAlerts()
      ])
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchProjects() {
    if (!session?.access_token) throw new Error('Not authenticated')
    
    try {
      const response = await fetch(getApiUrl('/projects/'), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`)
      }
      
      const data = await response.json()
      setProjects(Array.isArray(data) ? data as Project[] : [])
    } catch (error: unknown) {
      console.error('Error fetching projects:', error)
      throw error instanceof Error ? error : new Error('Unknown error fetching projects')
    }
  }

  async function fetchPortfolioMetrics() {
    if (!session?.access_token) return
    
    try {
      const portfolioParam = filters.portfolio_id !== 'all' ? `?portfolio_id=${filters.portfolio_id}` : ''
      const response = await fetch(getApiUrl(`/portfolio/metrics${portfolioParam}`), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch portfolio metrics: ${response.status}`)
      }
      
      const data = await response.json()
      // Extract the metrics from the API response structure
      setPortfolioMetrics(data.metrics as PortfolioMetrics)
    } catch (error: unknown) {
      console.error('Error fetching portfolio metrics:', error)
    }
  }

  async function fetchKPIs() {
    if (!session?.access_token) return
    
    try {
      const portfolioParam = filters.portfolio_id !== 'all' ? `?portfolio_id=${filters.portfolio_id}` : ''
      const response = await fetch(getApiUrl(`/portfolio/kpis${portfolioParam}`), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch KPIs: ${response.status}`)
      }
      
      const data = await response.json()
      setKPIs(data.kpis as KPIs)
    } catch (error: unknown) {
      console.error('Error fetching KPIs:', error)
    }
  }

  async function fetchTrendData() {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/portfolio/trends?days=30'), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch trend data: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Transform trend data for charts
      const transformedData = data.trend_data?.map((item: any) => ({
        date: new Date(item.date).toLocaleDateString(),
        projects: item.projects_count || 0,
        budget: item.spending || 0,
        actual: item.spending || 0,
        health_score: Math.random() * 3 // Placeholder - would be calculated from actual data
      })) || []
      
      setTrendData(transformedData)
    } catch (error: unknown) {
      console.error('Error fetching trend data:', error)
    }
  }

  async function generateAlerts() {
    if (!session?.access_token) return
    
    try {
      // Generate alerts based on current data
      const newAlerts: AlertItem[] = []
      
      // Budget alerts
      const budgetResponse = await fetch(getApiUrl('/financial-tracking/budget-alerts?threshold_percentage=80'), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (budgetResponse.ok) {
        const budgetData = await budgetResponse.json()
        budgetData.alerts?.forEach((alert: any) => {
          newAlerts.push({
            id: `budget-${alert.project_id}`,
            type: 'budget',
            severity: alert.alert_level === 'critical' ? 'critical' : 'high',
            title: 'Budget Alert',
            description: alert.message,
            project_id: alert.project_id,
            created_at: new Date().toISOString()
          })
        })
      }
      
      // Health-based alerts
      projects.forEach(project => {
        if (project.health === 'red') {
          newAlerts.push({
            id: `health-${project.id}`,
            type: 'health',
            severity: 'critical',
            title: 'Critical Project Health',
            description: `Project "${project.name}" requires immediate attention`,
            project_id: project.id,
            created_at: new Date().toISOString()
          })
        } else if (project.health === 'yellow') {
          newAlerts.push({
            id: `health-${project.id}`,
            type: 'health',
            severity: 'medium',
            title: 'Project At Risk',
            description: `Project "${project.name}" is showing warning signs`,
            project_id: project.id,
            created_at: new Date().toISOString()
          })
        }
      })
      
      setAlerts(newAlerts)
    } catch (error: unknown) {
      console.error('Error generating alerts:', error)
    }
  }

  const handleFilterChange = (filterType: keyof DashboardFilters, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }))
  }

  const toggleChartExpansion = (chartId: string) => {
    setExpandedCharts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(chartId)) {
        newSet.delete(chartId)
      } else {
        newSet.add(chartId)
      }
      return newSet
    })
  }

  const toggleChartVisibility = (chartId: string) => {
    setHiddenCharts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(chartId)) {
        newSet.delete(chartId)
      } else {
        newSet.add(chartId)
      }
      return newSet
    })
  }

  const exportDashboardData = () => {
    const exportData = {
      projects: filteredProjects,
      metrics: portfolioMetrics,
      kpis,
      trends: trendData,
      alerts: criticalAlerts,
      exported_at: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Chart data preparation
  const healthChartData = portfolioMetrics?.health_distribution ? [
    { name: 'Healthy', value: portfolioMetrics.health_distribution.green || 0, color: '#10B981' },
    { name: 'At Risk', value: portfolioMetrics.health_distribution.yellow || 0, color: '#F59E0B' },
    { name: 'Critical', value: portfolioMetrics.health_distribution.red || 0, color: '#EF4444' }
  ] : []

  const statusChartData = projects.length > 0 ? (() => {
    const statusCounts = projects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
      value: count,
      color: status === 'completed' ? '#10B981' : 
             status === 'active' ? '#3B82F6' :
             status === 'on-hold' ? '#F59E0B' :
             status === 'cancelled' ? '#EF4444' : '#6B7280'
    }))
  })() : []

  const budgetChartData = filteredProjects
    .filter(p => p.budget && p.actual_cost !== undefined)
    .map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      budget: p.budget || 0,
      actual: p.actual_cost || 0,
      variance: (p.actual_cost || 0) - (p.budget || 0),
      health: p.health
    }))

  const timelineData = filteredProjects
    .filter(p => p.start_date && p.end_date)
    .map(p => {
      const start = new Date(p.start_date!)
      const end = new Date(p.end_date!)
      const now = new Date()
      const total = end.getTime() - start.getTime()
      const elapsed = now.getTime() - start.getTime()
      const progress = Math.max(0, Math.min(100, (elapsed / total) * 100))
      
      return {
        name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        progress,
        health: p.health,
        status: p.status
      }
    })

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
        {/* Enhanced Header with Real-time Status */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
              {criticalAlerts.length > 0 && (
                <div className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {criticalAlerts.length} Critical Alert{criticalAlerts.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
              {portfolioMetrics && (
                <span>{portfolioMetrics.total_projects || 0} projects</span>
              )}
              {lastUpdated && (
                <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              )}
              {settings.autoRefresh && (
                <span className="flex items-center text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                  Auto-refresh: {settings.refreshInterval}s
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={exportDashboardData}
              className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>
        </div>

        {/* Critical Alerts Banner */}
        {criticalAlerts.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">Critical Alerts Require Attention</h3>
                <div className="mt-2 space-y-1">
                  {criticalAlerts.slice(0, 3).map(alert => (
                    <div key={alert.id} className="text-sm text-red-700">
                      <span className="font-medium">{alert.title}:</span> {alert.description}
                    </div>
                  ))}
                  {criticalAlerts.length > 3 && (
                    <div className="text-sm text-red-600">
                      +{criticalAlerts.length - 3} more alerts
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Filter Panel */}
        {showFilters && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              
              <div className="flex items-end">
                <div className="w-full space-y-2">
                  <label className="flex items-center text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={settings.autoRefresh}
                      onChange={(e) => setSettings(prev => ({ ...prev, autoRefresh: e.target.checked }))}
                      className="mr-2"
                    />
                    Auto-refresh
                  </label>
                  {settings.autoRefresh && (
                    <select
                      value={settings.refreshInterval}
                      onChange={(e) => setSettings(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) }))}
                      className="w-full p-1 text-xs border border-gray-300 rounded"
                    >
                      <option value={10}>10s</option>
                      <option value={30}>30s</option>
                      <option value={60}>1m</option>
                      <option value={300}>5m</option>
                    </select>
                  )}
                </div>
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
                        {project.actual_cost !== null && project.actual_cost !== undefined ? `$${project.actual_cost.toLocaleString()}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {project.budget && project.actual_cost !== null && project.actual_cost !== undefined ? (
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