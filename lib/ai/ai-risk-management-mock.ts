/**
 * Mock AI Risk Management Service
 * Provides mock data for development and testing
 */

import type {
  RiskPattern,
  RiskEscalationAlert,
  MitigationStrategy,
  RiskAnalysisRequest
} from './risk-management'

// Mock data
const mockRiskPatterns: RiskPattern[] = [
  {
    pattern_id: 'pattern_001',
    pattern_name: 'Resource Overallocation',
    pattern_type: 'resource_dependent',
    description: 'Pattern indicating resource overallocation leading to project delays',
    frequency: 'monthly',
    confidence_score: 0.85,
    historical_accuracy: 0.87,
    leading_indicators: [
      {
        indicator: 'resource_utilization',
        threshold: 90,
        weight: 0.4,
        data_source: 'resource_management_system'
      },
      {
        indicator: 'concurrent_projects',
        threshold: 3,
        weight: 0.3,
        data_source: 'project_database'
      }
    ],
    typical_project_phases: ['planning', 'execution'],
    common_categories: ['software_development', 'consulting'],
    affected_stakeholders: ['project_manager', 'team_lead', 'resource_manager'],
    occurrences_count: 15,
    average_impact_score: 0.75,
    escalation_probability: 0.65,
    next_likely_occurrence: {
      predicted_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      confidence: 0.8,
      context_factors: ['Q4 resource constraints', 'Multiple project deadlines']
    },
    successful_mitigations: [
      {
        strategy: 'early_intervention',
        success_rate: 0.9,
        average_cost_reduction: 15000,
        implementation_time: '3-5 days'
      },
      {
        strategy: 'resource_reallocation',
        success_rate: 0.8,
        average_cost_reduction: 12000,
        implementation_time: '5-7 days'
      }
    ]
  },
  {
    pattern_id: 'pattern_002',
    pattern_name: 'Scope Creep Cascade',
    pattern_type: 'cascading',
    description: 'Pattern where scope changes in one project affect multiple related projects',
    frequency: 'quarterly',
    confidence_score: 0.78,
    historical_accuracy: 0.82,
    leading_indicators: [
      {
        indicator: 'scope_change_frequency',
        threshold: 2,
        weight: 0.5,
        data_source: 'change_management_system'
      },
      {
        indicator: 'stakeholder_count',
        threshold: 5,
        weight: 0.3,
        data_source: 'stakeholder_database'
      }
    ],
    typical_project_phases: ['requirements', 'design', 'execution'],
    common_categories: ['enterprise_software', 'system_integration'],
    affected_stakeholders: ['business_analyst', 'project_manager', 'client'],
    occurrences_count: 8,
    average_impact_score: 0.68,
    escalation_probability: 0.55,
    next_likely_occurrence: {
      predicted_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      confidence: 0.7,
      context_factors: ['Client requirement changes', 'Market pressures']
    },
    successful_mitigations: [
      {
        strategy: 'stakeholder_alignment',
        success_rate: 0.85,
        average_cost_reduction: 20000,
        implementation_time: '7-10 days'
      },
      {
        strategy: 'change_control_process',
        success_rate: 0.9,
        average_cost_reduction: 25000,
        implementation_time: '5-7 days'
      }
    ]
  }
]

