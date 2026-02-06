/**
 * AI Resource Optimization Engine
 * Implements ML-powered resource allocation analysis with confidence scores
 * Requirements: 6.1, 6.2, 6.3
 */

import { getApiUrl } from '../api'

export interface ResourceOptimizationRequest {
  project_id?: string
  constraints?: {
    required_skills?: string[]
    max_utilization?: number
    min_availability?: number
    location?: string
    budget_limit?: number
  }
  optimization_goals?: {
    maximize_utilization?: boolean
    minimize_conflicts?: boolean
    balance_workload?: boolean
    skill_development?: boolean
  }
}

export interface OptimizationSuggestion {
  id: string
  type: 'resource_reallocation' | 'skill_optimization' | 'conflict_resolution' | 'capacity_planning'
  resource_id: string
  resource_name: string
  project_id?: string
  project_name?: string
  
  // Core metrics
  confidence_score: number
  impact_score: number
  effort_required: 'low' | 'medium' | 'high'
  
  // Optimization details
  current_allocation: number
  suggested_allocation: number
  skill_match_score?: number
  utilization_improvement: number
  
  // Conflict detection
  conflicts_detected: ConflictDetails[]
  alternative_strategies: AlternativeStrategy[]
  
  // Reasoning and recommendations
  reasoning: string
  benefits: string[]
  risks: string[]
  implementation_steps: string[]
  
  // Metadata
  analysis_timestamp: string
  expires_at: string
}

export interface ConflictDetails {
  type: 'schedule_overlap' | 'skill_mismatch' | 'over_allocation' | 'resource_unavailable'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affected_projects: string[]
  resolution_priority: number
}

export interface AlternativeStrategy {
  strategy_id: string
  name: string
  description: string
  confidence_score: number
  implementation_complexity: 'simple' | 'moderate' | 'complex'
  estimated_timeline: string
  resource_requirements: string[]
  expected_outcomes: string[]
}

export interface OptimizationAnalysis {
  analysis_id: string
  request_timestamp: string
  analysis_duration_ms: number
  
  // Results
  suggestions: OptimizationSuggestion[]
  conflicts: ConflictDetails[]
  
  // Summary metrics
  total_resources_analyzed: number
  optimization_opportunities: number
  potential_utilization_improvement: number
  estimated_cost_savings: number
  
  // Confidence and quality
  overall_confidence: number
  data_quality_score: number
  recommendation_reliability: 'high' | 'medium' | 'low'
  
  // Next steps
  recommended_actions: string[]
  follow_up_analysis_suggested: boolean
}

export class AIResourceOptimizer {
  private baseUrl: string
  private authToken: string | null = null

  constructor(authToken?: string) {
    this.baseUrl = getApiUrl('/ai/resource-optimizer/')
    this.authToken = authToken || null
  }

