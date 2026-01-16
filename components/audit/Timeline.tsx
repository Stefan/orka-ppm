'use client'

import React, { useState, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ZAxis
} from 'recharts'
import {
  AlertTriangle,
  Info,
  Shield,
  DollarSign,
  Users,
  FileText,
  Clock,
  ChevronRight,
  X,
  Filter,
  Calendar,
  Tag
} from 'lucide-react'

/**
 * Audit Event Interface
 */
export interface AuditEvent {
  id: string
  event_type: string
  user_id?: string
  user_name?: string
  entity_type: string
  entity_id?: string
  action_details: Record<string, any>
  severity: 'info' | 'warning' | 'error' | 'critical'
  timestamp: string
  anomaly_score?: number
  is_anomaly: boolean
  category?: string
  risk_level?: 'Low' | 'Medium' | 'High' | 'Critical'
  tags?: Record<string, any>
  ai_insights?: Record<string, any>
  tenant_id: string
}

/**
 * Timeline Props
 */
export interface TimelineProps {
  events: AuditEvent[]
  onEventClick?: (event: AuditEvent) => void
  onFilterChange?: (filters: TimelineFilters) => void
  filters?: TimelineFilters
  loading?: boolean
  height?: number
  className?: string
}

/**
 * Timeline Filters
 */
export interface TimelineFilters {
  dateRange?: {
    start: Date
    end: Date
  }
  eventTypes?: string[]
  severity?: string[]
  categories?: string[]
  riskLevels?: string[]
  showAnomaliesOnly?: boolean
}

/**
 * Get severity color
 */
const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical':
      return '#EF4444' // Red
    case 'error':
      return '#F59E0B' // Orange
    case 'warning':
      return '#FBBF24' // Yellow
    case 'info':
    default:
      return '#3B82F6' // Blue
  }
}

/**
 * Get category icon
 */
const getCategoryIcon = (category?: string) => {
  switch (category) {
    case 'Security Change':
      return <Shield className="h-4 w-4" />
    case 'Financial Impact':
      return <DollarSign className="h-4 w-4" />
    case 'Resource Allocation':
      return <Users className="h-4 w-4" />
    case 'Risk Event':
      return <AlertTriangle className="h-4 w-4" />
    case 'Compliance Action':
      return <FileText className="h-4 w-4" />
    default:
      return <Info className="h-4 w-4" />
  }
}

/**
 * Timeline Component
 * 
 * Interactive timeline visualization for audit events with AI insights.
 * Features:
 * - Chronological event display with color-coded severity
 * - Event markers with hover tooltips
 * - AI-generated tags and insights
 * - Anomaly score visualization
 * - Filtering by date, type, severity, category, and risk level
 * - Event drill-down with detailed modal
 */
