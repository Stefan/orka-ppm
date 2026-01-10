/**
 * AI Risk Management System
 * Implements ML-powered risk pattern recognition, predictive escalation alerts,
 * and historical mitigation strategy suggestions
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { getApiUrl } from '../api'
import { mockAIRiskManagementService } from './ai-risk-management-mock'

// Use mock service in development
const USE_MOCK_SERVICE = process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_API_URL

export interface RiskPattern {
  pattern_id: string
  pattern_name: string
  pattern_type: 'recurring' | 'cascading' | 'seasonal' | 'project_phase' | 'resource_dependent'
  description: string
  
  // Pattern characteristics
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'project_based'
  confidence_score: number // 0-1, how confident the AI is in this pattern
  historical_accuracy: number // 0-1, how accurate past predictions were
  
  // Risk indicators
  leading_indicators: Array<{
    indicator: string
    threshold: number
    weight: number // importance in pattern recognition
    data_source: string
  }>
  
  // Pattern context
  typical_project_phases: string[]
  common_categories: string[]
  affected_stakeholders: string[]
  
  // Historical data
  occurrences_count: number
  average_impact_score: number
  escalation_probability: number
  
  // Predictive insights
  next_likely_occurrence: {
    predicted_date: string
    confidence: number
    context_factors: string[]
  }
  
  // Mitigation effectiveness
  successful_mitigations: Array<{
    strategy: string
    success_rate: number
    average_cost_reduction: number
    implementation_time: string
  }>
}

export interface RiskEscalationAlert {
  alert_id: string
  risk_id: string
  risk_title: string
  project_id: string
  project_name: string
  
  // Alert details
  alert_type: 'pattern_detected' | 'escalation_predicted' | 'threshold_exceeded' | 'cascade_risk'
  severity: 'low' | 'medium' | 'high' | 'critical'
  urgency: 'immediate' | 'within_24h' | 'within_week' | 'monitor'
  
  // Prediction details
  current_risk_score: number
  predicted_risk_score: number
  escalation_probability: number
  time_to_escalation: string
  
  // Context and reasoning
  triggering_factors: Array<{
    factor: string
    current_value: number
    threshold: number
    contribution_weight: number
  }>
  
  pattern_matches: Array<{
    pattern_id: string
    pattern_name: string
    match_confidence: number
    historical_outcomes: string[]
  }>
  
  // Recommended actions
  immediate_actions: Array<{
    action: string
    priority: number
    estimated_effort: 'low' | 'medium' | 'high'
    expected_impact: number
  }>
  
  stakeholders_to_notify: Array<{
    role: string
    notification_method: 'email' | 'sms' | 'dashboard' | 'all'
    urgency_level: 'info' | 'warning' | 'critical'
  }>
  
  // Metadata
  generated_at: string
  expires_at: string
  acknowledged: boolean
  acknowledged_by?: string
  acknowledged_at?: string
}

export interface MitigationStrategy {
  strategy_id: string
  strategy_name: string
  description: string
  
  // Applicability
  applicable_risk_categories: string[]
  applicable_risk_scores: {
    min: number
    max: number
  }
  project_phase_suitability: string[]
  
  // Effectiveness metrics
  historical_success_rate: number
  average_risk_reduction: number
  implementation_complexity: 'low' | 'medium' | 'high'
  typical_implementation_time: string
  
  // Resource requirements
  required_skills: string[]
  estimated_cost: {
    min: number
    max: number
    currency: string
  }
  required_stakeholders: string[]
  
  // Implementation details
  implementation_steps: Array<{
    step_number: number
    description: string
    estimated_duration: string
    dependencies: string[]
    success_criteria: string[]
  }>
  
  // Monitoring and validation
  success_indicators: Array<{
    metric: string
    target_value: number
    measurement_method: string
    review_frequency: string
  }>
  
  // Learning data
  similar_cases: Array<{
    case_id: string
    project_name: string
    implementation_date: string
    outcome: 'successful' | 'partially_successful' | 'failed'
    lessons_learned: string[]
    actual_cost: number
    actual_duration: string
  }>
  
  // Metadata
  created_at: string
  last_updated: string
  confidence_score: number
  recommendation_strength: number
}

export interface RiskAnalysisRequest {
  project_ids?: string[]
  risk_categories?: string[]
  analysis_period_months?: number
  include_predictions?: boolean
  prediction_horizon_days?: number
  confidence_threshold?: number
}

export interface RiskLearningOutcome {
  outcome_id: string
  risk_id: string
  mitigation_strategy_id: string
  
  // Implementation details
  implemented_at: string
  implementation_duration: string
  actual_cost: number
  
  // Results
  initial_risk_score: number
  final_risk_score: number
  risk_reduction_achieved: number
  
  // Success metrics
  objectives_met: boolean
  stakeholder_satisfaction: number
  unexpected_benefits: string[]
  unexpected_challenges: string[]
  
  // Learning insights
  strategy_effectiveness: number
  implementation_challenges: string[]
  success_factors: string[]
  would_recommend_again: boolean
  
  // Model improvement data
  prediction_accuracy: number
  pattern_recognition_accuracy: number
  alert_timeliness: number
  
  // Future recommendations
  strategy_refinements: string[]
  monitoring_improvements: string[]
  early_warning_enhancements: string[]
}

export class AIRiskManagementSystem {
  private baseUrl: string
  private authToken: string | null = null
  private config: {
    pattern_detection_sensitivity: number
    escalation_prediction_horizon: number
    confidence_threshold: number
    learning_rate: number
  }

  constructor(authToken?: string) {
    this.baseUrl = getApiUrl('/ai/risk-management')
    this.authToken = authToken || null
    this.config = {
      pattern_detection_sensitivity: 0.7,
      escalation_prediction_horizon: 30, // days
      confidence_threshold: 0.75,
      learning_rate: 0.1
    }
  }

  /**
   * Identify risk patterns using machine learning
   * Requirement 7.1: Risk pattern recognition using machine learning
   */
  async identifyRiskPatterns(
    request: RiskAnalysisRequest = {}
  ): Promise<{
    patterns: RiskPattern[]
    pattern_summary: {
      total_patterns_found: number
      high_confidence_patterns: number
      actionable_patterns: number
      pattern_categories: Record<string, number>
    }
    insights: {
      most_critical_pattern: RiskPattern | null
      emerging_patterns: RiskPattern[]
      declining_patterns: RiskPattern[]
      seasonal_insights: Array<{
        season: string
        typical_risk_increase: number
        common_risk_types: string[]
      }>
    }
    recommendations: Array<{
      pattern_id: string
      recommendation_type: 'monitoring' | 'prevention' | 'preparation'
      description: string
      priority: number
      estimated_impact: string
    }>
  }> {
    // Use mock service in development
    if (USE_MOCK_SERVICE) {
      return await mockAIRiskManagementService.identifyRiskPatterns(request)
    }

    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.baseUrl}/pattern-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify({
          ...request,
          analysis_period_months: request.analysis_period_months || 12,
          confidence_threshold: request.confidence_threshold || this.config.confidence_threshold,
          config: this.config,
          analysis_timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error(`Risk pattern analysis failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const processingTime = Date.now() - startTime

      return this.transformPatternAnalysisResponse(data, processingTime)
    } catch (error) {
      console.error('Risk pattern identification failed:', error)
      throw new Error(`Failed to identify risk patterns: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate predictive risk escalation alerts
   * Requirement 7.4: Predictive risk escalation alerts
   */
  async generateEscalationAlerts(
    request: {
      risk_ids?: string[]
      project_ids?: string[]
      alert_sensitivity?: 'low' | 'medium' | 'high'
      prediction_horizon_days?: number
      include_recommendations?: boolean
    } = {}
  ): Promise<{
    alerts: RiskEscalationAlert[]
    alert_summary: {
      total_alerts: number
      critical_alerts: number
      immediate_action_required: number
      monitoring_alerts: number
    }
    escalation_forecast: Array<{
      date: string
      predicted_escalations: number
      confidence: number
      primary_risk_categories: string[]
    }>
    notification_plan: {
      immediate_notifications: Array<{
        stakeholder: string
        method: string
        alert_ids: string[]
      }>
      scheduled_notifications: Array<{
        stakeholder: string
        schedule: string
        alert_types: string[]
      }>
    }
  }> {
    // Use mock service in development
    if (USE_MOCK_SERVICE) {
      return await mockAIRiskManagementService.generateEscalationAlerts(request)
    }

    try {
      const response = await fetch(`${this.baseUrl}/escalation-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify({
          ...request,
          prediction_horizon_days: request.prediction_horizon_days || this.config.escalation_prediction_horizon,
          alert_sensitivity: request.alert_sensitivity || 'medium',
          config: this.config,
          generated_at: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error(`Escalation alert generation failed: ${response.status}`)
      }

      const data = await response.json()
      return this.transformEscalationAlertsResponse(data)
    } catch (error) {
      console.error('Escalation alert generation failed:', error)
      throw error
    }
  }

  /**
   * Get historical risk mitigation strategy suggestions
   * Requirement 7.3: Historical risk mitigation strategy suggestions
   */
  async suggestMitigationStrategies(
    request: {
      risk_id?: string
      risk_category?: string
      risk_score?: number
      project_phase?: string
      available_budget?: number
      timeline_constraint?: string
      stakeholder_availability?: string[]
    }
  ): Promise<{
    strategies: MitigationStrategy[]
    strategy_ranking: Array<{
      strategy_id: string
      overall_score: number
      effectiveness_score: number
      feasibility_score: number
      cost_efficiency_score: number
      recommendation_reason: string
    }>
    implementation_plan: {
      recommended_strategy: MitigationStrategy
      customized_steps: Array<{
        step: string
        timeline: string
        resources_needed: string[]
        success_criteria: string[]
      }>
      risk_monitoring_plan: Array<{
        metric: string
        baseline: number
        target: number
        review_frequency: string
      }>
    }
    alternative_approaches: Array<{
      approach: string
      pros: string[]
      cons: string[]
      suitability_score: number
    }>
  }> {
    // Use mock service in development
    if (USE_MOCK_SERVICE) {
      return await mockAIRiskManagementService.suggestMitigationStrategies(request)
    }

    try {
      const response = await fetch(`${this.baseUrl}/mitigation-strategies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify({
          ...request,
          analysis_context: {
            request_timestamp: new Date().toISOString(),
            config: this.config
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Mitigation strategy suggestion failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Mitigation strategy suggestion failed:', error)
      throw error
    }
  }

  /**
   * Record risk mitigation outcomes for learning
   * Requirement 7.2: Machine learning to improve accuracy over time
   */
  async recordMitigationOutcome(
    outcome: RiskLearningOutcome
  ): Promise<{
    learning_outcome: RiskLearningOutcome
    model_improvements: {
      pattern_recognition_update: boolean
      strategy_effectiveness_update: boolean
      prediction_accuracy_adjustment: number
      new_insights_discovered: string[]
    }
    updated_recommendations: {
      strategy_refinements: Array<{
        strategy_id: string
        refinement: string
        expected_improvement: number
      }>
      pattern_detection_improvements: string[]
      alert_threshold_adjustments: Array<{
        metric: string
        old_threshold: number
        new_threshold: number
        reason: string
      }>
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
          ...outcome,
          recorded_at: new Date().toISOString(),
          config: this.config
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to record mitigation outcome: ${response.status}`)
      }

      const result = await response.json()
      
      // Trigger model retraining if significant learning occurred
      await this.checkAndTriggerModelUpdate(result.model_improvements)
      
      return result
    } catch (error) {
      console.error('Mitigation outcome recording failed:', error)
      throw error
    }
  }

  /**
   * Get real-time risk management dashboard data
   */
  async getDashboardData(): Promise<{
    risk_overview: {
      total_active_risks: number
      high_risk_count: number
      escalation_alerts: number
      pattern_matches_today: number
    }
    active_patterns: Array<{
      pattern_name: string
      confidence: number
      next_occurrence: string
      affected_projects: number
    }>
    recent_alerts: RiskEscalationAlert[]
    mitigation_effectiveness: {
      strategies_in_progress: number
      recent_successes: number
      average_risk_reduction: number
      cost_savings_achieved: number
    }
    ai_insights: {
      model_accuracy: number
      prediction_confidence: number
      learning_rate: number
      last_model_update: string
    }
    recommendations: Array<{
      type: 'pattern' | 'escalation' | 'mitigation' | 'monitoring'
      priority: number
      title: string
      description: string
      action_required: boolean
      estimated_impact: string
    }>
  }> {
    // Use mock service in development
    if (USE_MOCK_SERVICE) {
      return await mockAIRiskManagementService.getDashboardData()
    }

    try {
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch risk dashboard data: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Risk dashboard data fetch failed:', error)
      throw error
    }
  }

  /**
   * Acknowledge and respond to risk alerts
   */
  async acknowledgeAlert(
    alertId: string,
    response: {
      acknowledged_by: string
      response_action: 'investigating' | 'implementing_mitigation' | 'escalating' | 'dismissing'
      notes?: string
      estimated_resolution_time?: string
    }
  ): Promise<{
    success: boolean
    updated_alert: RiskEscalationAlert
    follow_up_actions: string[]
  }> {
    // Use mock service in development
    if (USE_MOCK_SERVICE) {
      return await mockAIRiskManagementService.acknowledgeAlert(alertId, response)
    }

    try {
      const response_data = await fetch(`${this.baseUrl}/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify({
          ...response,
          acknowledged_at: new Date().toISOString()
        })
      })

      if (!response_data.ok) {
        throw new Error(`Failed to acknowledge alert: ${response_data.status}`)
      }

      return await response_data.json()
    } catch (error) {
      console.error('Alert acknowledgment failed:', error)
      throw error
    }
  }

  /**
   * Transform pattern analysis response to standardized format
   */
  private transformPatternAnalysisResponse(data: any, processingTime: number): any {
    const patterns: RiskPattern[] = (data.patterns || []).map((pattern: any) => ({
      pattern_id: pattern.id || `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern_name: pattern.name || 'Unnamed Pattern',
      pattern_type: pattern.type || 'recurring',
      description: pattern.description || 'Pattern detected through ML analysis',
      
      frequency: pattern.frequency || 'monthly',
      confidence_score: pattern.confidence || 0.75,
      historical_accuracy: pattern.accuracy || 0.8,
      
      leading_indicators: pattern.indicators || [],
      typical_project_phases: pattern.phases || [],
      common_categories: pattern.categories || [],
      affected_stakeholders: pattern.stakeholders || [],
      
      occurrences_count: pattern.occurrences || 0,
      average_impact_score: pattern.avg_impact || 0.5,
      escalation_probability: pattern.escalation_prob || 0.3,
      
      next_likely_occurrence: pattern.next_occurrence || {
        predicted_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        confidence: 0.6,
        context_factors: []
      },
      
      successful_mitigations: pattern.mitigations || []
    }))

    return {
      patterns,
      pattern_summary: data.summary || {
        total_patterns_found: patterns.length,
        high_confidence_patterns: patterns.filter(p => p.confidence_score > 0.8).length,
        actionable_patterns: patterns.filter(p => p.successful_mitigations.length > 0).length,
        pattern_categories: {}
      },
      insights: data.insights || {
        most_critical_pattern: patterns.find(p => p.average_impact_score > 0.7) || null,
        emerging_patterns: patterns.filter(p => p.occurrences_count < 3),
        declining_patterns: patterns.filter(p => p.escalation_probability < 0.2),
        seasonal_insights: []
      },
      recommendations: data.recommendations || []
    }
  }

  /**
   * Transform escalation alerts response to standardized format
   */
  private transformEscalationAlertsResponse(data: any): any {
    const alerts: RiskEscalationAlert[] = (data.alerts || []).map((alert: any) => ({
      alert_id: alert.id || `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      risk_id: alert.risk_id,
      risk_title: alert.risk_title,
      project_id: alert.project_id,
      project_name: alert.project_name,
      
      alert_type: alert.type || 'escalation_predicted',
      severity: alert.severity || 'medium',
      urgency: alert.urgency || 'within_24h',
      
      current_risk_score: alert.current_score || 0.5,
      predicted_risk_score: alert.predicted_score || 0.7,
      escalation_probability: alert.escalation_prob || 0.6,
      time_to_escalation: alert.time_to_escalation || '7 days',
      
      triggering_factors: alert.factors || [],
      pattern_matches: alert.patterns || [],
      immediate_actions: alert.actions || [],
      stakeholders_to_notify: alert.stakeholders || [],
      
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      acknowledged: false
    }))

    return {
      alerts,
      alert_summary: data.summary || {
        total_alerts: alerts.length,
        critical_alerts: alerts.filter(a => a.severity === 'critical').length,
        immediate_action_required: alerts.filter(a => a.urgency === 'immediate').length,
        monitoring_alerts: alerts.filter(a => a.urgency === 'monitor').length
      },
      escalation_forecast: data.forecast || [],
      notification_plan: data.notification_plan || {
        immediate_notifications: [],
        scheduled_notifications: []
      }
    }
  }

  /**
   * Check if model should be retrained and trigger update
   */
  private async checkAndTriggerModelUpdate(improvements: any): Promise<void> {
    try {
      if (improvements.pattern_recognition_update || improvements.strategy_effectiveness_update) {
        const response = await fetch(`${this.baseUrl}/model-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
          },
          body: JSON.stringify({
            improvements,
            config: this.config,
            trigger_timestamp: new Date().toISOString()
          })
        })

        if (response.ok) {
          const result = await response.json()
          if (result.retrain_triggered) {
            console.log('AI risk management model retraining triggered')
          }
        }
      }
    } catch (error) {
      console.warn('Model update trigger failed:', error)
      // Non-critical error, don't throw
    }
  }
}

// Export singleton instance
export const aiRiskManagementSystem = new AIRiskManagementSystem()

// Utility function to create system with auth token
export function createAIRiskManagementSystem(authToken: string): AIRiskManagementSystem {
  return new AIRiskManagementSystem(authToken)
}

// Utility functions for risk analysis
export function calculateRiskTrend(
  historicalScores: Array<{ date: string; score: number }>
): 'increasing' | 'stable' | 'decreasing' {
  if (historicalScores.length < 2) return 'stable'
  
  const recent = historicalScores.slice(-3)
  const older = historicalScores.slice(-6, -3)
  
  const recentAvg = recent.reduce((sum, item) => sum + item.score, 0) / recent.length
  const olderAvg = older.length > 0 
    ? older.reduce((sum, item) => sum + item.score, 0) / older.length 
    : recentAvg
  
  const threshold = 0.05 // 5% change threshold
  
  if (recentAvg > olderAvg + threshold) return 'increasing'
  if (recentAvg < olderAvg - threshold) return 'decreasing'
  return 'stable'
}

export function assessMitigationUrgency(
  riskScore: number,
  escalationProbability: number,
  timeToEscalation: string
): 'immediate' | 'within_24h' | 'within_week' | 'monitor' {
  if (riskScore > 0.8 && escalationProbability > 0.7) return 'immediate'
  if (riskScore > 0.6 && timeToEscalation.includes('day')) return 'within_24h'
  if (riskScore > 0.4 && timeToEscalation.includes('week')) return 'within_week'
  return 'monitor'
}

export function generateRiskInsights(
  patterns: RiskPattern[],
  alerts: RiskEscalationAlert[]
): Array<{
  insight: string
  confidence: number
  actionable: boolean
  priority: number
}> {
  const insights = []
  
  // Pattern-based insights
  const highConfidencePatterns = patterns.filter(p => p.confidence_score > 0.8)
  if (highConfidencePatterns.length > 0) {
    insights.push({
      insight: `${highConfidencePatterns.length} high-confidence risk patterns detected`,
      confidence: 0.9,
      actionable: true,
      priority: 1
    })
  }
  
  // Alert-based insights
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  if (criticalAlerts.length > 0) {
    insights.push({
      insight: `${criticalAlerts.length} critical risk escalations predicted`,
      confidence: 0.85,
      actionable: true,
      priority: 1
    })
  }
  
  // Trend insights
  const escalatingRisks = alerts.filter(a => a.escalation_probability > 0.7)
  if (escalatingRisks.length > 2) {
    insights.push({
      insight: 'Multiple risks showing escalation patterns - systemic issue possible',
      confidence: 0.75,
      actionable: true,
      priority: 2
    })
  }
  
  return insights.sort((a, b) => a.priority - b.priority)
}