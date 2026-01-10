/**
 * Hook for managing predictive analytics data and operations
 * Requirements: 6.4, 6.5
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  predictiveAnalyticsEngine,
  type CapacityPrediction,
  type PerformancePattern,
  type LearningOutcome,
  type PredictiveAnalyticsConfig,
  generateCapacityRecommendations
} from '../lib/sync/predictive-analytics'

interface UsePredictiveAnalyticsOptions {
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
  config?: Partial<PredictiveAnalyticsConfig>
}

interface PredictiveAlert {
  type: 'capacity_shortage' | 'skill_gap' | 'performance_decline' | 'resource_overload' | 'pattern_alert'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  resource_id?: string
  prediction_id?: string
  skill?: string
  pattern_id?: string
  days_until?: number
}

interface PredictiveAnalyticsState {
  capacityPredictions: CapacityPrediction[]
  performancePatterns: PerformancePattern[]
  learningInsights: any
  dashboardData: any
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function usePredictiveAnalytics(options: UsePredictiveAnalyticsOptions = {}) {
  const {
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    config
  } = options

  const [state, setState] = useState<PredictiveAnalyticsState>({
    capacityPredictions: [],
    performancePatterns: [],
    learningInsights: null,
    dashboardData: null,
    isLoading: false,
    error: null,
    lastUpdated: null
  })

  // Generate capacity predictions
  const generateCapacityPredictions = useCallback(async (
    request: {
      resource_ids?: string[]
      prediction_horizons?: Array<'1_week' | '1_month' | '3_months' | '6_months' | '1_year'>
      include_skill_breakdown?: boolean
      include_risk_analysis?: boolean
    } = {}
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const response = await predictiveAnalyticsEngine.generateCapacityPredictions(request)
      
      setState(prev => ({
        ...prev,
        capacityPredictions: response.predictions,
        isLoading: false,
        lastUpdated: new Date()
      }))
      
      return response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate capacity predictions'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }))
      throw error
    }
  }, [])

  // Identify performance patterns
  const identifyPerformancePatterns = useCallback(async (
    request: {
      analysis_period_months?: number
      resource_ids?: string[]
      pattern_types?: Array<'seasonal' | 'cyclical' | 'trending' | 'anomaly'>
      minimum_pattern_strength?: number
      include_predictions?: boolean
    } = {}
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const response = await predictiveAnalyticsEngine.identifyPerformancePatterns(request)
      
      setState(prev => ({
        ...prev,
        performancePatterns: response.patterns,
        isLoading: false,
        lastUpdated: new Date()
      }))
      
      return response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to identify performance patterns'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }))
      throw error
    }
  }, [])

  // Record optimization outcome for learning
  const recordOptimizationOutcome = useCallback(async (
    optimizationId: string,
    outcome: {
      implementation_date: string
      measurement_period_days: number
      actual_results: {
        utilization_change: number
        productivity_change: number
        quality_change: number
        cost_impact: number
        user_satisfaction: number
      }
      implementation_challenges: string[]
      success_factors: string[]
      lessons_learned: string[]
      would_recommend: boolean
      confidence_in_measurement: number
    }
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const response = await predictiveAnalyticsEngine.recordOptimizationOutcome(
        optimizationId,
        outcome
      )
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastUpdated: new Date()
      }))
      
      return response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to record optimization outcome'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }))
      throw error
    }
  }, [])

  // Get learning insights
  const getLearningInsights = useCallback(async (
    timeframe: '30d' | '90d' | '1y' = '90d'
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const insights = await predictiveAnalyticsEngine.getLearningInsights(timeframe)
      
      setState(prev => ({
        ...prev,
        learningInsights: insights,
        isLoading: false,
        lastUpdated: new Date()
      }))
      
      return insights
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get learning insights'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }))
      throw error
    }
  }, [])

  // Get dashboard data
  const getDashboardData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const dashboardData = await predictiveAnalyticsEngine.getDashboardData()
      
      setState(prev => ({
        ...prev,
        dashboardData,
        isLoading: false,
        lastUpdated: new Date()
      }))
      
      return dashboardData
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get dashboard data'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }))
      throw error
    }
  }, [])

  // Load all analytics data
  const loadAllData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const [dashboardData, capacityResponse, patternsResponse, learningInsights] = await Promise.all([
        predictiveAnalyticsEngine.getDashboardData(),
        predictiveAnalyticsEngine.generateCapacityPredictions({
          prediction_horizons: ['3_months'],
          include_skill_breakdown: true,
          include_risk_analysis: true
        }),
        predictiveAnalyticsEngine.identifyPerformancePatterns({
          analysis_period_months: 6,
          include_predictions: true
        }),
        predictiveAnalyticsEngine.getLearningInsights('90d')
      ])
      
      setState(prev => ({
        ...prev,
        dashboardData,
        capacityPredictions: capacityResponse.predictions,
        performancePatterns: patternsResponse.patterns,
        learningInsights,
        isLoading: false,
        lastUpdated: new Date(),
        error: null
      }))
      
      return {
        dashboardData,
        capacityPredictions: capacityResponse.predictions,
        performancePatterns: patternsResponse.patterns,
        learningInsights
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load analytics data'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }))
      throw error
    }
  }, [])

  // Refresh data
  const refresh = useCallback(async () => {
    return loadAllData()
  }, [loadAllData])

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        loadAllData().catch(console.error)
      }, refreshInterval)
      
      return () => clearInterval(interval)
    }
    return undefined
  }, [autoRefresh, refreshInterval, loadAllData])

  // Generate capacity recommendations
  const getCapacityRecommendations = useCallback(() => {
    if (state.capacityPredictions.length === 0) {
      return []
    }
    
    return generateCapacityRecommendations(state.capacityPredictions)
  }, [state.capacityPredictions])

  // Get critical alerts
  const getCriticalAlerts = useCallback((): PredictiveAlert[] => {
    const alerts: PredictiveAlert[] = []
    
    // Check for capacity shortages
    state.capacityPredictions.forEach(prediction => {
      if (prediction.predicted_utilization.realistic > 95) {
        alerts.push({
          type: 'capacity_shortage' as const,
          severity: 'critical' as const,
          message: `${prediction.resource_name} predicted to be over-allocated (${prediction.predicted_utilization.realistic.toFixed(1)}%)`,
          resource_id: prediction.resource_id,
          prediction_id: prediction.prediction_id
        })
      }
      
      // Check for critical skill gaps
      prediction.capacity_gaps.forEach(gap => {
        if (gap.severity === 'critical') {
          alerts.push({
            type: 'skill_gap' as const,
            severity: 'critical' as const,
            message: `Critical skill gap in ${gap.skill}: ${gap.gap_hours} hours shortage`,
            resource_id: prediction.resource_id,
            skill: gap.skill
          })
        }
      })
    })
    
    // Check for high-impact patterns
    state.performancePatterns.forEach(pattern => {
      if (pattern.significance > 0.8 && pattern.next_occurrence) {
        const daysUntil = Math.ceil(
          (new Date(pattern.next_occurrence.predicted_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        
        if (daysUntil <= 14) {
          alerts.push({
            type: 'pattern_alert' as const,
            severity: 'high' as const,
            message: `High-impact pattern "${pattern.pattern_name}" predicted in ${daysUntil} days`,
            pattern_id: pattern.pattern_id,
            days_until: daysUntil
          })
        }
      }
    })
    
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }, [state.capacityPredictions, state.performancePatterns])

  // Get performance insights
  const getPerformanceInsights = useCallback(() => {
    const insights = []
    
    // Utilization trends
    const avgUtilization = state.capacityPredictions.reduce(
      (sum, pred) => sum + pred.predicted_utilization.realistic, 0
    ) / Math.max(1, state.capacityPredictions.length)
    
    if (avgUtilization > 85) {
      insights.push({
        type: 'utilization',
        level: 'warning',
        message: `Average predicted utilization is high (${avgUtilization.toFixed(1)}%)`,
        recommendation: 'Consider capacity planning or workload redistribution'
      })
    } else if (avgUtilization < 60) {
      insights.push({
        type: 'utilization',
        level: 'info',
        message: `Average predicted utilization is low (${avgUtilization.toFixed(1)}%)`,
        recommendation: 'Opportunity to take on additional projects or optimize resources'
      })
    }
    
    // Pattern insights
    const seasonalPatterns = state.performancePatterns.filter(p => p.pattern_type === 'seasonal')
    if (seasonalPatterns.length > 0) {
      insights.push({
        type: 'patterns',
        level: 'info',
        message: `${seasonalPatterns.length} seasonal patterns identified`,
        recommendation: 'Plan capacity adjustments around seasonal variations'
      })
    }
    
    // Learning insights
    if (state.learningInsights?.model_performance?.current_accuracy) {
      const accuracy = state.learningInsights.model_performance.current_accuracy
      if (accuracy < 0.7) {
        insights.push({
          type: 'model',
          level: 'warning',
          message: `Model accuracy is below threshold (${(accuracy * 100).toFixed(1)}%)`,
          recommendation: 'More training data or model retuning may be needed'
        })
      }
    }
    
    return insights
  }, [state.capacityPredictions, state.performancePatterns, state.learningInsights])

  return {
    // State
    ...state,
    
    // Actions
    generateCapacityPredictions,
    identifyPerformancePatterns,
    recordOptimizationOutcome,
    getLearningInsights,
    getDashboardData,
    loadAllData,
    refresh,
    clearError,
    
    // Computed values
    capacityRecommendations: getCapacityRecommendations(),
    criticalAlerts: getCriticalAlerts(),
    performanceInsights: getPerformanceInsights(),
    
    // Utility functions
    hasData: state.capacityPredictions.length > 0 || state.performancePatterns.length > 0,
    isStale: state.lastUpdated ? (Date.now() - state.lastUpdated.getTime()) > refreshInterval : true
  }
}

export default usePredictiveAnalytics