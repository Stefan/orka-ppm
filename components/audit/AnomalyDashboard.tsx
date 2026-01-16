'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  AlertTriangle,
  Clock,
  Shield,
  DollarSign,
  Users,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  MessageSquare,
  TrendingUp,
  Activity,
  Bell,
  Wifi,
  WifiOff,
  TriangleAlert
} from 'lucide-react'
import { AuditEvent } from './Timeline'

/**
 * Anomaly Detection Interface
 */
export interface AnomalyDetection {
  id: string
  audit_event_id: string
  audit_event: AuditEvent
  anomaly_score: number
  detection_timestamp: string
  features_used: Record<string, any>
  model_version: string
  is_false_positive: boolean
  feedback_notes?: string
  feedback_user_id?: string
  feedback_timestamp?: string
  alert_sent: boolean
  tenant_id: string
}

/**
 * Anomaly Dashboard Props
 */
export interface AnomalyDashboardProps {
  anomalies: AnomalyDetection[]
  onAnomalyClick?: (anomaly: AnomalyDetection) => void
  onFeedback?: (anomalyId: string, isFalsePositive: boolean, notes?: string) => Promise<void>
  loading?: boolean
  className?: string
  enableRealtime?: boolean
  websocketUrl?: string
  onNewAnomaly?: (anomaly: AnomalyDetection) => void
}

/**
 * Get severity color based on anomaly score
 */
const getAnomalyColor = (score: number): string => {
  if (score >= 0.9) return 'red'
  if (score >= 0.8) return 'orange'
  return 'yellow'
}

/**
 * Get category icon
 */
const getCategoryIcon = (category?: string) => {
  switch (category) {
    case 'Security Change':
      return <Shield className="h-5 w-5" />
    case 'Financial Impact':
      return <DollarSign className="h-5 w-5" />
    case 'Resource Allocation':
      return <Users className="h-5 w-5" />
    case 'Risk Event':
      return <AlertTriangle className="h-5 w-5" />
    case 'Compliance Action':
      return <FileText className="h-5 w-5" />
    default:
      return <Info className="h-5 w-5" />
  }
}

/**
 * Anomaly Dashboard Component
 * 
 * Displays detected anomalies with:
 * - Anomaly scores with visual indicators
 * - Affected entities
 * - Suggested actions
 * - Detection timestamp and model version
 * - Feedback functionality
 * - Real-time updates
 */
