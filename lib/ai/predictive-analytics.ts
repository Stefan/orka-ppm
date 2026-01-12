/**
 * Predictive Analytics System
 * Implements capacity planning predictions and performance pattern recognition
 * Requirements: 6.4, 6.5
 */

import { getApiUrl } from '../api'

export interface HistoricalDataPoint {
  timestamp: string
  resource_id: string
  resource_name: string
  utilization_percentage: number
  project_count: number
  skill_utilization: Record<string, number>
  performance_metrics: {
    tasks_completed: number
    average_task_duration_hours: number
    quality_score: number
    client_satisfaction: number
  }
  external_factors: {
    season: 'Q1' | 'Q2' | 'Q3' | 'Q4'
    market_conditions: 'stable' | 'growth' | 'decline'
    team_size: number
    technology_stack: string[]
  }
}

export interface CapacityPrediction {
  prediction_id: string
  resource_id: string
  resource_name: string
  prediction_horizon: '1_week' | '1_month' | '3_months' | '6_months' | '1_year'
  
  // Predicted metrics
  predicted_utilization: {
    optimistic: number
    realistic: number
    pessimistic: number
    confidence_interval: [number, number]
  }
  
  predicted_capacity: {
    available_hours: number
    billable_hours: number
    development_hours: number
    buffer_hours: number
  }
  
  demand_forecast: {
    expected_project_count: number
    skill_demand: Record<string, number>
    peak_periods: Array<{
      start_date: string
      end_date: string
      intensity: 'low' | 'medium' | 'high'
      reason: string
    }>
  }
  
  // Prediction quality
  confidence_score: number
  prediction_accuracy_history: number
  data_quality_score: number
  model_version: string
  
  // Insights and recommendations
  capacity_gaps: Array<{
    skill: string
    gap_hours: number
    severity: 'low' | 'medium' | 'high' | 'critical'
    recommended_action: string
  }>
  
  optimization_opportunities: Array<{
    type: 'skill_development' | 'workload_balancing' | 'resource_reallocation'
    description: string
    potential_improvement: number
    implementation_effort: 'low' | 'medium' | 'high'
  }>
  
  risk_factors: Array<{
    factor: string
    probability: number
    impact: 'low' | 'medium' | 'high'
    mitigation_strategy: string
  }>
  
  // Metadata
  generated_at: string
  expires_at: string
  last_updated: string
}

export interface PerformancePattern {
  pattern_id: string
  pattern_type: 'seasonal' | 'cyclical' | 'trending' | 'anomaly'
  pattern_name: string
  description: string
  
  // Pattern characteristics
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  strength: number // 0-1, how consistent the pattern is
  significance: number // 0-1, how impactful the pattern is
  
  // Pattern data
  affected_resources: string[]
  affected_skills: string[]
  performance_impact: {
    utilization_change: number
    productivity_change: number
    quality_change: number
  }
  
  // Temporal information
  typical_duration: string
  next_occurrence: {
    predicted_date: string
    confidence: number
  }
  
  // Historical occurrences
  historical_instances: Array<{
    start_date: string
    end_date: string
    actual_impact: number
    prediction_accuracy: number
  }>
  
  // Actionable insights
  preparation_recommendations: string[]
  optimization_strategies: string[]
  monitoring_metrics: string[]
}

export interface LearningOutcome {
  outcome_id: string
  optimization_id: string
  applied_at: string
  measured_at: string
  
  // Baseline vs actual results
  baseline_metrics: {
    utilization: number
    productivity: number
    quality_score: number
    cost_efficiency: number
  }
  
  actual_results: {
    utilization: number
    productivity: number
    quality_score: number
    cost_efficiency: number
  }
  
  // Performance analysis
  improvement_percentage: number
  success_indicators: Array<{
    metric: string
    target: number
    actual: number
    achieved: boolean
  }>
  
  // Learning insights
  factors_contributing_to_success: string[]
  factors_limiting_success: string[]
  unexpected_outcomes: string[]
  
  // Model improvement data
  prediction_accuracy: number
  model_adjustments_made: string[]
  confidence_calibration: number
  
  // Future recommendations
  similar_scenario_applicability: number
  recommended_model_updates: string[]
  monitoring_recommendations: string[]
}

export interface PredictiveAnalyticsConfig {
  prediction_horizons: Array<'1_week' | '1_month' | '3_months' | '6_months' | '1_year'>
  confidence_threshold: number
  data_freshness_hours: number
  pattern_detection_sensitivity: number
  learning_rate: number
  model_retrain_frequency: 'daily' | 'weekly' | 'monthly'
}

