'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, CheckCircle, AlertCircle, Activity, BarChart3, DollarSign, Target, Lightbulb, Bell, RefreshCw } from 'lucide-react'

// Types for monitoring dashboard
interface ImplementationAlert {
  id: string
  type: 'schedule_overrun' | 'task_overdue' | 'resource_overload' | 'cost_variance' | 'quality_issue'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  implementation_plan_id: string
  task_id?: string
  detected_at: string
  acknowledged: boolean
  resolved: boolean
  recommended_action: string
}

interface DeviationAlert {
  id: string
  deviation_type: 'schedule' | 'cost' | 'scope' | 'quality'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  root_cause?: string
  corrective_action?: string
  impact_assessment?: string
  detected_date: string
  resolved_date?: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  implementation_plan_id: string
}

interface ImplementationMetrics {
  total_implementations: number
  active_implementations: number
  completed_implementations: number
  overdue_implementations: number
  average_completion_time_days: number
  success_rate_percentage: number
  total_cost_variance_percentage: number
  total_schedule_variance_days: number
}

interface LessonsLearned {
  id: string
  implementation_plan_id: string
  change_request_id: string
  lessons_learned: string
  category: string
  impact_on_future_changes?: string
  created_by: string
  created_by_name: string
  created_at: string
}

interface ImplementationMonitoringDashboardProps {
  projectId?: string
  refreshInterval?: number
  onAlertAction?: (alertId: string, action: string) => void
}

const ALERT_SEVERITIES = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800', bgColor: 'bg-gray-50' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800', bgColor: 'bg-yellow-50' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800', bgColor: 'bg-orange-50' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800', bgColor: 'bg-red-50' }
]

const DEVIATION_TYPES = [
  { value: 'schedule', label: 'Schedule', icon: Clock, color: 'text-blue-600' },
  { value: 'cost', label: 'Cost', icon: DollarSign, color: 'text-green-600' },
  { value: 'scope', label: 'Scope', icon: Target, color: 'text-purple-600' },
  { value: 'quality', label: 'Quality', icon: CheckCircle, color: 'text-orange-600' }
]

