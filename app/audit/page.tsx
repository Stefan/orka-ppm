'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import { AlertTriangle, Clock, FileText, Search, BarChart3, Download, RefreshCw, FileDown } from 'lucide-react'
import { getApiUrl } from '../../lib/api/client'

// Tab types
type TabType = 'dashboard' | 'timeline' | 'anomalies' | 'search'

interface DashboardStats {
  total_events: number
  anomalies_count: number
  critical_events: number
  top_users: Array<{ user_id: string; count: number }>
  top_event_types: Array<{ event_type: string; count: number }>
  category_breakdown: { [key: string]: number }
  event_volume_24h: Array<{ hour: string; count: number }>
}

export default function AuditDashboard() {
  const { session } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [exportLoading, setExportLoading] = useState<'pdf' | 'csv' | null>(null)

  // Fetch dashboard stats
  const fetchDashboardStats = useCallback(async () => {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/audit/dashboard/stats'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${response.status}`)
      }
      
      const data = await response.json()
      setStats(data)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard stats')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  // Initial load
  useEffect(() => {
    if (session?.access_token) {
      fetchDashboardStats()
    }
  }, [session?.access_token, fetchDashboardStats])

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh || !session?.access_token) return
    
    const interval = setInterval(() => {
      fetchDashboardStats()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [autoRefresh, session?.access_token, fetchDashboardStats])

  // Handle export
  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!session?.access_token) return
    
    setExportLoading(format)
    try {
      const response = await fetch(getApiUrl(`/audit/export/${format}`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: {},
          include_summary: format === 'pdf'
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to export ${format.toUpperCase()}`)
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-report-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(`Error exporting ${format}:`, err)
      setError(err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}`)
    } finally {
      setExportLoading(null)
    }
  }

  // Check authentication
  if (!session) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Authentication Required</h3>
                <p className="mt-1 text-sm text-yellow-700">Please log in to access the audit dashboard.</p>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Audit Trail</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-gray-600">
                {stats && (
                  <>
                    <span>{stats.total_events} events</span>
                    <span>{stats.anomalies_count} anomalies</span>
                    <span>{stats.critical_events} critical</span>
                  </>
                )}
                {lastUpdated && (
                  <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
                )}
                {autoRefresh && (
                  <span className="flex items-center text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                    Live
                  </span>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center justify-center min-h-[44px] px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  autoRefresh 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{autoRefresh ? 'Auto On' : 'Auto Off'}</span>
              </button>
              
              <button
                onClick={() => fetchDashboardStats()}
                disabled={loading}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 text-sm font-medium"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              
              <button
                onClick={() => handleExport('pdf')}
                disabled={exportLoading === 'pdf'}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 text-sm font-medium"
              >
                <FileDown className={`h-4 w-4 mr-2 ${exportLoading === 'pdf' ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">PDF</span>
              </button>
              
              <button
                onClick={() => handleExport('csv')}
                disabled={exportLoading === 'csv'}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 text-sm font-medium"
              >
                <Download className={`h-4 w-4 mr-2 ${exportLoading === 'csv' ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </button>
              
              <button
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === 'timeline'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Clock className="h-4 w-4 mr-2" />
                Timeline
              </button>
              
              <button
                onClick={() => setActiveTab('anomalies')}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === 'anomalies'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Anomalies
                {stats && stats.anomalies_count > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                    {stats.anomalies_count}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('search')}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === 'search'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {loading ? (
                  <div className="text-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Loading dashboard...</p>
                  </div>
                ) : stats ? (
                  <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Total Events</p>
                            <p className="text-2xl font-bold text-blue-600">{stats.total_events.toLocaleString()}</p>
                          </div>
                          <FileText className="h-8 w-8 text-blue-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Anomalies</p>
                            <p className="text-2xl font-bold text-red-600">{stats.anomalies_count.toLocaleString()}</p>
                          </div>
                          <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Critical Events</p>
                            <p className="text-2xl font-bold text-orange-600">{stats.critical_events.toLocaleString()}</p>
                          </div>
                          <AlertTriangle className="h-8 w-8 text-orange-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Event Rate</p>
                            <p className="text-2xl font-bold text-green-600">
                              {stats.event_volume_24h.length > 0 
                                ? Math.round(stats.total_events / 24) 
                                : 0}/hr
                            </p>
                          </div>
                          <BarChart3 className="h-8 w-8 text-green-600" />
                        </div>
                      </div>
                    </div>

                    {/* Category Breakdown Chart */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
                      <div className="space-y-3">
                        {Object.entries(stats.category_breakdown).map(([category, count]) => {
                          const percentage = stats.total_events > 0 
                            ? ((count / stats.total_events) * 100).toFixed(1) 
                            : 0
                          const categoryColors: { [key: string]: string } = {
                            'Security Change': 'bg-red-500',
                            'Financial Impact': 'bg-blue-500',
                            'Resource Allocation': 'bg-green-500',
                            'Risk Event': 'bg-yellow-500',
                            'Compliance Action': 'bg-purple-500'
                          }
                          const color = categoryColors[category] || 'bg-gray-500'
                          
                          return (
                            <div key={category}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700">{category}</span>
                                <span className="text-sm text-gray-600">
                                  {count} ({percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`${color} h-2 rounded-full transition-all duration-300`}
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Top Users and Event Types */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top Users */}
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Users</h3>
                        <div className="space-y-3">
                          {stats.top_users.slice(0, 5).map((user, index) => (
                            <div key={user.user_id} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold text-sm">
                                  {index + 1}
                                </div>
                                <span className="text-sm font-medium text-gray-700 truncate">
                                  {user.user_id}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-gray-900">
                                {user.count} events
                              </span>
                            </div>
                          ))}
                          {stats.top_users.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">No user data available</p>
                          )}
                        </div>
                      </div>

                      {/* Top Event Types */}
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Event Types</h3>
                        <div className="space-y-3">
                          {stats.top_event_types.slice(0, 5).map((eventType, index) => (
                            <div key={eventType.event_type} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 rounded-full font-semibold text-sm">
                                  {index + 1}
                                </div>
                                <span className="text-sm font-medium text-gray-700 truncate">
                                  {eventType.event_type}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-gray-900">
                                {eventType.count} events
                              </span>
                            </div>
                          ))}
                          {stats.top_event_types.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">No event type data available</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Event Volume Chart (24h) */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Volume (Last 24 Hours)</h3>
                      <div className="h-64">
                        {stats.event_volume_24h.length > 0 ? (
                          <div className="flex items-end justify-between h-full space-x-1">
                            {stats.event_volume_24h.map((item, index) => {
                              const maxCount = Math.max(...stats.event_volume_24h.map(i => i.count), 1)
                              const height = (item.count / maxCount) * 100
                              
                              return (
                                <div key={index} className="flex-1 flex flex-col items-center">
                                  <div className="w-full flex items-end justify-center h-full">
                                    <div
                                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                                      style={{ height: `${height}%` }}
                                      title={`${item.hour}: ${item.count} events`}
                                    ></div>
                                  </div>
                                  <span className="text-xs text-gray-500 mt-2 truncate w-full text-center">
                                    {item.hour}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            No event volume data available
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No dashboard data available
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'timeline' && (
              <div className="text-center py-12 text-gray-500">
                Timeline view will be implemented in task 13
              </div>
            )}
            
            {activeTab === 'anomalies' && (
              <div className="text-center py-12 text-gray-500">
                Anomalies view will be implemented in task 14
              </div>
            )}
            
            {activeTab === 'search' && (
              <div className="text-center py-12 text-gray-500">
                Semantic search will be implemented in task 15
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
