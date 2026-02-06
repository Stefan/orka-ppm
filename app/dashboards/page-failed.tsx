'use client'

import './compact-dashboard.css'
import { useEffect, useState, useMemo, Suspense, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import PageContainer from '../../components/shared/PageContainer'
import { 
  loadDashboardData, 
  clearDashboardCache,
  type QuickStats,
  type KPIs,
  type Project
} from '../../lib/api/dashboard-loader'
import { useCrossDeviceSync } from '../../hooks/useCrossDeviceSync'
import { useAutoPrefetch } from '../../hooks/useRoutePrefetch'
import { TrendingUp, AlertTriangle, CheckCircle, Clock, DollarSign, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ComponentErrorBoundary } from '../../components/error-boundaries/ComponentErrorBoundary'
import { SkeletonCard, SkeletonChart } from '../../components/ui/skeletons'
import { useLanguage } from '../../hooks/useLanguage'
import { useTranslations } from '../../lib/i18n/context'

// Dynamic imports for heavy components
const VarianceKPIs = dynamic(() => import('./components/VarianceKPIs'), {
  loading: () => <div className="h-24 bg-gray-100 dark:bg-slate-700 animate-pulse rounded-lg"></div>,
  ssr: false
})

const VarianceTrends = dynamic(() => import('./components/VarianceTrends'), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-slate-700 animate-pulse rounded-lg"></div>,
  ssr: false
})

const VarianceAlerts = dynamic(() => import('./components/VarianceAlerts'), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-slate-700 animate-pulse rounded-lg"></div>,
  ssr: false
})

const VirtualizedProjectList = dynamic(() => import('../../components/ui/VirtualizedProjectList'), {
  loading: () => <div className="h-64 bg-gray-100 dark:bg-slate-700 animate-pulse rounded-lg"></div>,
  ssr: false
})

