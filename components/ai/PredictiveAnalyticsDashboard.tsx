/**
 * Predictive Analytics Dashboard Component
 * Displays capacity planning predictions and performance patterns
 * Requirements: 6.4, 6.5
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  Target,
  Brain,
  BarChart3,
  Calendar,
  Zap,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react'
import { 
  predictiveAnalyticsEngine,
  type CapacityPrediction,
  type PerformancePattern,
  assessCapacityRisk
} from '../../lib/ai/predictive-analytics'

export interface PredictiveAnalyticsDashboardProps {
  userId?: string
  className?: string
}

interface DashboardData {
  capacity_overview: {
    current_utilization: number
    predicted_utilization_next_month: number
    capacity_trend: 'increasing' | 'stable' | 'decreasing'
    critical_alerts: Array<{
      type: 'capacity_shortage' | 'skill_gap' | 'overallocation'
      severity: 'low' | 'medium' | 'high' | 'critical'
      message: string
      recommended_action: string
    }>
  }
  performance_patterns: {
    active_patterns: number
    high_impact_patterns: number
    next_predicted_event: {
      pattern_name: string
      predicted_date: string
      confidence: number
      preparation_time: string
    }
  }
  learning_metrics: {
    model_accuracy: number
    recent_optimizations: number
    success_rate: number
    improvement_trend: 'improving' | 'stable' | 'declining'
  }
  recommendations: Array<{
    type: 'capacity' | 'pattern' | 'optimization'
    priority: number
    title: string
    description: string
    action_required: boolean
    estimated_impact: string
  }>
}

export const PredictiveAnalyticsDashboard: React.FC<PredictiveAnalyticsDashboardProps> = ({
  userId: _userId,
  className = ''
}) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [capacityPredictions, setCapacityPredictions] = useState<CapacityPrediction[]>([])
  const [performancePatterns, setPerformancePatterns] = useState<PerformancePattern[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTimeHorizon, setSelectedTimeHorizon] = useState<'1_month' | '3_months' | '6_months'>('3_months')

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load main dashboard data
      const dashboardResponse = await predictiveAnalyticsEngine.getDashboardData()
      setDashboardData(dashboardResponse)

      // Load detailed capacity predictions
      const capacityResponse = await predictiveAnalyticsEngine.generateCapacityPredictions({
        prediction_horizons: [selectedTimeHorizon],
        include_skill_breakdown: true,
        include_risk_analysis: true
      })
      setCapacityPredictions(capacityResponse.predictions)

      // Load performance patterns
      const patternsResponse = await predictiveAnalyticsEngine.identifyPerformancePatterns({
        analysis_period_months: 6,
        include_predictions: true
      })
      setPerformancePatterns(patternsResponse.patterns)

    } catch (err) {
      console.error('Failed to load predictive analytics data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics data')
    } finally {
      setIsLoading(false)
    }
  }, [selectedTimeHorizon])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const getTrendIcon = (trend: 'increasing' | 'stable' | 'decreasing') => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-5 w-5 text-green-500 dark:text-green-400" />
      case 'decreasing':
        return <TrendingDown className="h-5 w-5 text-red-500 dark:text-red-400" />
      default:
        return <BarChart3 className="h-5 w-5 text-blue-500 dark:text-blue-400" />
    }
  }

  const getSeverityColor = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    }
  }

  const getSeverityIcon = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <XCircle className="h-4 w-4" />
      case 'medium':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 dark:border-red-800 rounded-lg p-6 ${className}`}>
        <div className="flex items-center">
          <XCircle className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300">Error Loading Analytics</h3>
        </div>
        <p className="text-red-700 mt-2">{error}</p>
        <button
          onClick={loadDashboardData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Predictive Analytics</h1>
          <p className="text-gray-600 dark:text-slate-400">AI-powered capacity planning and performance insights</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeHorizon}
            onChange={(e) => setSelectedTimeHorizon(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="1_month">1 Month</option>
            <option value="3_months">3 Months</option>
            <option value="6_months">6 Months</option>
          </select>
          
          <button
            onClick={loadDashboardData}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Zap className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Current Utilization */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Current Utilization</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {dashboardData.capacity_overview.current_utilization.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {getTrendIcon(dashboardData.capacity_overview.capacity_trend)}
            <span className="ml-2 text-sm text-gray-600 dark:text-slate-400">
              {dashboardData.capacity_overview.capacity_trend} trend
            </span>
          </div>
        </div>

        {/* Predicted Utilization */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Predicted Next Month</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {dashboardData.capacity_overview.predicted_utilization_next_month.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(100, dashboardData.capacity_overview.predicted_utilization_next_month)}%` 
                  }}
                />
              </div>
              <span className="ml-2 text-sm text-gray-600 dark:text-slate-400">
                {assessCapacityRisk(
                  dashboardData.capacity_overview.predicted_utilization_next_month,
                  dashboardData.capacity_overview.capacity_trend
                )} risk
              </span>
            </div>
          </div>
        </div>

        {/* Active Patterns */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Active Patterns</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {dashboardData.performance_patterns.active_patterns}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {dashboardData.performance_patterns.high_impact_patterns} high impact
            </p>
          </div>
        </div>

        {/* Model Accuracy */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Model Accuracy</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {(dashboardData.learning_metrics.model_accuracy * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
              <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {dashboardData.learning_metrics.improvement_trend === 'improving' ? (
              <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
            ) : dashboardData.learning_metrics.improvement_trend === 'declining' ? (
              <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
            ) : (
              <BarChart3 className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            )}
            <span className="ml-2 text-sm text-gray-600 dark:text-slate-400">
              {dashboardData.learning_metrics.improvement_trend}
            </span>
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {dashboardData.capacity_overview.critical_alerts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Critical Alerts</h2>
          </div>
          
          <div className="space-y-3">
            {dashboardData.capacity_overview.critical_alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-3">
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm mt-1 opacity-90">
                      <strong>Recommended Action:</strong> {alert.recommended_action}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capacity Predictions */}
      {capacityPredictions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Capacity Predictions</h2>
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {selectedTimeHorizon.replace('_', ' ')} forecast
            </span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {capacityPredictions.slice(0, 4).map((prediction) => (
              <div key={prediction.prediction_id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 dark:text-slate-100">{prediction.resource_name}</h3>
                  <span className="text-sm text-gray-500 dark:text-slate-400">
                    {(prediction.confidence_score * 100).toFixed(0)}% confidence
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Predicted Utilization</span>
                      <span>{prediction.predicted_utilization.realistic.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min(100, prediction.predicted_utilization.realistic)}%` 
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mt-1">
                      <span>Pessimistic: {prediction.predicted_utilization.pessimistic.toFixed(1)}%</span>
                      <span>Optimistic: {prediction.predicted_utilization.optimistic.toFixed(1)}%</span>
                    </div>
                  </div>
                  
                  {prediction.capacity_gaps.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Capacity Gaps:</p>
                      <div className="space-y-1">
                        {prediction.capacity_gaps.slice(0, 2).map((gap, index) => (
                          <div key={index} className="text-xs text-gray-600 dark:text-slate-400">
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                              gap.severity === 'critical' ? 'bg-red-500' :
                              gap.severity === 'high' ? 'bg-orange-500' :
                              gap.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`} />
                            {gap.skill}: {gap.gap_hours}h shortage
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Patterns */}
      {performancePatterns.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Performance Patterns</h2>
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {performancePatterns.length} patterns identified
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {performancePatterns.slice(0, 4).map((pattern) => (
              <div key={pattern.pattern_id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 dark:text-slate-100">{pattern.pattern_name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    pattern.pattern_type === 'seasonal' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                    pattern.pattern_type === 'cyclical' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                    pattern.pattern_type === 'trending' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                    'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                  }`}>
                    {pattern.pattern_type}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">{pattern.description}</p>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Strength:</span>
                    <span>{(pattern.strength * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Impact:</span>
                    <span>{(pattern.significance * 100).toFixed(0)}%</span>
                  </div>
                  {pattern.next_occurrence && (
                    <div className="flex justify-between text-sm">
                      <span>Next Expected:</span>
                      <span>{new Date(pattern.next_occurrence.predicted_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center mb-6">
          <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">AI Recommendations</h2>
        </div>
        
        <div className="space-y-4">
          {dashboardData.recommendations
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 6)
            .map((recommendation, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-l-4 ${
                recommendation.priority === 1 ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                recommendation.priority === 2 ? 'border-orange-500 bg-orange-50' :
                'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h3 className="font-medium text-gray-900 dark:text-slate-100">{recommendation.title}</h3>
                    {recommendation.action_required && (
                      <span className="ml-2 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs rounded-full">
                        Action Required
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{recommendation.description}</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                    <strong>Expected Impact:</strong> {recommendation.estimated_impact}
                  </p>
                </div>
                <div className="flex-shrink-0 ml-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    recommendation.type === 'capacity' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                    recommendation.type === 'pattern' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                    'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  }`}>
                    {recommendation.type}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Predicted Event */}
      {dashboardData.performance_patterns.next_predicted_event && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
          <div className="flex items-center mb-4">
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Next Predicted Event</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Pattern</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {dashboardData.performance_patterns.next_predicted_event.pattern_name}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Predicted Date</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {new Date(dashboardData.performance_patterns.next_predicted_event.predicted_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Confidence</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {(dashboardData.performance_patterns.next_predicted_event.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Preparation Time:</strong> {dashboardData.performance_patterns.next_predicted_event.preparation_time}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PredictiveAnalyticsDashboard