export class PredictiveAnalyticsEngine {
  private baseUrl: string
  private authToken: string | null = null
  private config: PredictiveAnalyticsConfig

  constructor(authToken?: string, config?: Partial<PredictiveAnalyticsConfig>) {
    this.baseUrl = getApiUrl('/ai/predictive-analytics')
    this.authToken = authToken || null
    this.config = {
      prediction_horizons: ['1_month', '3_months', '6_months'],
      confidence_threshold: 0.7,
      data_freshness_hours: 24,
      pattern_detection_sensitivity: 0.6,
      learning_rate: 0.1,
      model_retrain_frequency: 'weekly',
      ...config
    }
  }

  /**
   * Generate capacity planning predictions based on historical data
   * Requirement 6.4: Predict future capacity needs
   */
  async generateCapacityPredictions(
    request: {
      resource_ids?: string[]
      prediction_horizons?: Array<'1_week' | '1_month' | '3_months' | '6_months' | '1_year'>
      include_skill_breakdown?: boolean
      include_risk_analysis?: boolean
      scenario_planning?: {
        optimistic_growth: number
        pessimistic_decline: number
        market_factors: string[]
      }
    } = {}
  ): Promise<{
    predictions: CapacityPrediction[]
    aggregate_insights: {
      total_capacity_trend: 'increasing' | 'stable' | 'decreasing'
      critical_skill_gaps: string[]
      peak_demand_periods: Array<{
        period: string
        intensity: number
        affected_resources: number
      }>
      recommended_hiring_plan: Array<{
        skill: string
        recommended_hires: number
        urgency: 'low' | 'medium' | 'high'
        timeline: string
      }>
    }
    model_performance: {
      overall_accuracy: number
      prediction_reliability: 'high' | 'medium' | 'low'
      data_coverage: number
      last_model_update: string
    }
  }> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.baseUrl}/capacity-predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify({
          ...request,
          config: this.config,
          analysis_timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error(`Capacity prediction failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const processingTime = Date.now() - startTime

      // Transform and validate the response
      return this.transformCapacityPredictionResponse(data, processingTime)
    } catch (error) {
      console.error('Capacity prediction generation failed:', error)
      throw new Error(`Failed to generate capacity predictions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Identify performance patterns for resource optimization
   * Requirement 6.4: Performance pattern recognition
   */
  async identifyPerformancePatterns(
    request: {
      analysis_period_months?: number
      resource_ids?: string[]
      pattern_types?: Array<'seasonal' | 'cyclical' | 'trending' | 'anomaly'>
      minimum_pattern_strength?: number
      include_predictions?: boolean
    } = {}
  ): Promise<{
    patterns: PerformancePattern[]
    pattern_summary: {
      total_patterns_found: number
      high_impact_patterns: number
      actionable_patterns: number
      pattern_categories: Record<string, number>
    }
    optimization_recommendations: Array<{
      pattern_id: string
      recommendation: string
      expected_improvement: number
      implementation_complexity: 'low' | 'medium' | 'high'
      priority: number
    }>
    monitoring_dashboard: {
      key_metrics_to_track: string[]
      alert_thresholds: Record<string, number>
      review_frequency: string
    }
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/performance-patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify({
          ...request,
          analysis_period_months: request.analysis_period_months || 12,
          minimum_pattern_strength: request.minimum_pattern_strength || this.config.pattern_detection_sensitivity,
          config: this.config
        })
      })

      if (!response.ok) {
        throw new Error(`Pattern analysis failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Performance pattern identification failed:', error)
      throw error
    }
  }

  /**
   * Create learning system that improves from optimization outcomes
   * Requirement 6.5: Learning system that improves from optimization outcomes
   */
  async recordOptimizationOutcome(
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
  ): Promise<{
    learning_outcome: LearningOutcome
    model_updates: {
      accuracy_improvement: number
      confidence_calibration_adjustment: number
      feature_importance_changes: Record<string, number>
      new_patterns_discovered: string[]
    }
    future_recommendations: {
      similar_scenarios: Array<{
        scenario_description: string
        applicability_score: number
        recommended_adjustments: string[]
      }>
      model_improvements: string[]
      data_collection_recommendations: string[]
    }
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/learning-outcomes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify({
          optimization_id: optimizationId,
          outcome,
          recorded_at: new Date().toISOString(),
          config: this.config
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to record learning outcome: ${response.status}`)
      }

      const result = await response.json()
      
      // Trigger model retraining if enough new data is available
      await this.checkAndTriggerModelUpdate()
      
      return result
    } catch (error) {
      console.error('Learning outcome recording failed:', error)
      throw error
    }
  }

  /**
   * Get historical learning outcomes and model performance
   */
  async getLearningInsights(
    timeframe: '30d' | '90d' | '1y' = '90d'
  ): Promise<{
    learning_summary: {
      total_optimizations_tracked: number
      average_success_rate: number
      model_accuracy_trend: Array<{
        date: string
        accuracy: number
        confidence: number
      }>
      top_success_factors: Array<{
        factor: string
        correlation_with_success: number
        frequency: number
      }>
    }
    model_performance: {
      current_accuracy: number
      accuracy_by_prediction_type: Record<string, number>
      calibration_score: number
      feature_importance: Record<string, number>
      last_retrain_date: string
      next_retrain_scheduled: string
    }
    improvement_opportunities: Array<{
      area: string
      current_performance: number
      potential_improvement: number
      recommended_actions: string[]
      data_requirements: string[]
    }>
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/learning-insights?timeframe=${timeframe}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch learning insights: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Learning insights fetch failed:', error)
      throw error
    }
  }

  /**
   * Get real-time predictive analytics dashboard data
   */
  async getDashboardData(): Promise<{
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
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Dashboard data fetch failed:', error)
      throw error
    }
  }

  /**
   * Transform capacity prediction response to standardized format
   */
  private transformCapacityPredictionResponse(data: any, _processingTime: number): any {
    // Transform predictions to ensure consistent format
    const predictions: CapacityPrediction[] = (data.predictions || []).map((pred: any) => ({
      prediction_id: pred.id || `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      resource_id: pred.resource_id,
      resource_name: pred.resource_name,
      prediction_horizon: pred.horizon || '3_months',
      
      predicted_utilization: {
        optimistic: pred.utilization?.optimistic || pred.predicted_utilization * 1.1,
        realistic: pred.utilization?.realistic || pred.predicted_utilization,
        pessimistic: pred.utilization?.pessimistic || pred.predicted_utilization * 0.9,
        confidence_interval: pred.confidence_interval || [
          pred.predicted_utilization * 0.85,
          pred.predicted_utilization * 1.15
        ]
      },
      
      predicted_capacity: {
        available_hours: pred.capacity?.available || pred.available_hours || 160,
        billable_hours: pred.capacity?.billable || pred.billable_hours || 120,
        development_hours: pred.capacity?.development || 20,
        buffer_hours: pred.capacity?.buffer || 20
      },
      
      demand_forecast: {
        expected_project_count: pred.demand?.project_count || 3,
        skill_demand: pred.demand?.skills || {},
        peak_periods: pred.demand?.peaks || []
      },
      
      confidence_score: pred.confidence || 0.75,
      prediction_accuracy_history: pred.historical_accuracy || 0.8,
      data_quality_score: pred.data_quality || 0.85,
      model_version: pred.model_version || '1.0.0',
      
      capacity_gaps: this.extractCapacityGaps(pred),
      optimization_opportunities: this.extractOptimizationOpportunities(pred),
      risk_factors: this.extractRiskFactors(pred),
      
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      last_updated: new Date().toISOString()
    }))

    return {
      predictions,
      aggregate_insights: data.aggregate_insights || this.generateAggregateInsights(predictions),
      model_performance: data.model_performance || {
        overall_accuracy: 0.82,
        prediction_reliability: 'high',
        data_coverage: 0.9,
        last_model_update: new Date().toISOString()
      }
    }
  }

  private extractCapacityGaps(pred: any): CapacityPrediction['capacity_gaps'] {
    const gaps: CapacityPrediction['capacity_gaps'] = []
    
    if (pred.skill_gaps) {
      Object.entries(pred.skill_gaps).forEach(([skill, gap]: [string, any]) => {
        gaps.push({
          skill,
          gap_hours: gap.hours || 0,
          severity: gap.severity || 'medium',
          recommended_action: gap.action || `Consider hiring or training for ${skill}`
        })
      })
    }
    
    return gaps
  }

  private extractOptimizationOpportunities(pred: any): CapacityPrediction['optimization_opportunities'] {
    const opportunities = []
    
    if (pred.underutilized_skills) {
      pred.underutilized_skills.forEach((skill: string) => {
        opportunities.push({
          type: 'skill_development' as const,
          description: `Develop ${skill} capabilities to increase utilization`,
          potential_improvement: 15,
          implementation_effort: 'medium' as const
        })
      })
    }
    
    if (pred.workload_imbalance) {
      opportunities.push({
        type: 'workload_balancing' as const,
        description: 'Rebalance workload distribution across team members',
        potential_improvement: 10,
        implementation_effort: 'low' as const
      })
    }
    
    return opportunities
  }

  private extractRiskFactors(pred: any): CapacityPrediction['risk_factors'] {
    const risks = []
    
    if (pred.predicted_utilization > 90) {
      risks.push({
        factor: 'High utilization risk',
        probability: 0.7,
        impact: 'high' as const,
        mitigation_strategy: 'Plan for additional capacity or reduce scope'
      })
    }
    
    if (pred.skill_concentration_risk) {
      risks.push({
        factor: 'Skill concentration risk',
        probability: 0.5,
        impact: 'medium' as const,
        mitigation_strategy: 'Cross-train team members in critical skills'
      })
    }
    
    return risks
  }

  private generateAggregateInsights(predictions: CapacityPrediction[]): any {
    const totalCapacityTrend = predictions.length > 0 
      ? predictions.reduce((sum, p) => sum + p.predicted_utilization.realistic, 0) / predictions.length > 80
        ? 'increasing' : 'stable'
      : 'stable'

    const criticalSkillGaps = predictions
      .flatMap(p => p.capacity_gaps)
      .filter(gap => gap.severity === 'critical' || gap.severity === 'high')
      .map(gap => gap.skill)

    return {
      total_capacity_trend: totalCapacityTrend,
      critical_skill_gaps: [...new Set(criticalSkillGaps)],
      peak_demand_periods: [],
      recommended_hiring_plan: []
    }
  }

  /**
   * Check if model should be retrained and trigger update
   */
  private async checkAndTriggerModelUpdate(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/model-update-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify({
          config: this.config,
          check_timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.should_retrain) {
          console.log('Model retraining triggered based on new learning outcomes')
        }
      }
    } catch (error) {
      console.warn('Model update check failed:', error)
      // Non-critical error, don't throw
    }
  }
}

// Export singleton instance
export const predictiveAnalyticsEngine = new PredictiveAnalyticsEngine()

// Utility function to create engine with auth token
export function createPredictiveAnalyticsEngine(
  authToken: string, 
  config?: Partial<PredictiveAnalyticsConfig>
): PredictiveAnalyticsEngine {
  return new PredictiveAnalyticsEngine(authToken, config)
}

// Utility functions for common operations
export function calculateCapacityUtilization(
  availableHours: number, 
  allocatedHours: number
): number {
  return availableHours > 0 ? (allocatedHours / availableHours) * 100 : 0
}

export function assessCapacityRisk(
  utilization: number, 
  trend: 'increasing' | 'stable' | 'decreasing'
): 'low' | 'medium' | 'high' | 'critical' {
  if (utilization > 95) return 'critical'
  if (utilization > 85 && trend === 'increasing') return 'high'
  if (utilization > 75) return 'medium'
  return 'low'
}

export function generateCapacityRecommendations(
  predictions: CapacityPrediction[]
): Array<{
  type: 'hiring' | 'training' | 'reallocation' | 'scope_adjustment'
  priority: number
  description: string
  timeline: string
  impact: string
}> {
  const recommendations: Array<{
    type: 'hiring' | 'training' | 'reallocation' | 'scope_adjustment'
    priority: number
    description: string
    timeline: string
    impact: string
  }> = []
  
  // Analyze critical gaps
  const criticalGaps = predictions.flatMap(p => 
    p.capacity_gaps.filter(gap => gap.severity === 'critical')
  )
  
  criticalGaps.forEach(gap => {
    recommendations.push({
      type: 'hiring' as const,
      priority: 1,
      description: `Urgent hiring needed for ${gap.skill} - ${gap.gap_hours} hour shortage`,
      timeline: '2-4 weeks',
      impact: 'High - prevents project delays'
    })
  })
  
  // Analyze optimization opportunities
  const optimizations = predictions.flatMap(p => p.optimization_opportunities)
  
  optimizations.forEach(opt => {
    recommendations.push({
      type: opt.type === 'skill_development' ? 'training' : 'reallocation',
      priority: opt.implementation_effort === 'low' ? 2 : 3,
      description: opt.description,
      timeline: opt.implementation_effort === 'low' ? '1-2 weeks' : '4-8 weeks',
      impact: `${opt.potential_improvement}% improvement expected`
    })
  })
  
  return recommendations.sort((a, b) => a.priority - b.priority)
}