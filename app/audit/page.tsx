'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import { AlertTriangle, Clock, FileText, Search, BarChart3, Download, RefreshCw, FileDown } from 'lucide-react'
import { getApiUrl } from '../../lib/api/client'
import { useTranslations } from '../../lib/i18n/context'
import { useToast } from '@/components/shared/Toast'
import { Timeline, AnomalyDashboard, SemanticSearch, AuditFilters } from '../../components/audit'
import type { AuditEvent, TimelineFilters } from '../../components/audit/Timeline'
import type { AnomalyDetection } from '../../components/audit/AnomalyDashboard'
import type { SearchResponse } from '../../components/audit/SemanticSearch'
import type { AuditFilters as AuditFiltersType } from '../../components/audit/AuditFilters'
import { useFeatureFlag } from '../../contexts/FeatureFlagContext'
import { GuidedTour, useGuidedTour, TourTriggerButton, auditTourSteps } from '@/components/guided-tour'
import { useDateFormatter } from '@/hooks/useDateFormatter'

// Tab types
type TabType = 'dashboard' | 'timeline' | 'anomalies' | 'search'

interface DashboardStats {
  total_events_24h: number
  total_anomalies_24h: number
  critical_events_24h: number
  top_users: Array<{ user_id: string; count: number }>
  top_event_types: Array<{ event_type: string; count: number }>
  category_breakdown: { [key: string]: number }
  event_volume_chart: Array<{ hour: string; count: number }>
  system_health: any
}

function emptyStats(): DashboardStats {
  return {
    total_events_24h: 0,
    total_anomalies_24h: 0,
    critical_events_24h: 0,
    top_users: [],
    top_event_types: [],
    category_breakdown: {},
    event_volume_chart: [],
    system_health: {},
  }
}