export default function ImplementationMonitoringDashboard({ 
  projectId,
  refreshInterval = 30000, // 30 seconds
  onAlertAction 
}: ImplementationMonitoringDashboardProps) {
  const [alerts, setAlerts] = useState<ImplementationAlert[]>([])
  const [deviations, setDeviations] = useState<DeviationAlert[]>([])
  const [metrics, setMetrics] = useState<ImplementationMetrics | null>(null)
  const [lessonsLearned, setLessonsLearned] = useState<LessonsLearned[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'deviations' | 'lessons'>('overview')
  const [alertFilters, setAlertFilters] = useState({
    severity: '',
    type: '',
    acknowledged: 'all'
  })
  const [showLessonsModal, setShowLessonsModal] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState<LessonsLearned | null>(null)

  // Mock data for development - replace with actual API calls
  useEffect(() => {
    const mockMetrics: ImplementationMetrics = {
      total_implementations: 24,
      active_implementations: 8,
      completed_implementations: 14,
      overdue_implementations: 2,
      average_completion_time_days: 18.5,
      success_rate_percentage: 87.5,
      total_cost_variance_percentage: -3.2,
      total_schedule_variance_days: 4.2
    }

    const mockAlerts: ImplementationAlert[] = [
      {
        id: 'alert-1',
        type: 'schedule_overrun',
        severity: 'high',
        title: 'Implementation Behind Schedule',
        description: 'Foundation work implementation is 5 days behind planned schedule',
        implementation_plan_id: 'impl-1',
        task_id: 'task-2',
        detected_at: '2024-01-24T10:30:00Z',
        acknowledged: false,
        resolved: false,
        recommended_action: 'Review resource allocation and consider adding additional crew'
      },
      {
        id: 'alert-2',
        type: 'resource_overload',
        severity: 'medium',
        title: 'Resource Overallocation',
        description: 'John Smith is assigned to 4 concurrent implementations',
        implementation_plan_id: 'impl-2',
        detected_at: '2024-01-24T09:15:00Z',
        acknowledged: true,
        resolved: false,
        recommended_action: 'Redistribute workload or adjust implementation timelines'
      },
      {
        id: 'alert-3',
        type: 'cost_variance',
        severity: 'critical',
        title: 'Significant Cost Overrun',
        description: 'Material costs exceeded budget by 25% due to price increases',
        implementation_plan_id: 'impl-3',
        detected_at: '2024-01-24T08:45:00Z',
        acknowledged: false,
        resolved: false,
        recommended_action: 'Review budget allocation and seek approval for additional funding'
      }
    ]

    const mockDeviations: DeviationAlert[] = [
      {
        id: 'dev-1',
        deviation_type: 'schedule',
        severity: 'high',
        description: 'Concrete pouring delayed due to weather conditions',
        root_cause: 'Unexpected heavy rainfall during critical construction phase',
        corrective_action: 'Adjusted schedule to account for weather delays, added protective measures',
        impact_assessment: 'Project completion delayed by 3 days, minimal cost impact',
        detected_date: '2024-01-22',
        resolved_date: undefined,
        status: 'in_progress',
        implementation_plan_id: 'impl-1'
      },
      {
        id: 'dev-2',
        deviation_type: 'cost',
        severity: 'medium',
        description: 'Equipment rental costs higher than estimated',
        root_cause: 'Market rate increases not accounted for in initial estimates',
        corrective_action: 'Negotiated better rates with alternative suppliers',
        impact_assessment: 'Budget variance of 8%, within acceptable limits',
        detected_date: '2024-01-20',
        resolved_date: '2024-01-23',
        status: 'resolved',
        implementation_plan_id: 'impl-2'
      }
    ]

    const mockLessonsLearned: LessonsLearned[] = [
      {
        id: 'lesson-1',
        implementation_plan_id: 'impl-1',
        change_request_id: 'cr-1',
        lessons_learned: 'Weather contingency planning is crucial for outdoor construction activities. Need to build in buffer time for weather delays.',
        category: 'planning',
        impact_on_future_changes: 'All future construction changes should include weather risk assessment and contingency time',
        created_by: 'user-1',
        created_by_name: 'John Smith',
        created_at: '2024-01-23T16:30:00Z'
      },
      {
        id: 'lesson-2',
        implementation_plan_id: 'impl-2',
        change_request_id: 'cr-2',
        lessons_learned: 'Early supplier engagement and price confirmation prevents cost overruns during implementation.',
        category: 'procurement',
        impact_on_future_changes: 'Implement supplier confirmation process before implementation starts',
        created_by: 'user-2',
        created_by_name: 'Sarah Wilson',
        created_at: '2024-01-22T14:15:00Z'
      }
    ]

    setTimeout(() => {
      setMetrics(mockMetrics)
      setAlerts(mockAlerts)
      setDeviations(mockDeviations)
      setLessonsLearned(mockLessonsLearned)
      setLoading(false)
      setLastRefresh(new Date())
    }, 1000)
  }, [projectId])

  // Auto-refresh functionality
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        // Refresh data
        setLastRefresh(new Date())
        // In real implementation, this would trigger API calls
      }, refreshInterval)

      return () => clearInterval(interval)
    }
    // Return undefined for the else case
    return undefined
  }, [refreshInterval])

  const handleAlertAction = (alertId: string, action: 'acknowledge' | 'resolve' | 'dismiss') => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { 
            ...alert, 
            acknowledged: action === 'acknowledge' || alert.acknowledged,
            resolved: action === 'resolve'
          }
        : alert
    ))

    if (onAlertAction) {
      onAlertAction(alertId, action)
    }
  }

  const handleRefresh = () => {
    setLoading(true)
    // Simulate refresh
    setTimeout(() => {
      setLoading(false)
      setLastRefresh(new Date())
    }, 1000)
  }

  const getSeverityConfig = (severity: string) => {
    return ALERT_SEVERITIES.find(s => s.value === severity) || ALERT_SEVERITIES[0]
  }

  const getDeviationTypeConfig = (type: string) => {
    return DEVIATION_TYPES.find(t => t.value === type) || DEVIATION_TYPES[0]
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const filteredAlerts = alerts.filter(alert => {
    if (alertFilters.severity && alert.severity !== alertFilters.severity) return false
    if (alertFilters.type && alert.type !== alertFilters.type) return false
    if (alertFilters.acknowledged === 'acknowledged' && !alert.acknowledged) return false
    if (alertFilters.acknowledged === 'unacknowledged' && alert.acknowledged) return false
    return true
  })

  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical' && !alert.resolved)
  const highAlerts = alerts.filter(alert => alert.severity === 'high' && !alert.resolved)
  const unresolvedDeviations = deviations.filter(dev => dev.status !== 'resolved' && dev.status !== 'closed')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" data-testid="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Implementation Monitoring Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">
            Real-time monitoring of implementation progress and issues
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="ml-2 text-sm font-medium text-red-800">
              Critical Alerts Require Immediate Attention ({criticalAlerts.length})
            </h3>
          </div>
          <div className="mt-2 space-y-1">
            {criticalAlerts.slice(0, 2).map((alert) => (
              <div key={alert.id} className="text-sm text-red-700">
                • {alert.title}: {alert.description}
              </div>
            ))}
            {criticalAlerts.length > 2 && (
              <div className="text-sm text-red-600 font-medium">
                +{criticalAlerts.length - 2} more critical alerts
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Active Implementations</p>
                <p className="text-2xl font-semibold text-gray-900">{metrics.active_implementations}</p>
                <p className="text-xs text-gray-500">of {metrics.total_implementations} total</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Overdue</p>
                <p className="text-2xl font-semibold text-gray-900">{metrics.overdue_implementations}</p>
                <p className="text-xs text-gray-500">implementations behind schedule</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Success Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{metrics.success_rate_percentage}%</p>
                <p className="text-xs text-gray-500">completed on time & budget</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Avg. Completion</p>
                <p className="text-2xl font-semibold text-gray-900">{metrics.average_completion_time_days}</p>
                <p className="text-xs text-gray-500">days average</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3, count: null },
              { id: 'alerts', label: 'Alerts', icon: Bell, count: alerts.filter(a => !a.resolved).length },
              { id: 'deviations', label: 'Deviations', icon: AlertTriangle, count: unresolvedDeviations.length },
              { id: 'lessons', label: 'Lessons Learned', icon: Lightbulb, count: lessonsLearned.length }
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Performance Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule Performance</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Average Schedule Variance</span>
                      <span className={`text-sm font-medium ${
                        metrics && metrics.total_schedule_variance_days <= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metrics && metrics.total_schedule_variance_days > 0 ? '+' : ''}{metrics?.total_schedule_variance_days} days
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">On-Time Completion Rate</span>
                      <span className="text-sm font-medium text-green-600">
                        {metrics && Math.round((metrics.completed_implementations - metrics.overdue_implementations) / metrics.completed_implementations * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Performance</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Average Cost Variance</span>
                      <span className={`text-sm font-medium ${
                        metrics && metrics.total_cost_variance_percentage <= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metrics && metrics.total_cost_variance_percentage > 0 ? '+' : ''}{metrics?.total_cost_variance_percentage}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Budget Adherence Rate</span>
                      <span className="text-sm font-medium text-green-600">
                        {metrics && Math.round(100 - Math.abs(metrics.total_cost_variance_percentage))}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {alerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="flex items-center gap-3 text-sm">
                      <div className={`w-2 h-2 rounded-full ${
                        alert.severity === 'critical' ? 'bg-red-500' :
                        alert.severity === 'high' ? 'bg-orange-500' :
                        alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-gray-500'
                      }`}></div>
                      <span className="text-gray-600">{formatDateTime(alert.detected_at)}</span>
                      <span className="text-gray-900">{alert.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-lg font-medium text-gray-900">Implementation Alerts</h3>
                
                {/* Alert Filters */}
                <div className="flex items-center gap-3">
                  <select
                    value={alertFilters.severity}
                    onChange={(e) => setAlertFilters(prev => ({ ...prev, severity: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Severities</option>
                    {ALERT_SEVERITIES.map(severity => (
                      <option key={severity.value} value={severity.value}>
                        {severity.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={alertFilters.acknowledged}
                    onChange={(e) => setAlertFilters(prev => ({ ...prev, acknowledged: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Alerts</option>
                    <option value="unacknowledged">Unacknowledged</option>
                    <option value="acknowledged">Acknowledged</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {filteredAlerts.map((alert) => {
                  const severityConfig = getSeverityConfig(alert.severity)
                  return (
                    <div key={alert.id} className={`border rounded-lg p-4 ${severityConfig.bgColor}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityConfig.color}`}>
                              {severityConfig.label}
                            </span>
                            <h4 className="text-lg font-medium text-gray-900">{alert.title}</h4>
                            {alert.acknowledged && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Acknowledged
                              </span>
                            )}
                            {alert.resolved && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Resolved
                              </span>
                            )}
                          </div>
                          
                          <p className="text-gray-700 mb-3">{alert.description}</p>
                          
                          <div className="bg-blue-50 rounded-lg p-3 mb-3">
                            <div className="flex items-start gap-2">
                              <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-blue-900">Recommended Action:</p>
                                <p className="text-sm text-blue-800">{alert.recommended_action}</p>
                              </div>
                            </div>
                          </div>

                          <div className="text-sm text-gray-500">
                            Detected: {formatDateTime(alert.detected_at)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {!alert.acknowledged && (
                            <button
                              onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                            >
                              Acknowledge
                            </button>
                          )}
                          {!alert.resolved && (
                            <button
                              onClick={() => handleAlertAction(alert.id, 'resolve')}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {filteredAlerts.length === 0 && (
                <div className="text-center py-12">
                  <Bell className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    All implementations are running smoothly.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Deviations Tab */}
          {activeTab === 'deviations' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Implementation Deviations</h3>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  Report Deviation
                </button>
              </div>

              <div className="space-y-4">
                {deviations.map((deviation) => {
                  const typeConfig = getDeviationTypeConfig(deviation.deviation_type)
                  const severityConfig = getSeverityConfig(deviation.severity)
                  const Icon = typeConfig.icon

                  return (
                    <div key={deviation.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className={`h-5 w-5 ${typeConfig.color}`} />
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityConfig.color}`}>
                              {severityConfig.label}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                              {typeConfig.label}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              deviation.status === 'resolved' ? 'bg-green-100 text-green-800' :
                              deviation.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {deviation.status.replace('_', ' ')}
                            </span>
                          </div>
                          
                          <p className="text-gray-900 font-medium mb-2">{deviation.description}</p>
                          
                          {deviation.root_cause && (
                            <div className="mb-3">
                              <p className="text-sm font-medium text-gray-700">Root Cause:</p>
                              <p className="text-sm text-gray-600">{deviation.root_cause}</p>
                            </div>
                          )}

                          {deviation.corrective_action && (
                            <div className="mb-3">
                              <p className="text-sm font-medium text-gray-700">Corrective Action:</p>
                              <p className="text-sm text-gray-600">{deviation.corrective_action}</p>
                            </div>
                          )}

                          {deviation.impact_assessment && (
                            <div className="mb-3">
                              <p className="text-sm font-medium text-gray-700">Impact Assessment:</p>
                              <p className="text-sm text-gray-600">{deviation.impact_assessment}</p>
                            </div>
                          )}

                          <div className="text-sm text-gray-500">
                            Detected: {formatDate(deviation.detected_date)}
                            {deviation.resolved_date && ` • Resolved: ${formatDate(deviation.resolved_date)}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <button className="text-blue-600 hover:text-blue-800 text-sm">
                            Update Status
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {deviations.length === 0 && (
                <div className="text-center py-12">
                  <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No deviations reported</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    All implementations are proceeding as planned.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Lessons Learned Tab */}
          {activeTab === 'lessons' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Lessons Learned</h3>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  Add Lesson
                </button>
              </div>

              <div className="space-y-4">
                {lessonsLearned.map((lesson) => (
                  <div key={lesson.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Lightbulb className="h-5 w-5 text-yellow-600" />
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {lesson.category}
                          </span>
                          <span className="text-sm text-gray-500">
                            by {lesson.created_by_name} • {formatDateTime(lesson.created_at)}
                          </span>
                        </div>
                        
                        <p className="text-gray-900 mb-3">{lesson.lessons_learned}</p>
                        
                        {lesson.impact_on_future_changes && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-sm font-medium text-green-900">Impact on Future Changes:</p>
                            <p className="text-sm text-green-800">{lesson.impact_on_future_changes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => {
                            setSelectedLesson(lesson)
                            setShowLessonsModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {lessonsLearned.length === 0 && (
                <div className="text-center py-12">
                  <Lightbulb className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No lessons learned yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Start capturing insights from implementation experiences.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lessons Learned Detail Modal */}
      {showLessonsModal && selectedLesson && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-3/4 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-gray-900">Lesson Learned Details</h3>
                <button
                  onClick={() => setShowLessonsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                    {selectedLesson.category}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lesson Learned</label>
                  <p className="text-gray-900 bg-gray-50 rounded-lg p-3">{selectedLesson.lessons_learned}</p>
                </div>

                {selectedLesson.impact_on_future_changes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Impact on Future Changes</label>
                    <p className="text-gray-900 bg-green-50 rounded-lg p-3">{selectedLesson.impact_on_future_changes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Created By</label>
                    <p className="text-gray-900">{selectedLesson.created_by_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Created Date</label>
                    <p className="text-gray-900">{formatDateTime(selectedLesson.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowLessonsModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Close
                </button>
                <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
                  Share Lesson
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}