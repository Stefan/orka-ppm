'use client'

import { useEffect, useState, lazy, Suspense, useRef, startTransition, useMemo } from 'react'
import { useAuth } from '../../providers/SupabaseAuthProvider'
import AppLayout from '../../../components/shared/AppLayout'
import { 
  Clock, AlertTriangle, CheckCircle, 
  RefreshCw, Trash2, Database, Globe, X
} from 'lucide-react'
import { getApiUrl } from '../../../lib/api'
import { useTranslations } from '@/lib/i18n/context'
import ChartSkeleton from '../../../components/admin/ChartSkeleton'
import TableSkeleton from '../../../components/admin/TableSkeleton'
import StatsSkeleton from '../../../components/admin/StatsSkeleton'
import { usePerformanceMonitoring } from '../../../hooks/usePerformanceMonitoring'
import { LazyComponentErrorBoundary } from '../../../components/error-boundaries'

// Lazy load ChartSection to reduce initial bundle size
const ChartSection = lazy(() => import('../../../components/admin/ChartSection').then(module => ({
  default: module.ChartSection
})))

// Lazy load SlowQueriesTable to reduce initial bundle size
const SlowQueriesTable = lazy(() => import('../../../components/admin/SlowQueriesTable'))

// Lazy load CacheStatsCard to reduce initial bundle size
const CacheStatsCard = lazy(() => import('../../../components/admin/CacheStatsCard'))

interface PerformanceStats {
  endpoint_stats: Record<string, {
    total_requests: number
    avg_duration: number
    min_duration: number
    max_duration: number
    error_rate: number
    requests_per_minute: number
  }>
  total_requests: number
  total_errors: number
  slow_queries_count: number
  recent_slow_queries: Array<{
    endpoint: string
    duration: number
    timestamp: string
  }>
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  metrics: {
    total_requests: number
    error_rate: number
    slow_queries: number
    uptime: string
  }
  cache_status: string
}

interface CacheStats {
  type: string
  entries?: number
  timestamps?: number
  connected_clients?: number
  used_memory?: string
  keyspace_hits?: number
  keyspace_misses?: number
  hit_rate?: number
  error?: string
}

