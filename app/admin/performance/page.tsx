'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../providers/SupabaseAuthProvider'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import AppLayout from '../../../components/shared/AppLayout'
import { 
  Clock, AlertTriangle, CheckCircle, 
  RefreshCw, Trash2, Database, Globe, X
} from 'lucide-react'
import { getApiUrl } from '../../../lib/api'

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
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (session) {
      fetchPerformanceData()
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchPerformanceData, 30000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [session])

  async function fetchPerformanceData(isManualRefresh = false) {
    if (!session?.access_token) return
    
    try {
      const [statsResponse, healthResponse, cacheResponse] = await Promise.all([
        fetch(getApiUrl('/admin/performance/stats'), {
          headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
        }),
        fetch(getApiUrl('/admin/performance/health'), {
          headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
        }),
        fetch(getApiUrl('/admin/cache/stats'), {
          headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
        })
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        // Validate the data structure before setting state
        if (statsData && typeof statsData === 'object') {
          setStats(statsData)
        } else {
          console.warn('Invalid stats data structure received:', statsData)
        }
      } else {
        console.error(`Stats API error: ${statsResponse.status} ${statsResponse.statusText}`)
      }

      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        if (healthData && typeof healthData === 'object') {
          setHealth(healthData)
        } else {
          console.warn('Invalid health data structure received:', healthData)
        }
      } else {
        console.error(`Health API error: ${healthResponse.status} ${healthResponse.statusText}`)
      }

      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json()
        if (cacheData && typeof cacheData === 'object') {
          setCacheStats(cacheData)
        } else {
          console.warn('Invalid cache data structure received:', cacheData)
        }
      } else {
        console.error(`Cache API error: ${cacheResponse.status} ${cacheResponse.statusText}`)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data')
    } finally {
      setLoading(false)
      // Only manage refreshing state if this is not a manual refresh
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
      
      const response = await fetch(getApiUrl('/admin/cache/clear'), {
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
        setSuccessMessage('Cache cleared successfully!')
        
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
      setError(err instanceof Error ? err.message : 'Failed to clear cache')
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
      setError(err instanceof Error ? err.message : 'Failed to refresh data')
    } finally {
      setRefreshing(false)
    }
  }

  // Prepare chart data
  const endpointData = stats && stats.endpoint_stats ? Object.entries(stats.endpoint_stats).map(([endpoint, data]) => ({
    endpoint: endpoint.length > 30 ? endpoint.substring(0, 30) + '...' : endpoint,
    fullEndpoint: endpoint, // Keep full endpoint for tooltips
    avg_duration: Math.round(data.avg_duration * 1000), // Convert to ms
    requests: data.total_requests,
    error_rate: data.error_rate,
    rpm: data.requests_per_minute
  })).slice(0, 10) : []

  const slowQueriesData = stats?.recent_slow_queries?.map(query => ({
    endpoint: query.endpoint,
    duration: Math.round(query.duration * 1000),
    time: new Date(query.timestamp).toLocaleTimeString()
  })) || []

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
            <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
            <p className="text-gray-600 mt-1">API performance monitoring and optimization</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={() => clearCache()}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cache
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
                    System Status: {health?.status ? (health.status.charAt(0).toUpperCase() + health.status.slice(1)) : 'Unknown'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Requests:</span>
                  <span className="ml-2 font-medium">{health?.metrics?.total_requests?.toLocaleString() || '0'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Error Rate:</span>
                  <span className="ml-2 font-medium">{health?.metrics?.error_rate || '0'}%</span>
                </div>
                <div>
                  <span className="text-gray-600">Slow Queries:</span>
                  <span className="ml-2 font-medium">{health?.metrics?.slow_queries || '0'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cache:</span>
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
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
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
                <p className="text-sm font-medium text-gray-600">Total Errors</p>
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
                <p className="text-sm font-medium text-gray-600">Slow Queries</p>
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
                <p className="text-sm font-medium text-gray-600">Cache Hit Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {cacheStats?.hit_rate ? `${cacheStats.hit_rate}%` : 'N/A'}
                </p>
              </div>
              <Database className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Endpoint Performance */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Endpoint Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={endpointData}>
                <XAxis dataKey="endpoint" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'avg_duration' ? `${value}ms` : value,
                    name === 'avg_duration' ? 'Avg Duration' : 
                    name === 'requests' ? 'Total Requests' : 
                    name === 'error_rate' ? 'Error Rate %' : 'RPM'
                  ]}
                  labelFormatter={(label, payload) => {
                    const data = payload?.[0]?.payload;
                    return data?.fullEndpoint || label;
                  }}
                />
                <Legend />
                <Bar dataKey="avg_duration" fill="#3B82F6" name="Avg Duration (ms)" />
                <Bar dataKey="error_rate" fill="#EF4444" name="Error Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Request Volume */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Volume</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={endpointData}>
                <XAxis dataKey="endpoint" />
                <YAxis />
                <Tooltip 
                  labelFormatter={(label, payload) => {
                    const data = payload?.[0]?.payload;
                    return data?.fullEndpoint || label;
                  }}
                />
                <Legend />
                <Bar dataKey="requests" fill="#10B981" name="Total Requests" />
                <Bar dataKey="rpm" fill="#F59E0B" name="Requests/Min" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Slow Queries */}
        {slowQueriesData.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Slow Queries</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {slowQueriesData.map((query, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 text-sm text-gray-900 break-words max-w-0">
                        <div 
                          className="font-mono text-xs bg-gray-100 px-2 py-1 rounded cursor-help" 
                          title={query.endpoint}
                        >
                          {query.endpoint}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {query.duration}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {query.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cache Statistics */}
        {cacheStats && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cache Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {cacheStats?.type?.toUpperCase() || 'UNKNOWN'}
                </div>
                <div className="text-sm text-gray-600">Cache Type</div>
              </div>
              
              {cacheStats?.type === 'redis' ? (
                <>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {cacheStats?.hit_rate || 0}%
                    </div>
                    <div className="text-sm text-gray-600">Hit Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {cacheStats?.used_memory || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">Memory Used</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {cacheStats?.entries || 0}
                    </div>
                    <div className="text-sm text-gray-600">Cache Entries</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {cacheStats?.timestamps || 0}
                    </div>
                    <div className="text-sm text-gray-600">Timestamps</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}