const AnomalyDashboard: React.FC<AnomalyDashboardProps> = ({
  anomalies,
  onAnomalyClick,
  onFeedback,
  loading = false,
  className = '',
  enableRealtime = false,
  websocketUrl,
  onNewAnomaly
}) => {
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null)
  const [feedbackAnomaly, setFeedbackAnomaly] = useState<string | null>(null)
  const [feedbackNotes, setFeedbackNotes] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [notifications, setNotifications] = useState<AnomalyDetection[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * WebSocket connection for real-time updates
   */
  useEffect(() => {
    if (!enableRealtime || !websocketUrl) return

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(websocketUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('WebSocket connected for anomaly updates')
          setWsConnected(true)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            // Handle new anomaly notification
            if (data.type === 'anomaly_detected' && data.anomaly) {
              const newAnomaly: AnomalyDetection = data.anomaly
              
              // Show toast notification for critical anomalies
              if (newAnomaly.audit_event.risk_level === 'Critical') {
                setNotifications(prev => [...prev, newAnomaly])
                
                // Auto-dismiss after 10 seconds
                setTimeout(() => {
                  setNotifications(prev => prev.filter(n => n.id !== newAnomaly.id))
                }, 10000)
              }
              
              // Notify parent component
              onNewAnomaly?.(newAnomaly)
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          setWsConnected(false)
        }

        ws.onclose = () => {
          console.log('WebSocket disconnected')
          setWsConnected(false)
          
          // Attempt to reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...')
            connectWebSocket()
          }, 5000)
        }
      } catch (error) {
        console.error('Failed to connect WebSocket:', error)
        setWsConnected(false)
      }
    }

    connectWebSocket()

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [enableRealtime, websocketUrl, onNewAnomaly])

  /**
   * Dismiss notification
   */
  const dismissNotification = useCallback((anomalyId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== anomalyId))
  }, [])

  /**
   * Sort anomalies by score (highest first) and timestamp (newest first)
   */
  const sortedAnomalies = useMemo(() => {
    return [...anomalies].sort((a, b) => {
      // First sort by score (descending)
      if (b.anomaly_score !== a.anomaly_score) {
        return b.anomaly_score - a.anomaly_score
      }
      // Then by timestamp (newest first)
      return new Date(b.detection_timestamp).getTime() - new Date(a.detection_timestamp).getTime()
    })
  }, [anomalies])

  /**
   * Group anomalies by severity
   */
  const anomalyStats = useMemo(() => {
    const critical = anomalies.filter(a => a.anomaly_score >= 0.9).length
    const high = anomalies.filter(a => a.anomaly_score >= 0.8 && a.anomaly_score < 0.9).length
    const medium = anomalies.filter(a => a.anomaly_score >= 0.7 && a.anomaly_score < 0.8).length
    const falsePositives = anomalies.filter(a => a.is_false_positive).length

    return { critical, high, medium, falsePositives }
  }, [anomalies])

  /**
   * Toggle anomaly expansion
   */
  const toggleExpand = useCallback((anomalyId: string) => {
    setExpandedAnomaly(prev => prev === anomalyId ? null : anomalyId)
  }, [])

  /**
   * Handle feedback submission
   */
  const handleFeedbackSubmit = useCallback(async (anomalyId: string, isFalsePositive: boolean) => {
    if (!onFeedback) return

    setSubmittingFeedback(true)
    try {
      await onFeedback(anomalyId, isFalsePositive, feedbackNotes)
      setFeedbackAnomaly(null)
      setFeedbackNotes('')
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setSubmittingFeedback(false)
    }
  }, [onFeedback, feedbackNotes])

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <Activity className="h-8 w-8 text-gray-400 animate-pulse mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading anomalies...</p>
        </div>
      </div>
    )
  }

  if (anomalies.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 ${className}`} data-testid="anomaly-dashboard">
        {/* Header with connection status */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <TriangleAlert className="h-6 w-6 text-red-600 mr-2" />
                Anomaly Detection
              </h2>
              <p className="text-sm text-gray-600 mt-1">0 anomalies detected</p>
            </div>
            
            {/* WebSocket Connection Status */}
            {enableRealtime && (
              <div className="flex items-center space-x-2">
                {wsConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-400 font-medium">Offline</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Empty state */}
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No Anomalies Detected</h3>
            <p className="text-sm text-gray-600">All audit events appear normal</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Add animation styles */}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>

      <div className={`bg-white rounded-lg border border-gray-200 ${className}`} data-testid="anomaly-dashboard">
      {/* Real-time Toast Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2" style={{ maxWidth: '400px' }}>
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="bg-red-600 text-white rounded-lg shadow-2xl p-4 animate-slide-in-right"
              role="alert"
              data-testid={`notification-${notification.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <Bell className="h-5 w-5 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1">
                      Critical Anomaly Detected
                    </h4>
                    <p className="text-sm opacity-90 mb-2">
                      {notification.audit_event.event_type}
                    </p>
                    <p className="text-xs opacity-75">
                      Score: {(notification.anomaly_score * 100).toFixed(1)}% • {' '}
                      {new Date(notification.detection_timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="p-1 hover:bg-red-700 rounded transition-colors"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => {
                  onAnomalyClick?.(notification)
                  dismissNotification(notification.id)
                }}
                className="mt-3 w-full px-3 py-1.5 bg-white text-red-600 rounded text-sm font-medium hover:bg-red-50 transition-colors"
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header with Stats */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-2" />
              Anomaly Detection
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {anomalies.length} anomal{anomalies.length !== 1 ? 'ies' : 'y'} detected
            </p>
          </div>
          
          {/* WebSocket Connection Status */}
          {enableRealtime && (
            <div className="flex items-center space-x-2">
              {wsConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Offline</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Critical</p>
                <p className="text-2xl font-bold text-red-700">{anomalyStats.critical}</p>
              </div>
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
            </div>
          </div>

          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-600 font-medium">High</p>
                <p className="text-2xl font-bold text-orange-700">{anomalyStats.high}</p>
              </div>
              <div className="w-3 h-3 rounded-full bg-orange-600"></div>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-yellow-600 font-medium">Medium</p>
                <p className="text-2xl font-bold text-yellow-700">{anomalyStats.medium}</p>
              </div>
              <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">False Positives</p>
                <p className="text-2xl font-bold text-gray-700">{anomalyStats.falsePositives}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Anomaly List */}
      <div className="divide-y divide-gray-200">
        {sortedAnomalies.map((anomaly) => {
          const isExpanded = expandedAnomaly === anomaly.id
          const isFeedbackOpen = feedbackAnomaly === anomaly.id
          const colorScheme = getAnomalyColor(anomaly.anomaly_score)
          const event = anomaly.audit_event

          return (
            <div
              key={anomaly.id}
              className={`p-6 hover:bg-gray-50 transition-colors ${
                anomaly.is_false_positive ? 'opacity-60' : ''
              }`}
              data-testid={`anomaly-${anomaly.id}`}
            >
              {/* Anomaly Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getCategoryIcon(event.category)}
                    <h3 className="text-lg font-semibold text-gray-900">
                      {event.event_type}
                    </h3>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      colorScheme === 'red' ? 'bg-red-100 text-red-700' :
                      colorScheme === 'orange' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {(anomaly.anomaly_score * 100).toFixed(1)}% Anomaly
                    </span>
                    {anomaly.is_false_positive && (
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                        False Positive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {new Date(anomaly.detection_timestamp).toLocaleString()}
                    </span>
                    {event.user_name && (
                      <span>User: {event.user_name}</span>
                    )}
                    <span>Entity: {event.entity_type}</span>
                  </div>
                </div>

                <button
                  onClick={() => toggleExpand(anomaly.id)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Anomaly Score Visualization */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Anomaly Score</span>
                  <span className="font-semibold">{(anomaly.anomaly_score * 100).toFixed(2)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      colorScheme === 'red' ? 'bg-red-600' :
                      colorScheme === 'orange' ? 'bg-orange-600' :
                      'bg-yellow-600'
                    }`}
                    style={{ width: `${anomaly.anomaly_score * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
                  {/* Affected Entities */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                        <Info className="h-4 w-4 mr-2" />
                        Affected Entity
                      </h4>
                      <dl className="space-y-2">
                        <div>
                          <dt className="text-xs text-blue-700">Entity Type</dt>
                          <dd className="text-sm font-medium text-blue-900">{event.entity_type}</dd>
                        </div>
                        {event.entity_id && (
                          <div>
                            <dt className="text-xs text-blue-700">Entity ID</dt>
                            <dd className="text-sm font-mono text-blue-900">{event.entity_id}</dd>
                          </div>
                        )}
                        {event.user_name && (
                          <div>
                            <dt className="text-xs text-blue-700">User</dt>
                            <dd className="text-sm text-blue-900">{event.user_name}</dd>
                          </div>
                        )}
                        {event.category && (
                          <div>
                            <dt className="text-xs text-blue-700">Category</dt>
                            <dd className="text-sm text-blue-900">{event.category}</dd>
                          </div>
                        )}
                        {event.risk_level && (
                          <div>
                            <dt className="text-xs text-blue-700">Risk Level</dt>
                            <dd className={`text-sm font-semibold ${
                              event.risk_level === 'Critical' ? 'text-red-600' :
                              event.risk_level === 'High' ? 'text-orange-600' :
                              event.risk_level === 'Medium' ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {event.risk_level}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Detection Metadata */}
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Detection Metadata
                      </h4>
                      <dl className="space-y-2">
                        <div>
                          <dt className="text-xs text-purple-700">Detection Time</dt>
                          <dd className="text-sm text-purple-900">
                            {new Date(anomaly.detection_timestamp).toLocaleString('en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-purple-700">Model Version</dt>
                          <dd className="text-sm font-mono text-purple-900">{anomaly.model_version}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-purple-700">Alert Status</dt>
                          <dd className="text-sm text-purple-900">
                            {anomaly.alert_sent ? (
                              <span className="flex items-center text-green-600">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Alert Sent
                              </span>
                            ) : (
                              <span className="text-gray-600">No Alert</span>
                            )}
                          </dd>
                        </div>
                        {anomaly.feedback_timestamp && (
                          <div>
                            <dt className="text-xs text-purple-700">Feedback Received</dt>
                            <dd className="text-sm text-purple-900">
                              {new Date(anomaly.feedback_timestamp).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  {/* Suggested Actions */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-amber-900 mb-3 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Suggested Actions
                    </h4>
                    <ul className="space-y-2">
                      {anomaly.anomaly_score >= 0.9 && (
                        <>
                          <li className="flex items-start text-sm text-amber-900">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 mr-2 flex-shrink-0"></span>
                            <span>Immediately review this event for potential security threats</span>
                          </li>
                          <li className="flex items-start text-sm text-amber-900">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 mr-2 flex-shrink-0"></span>
                            <span>Contact the user to verify the action was intentional</span>
                          </li>
                          <li className="flex items-start text-sm text-amber-900">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 mr-2 flex-shrink-0"></span>
                            <span>Check for similar patterns in recent audit logs</span>
                          </li>
                        </>
                      )}
                      {anomaly.anomaly_score >= 0.8 && anomaly.anomaly_score < 0.9 && (
                        <>
                          <li className="flex items-start text-sm text-amber-900">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 mr-2 flex-shrink-0"></span>
                            <span>Review this event within 24 hours</span>
                          </li>
                          <li className="flex items-start text-sm text-amber-900">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 mr-2 flex-shrink-0"></span>
                            <span>Verify the action aligns with expected user behavior</span>
                          </li>
                        </>
                      )}
                      {anomaly.anomaly_score < 0.8 && (
                        <>
                          <li className="flex items-start text-sm text-amber-900">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 mr-2 flex-shrink-0"></span>
                            <span>Monitor for recurring patterns</span>
                          </li>
                          <li className="flex items-start text-sm text-amber-900">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 mr-2 flex-shrink-0"></span>
                            <span>Consider marking as false positive if behavior is expected</span>
                          </li>
                        </>
                      )}
                      {event.category === 'Security Change' && (
                        <li className="flex items-start text-sm text-amber-900">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 mr-2 flex-shrink-0"></span>
                          <span>Review permission changes and access control modifications</span>
                        </li>
                      )}
                      {event.category === 'Financial Impact' && (
                        <li className="flex items-start text-sm text-amber-900">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 mr-2 flex-shrink-0"></span>
                          <span>Verify budget changes with project stakeholders</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* AI Insights */}
                  {event.ai_insights && Object.keys(event.ai_insights).length > 0 && (
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center">
                        <Info className="h-4 w-4 mr-2" />
                        AI Analysis
                      </h4>
                      <div className="space-y-2">
                        {event.ai_insights.explanation && (
                          <div>
                            <dt className="text-xs text-indigo-700 font-medium">Explanation</dt>
                            <dd className="text-sm text-indigo-900 mt-1">{event.ai_insights.explanation}</dd>
                          </div>
                        )}
                        {event.ai_insights.impact && (
                          <div>
                            <dt className="text-xs text-indigo-700 font-medium">Impact</dt>
                            <dd className="text-sm text-indigo-900 mt-1">{event.ai_insights.impact}</dd>
                          </div>
                        )}
                        {event.ai_insights.context && (
                          <div>
                            <dt className="text-xs text-indigo-700 font-medium">Context</dt>
                            <dd className="text-sm text-indigo-900 mt-1">{event.ai_insights.context}</dd>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Features Used in Detection */}
                  {anomaly.features_used && Object.keys(anomaly.features_used).length > 0 && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">
                        Detection Features
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(anomaly.features_used).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <dt className="text-xs text-gray-600 font-medium capitalize">
                              {key.replace(/_/g, ' ')}
                            </dt>
                            <dd className="text-gray-900 font-mono text-xs mt-0.5">
                              {typeof value === 'number' ? value.toFixed(3) : String(value)}
                            </dd>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feedback History */}
                  {anomaly.is_false_positive && anomaly.feedback_notes && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-green-900 mb-2 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Feedback
                      </h4>
                      <p className="text-sm text-green-800">{anomaly.feedback_notes}</p>
                      {anomaly.feedback_timestamp && (
                        <p className="text-xs text-green-600 mt-2">
                          Submitted on {new Date(anomaly.feedback_timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {!anomaly.is_false_positive && (
                <div className="flex items-center space-x-3 mt-4">
                  <button
                    onClick={() => onAnomalyClick?.(anomaly)}
                    className="px-4 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 font-medium"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => setFeedbackAnomaly(anomaly.id)}
                    className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium flex items-center"
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Mark as False Positive
                  </button>
                </div>
              )}

              {/* Feedback Form - Will be implemented in subtask 14.3 */}
              {isFeedbackOpen && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        Feedback Form
                      </h4>
                      <p className="text-xs text-gray-600">
                        Help improve our anomaly detection by providing feedback
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFeedbackAnomaly(null)
                        setFeedbackNotes('')
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      disabled={submittingFeedback}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Feedback Notes */}
                    <div>
                      <label htmlFor={`feedback-notes-${anomaly.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                        Feedback Notes (Optional)
                      </label>
                      <textarea
                        id={`feedback-notes-${anomaly.id}`}
                        value={feedbackNotes}
                        onChange={(e) => setFeedbackNotes(e.target.value)}
                        placeholder="Explain why this is a false positive..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={submittingFeedback}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Your feedback helps train our AI models to reduce false positives
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-3">
                      <button
                        onClick={() => {
                          setFeedbackAnomaly(null)
                          setFeedbackNotes('')
                        }}
                        className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={submittingFeedback}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleFeedbackSubmit(anomaly.id, true)}
                        className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        disabled={submittingFeedback}
                      >
                        {submittingFeedback ? (
                          <>
                            <Activity className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Submit Feedback
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
    </>
  )
}

export default AnomalyDashboard