  /**
   * Analyze resource allocation and generate optimization suggestions
   * Requirement 6.1: Identify underutilized and overallocated resources
   */
  async analyzeResourceAllocation(
    request: ResourceOptimizationRequest = {}
  ): Promise<OptimizationAnalysis> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify({
          ...request,
          analysis_type: 'comprehensive',
          include_alternatives: true,
          confidence_threshold: 0.6
        })
      })

      if (!response.ok) {
        let detail = response.statusText
        try {
          const errBody = await response.json() as { detail?: string }
          if (typeof errBody?.detail === 'string') detail = errBody.detail
        } catch {
          // ignore JSON parse failure
        }
        throw new Error(`Analysis failed: ${response.status} ${detail}`)
      }

      const data = await response.json()
      const analysisDuration = Date.now() - startTime

      // Transform backend response to our interface
      return this.transformAnalysisResponse(data, analysisDuration)
    } catch (error) {
      console.error('Resource optimization analysis failed:', error)
      throw new Error(`Failed to analyze resource allocation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate optimal team compositions for new projects
   * Requirement 6.2: Suggest optimal team compositions based on skills and availability
   */
  async suggestTeamComposition(
    projectRequirements: {
      project_id?: string
      required_skills: string[]
      estimated_effort_hours: number
      timeline_weeks: number
      priority: 'low' | 'medium' | 'high' | 'critical'
      budget_constraint?: number
    }
  ): Promise<{
    recommended_team: {
      resource_id: string
      resource_name: string
      role: string
      allocation_percentage: number
      skill_match_score: number
      availability_score: number
      cost_per_hour?: number
    }[]
    alternative_compositions: AlternativeStrategy[]
    composition_confidence: number
    estimated_timeline: string
    total_cost_estimate?: number
    risk_factors: string[]
  }> {
    try {
      const response = await fetch(`${this.baseUrl}team-composition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify(projectRequirements)
      })

      if (!response.ok) {
        throw new Error(`Team composition analysis failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Team composition suggestion failed:', error)
      throw error
    }
  }

  /**
   * Detect and resolve resource allocation conflicts
   * Requirement 6.3: Provide alternative strategies and recommendations
   */
  async detectConflicts(): Promise<{
    conflicts: ConflictDetails[]
    resolution_strategies: AlternativeStrategy[]
    priority_matrix: {
      conflict_id: string
      urgency: number
      impact: number
      resolution_complexity: number
    }[]
    automated_resolutions: {
      conflict_id: string
      can_auto_resolve: boolean
      proposed_solution: string
      confidence: number
    }[]
  }> {
    try {
      const response = await fetch(`${this.baseUrl}conflicts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        }
      })

      if (!response.ok) {
        throw new Error(`Conflict detection failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Conflict detection failed:', error)
      throw error
    }
  }

  /**
   * Apply optimization suggestion and track outcomes
   * Requirement 6.3: Track outcomes and improve future recommendations
   */
  async applyOptimization(
    suggestionId: string,
    options: {
      notify_stakeholders?: boolean
      implementation_notes?: string
      expected_completion_date?: string
    } = {}
  ): Promise<{
    application_id: string
    status: 'applied' | 'scheduled' | 'failed'
    affected_resources: string[]
    notifications_sent: string[]
    tracking_metrics: {
      baseline_utilization: number
      target_utilization: number
      estimated_improvement: number
    }
  }> {
    try {
      const response = await fetch(`${this.baseUrl}apply/${suggestionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify(options)
      })

      if (!response.ok) {
        throw new Error(`Failed to apply optimization: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Optimization application failed:', error)
      throw error
    }
  }

  /**
   * Get real-time optimization metrics and performance tracking
   */
  async getOptimizationMetrics(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<{
    period: string
    total_optimizations_applied: number
    average_utilization_improvement: number
    conflicts_resolved: number
    cost_savings_estimated: number
    user_satisfaction_score: number
    
    performance_trends: {
      date: string
      utilization_avg: number
      conflicts_count: number
      optimizations_applied: number
    }[]
    
    top_performing_optimizations: {
      type: string
      success_rate: number
      avg_improvement: number
      user_adoption_rate: number
    }[]
  }> {
    try {
      const response = await fetch(`${this.baseUrl}metrics?timeframe=${timeframe}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Metrics fetch failed:', error)
      throw error
    }
  }

  /**
   * Transform backend response to standardized format
   */
  private transformAnalysisResponse(data: any, analysisDuration: number): OptimizationAnalysis {
    const suggestions: OptimizationSuggestion[] = (data.suggestions || []).map((suggestion: any) => ({
      id: suggestion.id || `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.mapSuggestionType(suggestion.type),
      resource_id: suggestion.resource_id,
      resource_name: suggestion.resource_name,
      project_id: suggestion.project_id,
      project_name: suggestion.project_name,
      
      confidence_score: suggestion.confidence_score || suggestion.match_score || 0.7,
      impact_score: this.calculateImpactScore(suggestion),
      effort_required: this.determineEffortLevel(suggestion),
      
      current_allocation: suggestion.current_utilization || 0,
      suggested_allocation: suggestion.target_utilization || suggestion.current_utilization || 0,
      skill_match_score: suggestion.match_score,
      utilization_improvement: this.calculateUtilizationImprovement(suggestion),
      
      conflicts_detected: this.extractConflicts(suggestion),
      alternative_strategies: this.generateAlternativeStrategies(suggestion),
      
      reasoning: suggestion.reasoning || suggestion.recommendation || 'AI-generated optimization suggestion',
      benefits: this.extractBenefits(suggestion),
      risks: this.extractRisks(suggestion),
      implementation_steps: this.generateImplementationSteps(suggestion),
      
      analysis_timestamp: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    }))

    return {
      analysis_id: `analysis_${Date.now()}`,
      request_timestamp: new Date().toISOString(),
      analysis_duration_ms: analysisDuration,
      
      suggestions,
      conflicts: suggestions.flatMap(s => s.conflicts_detected),
      
      total_resources_analyzed: data.summary?.total_resources || 0,
      optimization_opportunities: suggestions.length,
      potential_utilization_improvement: this.calculatePotentialImprovement(suggestions),
      estimated_cost_savings: this.estimateCostSavings(suggestions),
      
      overall_confidence: data.overall_confidence || this.calculateOverallConfidence(suggestions),
      data_quality_score: 0.85, // Mock value - would be calculated based on data completeness
      recommendation_reliability: this.determineReliability(suggestions),
      
      recommended_actions: this.generateRecommendedActions(suggestions),
      follow_up_analysis_suggested: suggestions.some(s => s.confidence_score < 0.7)
    }
  }

  private mapSuggestionType(type: string): OptimizationSuggestion['type'] {
    const typeMap: Record<string, OptimizationSuggestion['type']> = {
      'increase_utilization': 'resource_reallocation',
      'reduce_utilization': 'resource_reallocation',
      'skill_optimization': 'skill_optimization',
      'resolve_conflict': 'conflict_resolution',
      'capacity_planning': 'capacity_planning'
    }
    return typeMap[type] || 'resource_reallocation'
  }

  private calculateImpactScore(suggestion: any): number {
    // Calculate impact based on utilization change and affected resources
    const utilizationDelta = Math.abs((suggestion.target_utilization || 0) - (suggestion.current_utilization || 0))
    const priorityMultiplier = suggestion.priority === 'high' ? 1.5 : suggestion.priority === 'critical' ? 2.0 : 1.0
    return Math.min(1.0, (utilizationDelta / 100) * priorityMultiplier)
  }

  private determineEffortLevel(suggestion: any): 'low' | 'medium' | 'high' {
    const utilizationChange = Math.abs((suggestion.target_utilization || 0) - (suggestion.current_utilization || 0))
    if (utilizationChange < 20) return 'low'
    if (utilizationChange < 50) return 'medium'
    return 'high'
  }

  private calculateUtilizationImprovement(suggestion: any): number {
    const current = suggestion.current_utilization || 0
    const target = suggestion.target_utilization || current
    return target - current
  }

  private extractConflicts(suggestion: any): ConflictDetails[] {
    if (!suggestion.conflict_detected) return []
    
    return [{
      type: 'over_allocation',
      severity: suggestion.priority === 'critical' ? 'critical' : 'medium',
      description: `Resource allocation conflict detected for ${suggestion.resource_name}`,
      affected_projects: suggestion.affected_projects || [],
      resolution_priority: suggestion.priority === 'critical' ? 1 : 2
    }]
  }

  private generateAlternativeStrategies(suggestion: any): AlternativeStrategy[] {
    const strategies: AlternativeStrategy[] = []
    
    if (suggestion.alternative_strategies) {
      suggestion.alternative_strategies.forEach((strategy: string, index: number) => {
        strategies.push({
          strategy_id: `alt_${suggestion.resource_id}_${index}`,
          name: `Alternative Strategy ${index + 1}`,
          description: strategy,
          confidence_score: 0.6 + (index * 0.1),
          implementation_complexity: index === 0 ? 'simple' : 'moderate',
          estimated_timeline: index === 0 ? '1-2 days' : '1-2 weeks',
          resource_requirements: ['Project Manager', 'Resource Coordinator'],
          expected_outcomes: [`Improved resource utilization`, `Reduced conflicts`]
        })
      })
    }
    
    return strategies
  }

  private extractBenefits(suggestion: any): string[] {
    const benefits = []
    
    if (suggestion.utilization_improvement > 0) {
      benefits.push(`Increase utilization by ${suggestion.utilization_improvement.toFixed(1)}%`)
    }
    
    if (suggestion.match_score > 0.8) {
      benefits.push('Excellent skill match for project requirements')
    }
    
    if (suggestion.available_hours > 0) {
      benefits.push(`${suggestion.available_hours} hours of additional capacity`)
    }
    
    return benefits.length > 0 ? benefits : ['Improved resource allocation efficiency']
  }

  private extractRisks(suggestion: any): string[] {
    const risks = []
    
    if (suggestion.confidence_score < 0.7) {
      risks.push('Lower confidence in recommendation accuracy')
    }
    
    if (suggestion.current_utilization > 90) {
      risks.push('Resource may become overallocated')
    }
    
    if (suggestion.conflict_detected) {
      risks.push('May create scheduling conflicts with existing projects')
    }
    
    return risks.length > 0 ? risks : ['Minimal risk with proper implementation']
  }

  private generateImplementationSteps(suggestion: any): string[] {
    const steps = [
      'Review current resource allocation and availability',
      'Communicate changes to affected stakeholders',
      'Update project assignments and schedules'
    ]
    
    if (suggestion.type === 'skill_optimization') {
      steps.push('Provide any necessary skill development or training')
    }
    
    if (suggestion.conflict_detected) {
      steps.unshift('Resolve existing conflicts before implementing changes')
    }
    
    steps.push('Monitor implementation and track performance metrics')
    
    return steps
  }

  private calculatePotentialImprovement(suggestions: OptimizationSuggestion[]): number {
    if (suggestions.length === 0) return 0
    return suggestions.reduce((sum, s) => sum + Math.abs(s.utilization_improvement), 0) / suggestions.length
  }

  private estimateCostSavings(suggestions: OptimizationSuggestion[]): number {
    // Simplified cost savings calculation
    return suggestions.reduce((sum, s) => {
      const hoursSaved = Math.abs(s.utilization_improvement) * 0.4 // 40% of improvement translates to savings
      return sum + (hoursSaved * 75) // Assume $75/hour average rate
    }, 0)
  }

  private calculateOverallConfidence(suggestions: OptimizationSuggestion[]): number {
    if (suggestions.length === 0) return 0
    return suggestions.reduce((sum, s) => sum + s.confidence_score, 0) / suggestions.length
  }

  private determineReliability(suggestions: OptimizationSuggestion[]): 'high' | 'medium' | 'low' {
    const avgConfidence = this.calculateOverallConfidence(suggestions)
    if (avgConfidence >= 0.8) return 'high'
    if (avgConfidence >= 0.6) return 'medium'
    return 'low'
  }

  private generateRecommendedActions(suggestions: OptimizationSuggestion[]): string[] {
    const actions = []
    
    const highPriority = suggestions.filter(s => s.impact_score > 0.7)
    if (highPriority.length > 0) {
      actions.push(`Prioritize ${highPriority.length} high-impact optimization(s)`)
    }
    
    const conflicts = suggestions.filter(s => s.conflicts_detected.length > 0)
    if (conflicts.length > 0) {
      actions.push(`Address ${conflicts.length} resource conflict(s) immediately`)
    }
    
    const lowConfidence = suggestions.filter(s => s.confidence_score < 0.7)
    if (lowConfidence.length > 0) {
      actions.push(`Review ${lowConfidence.length} low-confidence recommendation(s) manually`)
    }
    
    if (actions.length === 0) {
      actions.push('Monitor resource utilization and rerun analysis in 1 week')
    }
    
    return actions
  }
}

// Export singleton instance
export const aiResourceOptimizer = new AIResourceOptimizer()

// Utility function to create optimizer with auth token
export function createAIResourceOptimizer(authToken: string): AIResourceOptimizer {
  return new AIResourceOptimizer(authToken)
}