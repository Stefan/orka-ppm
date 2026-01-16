'use client'

import { useEffect, useState, useMemo, Suspense, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import { getApiUrl, apiRequest } from '../../lib/api/client'
import { 
  loadDashboardData, 
  clearDashboardCache,
  type QuickStats,
  type KPIs,
  type Project
} from '../../lib/api/dashboard-loader'
import ProjectCard from './components/ProjectCard'
import { useCrossDeviceSync } from '../../hooks/useCrossDeviceSync'
import { useAutoPrefetch } from '../../hooks/useRoutePrefetch'
import { TrendingUp, AlertTriangle, CheckCircle, Clock, DollarSign, RefreshCw, Eye, Users, BarChart3, GitBranch, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ComponentErrorBoundary } from '../../components/error-boundaries/ComponentErrorBoundary'
import { SkeletonCard, SkeletonChart } from '../../components/ui/skeletons'
import type { DashboardWidget } from '../../components/ui/organisms/AdaptiveDashboard'

// Dynamic imports for heavy components (code splitting)
const VarianceKPIs = dynamic(() => import('./components/VarianceKPIs'), {
  loading: () => (
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <SkeletonCard key={i} variant="stat" />
      ))}
    </div>
  ),
  ssr: false
})

const VarianceTrends = dynamic(() => import('./components/VarianceTrends'), {
  loading: () => <SkeletonChart variant="line" height="h-80" />,
  ssr: false
})

const VarianceAlerts = dynamic(() => import('./components/VarianceAlerts'), {
  loading: () => <SkeletonCard variant="stat" />,
  ssr: false
})

const VirtualizedProjectList = dynamic(() => import('../../components/ui/VirtualizedProjectList'), {
  loading: () => (
    <div className="divide-y divide-gray-200">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="px-6 py-4">
          <div className="animate-pulse flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-1/6"></div>
          </div>
        </div>
      ))}
    </div>
  ),
  ssr: false
})