export default function PerformanceDashboard() {
  const { session } = useAuth()
  const t = useTranslations('adminPerformance')
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // AbortController ref to cancel pending requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Initialize performance monitoring
  const performanceMonitoring = usePerformanceMonitoring({
    enabled: true,
    reportInterval: 30000, // Report every 30 seconds
    analyticsEndpoint: getApiUrl('/api/analytics/performance'),
    onReport: (report) => {
      // Log metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Performance Report:', {
          webVitals: report.webVitals,
          longTasks: report.longTasks.length,
          customMetrics: report.customMetrics
        })
      }
    }
  })

  useEffect(() => {
    if (session) {
      fetchPerformanceData()
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchPerformanceData, 30000)
      return () => {
        clearInterval(interval)
        // Cancel any pending requests on unmount
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }
    }
    return undefined
  }, [session])

  async function fetchPerformanceData(isManualRefresh = false) {
    if (!session?.access_token) return
    
    // Cancel any pending requests before starting new ones
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new AbortController for this fetch cycle
    abortControllerRef.current = new AbortController()
    
    try {
      // Measure API call performance
      const fetchStart = performance.now()
      
      // Prioritize critical data (health and stats) over cache stats
      // Fetch health and stats first in parallel, then cache stats separately
      const [statsResponse, healthResponse] = await Promise.all([
        fetch(getApiUrl('/api/admin/performance/stats'), {
          headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
          signal: abortControllerRef.current.signal,
          cache: 'no-store'
        }),
        fetch(getApiUrl('/api/admin/performance/health'), {
          headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
          signal: abortControllerRef.current.signal,
          cache: 'no-store'
        })
      ])

      const fetchDuration = performance.now() - fetchStart
      
      // Record API call metrics
      performanceMonitoring.recordCustomMetric('api_fetch_duration', fetchDuration)
      performanceMonitoring.recordAPICall('/api/admin/performance/stats', fetchDuration, statsResponse.status)
      performanceMonitoring.recordAPICall('/api/admin/performance/health', fetchDuration, healthResponse.status)

      // Process critical responses immediately
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        if (statsData && typeof statsData === 'object') {
          startTransition(() => {
            setStats(statsData)
          })
        }
      }

      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        if (healthData && typeof healthData === 'object') {
          startTransition(() => {
            setHealth(healthData)
          })
        }
      }

      // Fetch cache stats with lower priority (non-blocking, fetched after critical data)
      fetch(getApiUrl('/api/admin/cache/stats'), {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
        signal: abortControllerRef.current.signal,
        cache: 'no-store'
      })
        .then(async (cacheResponse) => {
          const cacheDuration = performance.now() - fetchStart
          performanceMonitoring.recordAPICall('/api/admin/cache/stats', cacheDuration, cacheResponse.status)
          
          if (cacheResponse.ok) {
            const cacheData = await cacheResponse.json()
            if (cacheData && typeof cacheData === 'object') {
              startTransition(() => {
                setCacheStats(cacheData)
              })
            }
          }
        })
        .catch((err) => {
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error('Cache stats fetch error:', err)
          }
        })

    } catch (err) {
      // Don't set error if request was aborted (expected behavior)
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request cancelled')
        return
      }
      setError(err instanceof Error ? err.message : t('errors.fetchFailed'))
      
      // Record error metric
      performanceMonitoring.recordMetric('api_error', 1, { 
        error: err instanceof Error ? err.message : 'unknown' 
      })
    } finally {
      setLoading(false)
      if (!isManualRefresh) {
        setRefreshing(false)
      }
    }
  }

  async function clearCache(patterns: string[] = ['*']) {
    if (!session?.access_token) return
    
    try {
      setRefreshing(true)
      setError(null)
      setSuccessMessage(null)
      
      const response = await fetch(getApiUrl('/api/admin/cache/clear'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ patterns })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Cache cleared successfully:', result)
        
        // Show success message
        setSuccessMessage(t('cacheCleared'))
        
        // Refresh data after clearing cache
        await fetchPerformanceData(true)
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Failed to clear cache: ${response.status}`)
      }
    } catch (err) {
      console.error('Cache clear error:', err)
      setError(err instanceof Error ? err.message : t('errors.clearCacheFailed'))
    } finally {
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      await fetchPerformanceData(true) // Pass true to indicate manual refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.refreshFailed'))
    } finally {
      setRefreshing(false)
    }
  }

  // Prepare chart data - memoized to prevent recalculation on every render
  const endpointData = useMemo(() => {
    if (!stats?.endpoint_stats) return []
    
    return Object.entries(stats.endpoint_stats).map(([endpoint, data]) => ({
      endpoint: endpoint.length > 30 ? endpoint.substring(0, 30) + '...' : endpoint,
      fullEndpoint: endpoint, // Keep full endpoint for tooltips
      avg_duration: Math.round(data.avg_duration * 1000), // Convert to ms
      requests: data.total_requests,
      error_rate: data.error_rate,
      rpm: data.requests_per_minute
    })).slice(0, 10)
  }, [stats?.endpoint_stats])

  const slowQueriesData = useMemo(() => {
    if (!stats?.recent_slow_queries) return []
    
    return stats.recent_slow_queries.map(query => ({
      endpoint: query.endpoint,
      duration: Math.round(query.duration * 1000),
      time: new Date(query.timestamp).toLocaleTimeString()
    }))
  }, [stats?.recent_slow_queries])

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'unhealthy': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getHealthBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100'
      case 'degraded': return 'bg-yellow-100'
      case 'unhealthy': return 'bg-red-100'
      default: return 'bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    return t(`status.${status}` as any) || t('status.unknown')
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-600 mt-1">{t('subtitle')}</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </button>
            
            <button
              onClick={() => clearCache()}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('clearCache')}
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Health Status */}
        {health && (
          <div className={`p-6 rounded-lg border ${getHealthBg(health?.status || 'unknown')}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {health?.status === 'healthy' ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : health?.status === 'degraded' ? (
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                )}
                <div>
                  <h3 className={`text-lg font-semibold ${getHealthColor(health?.status || 'unknown')}`}>
                    {t('systemStatus')}: {getStatusText(health?.status || 'unknown')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t('lastUpdated')}: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">{t('totalRequests')}:</span>
                  <span className="ml-2 font-medium">{health?.metrics?.total_requests?.toLocaleString() || '0'}</span>
                </div>
                <div>
                  <span className="text-gray-600">{t('errorRate')}:</span>
                  <span className="ml-2 font-medium">{health?.metrics?.error_rate || '0'}%</span>
                </div>
                <div>
                  <span className="text-gray-600">{t('slowQueries')}:</span>
                  <span className="ml-2 font-medium">{health?.metrics?.slow_queries || '0'}</span>
                </div>
                <div>
                  <span className="text-gray-600">{t('cache')}:</span>
                  <span className="ml-2 font-medium">{health?.cache_status || 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('totalRequests')}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats?.total_requests?.toLocaleString() || '0'}
                </p>
              </div>
              <Globe className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('totalErrors')}</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats?.total_errors || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('slowQueries')}</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats?.slow_queries_count || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('cacheHitRate')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {cacheStats?.hit_rate ? `${cacheStats.hit_rate}%` : 'N/A'}
                </p>
              </div>
              <Database className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Charts - Lazy Loaded */}
        <LazyComponentErrorBoundary 
          componentName="ChartSection"
          fallbackMessage={t('errors.chartLoadFailed') || 'Unable to load charts'}
        >
          <Suspense fallback={
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          }>
            <ChartSection 
              endpointData={endpointData}
              slowQueriesData={slowQueriesData}
              translations={{
                endpointPerformance: t('endpointPerformance'),
                avgDuration: t('avgDuration'),
                totalRequestsLabel: t('totalRequestsLabel'),
                errorRate: t('errorRate'),
                requestsPerMin: t('requestsPerMin'),
                requestVolume: t('requestVolume')
              }}
            />
          </Suspense>
        </LazyComponentErrorBoundary>

        {/* Slow Queries - Lazy Loaded */}
        {slowQueriesData.length > 0 && (
          <LazyComponentErrorBoundary 
            componentName="SlowQueriesTable"
            fallbackMessage={t('errors.tableLoadFailed') || 'Unable to load slow queries table'}
          >
            <Suspense fallback={<TableSkeleton />}>
              <SlowQueriesTable 
                slowQueriesData={slowQueriesData}
                translations={{
                  recentSlowQueries: t('recentSlowQueries'),
                  endpoint: t('endpoint'),
                  duration: t('duration'),
                  time: t('time')
                }}
              />
            </Suspense>
          </LazyComponentErrorBoundary>
        )}

        {/* Cache Statistics - Lazy Loaded */}
        {cacheStats && (
          <LazyComponentErrorBoundary 
            componentName="CacheStatsCard"
            fallbackMessage={t('errors.cacheStatsLoadFailed') || 'Unable to load cache statistics'}
          >
            <Suspense fallback={<StatsSkeleton />}>
              <CacheStatsCard 
                cacheStats={cacheStats}
                translations={{
                  cacheStatistics: t('cacheStatistics'),
                  cacheType: t('cacheType'),
                  hitRate: t('hitRate'),
                  memoryUsed: t('memoryUsed'),
                  cacheEntries: t('cacheEntries'),
                  timestamps: t('timestamps')
                }}
              />
            </Suspense>
          </LazyComponentErrorBoundary>
        )}
      </div>
    </AppLayout>
  )
}