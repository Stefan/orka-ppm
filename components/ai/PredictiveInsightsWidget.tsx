/**
 * Predictive Insights Widget
 * A compact widget showing key predictive analytics insights
 * Requirements: 6.4, 6.5
 */

'use client'

import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Brain,
  ChevronRight,
  Zap,
  Clock,
  Target
} from 'lucide-react'
import { usePredictiveAnalytics } from '../hooks/usePredictiveAnalytics'

interface PredictiveInsightsWidgetProps {
  className?: string
  showFullDashboardLink?: boolean
  maxInsights?: number
}

export const PredictiveInsightsWidget: React.FC<PredictiveInsightsWidgetProps> = ({
  className = '',
  showFullDashboardLink = true,
  maxInsights = 3
}) => {
  const {
    dashboardData,
    criticalAlerts,
    performanceInsights,
    isLoading,
    error,
    loadAllData
  } = usePredictiveAnalytics({
    autoRefresh: true,
    refreshInterval: 10 * 60 * 1000 // 10 minutes
  })

  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    loadAllData().catch(console.error)
  }, [loadAllData])

  if (isLoading && !dashboardData) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center mb-3">
            <div className="h-5 w-5 bg-gray-200 rounded mr-2"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center text-red-600 mb-2">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <span className="text-sm font-medium">Analytics Unavailable</span>
        </div>
        <p className="text-xs text-gray-500">{error}</p>
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  const topInsights = [
    ...criticalAlerts.slice(0, 2).map(alert => ({
      type: 'alert',
      icon: AlertTriangle,
      iconColor: alert.severity === 'critical' ? 'text-red-500' : 'text-orange-500',
      title: alert.type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      message: alert.message,
      priority: alert.severity === 'critical' ? 1 : 2
    })),
    ...performanceInsights.slice(0, 2).map(insight => ({
      type: 'insight',
      icon: insight.level === 'warning' ? AlertTriangle : TrendingUp,
      iconColor: insight.level === 'warning' ? 'text-yellow-500' : 'text-blue-500',
      title: insight.type.replace(/\b\w/g, l => l.toUpperCase()),
      message: insight.message,
      priority: insight.level === 'warning' ? 2 : 3
    }))
  ].sort((a, b) => a.priority - b.priority).slice(0, maxInsights)

  const utilizationTrend = dashboardData.capacity_overview?.capacity_trend
  const currentUtilization = dashboardData.capacity_overview?.current_utilization || 0
  const predictedUtilization = dashboardData.capacity_overview?.predicted_utilization_next_month || 0

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Brain className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-medium text-gray-900">AI Insights</h3>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronRight className={`h-4 w-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Target className="h-4 w-4 text-blue-500 mr-1" />
              <span className="text-xs text-gray-500">Current</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {currentUtilization.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Clock className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-xs text-gray-500">Predicted</span>
            </div>
            <div className="flex items-center justify-center">
              <p className="text-lg font-semibold text-gray-900">
                {predictedUtilization.toFixed(1)}%
              </p>
              {utilizationTrend === 'increasing' && (
                <TrendingUp className="h-3 w-3 text-green-500 ml-1" />
              )}
              {utilizationTrend === 'decreasing' && (
                <TrendingDown className="h-3 w-3 text-red-500 ml-1" />
              )}
            </div>
          </div>
        </div>

        {/* Top Insights */}
        {topInsights.length > 0 && (
          <div className="space-y-2">
            {topInsights.map((insight, index) => (
              <div key={index} className="flex items-start p-2 bg-gray-50 rounded-lg">
                <insight.icon className={`h-4 w-4 ${insight.iconColor} mr-2 mt-0.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {insight.title}
                  </p>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {insight.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            {/* Model Performance */}
            {dashboardData.learning_metrics && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Model Accuracy</span>
                  <span className="text-xs text-gray-900">
                    {(dashboardData.learning_metrics.model_accuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${dashboardData.learning_metrics.model_accuracy * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Active Patterns */}
            {dashboardData.performance_patterns && (
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Active Patterns</span>
                  <span className="text-xs text-gray-900">
                    {dashboardData.performance_patterns.active_patterns}
                  </span>
                </div>
                {dashboardData.performance_patterns.high_impact_patterns > 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    {dashboardData.performance_patterns.high_impact_patterns} high impact
                  </p>
                )}
              </div>
            )}

            {/* Next Predicted Event */}
            {dashboardData.performance_patterns?.next_predicted_event && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center mb-1">
                  <Zap className="h-3 w-3 text-blue-600 mr-1" />
                  <span className="text-xs font-medium text-blue-900">Next Event</span>
                </div>
                <p className="text-xs text-blue-800">
                  {dashboardData.performance_patterns.next_predicted_event.pattern_name}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {new Date(dashboardData.performance_patterns.next_predicted_event.predicted_date).toLocaleDateString()}
                  {' '}({(dashboardData.performance_patterns.next_predicted_event.confidence * 100).toFixed(0)}% confidence)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Full Dashboard Link */}
        {showFullDashboardLink && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors">
              View Full Analytics Dashboard
              <ChevronRight className="h-3 w-3 ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PredictiveInsightsWidget