const mockEscalationAlerts: RiskEscalationAlert[] = [
  {
    alert_id: 'alert_001',
    risk_id: 'risk_001',
    risk_title: 'Budget Overrun Risk',
    project_id: 'project_001',
    project_name: 'Alpha Development Project',
    alert_type: 'escalation_predicted',
    severity: 'high',
    urgency: 'within_24h',
    current_risk_score: 0.65,
    predicted_risk_score: 0.85,
    escalation_probability: 0.92,
    time_to_escalation: '7 days',
    triggering_factors: [
      {
        factor: 'Budget variance exceeding 15%',
        current_value: 18.5,
        threshold: 15.0,
        contribution_weight: 0.4
      },
      {
        factor: 'Resource costs increasing',
        current_value: 125.0,
        threshold: 100.0,
        contribution_weight: 0.3
      },
      {
        factor: 'Timeline delays accumulating',
        current_value: 14,
        threshold: 10,
        contribution_weight: 0.3
      }
    ],
    pattern_matches: [
      {
        pattern_id: 'pattern_001',
        pattern_name: 'Resource Overallocation',
        match_confidence: 0.87,
        historical_outcomes: ['Project delayed by 2 weeks', 'Budget increased by 20%']
      }
    ],
    immediate_actions: [
      {
        action: 'Immediate budget review',
        priority: 1,
        estimated_effort: 'medium',
        expected_impact: 0.7
      },
      {
        action: 'Stakeholder notification',
        priority: 2,
        estimated_effort: 'low',
        expected_impact: 0.5
      },
      {
        action: 'Resource reallocation assessment',
        priority: 3,
        estimated_effort: 'high',
        expected_impact: 0.8
      }
    ],
    stakeholders_to_notify: [
      {
        role: 'Project Manager',
        notification_method: 'email',
        urgency_level: 'critical'
      },
      {
        role: 'Budget Owner',
        notification_method: 'all',
        urgency_level: 'critical'
      },
      {
        role: 'Team Lead',
        notification_method: 'dashboard',
        urgency_level: 'warning'
      }
    ],
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acknowledged: false
  }
]

const mockMitigationStrategies: MitigationStrategy[] = [
  {
    strategy_id: 'strategy_001',
    strategy_name: 'Resource Reallocation',
    description: 'Reallocate resources from lower priority projects to critical path items',
    applicable_risk_categories: ['resource_shortage', 'timeline_delay'],
    applicable_risk_scores: {
      min: 0.4,
      max: 0.9
    },
    project_phase_suitability: ['planning', 'execution'],
    historical_success_rate: 0.78,
    average_risk_reduction: 0.35,
    implementation_complexity: 'medium',
    typical_implementation_time: '5-7 days',
    required_skills: ['resource_management', 'project_planning', 'stakeholder_communication'],
    estimated_cost: {
      min: 3000,
      max: 8000,
      currency: 'USD'
    },
    required_stakeholders: ['resource_manager', 'project_manager', 'team_leads'],
    implementation_steps: [
      {
        step_number: 1,
        description: 'Identify available resources',
        estimated_duration: '1 day',
        dependencies: [],
        success_criteria: ['Resource inventory completed', 'Availability confirmed']
      },
      {
        step_number: 2,
        description: 'Assess skill compatibility',
        estimated_duration: '1 day',
        dependencies: ['step_1'],
        success_criteria: ['Skills matrix updated', 'Compatibility scores calculated']
      },
      {
        step_number: 3,
        description: 'Negotiate with project managers',
        estimated_duration: '2 days',
        dependencies: ['step_2'],
        success_criteria: ['Agreements reached', 'Resource transfers approved']
      },
      {
        step_number: 4,
        description: 'Execute reallocation',
        estimated_duration: '1 day',
        dependencies: ['step_3'],
        success_criteria: ['Resources transferred', 'New assignments active']
      },
      {
        step_number: 5,
        description: 'Monitor effectiveness',
        estimated_duration: 'ongoing',
        dependencies: ['step_4'],
        success_criteria: ['Monitoring systems active', 'Performance metrics tracked']
      }
    ],
    success_indicators: [
      {
        metric: 'Resource utilization improvement',
        target_value: 0.8,
        measurement_method: 'automated_tracking',
        review_frequency: 'weekly'
      },
      {
        metric: 'Timeline recovery',
        target_value: 0.9,
        measurement_method: 'milestone_tracking',
        review_frequency: 'daily'
      }
    ],
    similar_cases: [
      {
        case_id: 'case_001',
        project_name: 'Alpha Development',
        implementation_date: '2024-01-15',
        outcome: 'successful',
        lessons_learned: ['Early stakeholder buy-in crucial', 'Skills assessment prevented delays'],
        actual_cost: 4800,
        actual_duration: '6 days'
      },
      {
        case_id: 'case_002',
        project_name: 'Beta Integration',
        implementation_date: '2024-02-20',
        outcome: 'partially_successful',
        lessons_learned: ['Communication gaps caused friction', 'Need better change management'],
        actual_cost: 6200,
        actual_duration: '8 days'
      }
    ],
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    last_updated: new Date().toISOString(),
    confidence_score: 0.85,
    recommendation_strength: 0.78
  }
]