export default function AuditDashboard() {
  const { session } = useAuth()
  const { t } = useTranslations()
  const { formatDate } = useDateFormatter()
  const toast = useToast()
  const anomalyToastShownRef = useRef(false)
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Feature flag checks
  const { enabled: anomalyDetectionEnabled } = useFeatureFlag('ai_anomaly_detection')

  // Redirect from anomalies tab if feature is disabled
  useEffect(() => {
    if (activeTab === 'anomalies' && !anomalyDetectionEnabled) {
      setActiveTab('dashboard')
    }
  }, [activeTab, anomalyDetectionEnabled])

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [exportLoading, setExportLoading] = useState<'pdf' | 'csv' | null>(null)
  
  // Timeline state: default to last 7 days so the timeline shows a sensible range without user picking dates
  const [timelineEvents, setTimelineEvents] = useState<AuditEvent[]>([])
  const [timelineFilters, setTimelineFilters] = useState<TimelineFilters>(() => {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const start = new Date(end)
    start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
    return { dateRange: { start, end } }
  })
  const [timelineLoading, setTimelineLoading] = useState(false)

  // Recent events for dashboard tab (same data as timeline, so record appears in both)
  const [recentEvents, setRecentEvents] = useState<AuditEvent[]>([])
  const [recentEventsLoading, setRecentEventsLoading] = useState(false)
  
  // Anomalies state
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([])
  const [anomaliesLoading, setAnomaliesLoading] = useState(false)
  
  // Search state
  const [searchLoading, setSearchLoading] = useState(false)
  
  // Filters state
  const [auditFilters, setAuditFilters] = useState<AuditFiltersType>({})
  const { isOpen, startTour, closeTour, completeTour, resetAndStartTour, hasCompletedTour } = useGuidedTour('audit-v1')

  // Fetch dashboard stats
  const fetchDashboardStats = useCallback(async () => {
    const token = session?.access_token
    if (!token?.trim()) return

    try {
      const response = await fetch(getApiUrl('/api/audit/dashboard/stats'), {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 401) {
        const errBody = await response.json().catch(() => ({}))
        const message =
          errBody?.code === 'MISSING_AUTH'
            ? (t('audit.errorAuthMissing') || 'Authorization missing. Please log in.')
            : (t('audit.errorAuthInvalid') || 'Session expired or invalid. Please log in again.')
        setError(message)
        setStats(emptyStats())
        setLastUpdated(new Date())
        setLoading(false)
        return
      }

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
      setStats(emptyStats())
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, t])
  
  // Fetch timeline events
  const fetchTimelineEvents = useCallback(async () => {
    if (!session?.access_token) return
    
    setTimelineLoading(true)
    try {
      const params = new URLSearchParams()
      if (timelineFilters.dateRange?.start) {
        params.append('start_date', timelineFilters.dateRange.start.toISOString())
      }
      if (timelineFilters.dateRange?.end) {
        params.append('end_date', timelineFilters.dateRange.end.toISOString())
      }
      if (timelineFilters.severity && timelineFilters.severity.length > 0) {
        params.append('severity', timelineFilters.severity.join(','))
      }
      if (timelineFilters.categories && timelineFilters.categories.length > 0) {
        params.append('categories', timelineFilters.categories.join(','))
      }
      if (timelineFilters.showAnomaliesOnly) {
        params.append('anomalies_only', 'true')
      }
      
      const url = getApiUrl(`/api/audit/logs?${params.toString()}`)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(`Failed to fetch timeline events: ${response.status}`)
      }

      setTimelineEvents(data.events ?? data.logs ?? [])
      setError(null)
    } catch (err) {
      console.error('Error fetching timeline events:', err)
      setError(err instanceof Error ? err.message : 'Failed to load timeline events')
    } finally {
      setTimelineLoading(false)
    }
  }, [session?.access_token, timelineFilters])

  // Fetch recent events for dashboard tab (limit 10, no date filter)
  const fetchRecentEvents = useCallback(async () => {
    if (!session?.access_token) return
    setRecentEventsLoading(true)
    try {
      const url = getApiUrl('/api/audit/logs?limit=10')
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) return
      setRecentEvents(data.events ?? data.logs ?? [])
    } catch {
      setRecentEvents([])
    } finally {
      setRecentEventsLoading(false)
    }
  }, [session?.access_token])
  
  // Fetch anomalies
  const fetchAnomalies = useCallback(async () => {
    if (!session?.access_token) return
    
    setAnomaliesLoading(true)
    try {
      const response = await fetch(getApiUrl('/api/audit/detect-anomalies'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          time_range_days: 30
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch anomalies: ${response.status}`)
      }
      
      const data = await response.json()
      setAnomalies(data.anomalies || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching anomalies:', err)
      setError(err instanceof Error ? err.message : 'Failed to load anomalies')
    } finally {
      setAnomaliesLoading(false)
    }
  }, [session?.access_token])
  
  // Handle search
  const handleSearch = useCallback(async (query: string): Promise<SearchResponse> => {
    if (!session?.access_token) {
      throw new Error('Not authenticated')
    }
    
    const response = await fetch(getApiUrl('/api/audit/search'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    })
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }
    
    return await response.json()
  }, [session?.access_token])
  
  // Handle anomaly feedback
  const handleAnomalyFeedback = useCallback(async (
    anomalyId: string,
    isFalsePositive: boolean,
    notes?: string
  ) => {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl(`/api/audit/anomalies/${anomalyId}/feedback`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_false_positive: isFalsePositive,
          notes
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to submit feedback: ${response.status}`)
      }
      
      // Refresh anomalies
      await fetchAnomalies()
    } catch (err) {
      console.error('Error submitting feedback:', err)
      throw err
    }
  }, [session?.access_token, fetchAnomalies])
  
  // Handle tag addition
  const handleAddTag = useCallback(async (logId: string, tag: string) => {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl(`/api/audit/logs/${logId}/tag`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tag })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to add tag: ${response.status}`)
      }
      
      // Refresh timeline events
      await fetchTimelineEvents()
    } catch (err) {
      console.error('Error adding tag:', err)
      throw err
    }
  }, [session?.access_token, fetchTimelineEvents])

  // Initial load
  useEffect(() => {
    if (session?.access_token) {
      fetchDashboardStats()
    }
  }, [session?.access_token, fetchDashboardStats])
  
  // Fetch data when tab changes
  useEffect(() => {
    if (!session?.access_token) return
    
    if (activeTab === 'dashboard') {
      fetchRecentEvents()
    } else if (activeTab === 'timeline') {
      fetchTimelineEvents()
    } else if (activeTab === 'anomalies') {
      fetchAnomalies()
    }
  }, [activeTab, session?.access_token, fetchRecentEvents, fetchTimelineEvents, fetchAnomalies])

  // Proaktive Compliance-Toasts (Phase 3): Hinweis bei erkannten Anomalien
  useEffect(() => {
    if (!anomalyDetectionEnabled || anomaliesLoading || anomalies.length === 0) return
    if (anomalyToastShownRef.current) return
    anomalyToastShownRef.current = true
    const message = t('audit.anomalyToastMessage') || 'Vorschlag: Überprüfe die markierten Einträge im Tab Anomalien.'
    toast.warning(
      t('audit.anomaliesDetected') || 'Anomalien erkannt',
      message,
      { duration: 8000 }
    )
  }, [anomalyDetectionEnabled, anomaliesLoading, anomalies.length, t, toast])
  
  // Fetch timeline events when filters change
  useEffect(() => {
    if (activeTab === 'timeline' && session?.access_token) {
      fetchTimelineEvents()
    }
  }, [timelineFilters, activeTab, session?.access_token, fetchTimelineEvents])

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
      const response = await fetch(getApiUrl(`/api/audit/export/${format}`), {
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
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{t('audit.authRequired')}</h3>
                <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">{t('audit.authRequiredMessage')}</p>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div data-testid="audit-page" className="min-w-0 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div data-testid="audit-header" className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
            <div className="min-w-0 flex-1">
              <h1 data-testid="audit-title" className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">{t('audit.title')}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-gray-700 dark:text-slate-300">
                {stats && (
                  <>
                    <span>{(stats.total_events_24h || 0)} {t('audit.events')}</span>
                    <span>{(stats.total_anomalies_24h || 0)} {t('audit.anomalies')}</span>
                    <span>{(stats.critical_events_24h || 0)} {t('audit.critical')}</span>
                  </>
                )}
                {lastUpdated && (
                  <span>{t('audit.updated')}: {lastUpdated.toLocaleTimeString()}</span>
                )}
                {autoRefresh && (
                  <span className="flex items-center text-green-600 dark:text-green-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                    {t('audit.live')}
                  </span>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <TourTriggerButton
                onStart={hasCompletedTour ? resetAndStartTour : startTour}
                hasCompletedTour={hasCompletedTour}
              />
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center justify-center min-h-[44px] px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  autoRefresh 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50' 
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{autoRefresh ? t('audit.autoOn') : t('audit.autoOff')}</span>
              </button>
              
              <button
                onClick={() => fetchDashboardStats()}
                disabled={loading}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 text-sm font-medium"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t('audit.refresh')}</span>
              </button>
              
              <div data-tour="audit-export" className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exportLoading === 'pdf'}
                  className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 text-sm font-medium"
                >
                  <FileDown className={`h-4 w-4 mr-2 ${exportLoading === 'pdf' ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exportLoading === 'csv'}
                  className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 text-sm font-medium"
                >
                  <Download className={`h-4 w-4 mr-2 ${exportLoading === 'csv' ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline">CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">{t('audit.error')}</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div data-testid="audit-trail" data-tour="audit-filter" className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="border-b border-gray-200 dark:border-slate-700">
            <nav className="flex -mb-px overflow-x-auto" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-700 dark:text-slate-300 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:border-slate-600'
                }`}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                {t('audit.tabs.dashboard')}
              </button>
              
              <button
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === 'timeline'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-700 dark:text-slate-300 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:border-slate-600'
                }`}
              >
                <Clock className="h-4 w-4 mr-2" />
                {t('audit.tabs.timeline')}
              </button>
              
              {anomalyDetectionEnabled && (
                <button
                  data-tour="audit-anomalies"
                  onClick={() => setActiveTab('anomalies')}
                  className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === 'anomalies'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-700 dark:text-slate-300 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:border-slate-600'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {t('audit.tabs.anomalies')}
                  {stats && stats.total_anomalies_24h > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full">
                      {stats.total_anomalies_24h}
                    </span>
                  )}
                </button>
              )}
              
              <button
                onClick={() => setActiveTab('search')}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === 'search'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-700 dark:text-slate-300 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:border-slate-600'
                }`}
              >
                <Search className="h-4 w-4 mr-2" />
                {t('audit.tabs.search')}
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {loading ? (
                  <div className="text-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400 dark:text-slate-500 mx-auto mb-4" />
                    <p className="text-gray-700 dark:text-slate-300">{t('audit.loadingDashboard')}</p>
                  </div>
                ) : stats ? (
                  <>
                    {/* Stats Cards: 2 per row on mobile for better space use, 4 on xl */}
                    <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('audit.stats.totalEvents')}</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{(stats.total_events_24h || 0).toLocaleString()}</p>
                          </div>
                          <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('audit.stats.anomalies')}</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{(stats.total_anomalies_24h || 0).toLocaleString()}</p>
                          </div>
                          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('audit.stats.criticalEvents')}</p>
                            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{(stats.critical_events_24h || 0).toLocaleString()}</p>
                          </div>
                          <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('audit.stats.eventRate')}</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {stats.event_volume_chart.length > 0
                                ? Math.round((stats.total_events_24h || 0) / 24)
                                : 0}/hr
                            </p>
                          </div>
                          <BarChart3 className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                    </div>

                    {/* Category Breakdown Chart */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('audit.categoryBreakdown')}</h3>
                      <div className="space-y-3">
                        {Object.entries(stats.category_breakdown).map(([category, count]) => {
                          const percentage = (stats.total_events_24h || 0) > 0
                            ? ((count / (stats.total_events_24h || 0)) * 100).toFixed(1)
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
                                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{category}</span>
                                <span className="text-sm text-gray-700 dark:text-slate-300">
                                  {count} ({percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
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
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('audit.topUsers')}</h3>
                        <div className="space-y-3">
                          {stats.top_users.slice(0, 5).map((user, index) => (
                            <div key={user.user_id} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full font-semibold text-sm">
                                  {index + 1}
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate">
                                  {user.user_id}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                                {user.count} {t('audit.events')}
                              </span>
                            </div>
                          ))}
                          {stats.top_users.length === 0 && (
                            <p className="text-sm text-gray-700 dark:text-slate-300 text-center py-4">{t('audit.noUserData')}</p>
                          )}
                        </div>
                      </div>

                      {/* Top Event Types */}
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('audit.topEventTypes')}</h3>
                        <div className="space-y-3">
                          {stats.top_event_types.slice(0, 5).map((eventType, index) => (
                            <div key={eventType.event_type} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full font-semibold text-sm">
                                  {index + 1}
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate">
                                  {t(`audit.eventTypes.${eventType.event_type}` as any) || eventType.event_type}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                                {eventType.count} {t('audit.events')}
                              </span>
                            </div>
                          ))}
                          {stats.top_event_types.length === 0 && (
                            <p className="text-sm text-gray-700 dark:text-slate-300 text-center py-4">{t('audit.noEventTypeData')}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Event Volume Chart (24h) */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('audit.eventVolume24h')}</h3>
                      <div className="h-64">
                        {stats.event_volume_chart.length > 0 ? (
                          <div className="flex items-end justify-between h-full space-x-1">
                            {stats.event_volume_chart.map((item, index) => {
                              const maxCount = Math.max(...stats.event_volume_chart.map(i => i.count), 1)
                              const height = (item.count / maxCount) * 100
                              
                              return (
                                <div key={index} className="flex-1 flex flex-col items-center">
                                  <div className="w-full flex items-end justify-center h-full">
                                    <div
                                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                                      style={{ height: `${height}%` }}
                                      title={`${item.hour}: ${item.count} ${t('audit.events')}`}
                                    ></div>
                                  </div>
                                  <span className="text-xs text-gray-700 dark:text-slate-300 mt-2 truncate w-full text-center">
                                    {item.hour}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-700 dark:text-slate-300">
                            {t('audit.noEventVolumeData')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Events - same data as Timeline so records appear here and in Search */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                          {t('audit.recentEvents') || 'Recent Events'}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setActiveTab('timeline')}
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {t('audit.viewAll') || 'View all'}
                        </button>
                      </div>
                      {recentEventsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin text-gray-400 dark:text-slate-500" />
                        </div>
                      ) : recentEvents.length > 0 ? (
                        <ul className="space-y-3">
                          {recentEvents.map((event) => (
                            <li
                              key={event.id}
                              className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700 last:border-0"
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="h-4 w-4 text-gray-500 dark:text-slate-400 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                    {t(`audit.eventTypes.${event.event_type}` as any) || event.event_type}
                                  </p>
                                  <p className="text-xs text-gray-600 dark:text-slate-400">
                                    {event.entity_type}
                                    {event.timestamp && (
                                      <span className="ml-2">
                                        {formatDate(
                                          typeof event.timestamp === 'string' ? new Date(event.timestamp) : new Date((event.timestamp as Date).getTime()),
                                          { dateStyle: 'short', timeStyle: 'short' }
                                        )}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                event.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                event.severity === 'error' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                                event.severity === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                              }`}>
                                {event.severity || 'info'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-slate-400 text-center py-6">
                          {t('audit.noRecentEvents') || 'No recent events'}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-700 dark:text-slate-300">
                    {t('audit.noDashboardData')}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'timeline' && (
              <Timeline
                events={timelineEvents}
                loading={timelineLoading}
                filters={timelineFilters}
                onFilterChange={setTimelineFilters}
                onEventClick={(event) => {
                  console.log('Event clicked:', event)
                }}
                height={600}
              />
            )}
            
            {activeTab === 'anomalies' && (
              <AnomalyDashboard
                anomalies={anomalies}
                loading={anomaliesLoading}
                onFeedback={handleAnomalyFeedback}
                onAnomalyClick={(anomaly) => {
                  console.log('Anomaly clicked:', anomaly)
                }}
                enableRealtime={false}
              />
            )}
            
            {activeTab === 'search' && (
              <SemanticSearch
                onSearch={handleSearch}
                loading={searchLoading}
                placeholder="Ask a question about audit logs..."
                maxHeight={600}
              />
            )}
          </div>
        </div>
      </div>
      <GuidedTour
        steps={auditTourSteps}
        isOpen={isOpen}
        onClose={closeTour}
        onComplete={completeTour}
        tourId="audit-v1"
      />
    </AppLayout>
  )
}
