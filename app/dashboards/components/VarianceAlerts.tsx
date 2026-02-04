'use client'

import { useState, useEffect, memo, useCallback } from 'react'
import { AlertTriangle, CheckCircle, Clock, X, ChevronDown, ChevronUp, Lightbulb, Zap } from 'lucide-react'
import { getApiUrl } from '../../../lib/api'
import { resilientFetch } from '@/lib/api/resilient-fetch'
import { usePermissions } from '@/app/providers/EnhancedAuthProvider'

interface VarianceAlert {
  id: string
  project_id: string
  variance_amount: number
  variance_percentage: number
  threshold_percentage: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  created_at: string
  resolved: boolean
}

interface RootCause {
  cause: string
  confidence_pct: number
}

interface AutoFixSuggestion {
  id: string
  description: string
  metric: string
  change: number
  unit: string
  impact: string
}

interface VarianceAlertsProps {
  session: any
  onAlertCount?: (count: number) => void
  showAdminActions?: boolean
}

function VarianceAlerts({ session, onAlertCount, showAdminActions }: VarianceAlertsProps) {
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [alerts, setAlerts] = useState<VarianceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [expandedRootCause, setExpandedRootCause] = useState<string | null>(null)
  const [rootCauseCache, setRootCauseCache] = useState<Record<string, RootCause[]>>({})
  const [suggestionsAlertId, setSuggestionsAlertId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AutoFixSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)

  // Determine if user can manage alerts - use prop if provided, otherwise check permission
  const canManageAlerts = showAdminActions !== undefined 
    ? showAdminActions 
    : hasPermission('budget_alert_manage')

  useEffect(() => {
    if (session) {
      fetchVarianceAlerts()
    }
  }, [session])

  useEffect(() => {
    // Notify parent component of alert count
    const activeAlerts = alerts?.filter(alert => !alert?.resolved) || []
    onAlertCount?.(activeAlerts?.length || 0)
  }, [alerts, onAlertCount])

  const fetchVarianceAlerts = async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    const result = await resilientFetch<{ alerts: VarianceAlert[] }>(
      getApiUrl('/variance/alerts'),
      {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
        retries: 1,
        fallbackData: { alerts: [] },
        silentFail: true, // Don't spam console with errors
      }
    )
    
    if (result.data) {
      setAlerts(result.data.alerts || [])
    } else {
      setAlerts([])
    }
    
    setLoading(false)
  }

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(getApiUrl(`/variance/alerts/${alertId}/resolve`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response?.ok) {
        setAlerts(prev => prev?.map(alert => 
          alert?.id === alertId ? { ...alert, resolved: true } : alert
        ) || [])
      }
    } catch (err) {
      console.error('Error resolving alert:', err)
      setAlerts(prev => prev?.map(alert => 
        alert?.id === alertId ? { ...alert, resolved: true } : alert
      ) || [])
    }
  }

  const fetchRootCause = useCallback(async (alertId: string) => {
    if (rootCauseCache[alertId]) return
    try {
      const res = await fetch(getApiUrl(`/variance/alerts/${alertId}/root-cause`), {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
      })
      const data = await res.json().catch(() => ({}))
      if (data?.causes?.length) {
        setRootCauseCache(prev => ({ ...prev, [alertId]: data.causes }))
      }
    } catch {
      // ignore
    }
  }, [session?.access_token, rootCauseCache])

  const toggleRootCause = (alertId: string) => {
    if (expandedRootCause === alertId) {
      setExpandedRootCause(null)
    } else {
      setExpandedRootCause(alertId)
      fetchRootCause(alertId)
    }
  }

  const openSuggestions = async (alertId: string) => {
    setSuggestionsAlertId(alertId)
    setSuggestionsLoading(true)
    setSuggestions([])
    try {
      const res = await fetch(getApiUrl(`/variance/alerts/${alertId}/suggestions`), {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
      })
      const data = await res.json().catch(() => ({}))
      setSuggestions(data?.suggestions || [])
    } catch {
      setSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const requestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setPushEnabled(true)
        await fetch(getApiUrl('/variance/push-subscribe'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscription: { endpoint: 'pending', keys: {} } }),
        }).catch(() => {})
      }
    } catch {
      // ignore
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-200 text-red-800'
      case 'high': return 'bg-orange-100 border-orange-200 text-orange-800'
      case 'medium': return 'bg-yellow-100 border-yellow-200 text-yellow-800'
      case 'low': return 'bg-blue-100 border-blue-200 text-blue-800'
      default: return 'bg-gray-100 border-gray-200 text-gray-800'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      case 'medium':
        return <Clock className="h-4 w-4" />
      case 'low':
        return <CheckCircle className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  if (loading || permissionsLoading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const activeAlerts = alerts?.filter(alert => !alert?.resolved) || []
  const displayAlerts = showAll ? alerts : activeAlerts?.slice(0, 3) || []

  // Always reserve the same space to prevent CLS
  const containerStyle: React.CSSProperties = {
    minHeight: '200px', // Reserve consistent space
    contain: 'layout style paint' // Performance isolation
  }

  if ((activeAlerts?.length || 0) === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4" style={containerStyle}>
        <div className="flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
          <span className="text-sm text-green-800">
            No active variance alerts. All projects are within budget thresholds.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200" style={containerStyle}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Variance Alerts ({activeAlerts?.length || 0})
        </h3>
        <div className="flex items-center gap-2">
          {typeof window !== 'undefined' && 'Notification' in window && (
            <button
              type="button"
              onClick={requestPushPermission}
              className={`text-xs px-2 py-1 rounded border ${
                pushEnabled ? 'bg-blue-100 border-blue-300 text-blue-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              title="Get browser push for new alerts"
            >
              {pushEnabled ? 'Push on' : 'Push alerts'}
            </button>
          )}
          {(alerts?.length || 0) > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showAll ? 'Show Less' : `Show All (${alerts?.length || 0})`}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {displayAlerts?.map((alert) => (
          <div
            key={alert?.id}
            className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)} ${
              alert.resolved ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2 flex-1">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">
                    {alert.project_id}
                  </h4>
                  <p className="text-xs mt-1">
                    {alert.message}
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-xs">
                    <span>
                      Variance: {alert.variance_percentage >= 0 ? '+' : ''}
                      {alert.variance_percentage.toFixed(1)}%
                    </span>
                    <span>
                      Amount: {alert.variance_amount >= 0 ? '+' : ''}
                      {alert.variance_amount.toLocaleString()}
                    </span>
                    <span>
                      {new Date(alert.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {!alert.resolved && canManageAlerts && (
                <button
                  onClick={() => resolveAlert(alert.id)}
                  className="ml-2 p-1 hover:bg-white hover:bg-opacity-50 rounded"
                  title="Resolve alert"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {!alert.resolved && !canManageAlerts && (
                <div className="ml-2 text-xs text-gray-500 italic">
                  Admin only
                </div>
              )}
            </div>

            {!alert.resolved && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleRootCause(alert.id)}
                  className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                >
                  {expandedRootCause === alert.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Root cause
                </button>
                <button
                  type="button"
                  onClick={() => openSuggestions(alert.id)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                >
                  <Lightbulb className="h-3 w-3" />
                  Suggestions
                </button>
              </div>
            )}

            {expandedRootCause === alert.id && (
              <div className="mt-2 pt-2 border-t border-gray-200/80">
                <p className="text-xs font-medium text-gray-600 mb-1">AI Root Cause</p>
                {rootCauseCache[alert.id]?.length ? (
                  <ul className="text-xs space-y-1">
                    {rootCauseCache[alert.id].map((c, i) => (
                      <li key={i}>
                        {c.cause} <span className="text-gray-500">({c.confidence_pct}%)</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500">Loading…</p>
                )}
              </div>
            )}

            {alert.resolved && (
              <div className="mt-2 flex items-center text-xs text-gray-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Resolved
              </div>
            )}
          </div>
        ))}
      </div>

      {suggestionsAlertId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suggestions-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h4 id="suggestions-title" className="font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Auto-fix suggestions
              </h4>
              <button
                type="button"
                onClick={() => { setSuggestionsAlertId(null); setSuggestions([]) }}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {suggestionsLoading ? (
                <p className="text-sm text-gray-500">Loading suggestions…</p>
              ) : suggestions.length === 0 ? (
                <p className="text-sm text-gray-500">No suggestions for this alert.</p>
              ) : (
                <ul className="space-y-3">
                  {suggestions.map((s) => (
                    <li key={s.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{s.description}</p>
                      <p className="text-xs text-gray-600 mt-1">{s.impact}</p>
                      <button
                        type="button"
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Simulate impact
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 text-xs text-gray-500">
          Note: Using demo data - {error}
        </div>
      )}
    </div>
  )
}

// Custom comparison function to prevent unnecessary re-renders
// Only re-render if session token changes
// Note: onAlertCount is a callback and should be stable (wrapped in useCallback in parent)
const arePropsEqual = (prevProps: VarianceAlertsProps, nextProps: VarianceAlertsProps) => {
  return prevProps.session?.access_token === nextProps.session?.access_token
}

export default memo(VarianceAlerts, arePropsEqual)