export class MockAIRiskManagementService {
  async analyzeRisk(request: RiskAnalysisRequest): Promise<{
    analysis_id: string
    risk_score: number
    risk_level: string
    confidence_score: number
    identified_patterns: RiskPattern[]
    risk_factors: string[]
    impact_assessment: {
      budget_impact: number
      timeline_impact_days: number
      resource_impact: string
      stakeholder_impact: string
    }
    recommendations: string[]
    analysis_timestamp: string
    expires_at: string
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))

    return {
      analysis_id: `analysis_${Date.now()}`,
      risk_score: Math.random() * 0.4 + 0.3, // 0.3 to 0.7
      risk_level: Math.random() > 0.5 ? 'medium' : 'high',
      confidence_score: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
      identified_patterns: mockRiskPatterns.slice(0, Math.floor(Math.random() * 2) + 1),
      risk_factors: [
        'Resource utilization above threshold',
        'Timeline compression detected',
        'Stakeholder complexity high'
      ],
      impact_assessment: {
        budget_impact: Math.floor(Math.random() * 50000) + 10000,
        timeline_impact_days: Math.floor(Math.random() * 30) + 5,
        resource_impact: Math.random() > 0.5 ? 'high' : 'medium',
        stakeholder_impact: Math.random() > 0.5 ? 'medium' : 'low'
      },
      recommendations: [
        'Implement resource monitoring',
        'Establish stakeholder communication plan',
        'Create contingency timeline'
      ],
      analysis_timestamp: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
  }

  async recognizePatterns(request: any): Promise<{
    recognition_id: string
    identified_patterns: RiskPattern[]
    pattern_confidence: number
    pattern_trends: {
      increasing: string[]
      stable: string[]
      decreasing: string[]
    }
    recommendations: string[]
    analysis_timestamp: string
  }> {
    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      recognition_id: `recognition_${Date.now()}`,
      identified_patterns: mockRiskPatterns,
      pattern_confidence: Math.random() * 0.3 + 0.7,
      pattern_trends: {
        increasing: ['resource_dependent', 'cascading'],
        stable: ['seasonal'],
        decreasing: ['recurring']
      },
      recommendations: [
        'Focus on resource management patterns',
        'Implement early warning systems',
        'Strengthen change control processes'
      ],
      analysis_timestamp: new Date().toISOString()
    }
  }

  async predictEscalation(request: any): Promise<{
    prediction_id: string
    escalation_alerts: RiskEscalationAlert[]
    escalation_probability: number
    predicted_timeline: {
      days_to_escalation: number
      confidence_interval: {
        min_days: number
        max_days: number
      }
    }
    contributing_factors: string[]
    prevention_window: {
      optimal_action_date: string
      latest_action_date: string
    }
    analysis_timestamp: string
  }> {
    await new Promise(resolve => setTimeout(resolve, 400))

    return {
      prediction_id: `prediction_${Date.now()}`,
      escalation_alerts: mockEscalationAlerts,
      escalation_probability: Math.random() * 0.4 + 0.3,
      predicted_timeline: {
        days_to_escalation: Math.floor(Math.random() * 14) + 3,
        confidence_interval: {
          min_days: 2,
          max_days: 21
        }
      },
      contributing_factors: [
        'Current trend trajectory',
        'Historical pattern matching',
        'External risk factors'
      ],
      prevention_window: {
        optimal_action_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        latest_action_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      analysis_timestamp: new Date().toISOString()
    }
  }

  async suggestMitigation(request: any): Promise<{
    suggestion_id: string
    recommended_strategies: MitigationStrategy[]
    strategy_ranking: Array<{
      strategy_id: string
      rank: number
      score: number
      rationale: string
    }>
    implementation_plan: {
      immediate_actions: string[]
      short_term_actions: string[]
      long_term_actions: string[]
    }
    cost_benefit_analysis: {
      total_estimated_cost: number
      potential_savings: number
      roi_estimate: number
      payback_period_days: number
    }
    analysis_timestamp: string
  }> {
    await new Promise(resolve => setTimeout(resolve, 600))

    return {
      suggestion_id: `suggestion_${Date.now()}`,
      recommended_strategies: mockMitigationStrategies,
      strategy_ranking: mockMitigationStrategies.map((strategy, index) => ({
        strategy_id: strategy.strategy_id,
        rank: index + 1,
        score: strategy.effectiveness_score,
        rationale: `Best fit for current risk profile with ${Math.round(strategy.effectiveness_score * 100)}% effectiveness`
      })),
      implementation_plan: {
        immediate_actions: [
          'Assess current resource allocation',
          'Identify critical path dependencies',
          'Prepare stakeholder communication'
        ],
        short_term_actions: [
          'Implement monitoring systems',
          'Execute resource reallocation',
          'Establish regular check-ins'
        ],
        long_term_actions: [
          'Develop prevention protocols',
          'Update risk management processes',
          'Train team on new procedures'
        ]
      },
      cost_benefit_analysis: {
        total_estimated_cost: mockMitigationStrategies.reduce((sum, s) => sum + s.estimated_cost, 0),
        potential_savings: Math.floor(Math.random() * 100000) + 50000,
        roi_estimate: Math.random() * 3 + 2, // 2x to 5x ROI
        payback_period_days: Math.floor(Math.random() * 90) + 30
      },
      analysis_timestamp: new Date().toISOString()
    }
  }

  async getHistoricalPatterns(): Promise<RiskPattern[]> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return mockRiskPatterns
  }

  async getActiveAlerts(): Promise<RiskEscalationAlert[]> {
    await new Promise(resolve => setTimeout(resolve, 150))
    return mockEscalationAlerts
  }

  async getMitigationStrategies(): Promise<MitigationStrategy[]> {
    await new Promise(resolve => setTimeout(resolve, 100))
    return mockMitigationStrategies
  }

  async generateEscalationAlerts(request: {
    risk_ids?: string[]
    project_ids?: string[]
    time_horizon_days?: number
    severity_threshold?: 'low' | 'medium' | 'high'
    include_predictions?: boolean
  } = {}): Promise<{
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
    await new Promise(resolve => setTimeout(resolve, 500))

    const alerts = mockEscalationAlerts

    return {
      alerts,
      alert_summary: {
        total_alerts: alerts.length,
        critical_alerts: alerts.filter(a => a.severity === 'critical').length,
        immediate_action_required: alerts.filter(a => a.urgency === 'immediate').length,
        monitoring_alerts: alerts.filter(a => a.urgency === 'monitor').length
      },
      escalation_forecast: [
        {
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          predicted_escalations: 2,
          confidence: 0.8,
          primary_risk_categories: ['budget_overrun', 'timeline_delay']
        },
        {
          date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          predicted_escalations: 1,
          confidence: 0.6,
          primary_risk_categories: ['resource_shortage']
        }
      ],
      notification_plan: {
        immediate_notifications: alerts
          .filter(a => a.urgency === 'immediate')
          .map(a => ({
            stakeholder: 'Project Manager',
            method: 'email',
            alert_ids: [a.alert_id]
          })),
        scheduled_notifications: [
          {
            stakeholder: 'Senior Management',
            schedule: 'daily',
            alert_types: ['critical', 'high']
          },
          {
            stakeholder: 'Team Leads',
            schedule: 'weekly',
            alert_types: ['medium', 'low']
          }
        ]
      }
    }
  }

  async identifyRiskPatterns(request: RiskAnalysisRequest = {}): Promise<{
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
    await new Promise(resolve => setTimeout(resolve, 400))

    return {
      patterns: mockRiskPatterns,
      pattern_summary: {
        total_patterns_found: mockRiskPatterns.length,
        high_confidence_patterns: mockRiskPatterns.filter(p => p.confidence_score > 0.8).length,
        actionable_patterns: mockRiskPatterns.filter(p => p.successful_mitigations.length > 0).length,
        pattern_categories: {
          'resource_dependent': 1,
          'cascading': 1,
          'seasonal': 0,
          'recurring': 0
        }
      },
      insights: {
        most_critical_pattern: mockRiskPatterns.find(p => p.average_impact_score > 0.7) || null,
        emerging_patterns: mockRiskPatterns.filter(p => p.occurrences_count < 5),
        declining_patterns: mockRiskPatterns.filter(p => p.escalation_probability < 0.3),
        seasonal_insights: [
          {
            season: 'Q4',
            typical_risk_increase: 0.25,
            common_risk_types: ['resource_shortage', 'timeline_pressure']
          }
        ]
      },
      recommendations: mockRiskPatterns.map((pattern, index) => ({
        pattern_id: pattern.pattern_id,
        recommendation_type: index % 3 === 0 ? 'monitoring' : index % 3 === 1 ? 'prevention' : 'preparation',
        description: `Implement ${pattern.pattern_name.toLowerCase()} detection and response protocols`,
        priority: Math.floor(pattern.confidence_score * 10),
        estimated_impact: pattern.average_impact_score > 0.7 ? 'significant' : pattern.average_impact_score > 0.4 ? 'moderate' : 'minimal'
      }))
    }
  }

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
    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      risk_overview: {
        total_active_risks: 12,
        high_risk_count: 3,
        escalation_alerts: 2,
        pattern_matches_today: 5
      },
      active_patterns: mockRiskPatterns.map(pattern => ({
        pattern_name: pattern.pattern_name,
        confidence: pattern.confidence_score,
        next_occurrence: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        affected_projects: Math.floor(Math.random() * 5) + 1
      })),
      recent_alerts: mockEscalationAlerts,
      mitigation_effectiveness: {
        strategies_in_progress: 4,
        recent_successes: 7,
        average_risk_reduction: 0.65,
        cost_savings_achieved: 125000
      },
      ai_insights: {
        model_accuracy: 0.852,
        prediction_confidence: 0.78,
        learning_rate: 0.1,
        last_model_update: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      recommendations: [
        {
          type: 'escalation',
          priority: 1,
          title: 'Critical Budget Overrun Alert',
          description: 'Project Alpha showing 85% probability of budget escalation within 7 days',
          action_required: true,
          estimated_impact: 'high'
        },
        {
          type: 'pattern',
          priority: 2,
          title: 'Resource Overallocation Pattern Detected',
          description: 'Similar pattern led to delays in 3 previous projects',
          action_required: true,
          estimated_impact: 'medium'
        },
        {
          type: 'mitigation',
          priority: 3,
          title: 'Implement Resource Reallocation',
          description: 'Historical success rate of 78% for similar risk profiles',
          action_required: false,
          estimated_impact: 'medium'
        }
      ]
    }
  }

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
    await new Promise(resolve => setTimeout(resolve, 200))

    // Find the alert (in a real implementation, this would update the database)
    const alert = mockEscalationAlerts.find(a => a.alert_id === alertId)
    
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`)
    }

    // Create updated alert
    const updatedAlert: RiskEscalationAlert = {
      ...alert,
      acknowledged: true,
      acknowledged_by: response.acknowledged_by,
      acknowledged_at: new Date().toISOString()
    }

    // Generate follow-up actions based on response action
    const followUpActions: string[] = []
    
    switch (response.response_action) {
      case 'investigating':
        followUpActions.push(
          'Schedule investigation meeting within 24 hours',
          'Gather additional risk data and metrics',
          'Identify key stakeholders for consultation'
        )
        break
      case 'implementing_mitigation':
        followUpActions.push(
          'Review recommended mitigation strategies',
          'Allocate resources for implementation',
          'Set up monitoring for mitigation effectiveness'
        )
        break
      case 'escalating':
        followUpActions.push(
          'Notify senior management immediately',
          'Prepare detailed risk assessment report',
          'Schedule emergency stakeholder meeting'
        )
        break
      case 'dismissing':
        followUpActions.push(
          'Document dismissal rationale',
          'Update risk assessment criteria',
          'Monitor for pattern recurrence'
        )
        break
    }

    return {
      success: true,
      updated_alert: updatedAlert,
      follow_up_actions: followUpActions
    }
  }

  async suggestMitigationStrategies(request: {
    risk_id?: string
    risk_category?: string
    risk_score?: number
    project_phase?: string
    available_budget?: number
    timeline_constraint?: string
    stakeholder_availability?: string[]
  }): Promise<{
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
    await new Promise(resolve => setTimeout(resolve, 500))

    const strategies = mockMitigationStrategies
    const recommendedStrategy = strategies[0]

    return {
      strategies,
      strategy_ranking: strategies.map((strategy, index) => ({
        strategy_id: strategy.strategy_id,
        overall_score: strategy.historical_success_rate * 0.9,
        effectiveness_score: strategy.average_risk_reduction,
        feasibility_score: strategy.implementation_complexity === 'low' ? 0.9 : strategy.implementation_complexity === 'medium' ? 0.7 : 0.5,
        cost_efficiency_score: Math.max(0.1, 1 - (strategy.estimated_cost.min / 10000)),
        recommendation_reason: `Best fit for ${request.risk_category || 'general'} risks with ${Math.round(strategy.historical_success_rate * 100)}% historical success rate`
      })),
      implementation_plan: {
        recommended_strategy: recommendedStrategy,
        customized_steps: [
          {
            step: 'Initial assessment and planning',
            timeline: '1-2 days',
            resources_needed: ['Project Manager', 'Risk Analyst'],
            success_criteria: ['Assessment completed', 'Plan approved']
          },
          {
            step: 'Resource identification and allocation',
            timeline: '2-3 days',
            resources_needed: ['Resource Manager', 'Team Leads'],
            success_criteria: ['Resources identified', 'Allocation confirmed']
          },
          {
            step: 'Implementation and monitoring',
            timeline: '3-5 days',
            resources_needed: ['Implementation Team', 'Monitoring Tools'],
            success_criteria: ['Strategy implemented', 'Monitoring active']
          }
        ],
        risk_monitoring_plan: [
          {
            metric: 'Risk Score',
            baseline: request.risk_score || 0.7,
            target: (request.risk_score || 0.7) * 0.6,
            review_frequency: 'daily'
          },
          {
            metric: 'Resource Utilization',
            baseline: 0.85,
            target: 0.75,
            review_frequency: 'weekly'
          }
        ]
      },
      alternative_approaches: [
        {
          approach: 'Timeline Extension',
          pros: ['Lower resource pressure', 'Better quality outcomes'],
          cons: ['Delayed delivery', 'Increased costs'],
          suitability_score: 0.6
        },
        {
          approach: 'Scope Reduction',
          pros: ['Faster delivery', 'Lower risk'],
          cons: ['Reduced functionality', 'Stakeholder disappointment'],
          suitability_score: 0.7
        }
      ]
    }
  }
}

export const mockAIRiskManagementService = new MockAIRiskManagementService()