const Timeline: React.FC<TimelineProps> = ({
  events,
  onEventClick,
  onFilterChange,
  filters,
  loading = false,
  height = 500,
  className = ''
}) => {
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  /**
   * Transform events for Recharts scatter plot
   * X-axis: timestamp, Y-axis: severity level, Z-axis: anomaly score
   */
  const chartData = useMemo(() => {
    return events.map((event, index) => {
      // Convert severity to numeric value for Y-axis
      const severityValue = 
        event.severity === 'critical' ? 4 :
        event.severity === 'error' ? 3 :
        event.severity === 'warning' ? 2 : 1

      // Use anomaly score for bubble size (Z-axis)
      const bubbleSize = event.is_anomaly && event.anomaly_score 
        ? event.anomaly_score * 100 
        : 20

      return {
        ...event,
        x: new Date(event.timestamp).getTime(),
        y: severityValue,
        z: bubbleSize,
        color: getSeverityColor(event.severity),
        index
      }
    })
  }, [events])

  /**
   * Handle event click
   */
  const handleEventClick = useCallback((data: any) => {
    if (data && data.payload) {
      const event = events[data.payload.index]
      setSelectedEvent(event)
      onEventClick?.(event)
    }
  }, [events, onEventClick])

  /**
   * Custom tooltip
   */
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    const event = events[data.index]

    return (
      <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200 max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            {getCategoryIcon(event.category)}
            <div>
              <p className="font-semibold text-gray-900">{event.event_type}</p>
              <p className="text-xs text-gray-500">
                {new Date(event.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <span className={`px-2 py-1 text-xs rounded-full ${
            event.severity === 'critical' ? 'bg-red-100 text-red-700' :
            event.severity === 'error' ? 'bg-orange-100 text-orange-700' :
            event.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {event.severity}
          </span>
        </div>

        {/* User and Entity */}
        <div className="space-y-1 mb-3">
          {event.user_name && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">User:</span> {event.user_name}
            </p>
          )}
          <p className="text-sm text-gray-700">
            <span className="font-medium">Entity:</span> {event.entity_type}
          </p>
        </div>

        {/* AI Insights */}
        {event.is_anomaly && event.anomaly_score && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-900">
                Anomaly Detected
              </span>
            </div>
            <p className="text-xs text-red-700 mt-1">
              Score: {(event.anomaly_score * 100).toFixed(1)}%
            </p>
            {event.ai_insights?.explanation && (
              <p className="text-xs text-red-600 mt-1">
                {event.ai_insights.explanation}
              </p>
            )}
          </div>
        )}

        {/* AI Generated Insights */}
        {event.ai_insights && !event.is_anomaly && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center space-x-2 mb-1">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-900">AI Insights</span>
            </div>
            {event.ai_insights.summary && (
              <p className="text-xs text-blue-700">
                {event.ai_insights.summary}
              </p>
            )}
            {event.ai_insights.impact && (
              <p className="text-xs text-blue-600 mt-1">
                Impact: {event.ai_insights.impact}
              </p>
            )}
          </div>
        )}

        {/* Tags */}
        {event.tags && Object.keys(event.tags).length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-700 mb-1">AI Tags:</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(event.tags).slice(0, 3).map(([key, value]) => (
                <span
                  key={key}
                  className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full"
                >
                  {key}: {String(value)}
                </span>
              ))}
              {Object.keys(event.tags).length > 3 && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  +{Object.keys(event.tags).length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Category and Risk Level */}
        <div className="flex items-center justify-between text-xs text-gray-600">
          {event.category && (
            <span className="flex items-center space-x-1">
              <Tag className="h-3 w-3" />
              <span>{event.category}</span>
            </span>
          )}
          {event.risk_level && (
            <span className={`px-2 py-0.5 rounded-full ${
              event.risk_level === 'Critical' ? 'bg-red-100 text-red-700' :
              event.risk_level === 'High' ? 'bg-orange-100 text-orange-700' :
              event.risk_level === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {event.risk_level} Risk
            </span>
          )}
        </div>

        {/* Click hint */}
        <div className="mt-3 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 flex items-center">
            <ChevronRight className="h-3 w-3 mr-1" />
            Click for details
          </p>
        </div>
      </div>
    )
  }

  /**
   * Format X-axis (timestamp)
   */
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  /**
   * Format Y-axis (severity)
   */
  const formatYAxis = (value: number) => {
    switch (value) {
      case 4: return 'Critical'
      case 3: return 'Error'
      case 2: return 'Warning'
      case 1: return 'Info'
      default: return ''
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <Clock className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading timeline...</p>
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <Info className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No events to display</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-white rounded-lg border border-gray-200 ${className}`} data-testid="audit-timeline">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Audit Timeline</h3>
          <p className="text-sm text-gray-600">
            {events.length} event{events.length !== 1 ? 's' : ''}
            {events.filter(e => e.is_anomaly).length > 0 && (
              <span className="ml-2 text-red-600">
                • {events.filter(e => e.is_anomaly).length} anomal{events.filter(e => e.is_anomaly).length !== 1 ? 'ies' : 'y'}
              </span>
            )}
          </p>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-lg transition-colors ${
            showFilters ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Toggle Filters"
        >
          <Filter className="h-5 w-5" />
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Date Range
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters?.dateRange?.start ? new Date(filters.dateRange.start).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const newFilters = {
                      ...filters,
                      dateRange: {
                        start: new Date(e.target.value),
                        end: filters?.dateRange?.end || new Date()
                      }
                    }
                    onFilterChange?.(newFilters)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Start date"
                />
                <input
                  type="date"
                  value={filters?.dateRange?.end ? new Date(filters.dateRange.end).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const newFilters = {
                      ...filters,
                      dateRange: {
                        start: filters?.dateRange?.start || new Date(),
                        end: new Date(e.target.value)
                      }
                    }
                    onFilterChange?.(newFilters)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="End date"
                />
              </div>
            </div>

            {/* Severity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Severity
              </label>
              <div className="space-y-2">
                {['info', 'warning', 'error', 'critical'].map((severity) => (
                  <label key={severity} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters?.severity?.includes(severity) ?? true}
                      onChange={(e) => {
                        const currentSeverity = filters?.severity || []
                        const newSeverity = e.target.checked
                          ? [...currentSeverity, severity]
                          : currentSeverity.filter(s => s !== severity)
                        onFilterChange?.({ ...filters, severity: newSeverity })
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{severity}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="h-4 w-4 inline mr-1" />
                Category
              </label>
              <div className="space-y-2">
                {[
                  'Security Change',
                  'Financial Impact',
                  'Resource Allocation',
                  'Risk Event',
                  'Compliance Action'
                ].map((category) => (
                  <label key={category} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters?.categories?.includes(category) ?? true}
                      onChange={(e) => {
                        const currentCategories = filters?.categories || []
                        const newCategories = e.target.checked
                          ? [...currentCategories, category]
                          : currentCategories.filter(c => c !== category)
                        onFilterChange?.({ ...filters, categories: newCategories })
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Risk Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risk Level
              </label>
              <div className="space-y-2">
                {['Low', 'Medium', 'High', 'Critical'].map((level) => (
                  <label key={level} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters?.riskLevels?.includes(level) ?? true}
                      onChange={(e) => {
                        const currentLevels = filters?.riskLevels || []
                        const newLevels = e.target.checked
                          ? [...currentLevels, level]
                          : currentLevels.filter(l => l !== level)
                        onFilterChange?.({ ...filters, riskLevels: newLevels })
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{level}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Anomalies Only Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Filters
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters?.showAnomaliesOnly ?? false}
                  onChange={(e) => {
                    onFilterChange?.({ ...filters, showAnomaliesOnly: e.target.checked })
                  }}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700 flex items-center">
                  <AlertTriangle className="h-4 w-4 text-red-600 mr-1" />
                  Show Anomalies Only
                </span>
              </label>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  onFilterChange?.({
                    dateRange: undefined,
                    eventTypes: undefined,
                    severity: undefined,
                    categories: undefined,
                    riskLevels: undefined,
                    showAnomaliesOnly: false
                  })
                }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart
            margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              type="number"
              dataKey="x"
              name="Time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatXAxis}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Severity"
              domain={[0.5, 4.5]}
              ticks={[1, 2, 3, 4]}
              tickFormatter={formatYAxis}
              tick={{ fontSize: 12 }}
            />
            <ZAxis
              type="number"
              dataKey="z"
              range={[20, 400]}
              name="Anomaly Score"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            <Scatter
              name="Audit Events"
              data={chartData}
              onClick={handleEventClick}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="px-4 pb-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-gray-600">Info</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-gray-600">Warning</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span className="text-gray-600">Error</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-600">Critical</span>
        </div>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-3 w-3 text-red-600" />
          <span className="text-gray-600">Larger bubbles = Higher anomaly score</span>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  {getCategoryIcon(selectedEvent.category)}
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedEvent.event_type}
                  </h2>
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    selectedEvent.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    selectedEvent.severity === 'error' ? 'bg-orange-100 text-orange-700' :
                    selectedEvent.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedEvent.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {new Date(selectedEvent.timestamp).toLocaleString('en-US', {
                    dateStyle: 'full',
                    timeStyle: 'long'
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Event Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Event Information</h3>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-xs text-gray-600">Event ID</dt>
                      <dd className="text-sm font-mono text-gray-900">{selectedEvent.id}</dd>
                    </div>
                    {selectedEvent.user_name && (
                      <div>
                        <dt className="text-xs text-gray-600">User</dt>
                        <dd className="text-sm text-gray-900">{selectedEvent.user_name}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs text-gray-600">Entity Type</dt>
                      <dd className="text-sm text-gray-900">{selectedEvent.entity_type}</dd>
                    </div>
                    {selectedEvent.entity_id && (
                      <div>
                        <dt className="text-xs text-gray-600">Entity ID</dt>
                        <dd className="text-sm font-mono text-gray-900">{selectedEvent.entity_id}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Classification</h3>
                  <dl className="space-y-2">
                    {selectedEvent.category && (
                      <div>
                        <dt className="text-xs text-gray-600">Category</dt>
                        <dd className="text-sm text-gray-900">{selectedEvent.category}</dd>
                      </div>
                    )}
                    {selectedEvent.risk_level && (
                      <div>
                        <dt className="text-xs text-gray-600">Risk Level</dt>
                        <dd className={`text-sm font-semibold ${
                          selectedEvent.risk_level === 'Critical' ? 'text-red-600' :
                          selectedEvent.risk_level === 'High' ? 'text-orange-600' :
                          selectedEvent.risk_level === 'Medium' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {selectedEvent.risk_level}
                        </dd>
                      </div>
                    )}
                    {selectedEvent.is_anomaly && selectedEvent.anomaly_score && (
                      <div>
                        <dt className="text-xs text-gray-600">Anomaly Score</dt>
                        <dd className="text-sm font-semibold text-red-600">
                          {(selectedEvent.anomaly_score * 100).toFixed(2)}%
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Anomaly Alert */}
              {selectedEvent.is_anomaly && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-900 mb-2">
                        Anomaly Detected
                      </h3>
                      <p className="text-sm text-red-700 mb-2">
                        This event has been flagged as anomalous by the AI detection system with a score of{' '}
                        <span className="font-semibold">
                          {((selectedEvent.anomaly_score || 0) * 100).toFixed(2)}%
                        </span>
                      </p>
                      {selectedEvent.ai_insights?.explanation && (
                        <p className="text-sm text-red-600">
                          {selectedEvent.ai_insights.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Insights */}
              {selectedEvent.ai_insights && Object.keys(selectedEvent.ai_insights).length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                    <Info className="h-5 w-5 mr-2" />
                    AI-Generated Insights
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(selectedEvent.ai_insights).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs text-blue-700 font-medium capitalize">
                          {key.replace(/_/g, ' ')}
                        </dt>
                        <dd className="text-sm text-blue-900 mt-1">
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </dd>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedEvent.tags && Object.keys(selectedEvent.tags).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <Tag className="h-5 w-5 mr-2" />
                    AI-Generated Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedEvent.tags).map(([key, value]) => (
                      <span
                        key={key}
                        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-full"
                      >
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Action Details</h3>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(selectedEvent.action_details, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Navigation to Related Entities */}
              {selectedEvent.entity_id && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Related Entity</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      View details for this {selectedEvent.entity_type}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      // Navigate to entity details
                      // This would be implemented based on your routing structure
                      console.log('Navigate to entity:', selectedEvent.entity_type, selectedEvent.entity_id)
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                  >
                    <span>View {selectedEvent.entity_type}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  // Export event details
                  const dataStr = JSON.stringify(selectedEvent, null, 2)
                  const dataBlob = new Blob([dataStr], { type: 'application/json' })
                  const url = URL.createObjectURL(dataBlob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `audit-event-${selectedEvent.id}.json`
                  link.click()
                  URL.revokeObjectURL(url)
                }}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Export Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Timeline