export default function ModernDashboard() {
  const { session } = useAuth()
  const router = useRouter()
  const { currentLanguage } = useLanguage()
  const { t } = useTranslations()
  
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null)
  const [kpis, setKPIs] = useState<KPIs | null>(null)
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [varianceAlertCount, setVarianceAlertCount] = useState(0)

  // Prefetch routes
  useAutoPrefetch(['/resources', '/scenarios', '/financials'], 1500)

  // Cross-device synchronization
  const {
    preferences,
    updatePreferences,
    initialize: initializeSync,
    isSyncing,
    lastSyncTime
  } = useCrossDeviceSync()

  // Error component
  const ErrorFallback = ({ error, onRetry }: { error: Error; onRetry: () => void }) => (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
      <div className="flex items-start">
        <AlertTriangle className="h-4 w-4 text-red-400 mr-2 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-xs font-medium text-red-800 dark:text-red-300">Error</h3>
          <p className="text-xs text-red-700 mt-0.5">{error.message}</p>
          <button
            onClick={onRetry}
            className="mt-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  )

  // Optimized data loading
  const loadOptimizedData = useCallback(async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    try {
      await loadDashboardData(
        session.access_token,
        (criticalData) => {
          setQuickStats(criticalData.quickStats)
          setKPIs(criticalData.kpis)
          setLoading(false)
          setLastUpdated(new Date())
        },
        (projects) => {
          setRecentProjects(projects)
        }
      )
    } catch (err) {
      console.error('Dashboard load error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      
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

  useEffect(() => {
    if (session?.access_token) {
      loadOptimizedData()
      if (session.user?.id) {
        initializeSync(session.user.id)
      }
    }
  }, [session, initializeSync, loadOptimizedData])

  // Quick refresh
  const quickRefresh = useCallback(async () => {
    if (!session?.access_token) return
    
    try {
      clearDashboardCache()
      await loadOptimizedData()
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, [session?.access_token, loadOptimizedData])

  // Memoized calculations
  const healthPercentages = useMemo(() => {
    if (!quickStats?.health_distribution) return { healthy: 0, atRisk: 0, critical: 0 }
    
    const total = quickStats?.total_projects || 1
    return {
      healthy: Math.round(((quickStats?.health_distribution?.green || 0) / total) * 100),
      atRisk: Math.round(((quickStats?.health_distribution?.yellow || 0) / total) * 100),
      critical: Math.round(((quickStats?.health_distribution?.red || 0) / total) * 100)
    }
  }, [quickStats])

  // Loading state
  if (loading) return (
    <AppLayout>
      <PageContainer maxWidth="wide" compact className="dashboard-compact">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  )

  return (
    <AppLayout>
      <PageContainer maxWidth="wide" compact className="dashboard-compact">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">{t('dashboard.title')}</h1>
            {quickStats && (
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                <span>{quickStats.total_projects} {t('dashboard.projects')}</span>
                {quickStats.critical_alerts > 0 && (
                  <span className="flex items-center px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 rounded-full font-medium">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {quickStats.critical_alerts}
                  </span>
                )}
                {varianceAlertCount > 0 && (
                  <span className="flex items-center px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 rounded-full font-medium">
                    {varianceAlertCount} Budget
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={quickRefresh}
              className="flex items-center px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 mb-3">
            <div className="flex items-center text-xs text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <span>Using fallback data</span>
            </div>
          </div>
        )}

        {/* Row 1: KPI Cards - 4 columns */}
        {kpis && (
          <ComponentErrorBoundary
            componentName="KPICards"
            fallbackComponent={({ error, resetError }) => (
              <ErrorFallback error={error} onRetry={resetError} />
            )}
          >
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-slate-400 mb-0.5">Success Rate</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{kpis?.project_success_rate || 0}%</p>
                  </div>
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-slate-400 mb-0.5">Budget</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{kpis?.budget_performance || 0}%</p>
                  </div>
                  <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-slate-400 mb-0.5">Timeline</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{kpis?.timeline_performance || 0}%</p>
                  </div>
                  <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 dark:text-slate-400 mb-0.5">Active</p>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{kpis?.active_projects_ratio || 0}%</p>
                  </div>
                  <TrendingUp className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </div>
          </ComponentErrorBoundary>
        )}

        {/* Row 2: Variance KPIs */}
        <ComponentErrorBoundary
          componentName="VarianceKPIs"
          fallbackComponent={({ error, resetError }) => (
            <ErrorFallback error={error} onRetry={resetError} />
          )}
        >
          <div className="mb-3">
            <Suspense fallback={<div className="h-24 bg-gray-100 dark:bg-slate-700 animate-pulse rounded-lg"></div>}>
              <VarianceKPIs session={session} selectedCurrency="USD" />
            </Suspense>
          </div>
        </ComponentErrorBoundary>

        {/* Row 3: Variance Trends (2/3) + Health & Stats (1/3) */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {/* Variance Trends */}
          <div className="col-span-2">
            <ComponentErrorBoundary
              componentName="VarianceTrends"
              fallbackComponent={({ error, resetError }) => (
                <ErrorFallback error={error} onRetry={resetError} />
              )}
            >
              <Suspense fallback={<div className="h-64 bg-gray-100 dark:bg-slate-700 animate-pulse rounded-lg"></div>}>
                <VarianceTrends session={session} selectedCurrency="USD" />
              </Suspense>
            </ComponentErrorBoundary>
          </div>

          {/* Health & Stats */}
          <div className="space-y-3">
            {quickStats && (
              <ComponentErrorBoundary
                componentName="HealthStats"
                fallbackComponent={({ error, resetError }) => (
                  <ErrorFallback error={error} onRetry={resetError} />
                )}
              >
                {/* Project Health */}
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-900 dark:text-slate-100 mb-2">Project Health</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div>
                        <span>Healthy</span>
                      </div>
                      <span className="font-bold">{quickStats?.health_distribution?.green || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1.5"></div>
                        <span>At Risk</span>
                      </div>
                      <span className="font-bold">{quickStats?.health_distribution?.yellow || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></div>
                        <span>Critical</span>
                      </div>
                      <span className="font-bold">{quickStats?.health_distribution?.red || 0}</span>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <div className="flex h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="bg-green-500" style={{ width: `${healthPercentages?.healthy || 0}%` }}></div>
                      <div className="bg-yellow-500" style={{ width: `${healthPercentages?.atRisk || 0}%` }}></div>
                      <div className="bg-red-500" style={{ width: `${healthPercentages?.critical || 0}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-900 dark:text-slate-100 mb-2">Quick Stats</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{quickStats?.total_projects || 0}</div>
                      <div className="text-xs text-gray-600 dark:text-slate-400">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">{quickStats?.active_projects || 0}</div>
                      <div className="text-xs text-gray-600 dark:text-slate-400">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600 dark:text-red-400">{quickStats?.critical_alerts || 0}</div>
                      <div className="text-xs text-gray-600 dark:text-slate-400">Alerts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{quickStats?.at_risk_projects || 0}</div>
                      <div className="text-xs text-gray-600 dark:text-slate-400">At Risk</div>
                    </div>
                  </div>
                </div>
              </ComponentErrorBoundary>
            )}
          </div>
        </div>

        {/* Row 4: Variance Alerts (1/3) + Recent Projects (2/3) */}
        <div className="grid grid-cols-3 gap-3">
          {/* Variance Alerts */}
          <div>
            <ComponentErrorBoundary
              componentName="VarianceAlerts"
              fallbackComponent={({ error, resetError }) => (
                <ErrorFallback error={error} onRetry={resetError} />
              )}
            >
              <Suspense fallback={<div className="h-64 bg-gray-100 dark:bg-slate-700 animate-pulse rounded-lg"></div>}>
                <VarianceAlerts session={session} onAlertCount={setVarianceAlertCount} />
              </Suspense>
            </ComponentErrorBoundary>
          </div>

          {/* Recent Projects */}
          <div className="col-span-2">
            {(recentProjects?.length || 0) > 0 && (
              <ComponentErrorBoundary
                componentName="RecentProjects"
                fallbackComponent={({ error, resetError }) => (
                  <ErrorFallback error={error} onRetry={resetError} />
                )}
              >
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-700">
                    <h3 className="text-xs font-semibold text-gray-900 dark:text-slate-100">Recent Projects</h3>
                  </div>
                  <VirtualizedProjectList 
                    projects={recentProjects} 
                    height={250}
                    itemHeight={70}
                  />
                </div>
              </ComponentErrorBoundary>
            )}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