const AdaptiveDashboard = dynamic(() => import('../../components/ui/organisms/AdaptiveDashboard').then(mod => ({ default: mod.default })), {
  loading: () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="animate-pulse space-y-4">
        <div className="h-5 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  ),
  ssr: false
})

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

  // Prefetch /resources route for instant navigation
  useAutoPrefetch(['/resources', '/scenarios', '/financials'], 1500)

  // Cross-device synchronization
  const {
    preferences,
    updatePreferences,
    initialize: initializeSync,
    isSyncing,
    lastSyncTime
  } = useCrossDeviceSync()

  // Loading component for Suspense fallbacks
  const LoadingFallback = ({ message = "Loading..." }: { message?: string }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
      <p className="text-sm text-gray-500 mt-2">{message}</p>
    </div>
  )

  // Error component for error boundaries
  const ErrorFallback = ({ error, onRetry }: { error: Error; onRetry: () => void }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">Component Error</h3>
          <p className="text-sm text-red-700 mt-1">{error.message}</p>
          <button
            onClick={onRetry}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )

  // Optimized data loading with parallel requests, caching, and progressive loading
  const loadOptimizedData = useCallback(async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Use progressive loading: show critical data first, then secondary data
      await loadDashboardData(
        session.access_token,
        // Callback for critical data (QuickStats + KPIs)
        (criticalData) => {
          setQuickStats(criticalData.quickStats)
          setKPIs(criticalData.kpis)
          setLoading(false) // Stop loading spinner once critical data is ready
          setLastUpdated(new Date())
        },
        // Callback for secondary data (Projects)
        (projects) => {
          setRecentProjects(projects)
        }
      )
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
      setLoading(false)
    }
  }, [session?.access_token])

  // Optimized loading with progressive data loading
  useEffect(() => {
    if (session?.access_token) {
      loadOptimizedData()
      // Initialize cross-device sync
      if (session.user?.id) {
        initializeSync(session.user.id)
      }
    }
  }, [session, initializeSync, loadOptimizedData])

  // Sync dashboard preferences when they change
  useEffect(() => {
    if (preferences?.dashboardLayout) {
      setDashboardLayout(preferences.dashboardLayout.layout)
      setDashboardWidgets(preferences.dashboardLayout.widgets || [])
      setShowAdaptiveDashboard((preferences.dashboardLayout.widgets?.length || 0) > 0)
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
          items: recentProjects?.slice(0, 5)?.map(project => ({
            name: project?.name || 'Unknown Project',
            status: project?.health === 'green' ? 'success' : 
                   project?.health === 'yellow' ? 'warning' : 'error'
          })) || []
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

  // Quick refresh (optimized with cache clearing)
  const quickRefresh = useCallback(async () => {
    if (!session?.access_token) return
    
    try {
      // Clear cache to force fresh data
      clearDashboardCache()
      await loadOptimizedData()
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, [session?.access_token, loadOptimizedData])

  // Handle dashboard widget updates and sync across devices
  const handleWidgetUpdate = useCallback(async (widgets: DashboardWidget[]) => {
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
  }, [preferences, updatePreferences])

  // Handle layout changes and sync across devices
  const handleLayoutChange = useCallback(async (layout: 'grid' | 'masonry' | 'list') => {
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
  }, [preferences, updatePreferences])

  // Toggle between adaptive and traditional dashboard
  const toggleDashboardMode = useCallback(() => {
    setShowAdaptiveDashboard(!showAdaptiveDashboard)
  }, [showAdaptiveDashboard])

  // Memoized calculations for performance
  const healthPercentages = useMemo(() => {
    if (!quickStats?.health_distribution) return { healthy: 0, atRisk: 0, critical: 0 }
    
    const total = quickStats?.total_projects || 1
    return {
      healthy: Math.round(((quickStats?.health_distribution?.green || 0) / total) * 100),
      atRisk: Math.round(((quickStats?.health_distribution?.yellow || 0) / total) * 100),
      critical: Math.round(((quickStats?.health_distribution?.red || 0) / total) * 100)
    }
  }, [quickStats])

  // Ultra-fast loading state
  if (loading) return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        
        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} variant="stat" />
          ))}
        </div>
        
        {/* Variance KPIs Skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} variant="stat" />
          ))}
        </div>
        
        {/* Health Overview Skeleton */}
        <div className="grid grid-cols-2 gap-6">
          <SkeletonChart variant="pie" />
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="animate-pulse space-y-4">
              <div className="h-5 bg-gray-200 rounded w-1/3"></div>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Variance Trends Skeleton */}
        <SkeletonChart variant="line" height="h-80" />
        
        {/* Recent Projects Skeleton */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="animate-pulse h-5 bg-gray-200 rounded w-1/4"></div>
          </div>
          <div className="divide-y divide-gray-200">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-6 py-4">
                <div className="animate-pulse flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Ultra-fast Header */}
        <div className="flex justify-between items-start space-y-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900 truncate">Portfolio Dashboard</h1>
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
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
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
              <span>AI Enhanced</span>
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
          <ComponentErrorBoundary
            componentName="AdaptiveDashboard"
            fallbackComponent={({ error, resetError }) => (
              <ErrorFallback error={error} onRetry={resetError} />
            )}
          >
            <Suspense fallback={<LoadingFallback message="Loading AI-enhanced dashboard..." />}>
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
            </Suspense>
          </ComponentErrorBoundary>
        ) : (
          <>
            {/* Traditional Dashboard Content */}
            {/* Ultra-fast KPI Cards */}
            {kpis && (
              <ComponentErrorBoundary
                componentName="KPICards"
                fallbackComponent={({ error, resetError }) => (
                  <ErrorFallback error={error} onRetry={resetError} />
                )}
              >
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Success Rate</p>
                        <p className="text-2xl font-bold text-green-600">{kpis?.project_success_rate || 0}%</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Budget Performance</p>
                        <p className="text-2xl font-bold text-blue-600">{kpis?.budget_performance || 0}%</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Timeline Performance</p>
                        <p className="text-2xl font-bold text-purple-600">{kpis?.timeline_performance || 0}%</p>
                      </div>
                      <Clock className="h-8 w-8 text-purple-600" />
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Active Projects</p>
                        <p className="text-2xl font-bold text-indigo-600">{kpis?.active_projects_ratio || 0}%</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-indigo-600" />
                    </div>
                  </div>
                </div>
              </ComponentErrorBoundary>
            )}

            {/* Variance KPIs Integration */}
            <ComponentErrorBoundary
              componentName="VarianceKPIs"
              fallbackComponent={({ error, resetError }) => (
                <ErrorFallback error={error} onRetry={resetError} />
              )}
            >
              <Suspense fallback={<LoadingFallback message="Loading variance KPIs..." />}>
                <VarianceKPIs session={session} selectedCurrency="USD" />
              </Suspense>
            </ComponentErrorBoundary>

            {/* Quick Health Overview */}
            {quickStats && (
              <ComponentErrorBoundary
                componentName="HealthOverview"
                fallbackComponent={({ error, resetError }) => (
                  <ErrorFallback error={error} onRetry={resetError} />
                )}
              >
                <div className="grid grid-cols-2 gap-6">
                  {/* Health Distribution */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Health</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0">
                          <div className="w-3 h-3 bg-green-500 rounded-full mr-3 flex-shrink-0"></div>
                          <span className="text-sm font-medium text-gray-700">Healthy</span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className="text-sm font-bold text-gray-900">{quickStats?.health_distribution?.green || 0}</span>
                          <span className="text-xs text-gray-500">({healthPercentages?.healthy || 0}%)</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3 flex-shrink-0"></div>
                          <span className="text-sm font-medium text-gray-700">At Risk</span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className="text-sm font-bold text-gray-900">{quickStats?.health_distribution?.yellow || 0}</span>
                          <span className="text-xs text-gray-500">({healthPercentages?.atRisk || 0}%)</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0">
                          <div className="w-3 h-3 bg-red-500 rounded-full mr-3 flex-shrink-0"></div>
                          <span className="text-sm font-medium text-gray-700">Critical</span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className="text-sm font-bold text-gray-900">{quickStats?.health_distribution?.red || 0}</span>
                          <span className="text-xs text-gray-500">({healthPercentages?.critical || 0}%)</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Simple Health Bar */}
                    <div className="mt-4">
                      <div className="flex h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="bg-green-500" 
                          style={{ width: `${healthPercentages?.healthy || 0}%` }}
                        >
                        </div>
                        <div 
                          className="bg-yellow-500" 
                          style={{ width: `${healthPercentages?.atRisk || 0}%` }}
                        >
                        </div>
                        <div 
                          className="bg-red-500" 
                          style={{ width: `${healthPercentages?.critical || 0}%` }}
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
                        <div className="text-xl sm:text-2xl font-bold text-blue-600">{quickStats?.total_projects || 0}</div>
                        <div className="text-sm text-gray-600">Total Projects</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold text-green-600">{quickStats?.active_projects || 0}</div>
                        <div className="text-sm text-gray-600">Active Projects</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold text-red-600">{quickStats?.critical_alerts || 0}</div>
                        <div className="text-sm text-gray-600">Critical Alerts</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold text-yellow-600">{quickStats?.at_risk_projects || 0}</div>
                        <div className="text-sm text-gray-600">At Risk</div>
                      </div>
                    </div>
                  </div>
                </div>
              </ComponentErrorBoundary>
            )}

            {/* Variance Trends */}
            <ComponentErrorBoundary
              componentName="VarianceTrends"
              fallbackComponent={({ error, resetError }) => (
                <ErrorFallback error={error} onRetry={resetError} />
              )}
            >
              <Suspense fallback={<LoadingFallback message="Loading variance trends..." />}>
                <VarianceTrends session={session} selectedCurrency="USD" />
              </Suspense>
            </ComponentErrorBoundary>

            {/* Variance Alerts */}
            <ComponentErrorBoundary
              componentName="VarianceAlerts"
              fallbackComponent={({ error, resetError }) => (
                <ErrorFallback error={error} onRetry={resetError} />
              )}
            >
              <Suspense fallback={<LoadingFallback message="Loading variance alerts..." />}>
                <VarianceAlerts session={session} onAlertCount={setVarianceAlertCount} />
              </Suspense>
            </ComponentErrorBoundary>

            {/* Recent Projects (Loaded in background) */}
            {(recentProjects?.length || 0) > 0 && (
              <ComponentErrorBoundary
                componentName="RecentProjects"
                fallbackComponent={({ error, resetError }) => (
                  <ErrorFallback error={error} onRetry={resetError} />
                )}
              >
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Projects</h3>
                  </div>
                  <VirtualizedProjectList 
                    projects={recentProjects} 
                    height={600}
                    itemHeight={120}
                  />
                </div>
              </ComponentErrorBoundary>
            )}

            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-5 gap-4">
                <button 
                  onClick={() => router.push('/scenarios')}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors min-h-[44px]"
                >
                  <div className="text-center">
                    <GitBranch className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700">What-If Scenarios</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => router.push('/dashboards')}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors min-h-[44px]"
                >
                  <div className="text-center">
                    <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700">View Detailed Charts</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => router.push('/resources')}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors min-h-[44px]"
                >
                  <div className="text-center">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700">Manage Resources</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => router.push('/financials')}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors min-h-[44px]"
                >
                  <div className="text-center">
                    <DollarSign className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-700">Financial Analysis</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => router.push('/reports')}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors min-h-[44px]"
                >
                  <div className="text-center">
                    <Eye className="h-8 w-8 text-gray-400 mx-auto mb-2" />
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