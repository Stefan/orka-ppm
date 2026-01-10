'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import { getApiUrl, apiRequest } from '../../lib/api/client'
import VarianceKPIs from './components/VarianceKPIs'
import VarianceTrends from './components/VarianceTrends'
import VarianceAlerts from './components/VarianceAlerts'
import { AdaptiveDashboard, DashboardWidget } from '../../components/ui/organisms/AdaptiveDashboard'
import { useCrossDeviceSync } from '../../hooks/useCrossDeviceSync'
import { TrendingUp, AlertTriangle, CheckCircle, Clock, DollarSign, RefreshCw, Eye, Users, BarChart3, GitBranch, Zap, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface QuickStats {
  total_projects: number
  active_projects: number
  health_distribution: { green: number; yellow: number; red: number }
  critical_alerts: number
  at_risk_projects: number
}

interface KPIs {
  project_success_rate: number
  budget_performance: number
  timeline_performance: number
  average_health_score: number
  resource_efficiency: number
  active_projects_ratio: number
}

interface Project {
  id: string
  name: string
  status: string
  health: 'green' | 'yellow' | 'red'
  budget?: number | null
  created_at: string
}

export default function UltraFastDashboard() {
  const { session } = useAuth()
  const router = useRouter()
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null)
  const [kpis, setKPIs] = useState<KPIs | null>(null)
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [varianceAlertCount, setVarianceAlertCount] = useState(0)
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([])
  const [dashboardLayout, setDashboardLayout] = useState<'grid' | 'masonry' | 'list'>('grid')
  const [showAdaptiveDashboard, setShowAdaptiveDashboard] = useState(false)

  // Cross-device synchronization
  const {
    preferences,
    sessionState,
    updatePreferences,
    restoreSession,
    initialize: initializeSync,
    isSyncing,
    lastSyncTime
  } = useCrossDeviceSync()

  // Ultra-fast loading - with fallback to existing endpoints
  useEffect(() => {
    if (session) {
      loadEssentialData()
      // Initialize cross-device sync
      if (session.user?.id) {
        initializeSync(session.user.id)
      }
    }
  }, [session, initializeSync])

  // Sync dashboard preferences when they change
  useEffect(() => {
    if (preferences?.dashboardLayout) {
      setDashboardLayout(preferences.dashboardLayout.layout)
      setDashboardWidgets(preferences.dashboardLayout.widgets)
      setShowAdaptiveDashboard(preferences.dashboardLayout.widgets.length > 0)
    }
  }, [preferences])

  // Generate dashboard widgets from existing data
  useEffect(() => {
    if (quickStats && kpis && !showAdaptiveDashboard) {
      generateDashboardWidgets()
    }
  }, [quickStats, kpis, showAdaptiveDashboard])

  const generateDashboardWidgets = () => {
    const widgets: DashboardWidget[] = [
      {
        id: 'project-success-rate',
        type: 'metric',
        title: 'Project Success Rate',
        data: {
          value: `${kpis?.project_success_rate || 0}%`,
          label: 'Success Rate',
          change: 5.2
        },
        size: 'small',
        position: { x: 0, y: 0 },
        priority: 1
      },
      {
        id: 'budget-performance',
        type: 'metric',
        title: 'Budget Performance',
        data: {
          value: `${kpis?.budget_performance || 0}%`,
          label: 'Budget Efficiency',
          change: -2.1
        },
        size: 'small',
        position: { x: 1, y: 0 },
        priority: 2
      },
      {
        id: 'timeline-performance',
        type: 'metric',
        title: 'Timeline Performance',
        data: {
          value: `${kpis?.timeline_performance || 0}%`,
          label: 'On-Time Delivery',
          change: 3.7
        },
        size: 'small',
        position: { x: 2, y: 0 },
        priority: 3
      },
      {
        id: 'active-projects-ratio',
        type: 'metric',
        title: 'Active Projects',
        data: {
          value: `${kpis?.active_projects_ratio || 0}%`,
          label: 'Active Ratio',
          change: 1.2
        },
        size: 'small',
        position: { x: 3, y: 0 },
        priority: 4
      },
      {
        id: 'project-health-overview',
        type: 'chart',
        title: 'Project Health Overview',
        data: {
          healthy: quickStats?.health_distribution?.green || 0,
          atRisk: quickStats?.health_distribution?.yellow || 0,
          critical: quickStats?.health_distribution?.red || 0
        },
        size: 'medium',
        position: { x: 0, y: 1 },
        priority: 5
      },
      {
        id: 'recent-projects-list',
        type: 'list',
        title: 'Recent Projects',
        data: {
          items: recentProjects.slice(0, 5).map(project => ({
            name: project.name,
            status: project.health === 'green' ? 'success' : 
                   project.health === 'yellow' ? 'warning' : 'error'
          }))
        },
        size: 'medium',
        position: { x: 2, y: 1 },
        priority: 6
      }
    ]

    // Add AI-powered insights if variance alerts exist
    if (varianceAlertCount > 0) {
      widgets.push({
        id: 'ai-budget-insight',
        type: 'ai-insight',
        title: 'Budget Optimization Insight',
        data: {
          insight: `Detected ${varianceAlertCount} budget variance${varianceAlertCount !== 1 ? 's' : ''}. Consider reallocating resources from over-performing projects to those at risk.`,
          confidence: 0.85,
          impact: 'high',
          actions: ['View Details', 'Apply Suggestions', 'Dismiss']
        },
        size: 'large',
        position: { x: 0, y: 2 },
        priority: 1,
        aiRecommended: true
      })
    }

    setDashboardWidgets(widgets)
  }

  const loadEssentialData = async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Try optimized endpoint first, fallback to existing endpoints
      let data
      try {
        const response = await apiRequest('/optimized/dashboard/quick-stats') as any
        setQuickStats(response.quick_stats)
        setKPIs(response.kpis)
      } catch (optimizedError) {
        console.log('Using fallback endpoints...')
        // Fallback to existing endpoints with minimal data
        data = await loadFallbackData()
      }
      
      setLastUpdated(new Date())
      
      // Load recent projects in background (non-blocking)
      loadRecentProjects()
      
    } catch (err) {
      console.error('Dashboard load error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      
      // Show fallback data instead of error
      setQuickStats({
        total_projects: 0,
        active_projects: 0,
        health_distribution: { green: 0, yellow: 0, red: 0 },
        critical_alerts: 0,
        at_risk_projects: 0
      })
      setKPIs({
        project_success_rate: 0,
        budget_performance: 0,
        timeline_performance: 0,
        average_health_score: 0,
        resource_efficiency: 0,
        active_projects_ratio: 0
      })
    } finally {
      setLoading(false)
    }
  }

  // Fallback data loading using existing endpoints
  const loadFallbackData = async () => {
    if (!session?.access_token) return { quickStats: null, kpis: null }
    
    const [projectsResponse, portfolioResponse] = await Promise.all([
      fetch(getApiUrl('/projects'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      }),
      fetch(getApiUrl('/portfolios/metrics'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      }).catch(() => null) // Graceful fallback if metrics endpoint doesn't exist
    ])

    let projects = []
    let portfolioMetrics = null

    if (projectsResponse.ok) {
      const projectsData = await projectsResponse.json()
      projects = Array.isArray(projectsData) ? projectsData : (projectsData.projects || [])
    }

    if (portfolioResponse && portfolioResponse.ok) {
      portfolioMetrics = await portfolioResponse.json()
    }

    // Calculate stats from projects data
    const projectsArray = Array.isArray(projects) ? projects : []
    const totalProjects = projectsArray.length
    const activeProjects = projectsArray.filter((p: any) => p.status === 'active').length
    const healthDistribution = projectsArray.reduce((acc: any, project: any) => {
      const health = project.health || 'green'
      acc[health] = (acc[health] || 0) + 1
      return acc
    }, { green: 0, yellow: 0, red: 0 })

    const quickStats = {
      total_projects: totalProjects,
      active_projects: activeProjects,
      health_distribution: healthDistribution,
      critical_alerts: healthDistribution.red || 0,
      at_risk_projects: healthDistribution.yellow || 0
    }

    const kpis = portfolioMetrics || {
      project_success_rate: 85,
      budget_performance: 92,
      timeline_performance: 78,
      average_health_score: 2.1,
      resource_efficiency: 88,
      active_projects_ratio: Math.round((activeProjects / Math.max(totalProjects, 1)) * 100)
    }

    setQuickStats(quickStats)
    setKPIs(kpis)

    return { quickStats, kpis }
  }

  // Background loading of projects (non-blocking)
  const loadRecentProjects = async () => {
    try {
      try {
        const response = await apiRequest('/optimized/dashboard/projects-summary?limit=5') as any
        const projects = response.projects || response.slice(0, 5) || []
        setRecentProjects(projects)
      } catch (optimizedError) {
        // Fallback to regular projects endpoint
        const response = await apiRequest('/projects?limit=5') as any
        const projects = response.projects || response.slice(0, 5) || []
        setRecentProjects(projects)
      }
    } catch (err) {
      console.error('Projects load error:', err)
      // Fail silently - don't block main dashboard
    }
  }

  // Quick refresh (optimized)
  const quickRefresh = async () => {
    if (!session?.access_token) return
    
    try {
      await loadEssentialData()
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }

  // Handle dashboard widget updates and sync across devices
  const handleWidgetUpdate = async (widgets: DashboardWidget[]) => {
    setDashboardWidgets(widgets)
    
    // Sync dashboard preferences across devices
    if (preferences) {
      await updatePreferences({
        ...preferences,
        dashboardLayout: {
          ...preferences.dashboardLayout,
          widgets
        }
      })
    }
  }

  // Handle layout changes and sync across devices
  const handleLayoutChange = async (layout: 'grid' | 'masonry' | 'list') => {
    setDashboardLayout(layout)
    
    // Sync layout preference across devices
    if (preferences) {
      await updatePreferences({
        ...preferences,
        dashboardLayout: {
          ...preferences.dashboardLayout,
          layout
        }
      })
    }
  }

  // Toggle between adaptive and traditional dashboard
  const toggleDashboardMode = () => {
    setShowAdaptiveDashboard(!showAdaptiveDashboard)
  }

  // Memoized calculations for performance
  const healthPercentages = useMemo(() => {
    if (!quickStats || !quickStats.health_distribution) return { healthy: 0, atRisk: 0, critical: 0 }
    
    const total = quickStats.total_projects || 1
    return {
      healthy: Math.round((quickStats.health_distribution.green / total) * 100),
      atRisk: Math.round((quickStats.health_distribution.yellow / total) * 100),
      critical: Math.round((quickStats.health_distribution.red / total) * 100)
    }
  }, [quickStats])

  // Ultra-fast loading state
  if (loading) return (
    <AppLayout>
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Ultra-fast Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">Portfolio Dashboard</h1>
              {quickStats && quickStats.critical_alerts > 0 && (
                <div className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium w-fit">
                  <AlertTriangle className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span className="whitespace-nowrap">{quickStats.critical_alerts} Critical</span>
                </div>
              )}
              {varianceAlertCount > 0 && (
                <div className="flex items-center px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium w-fit">
                  <DollarSign className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span className="whitespace-nowrap">{varianceAlertCount} Budget Alert{varianceAlertCount !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-gray-600">
              {quickStats && <span className="whitespace-nowrap">{quickStats.total_projects} projects</span>}
              {lastUpdated && (
                <span className="whitespace-nowrap">Updated: {lastUpdated.toLocaleTimeString()}</span>
              )}
              {lastSyncTime && (
                <span className="whitespace-nowrap flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-1 flex-shrink-0 ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                  {isSyncing ? 'Syncing...' : 'Synced'}
                </span>
              )}
              <span className="flex items-center text-green-600 whitespace-nowrap">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 flex-shrink-0"></div>
                Live
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleDashboardMode}
              className="flex items-center justify-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              title={showAdaptiveDashboard ? 'Switch to Traditional View' : 'Switch to AI-Enhanced View'}
            >
              <Zap className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">{showAdaptiveDashboard ? 'Traditional' : 'AI Enhanced'}</span>
              <span className="sm:hidden">AI</span>
            </button>
            
            <button
              onClick={quickRefresh}
              className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Error Banner (if any) */}
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-yellow-800 break-words">
                Using fallback data - {error}
              </span>
            </div>
          </div>
        )}

        {/* Adaptive Dashboard or Traditional Dashboard */}
        {showAdaptiveDashboard && session?.user?.id ? (
          <AdaptiveDashboard
            userId={session.user.id}
            userRole={session.user.user_metadata?.role || 'user'}
            widgets={dashboardWidgets}
            layout={dashboardLayout}
            enableAI={true}
            enableDragDrop={true}
            onWidgetUpdate={handleWidgetUpdate}
            onLayoutChange={handleLayoutChange}
            className="mt-6"
          />
        ) : (
          <>
            {/* Traditional Dashboard Content */}
            {/* Ultra-fast KPI Cards */}
            {kpis && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Success Rate</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600">{kpis.project_success_rate}%</p>
                    </div>
                    <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                  </div>
                </div>
                
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Budget Performance</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600">{kpis.budget_performance}%</p>
                    </div>
                    <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                  </div>
                </div>
                
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Timeline Performance</p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-600">{kpis.timeline_performance}%</p>
                    </div>
                    <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
                  </div>
                </div>
                
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Projects</p>
                      <p className="text-xl sm:text-2xl font-bold text-indigo-600">{kpis.active_projects_ratio}%</p>
                    </div>
                    <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600" />
                  </div>
                </div>
              </div>
            )}

            {/* Variance KPIs Integration */}
            <VarianceKPIs session={session} selectedCurrency="USD" />

            {/* Quick Health Overview */}
            {quickStats && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                {/* Health Distribution */}
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Health</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3 flex-shrink-0"></div>
                        <span className="text-sm font-medium text-gray-700">Healthy</span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-sm font-bold text-gray-900">{quickStats.health_distribution?.green || 0}</span>
                        <span className="text-xs text-gray-500">({healthPercentages.healthy}%)</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3 flex-shrink-0"></div>
                        <span className="text-sm font-medium text-gray-700">At Risk</span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-sm font-bold text-gray-900">{quickStats.health_distribution?.yellow || 0}</span>
                        <span className="text-xs text-gray-500">({healthPercentages.atRisk}%)</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-3 flex-shrink-0"></div>
                        <span className="text-sm font-medium text-gray-700">Critical</span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-sm font-bold text-gray-900">{quickStats.health_distribution?.red || 0}</span>
                        <span className="text-xs text-gray-500">({healthPercentages.critical}%)</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Simple Health Bar */}
                  <div className="mt-4">
                    <div className="flex h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="bg-green-500" 
                        style={{ width: `${healthPercentages.healthy}%` }}
                      >
                      </div>
                      <div 
                        className="bg-yellow-500" 
                        style={{ width: `${healthPercentages.atRisk}%` }}
                      >
                      </div>
                      <div 
                        className="bg-red-500" 
                        style={{ width: `${healthPercentages.critical}%` }}
                      >
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-blue-600">{quickStats.total_projects}</div>
                      <div className="text-sm text-gray-600">Total Projects</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-green-600">{quickStats.active_projects}</div>
                      <div className="text-sm text-gray-600">Active Projects</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-red-600">{quickStats.critical_alerts}</div>
                      <div className="text-sm text-gray-600">Critical Alerts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-yellow-600">{quickStats.at_risk_projects}</div>
                      <div className="text-sm text-gray-600">At Risk</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Variance Trends */}
            <VarianceTrends session={session} selectedCurrency="USD" />

            {/* Variance Alerts */}
            <VarianceAlerts session={session} onAlertCount={setVarianceAlertCount} />

            {/* Recent Projects (Loaded in background) */}
            {recentProjects.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Projects</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {recentProjects.map((project) => (
                    <div key={project.id} className="px-4 sm:px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            project.health === 'green' ? 'bg-green-500' :
                            project.health === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          >
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium text-gray-900 truncate">{project.name}</h4>
                            <p className="text-sm text-gray-500 capitalize">{project.status.replace('-', ' ')}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {project.budget && (
                            <p className="text-sm font-medium text-gray-900">
                              ${project.budget.toLocaleString()}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {new Date(project.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <button 
                  onClick={() => router.push('/scenarios')}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors min-h-[44px]"
                >
                  <div className="text-center">
                    <GitBranch className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700">What-If Scenarios</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => router.push('/dashboards')}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors min-h-[44px]"
                >
                  <div className="text-center">
                    <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700">View Detailed Charts</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => router.push('/resources')}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors min-h-[44px]"
                >
                  <div className="text-center">
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700">Manage Resources</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => router.push('/financials')}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors min-h-[44px]"
                >
                  <div className="text-center">
                    <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700">Financial Analysis</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => router.push('/reports')}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors min-h-[44px]"
                >
                  <div className="text-center">
                    <Eye className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700">Generate Report</span>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}