/**
 * Mock AI Risk Management Service
 * Provides realistic mock data for AI risk management features
 * This simulates the backend AI service for development and testing
 */

import { 
  type RiskPattern,
  type RiskEscalationAlert,
  type MitigationStrategy,
  type RiskAnalysisRequest,
  type RiskLearningOutcome
} from './ai-risk-management'

// Mock data generators
export class MockAIRiskManagementService {
  private static instance: MockAIRiskManagementService
  private patterns: RiskPattern[] = []
  private alerts: RiskEscalationAlert[] = []
  private strategies: MitigationStrategy[] = []
  private learningOutcomes: RiskLearningOutcome[] = []

  constructor() {
    this.initializeMockData()
  }

  static getInstance(): MockAIRiskManagementService {
    if (!MockAIRiskManagementService.instance) {
      MockAIRiskManagementService.instance = new MockAIRiskManagementService()
    }
    return MockAIRiskManagementService.instance
  }

  private initializeMockData() {
    this.patterns = this.generateMockPatterns()
    this.alerts = this.generateMockAlerts()
    this.strategies = this.generateMockStrategies()
  }

  private generateMockPatterns(): RiskPattern[] {
    return [
      {
        pattern_id: 'pattern_1',
        pattern_name: 'End-of-Sprint Resource Crunch',
        pattern_type: 'recurring',
        description: 'Teams consistently experience resource shortages in the final week of sprints, leading to quality compromises and deadline pressure.',
        frequency: 'weekly',
        confidence_score: 0.87,
        historical_accuracy: 0.82,
        leading_indicators: [
          {
            indicator: 'Sprint velocity decline',
            threshold: 0.8,
            weight: 0.9,
            data_source: 'Sprint metrics'
          },
          {
            indicator: 'Overtime hours increase',
            threshold: 1.5,
            weight: 0.7,
            data_source: 'Time tracking'
          }
        ],
        typical_project_phases: ['development', 'testing'],
        common_categories: ['resource', 'schedule'],
        affected_stakeholders: ['developers', 'qa_team', 'project_manager'],
        occurrences_count: 23,
        average_impact_score: 0.65,
        escalation_probability: 0.45,
        next_likely_occurrence: {
          predicted_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          confidence: 0.78,
          context_factors: ['Current sprint at 60% completion', 'Team velocity below average']
        },
        successful_mitigations: [
          {
            strategy: 'Mid-sprint capacity review',
            success_rate: 0.73,
            average_cost_reduction: 0.25,
            implementation_time: '2 days'
          },
          {
            strategy: 'Scope adjustment protocol',
            success_rate: 0.68,
            average_cost_reduction: 0.30,
            implementation_time: '1 day'
          }
        ]
      },
      {
        pattern_id: 'pattern_2',
        pattern_name: 'Third-Party Integration Cascade',
        pattern_type: 'cascading',
        description: 'Delays in third-party API integrations trigger cascading effects across dependent features and testing phases.',
        frequency: 'project_based',
        confidence_score: 0.91,
        historical_accuracy: 0.88,
        leading_indicators: [
          {
            indicator: 'API response time degradation',
            threshold: 2000,
            weight: 0.8,
            data_source: 'Monitoring systems'
          },
          {
            indicator: 'Integration test failure rate',
            threshold: 0.15,
            weight: 0.9,
            data_source: 'Test results'
          }
        ],
        typical_project_phases: ['integration', 'testing'],
        common_categories: ['technical', 'external'],
        affected_stakeholders: ['backend_team', 'qa_team', 'devops'],
        occurrences_count: 15,
        average_impact_score: 0.78,
        escalation_probability: 0.62,
        next_likely_occurrence: {
          predicted_date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
          confidence: 0.85,
          context_factors: ['New API integration scheduled', 'Vendor reliability concerns']
        },
        successful_mitigations: [
          {
            strategy: 'Fallback API implementation',
            success_rate: 0.85,
            average_cost_reduction: 0.40,
            implementation_time: '5 days'
          }
        ]
      },
      {
        pattern_id: 'pattern_3',
        pattern_name: 'Q4 Budget Pressure Escalation',
        pattern_type: 'seasonal',
        description: 'Financial risks consistently escalate during Q4 due to budget constraints and year-end pressure.',
        frequency: 'quarterly',
        confidence_score: 0.93,
        historical_accuracy: 0.89,
        leading_indicators: [
          {
            indicator: 'Budget utilization rate',
            threshold: 0.85,
            weight: 0.95,
            data_source: 'Financial systems'
          },
          {
            indicator: 'Scope creep requests',
            threshold: 3,
            weight: 0.6,
            data_source: 'Change requests'
          }
        ],
        typical_project_phases: ['planning', 'execution'],
        common_categories: ['financial', 'schedule'],
        affected_stakeholders: ['finance_team', 'project_manager', 'executives'],
        occurrences_count: 8,
        average_impact_score: 0.82,
        escalation_probability: 0.71,
        next_likely_occurrence: {
          predicted_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          confidence: 0.92,
          context_factors: ['Q4 approaching', 'Current budget at 78% utilization']
        },
        successful_mitigations: [
          {
            strategy: 'Early budget reallocation',
            success_rate: 0.79,
            average_cost_reduction: 0.35,
            implementation_time: '2 weeks'
          }
        ]
      }
    ]
  }

  private generateMockAlerts(): RiskEscalationAlert[] {
    return [
      {
        alert_id: 'alert_1',
        risk_id: '1',
        risk_title: 'Technical Debt Accumulation',
        project_id: '1',
        project_name: 'Sample Project',
        alert_type: 'escalation_predicted',
        severity: 'high',
        urgency: 'within_24h',
        current_risk_score: 0.56,
        predicted_risk_score: 0.73,
        escalation_probability: 0.82,
        time_to_escalation: '3 days',
        triggering_factors: [
          {
            factor: 'Code complexity increase',
            current_value: 8.2,
            threshold: 7.5,
            contribution_weight: 0.8
          },
          {
            factor: 'Test coverage decline',
            current_value: 0.68,
            threshold: 0.75,
            contribution_weight: 0.6
          }
        ],
        pattern_matches: [
          {
            pattern_id: 'pattern_1',
            pattern_name: 'End-of-Sprint Resource Crunch',
            match_confidence: 0.75,
            historical_outcomes: ['Delayed release', 'Quality issues', 'Team burnout']
          }
        ],
        immediate_actions: [
          {
            action: 'Schedule technical debt review meeting',
            priority: 1,
            estimated_effort: 'low',
            expected_impact: 0.25
          },
          {
            action: 'Allocate 20% of next sprint to refactoring',
            priority: 2,
            estimated_effort: 'medium',
            expected_impact: 0.40
          }
        ],
        stakeholders_to_notify: [
          {
            role: 'tech_lead',
            notification_method: 'email',
            urgency_level: 'warning'
          },
          {
            role: 'project_manager',
            notification_method: 'dashboard',
            urgency_level: 'info'
          }
        ],
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        acknowledged: false
      },
      {
        alert_id: 'alert_2',
        risk_id: '5',
        risk_title: 'Schedule Compression Risk',
        project_id: '2',
        project_name: 'Another Project',
        alert_type: 'pattern_detected',
        severity: 'critical',
        urgency: 'immediate',
        current_risk_score: 0.48,
        predicted_risk_score: 0.85,
        escalation_probability: 0.91,
        time_to_escalation: '1 day',
        triggering_factors: [
          {
            factor: 'Sprint velocity decline',
            current_value: 0.65,
            threshold: 0.8,
            contribution_weight: 0.9
          },
          {
            factor: 'Team overtime hours',
            current_value: 1.8,
            threshold: 1.2,
            contribution_weight: 0.7
          }
        ],
        pattern_matches: [
          {
            pattern_id: 'pattern_1',
            pattern_name: 'End-of-Sprint Resource Crunch',
            match_confidence: 0.89,
            historical_outcomes: ['Missed deadline', 'Scope reduction', 'Quality compromise']
          }
        ],
        immediate_actions: [
          {
            action: 'Emergency stakeholder meeting',
            priority: 1,
            estimated_effort: 'low',
            expected_impact: 0.30
          },
          {
            action: 'Scope reduction assessment',
            priority: 2,
            estimated_effort: 'medium',
            expected_impact: 0.50
          }
        ],
        stakeholders_to_notify: [
          {
            role: 'project_manager',
            notification_method: 'all',
            urgency_level: 'critical'
          },
          {
            role: 'stakeholder',
            notification_method: 'email',
            urgency_level: 'critical'
          }
        ],
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        acknowledged: false
      }
    ]
  }

  private generateMockStrategies(): MitigationStrategy[] {
    return [
      {
        strategy_id: 'strategy_1',
        strategy_name: 'Incremental Technical Debt Reduction',
        description: 'Systematic approach to reducing technical debt through dedicated sprint allocation and code quality improvements.',
        applicable_risk_categories: ['technical'],
        applicable_risk_scores: { min: 0.4, max: 0.8 },
        project_phase_suitability: ['development', 'maintenance'],
        historical_success_rate: 0.78,
        average_risk_reduction: 0.35,
        implementation_complexity: 'medium',
        typical_implementation_time: '2-4 sprints',
        required_skills: ['code_review', 'refactoring', 'testing'],
        estimated_cost: { min: 5000, max: 15000, currency: 'USD' },
        required_stakeholders: ['tech_lead', 'development_team'],
        implementation_steps: [
          {
            step_number: 1,
            description: 'Conduct technical debt assessment and prioritization',
            estimated_duration: '3 days',
            dependencies: [],
            success_criteria: ['Debt inventory completed', 'Priority matrix established']
          },
          {
            step_number: 2,
            description: 'Allocate 20% of sprint capacity to debt reduction',
            estimated_duration: 'Ongoing',
            dependencies: ['Step 1'],
            success_criteria: ['Sprint planning updated', 'Team capacity allocated']
          },
          {
            step_number: 3,
            description: 'Implement code quality gates and monitoring',
            estimated_duration: '1 week',
            dependencies: ['Step 1'],
            success_criteria: ['Quality gates active', 'Monitoring dashboard deployed']
          }
        ],
        success_indicators: [
          {
            metric: 'Code complexity score',
            target_value: 7.0,
            measurement_method: 'Static analysis tools',
            review_frequency: 'Weekly'
          },
          {
            metric: 'Test coverage percentage',
            target_value: 80,
            measurement_method: 'Coverage reports',
            review_frequency: 'Sprint'
          }
        ],
        similar_cases: [
          {
            case_id: 'case_1',
            project_name: 'E-commerce Platform',
            implementation_date: '2024-08-15',
            outcome: 'successful',
            lessons_learned: ['Early stakeholder buy-in crucial', 'Gradual approach more sustainable'],
            actual_cost: 12000,
            actual_duration: '3 sprints'
          },
          {
            case_id: 'case_2',
            project_name: 'Mobile App Backend',
            implementation_date: '2024-06-20',
            outcome: 'partially_successful',
            lessons_learned: ['Need better tooling integration', 'Team training required'],
            actual_cost: 8500,
            actual_duration: '4 sprints'
          }
        ],
        created_at: '2024-01-01T00:00:00Z',
        last_updated: new Date().toISOString(),
        confidence_score: 0.82,
        recommendation_strength: 0.75
      },
      {
        strategy_id: 'strategy_2',
        strategy_name: 'Agile Scope Management Protocol',
        description: 'Dynamic scope adjustment framework to manage schedule compression risks through prioritization and stakeholder alignment.',
        applicable_risk_categories: ['schedule', 'resource'],
        applicable_risk_scores: { min: 0.3, max: 0.9 },
        project_phase_suitability: ['planning', 'execution'],
        historical_success_rate: 0.85,
        average_risk_reduction: 0.42,
        implementation_complexity: 'low',
        typical_implementation_time: '1-2 weeks',
        required_skills: ['stakeholder_management', 'prioritization', 'agile_methodology'],
        estimated_cost: { min: 2000, max: 8000, currency: 'USD' },
        required_stakeholders: ['project_manager', 'product_owner', 'stakeholders'],
        implementation_steps: [
          {
            step_number: 1,
            description: 'Establish scope prioritization framework',
            estimated_duration: '2 days',
            dependencies: [],
            success_criteria: ['Framework documented', 'Stakeholder approval obtained']
          },
          {
            step_number: 2,
            description: 'Implement regular scope review meetings',
            estimated_duration: 'Ongoing',
            dependencies: ['Step 1'],
            success_criteria: ['Meeting cadence established', 'Review process active']
          }
        ],
        success_indicators: [
          {
            metric: 'Scope change frequency',
            target_value: 2,
            measurement_method: 'Change request tracking',
            review_frequency: 'Sprint'
          }
        ],
        similar_cases: [
          {
            case_id: 'case_3',
            project_name: 'CRM System',
            implementation_date: '2024-09-10',
            outcome: 'successful',
            lessons_learned: ['Clear communication essential', 'Regular reviews prevent scope creep'],
            actual_cost: 5500,
            actual_duration: '10 days'
          }
        ],
        created_at: '2024-01-01T00:00:00Z',
        last_updated: new Date().toISOString(),
        confidence_score: 0.88,
        recommendation_strength: 0.92
      }
    ]
  }

  // Mock API methods
  async identifyRiskPatterns(request: RiskAnalysisRequest = {}) {
    // Simulate API delay
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 1500)
    })

    const filteredPatterns = this.patterns.filter(pattern => {
      if (request.confidence_threshold && pattern.confidence_score < request.confidence_threshold) {
        return false
      }
      return true
    })

    return {
      patterns: filteredPatterns,
      pattern_summary: {
        total_patterns_found: filteredPatterns.length,
        high_confidence_patterns: filteredPatterns.filter(p => p.confidence_score > 0.8).length,
        actionable_patterns: filteredPatterns.filter(p => p.successful_mitigations.length > 0).length,
        pattern_categories: filteredPatterns.reduce((acc, p) => {
          acc[p.pattern_type] = (acc[p.pattern_type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      },
      insights: {
        most_critical_pattern: filteredPatterns.find(p => p.average_impact_score > 0.7) || null,
        emerging_patterns: filteredPatterns.filter(p => p.occurrences_count < 5),
        declining_patterns: filteredPatterns.filter(p => p.escalation_probability < 0.3),
        seasonal_insights: [
          {
            season: 'Q4',
            typical_risk_increase: 0.25,
            common_risk_types: ['financial', 'schedule']
          }
        ]
      },
      recommendations: [
        {
          pattern_id: 'pattern_1',
          recommendation_type: 'prevention' as const,
          description: 'Implement mid-sprint capacity reviews to prevent resource crunches',
          priority: 1,
          estimated_impact: '25% risk reduction'
        }
      ]
    }
  }

  async generateEscalationAlerts(request: any = {}) {
    // Simulate API delay
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 1200)
    })

    const filteredAlerts = this.alerts.filter(alert => {
      if (request.alert_sensitivity === 'low' && alert.severity === 'low') return false
      if (request.alert_sensitivity === 'high') return true
      return alert.severity !== 'low'
    })

    return {
      alerts: filteredAlerts,
      alert_summary: {
        total_alerts: filteredAlerts.length,
        critical_alerts: filteredAlerts.filter(a => a.severity === 'critical').length,
        immediate_action_required: filteredAlerts.filter(a => a.urgency === 'immediate').length,
        monitoring_alerts: filteredAlerts.filter(a => a.urgency === 'monitor').length
      },
      escalation_forecast: [
        {
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          predicted_escalations: 2,
          confidence: 0.78,
          primary_risk_categories: ['technical', 'schedule']
        }
      ],
      notification_plan: {
        immediate_notifications: filteredAlerts
          .filter(a => a.urgency === 'immediate')
          .map(a => ({
            stakeholder: 'project_manager',
            method: 'email',
            alert_ids: [a.alert_id]
          })),
        scheduled_notifications: []
      }
    }
  }

  async suggestMitigationStrategies(request: any) {
    // Simulate API delay
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 1000)
    })

    const applicableStrategies = this.strategies.filter(strategy => {
      if (request.risk_category && !strategy.applicable_risk_categories.includes(request.risk_category)) {
        return false
      }
      if (request.risk_score) {
        const score = request.risk_score
        if (score < strategy.applicable_risk_scores.min || score > strategy.applicable_risk_scores.max) {
          return false
        }
      }
      return true
    })

    const strategyRanking = applicableStrategies.map(strategy => ({
      strategy_id: strategy.strategy_id,
      overall_score: (strategy.historical_success_rate + strategy.recommendation_strength) / 2,
      effectiveness_score: strategy.historical_success_rate,
      feasibility_score: strategy.implementation_complexity === 'low' ? 0.9 : 
                        strategy.implementation_complexity === 'medium' ? 0.7 : 0.5,
      cost_efficiency_score: 1 - (strategy.estimated_cost.min / 20000), // Normalize cost
      recommendation_reason: `${(strategy.historical_success_rate * 100).toFixed(0)}% success rate with ${strategy.implementation_complexity} complexity`
    })).sort((a, b) => b.overall_score - a.overall_score)

    const recommendedStrategy = applicableStrategies.find(s => s.strategy_id === strategyRanking[0]?.strategy_id)

    return {
      strategies: applicableStrategies,
      strategy_ranking: strategyRanking,
      implementation_plan: recommendedStrategy ? {
        recommended_strategy: recommendedStrategy,
        customized_steps: recommendedStrategy.implementation_steps.map(step => ({
          step: step.description,
          timeline: step.estimated_duration,
          resources_needed: recommendedStrategy.required_skills,
          success_criteria: step.success_criteria
        })),
        risk_monitoring_plan: recommendedStrategy.success_indicators.map(indicator => ({
          metric: indicator.metric,
          baseline: 0,
          target: indicator.target_value,
          review_frequency: indicator.review_frequency
        }))
      } : {
        recommended_strategy: applicableStrategies[0] || this.strategies[0],
        customized_steps: [],
        risk_monitoring_plan: []
      },
      alternative_approaches: [
        {
          approach: 'Gradual implementation',
          pros: ['Lower risk', 'Easier adoption'],
          cons: ['Slower results', 'May lose momentum'],
          suitability_score: 0.7
        }
      ]
    }
  }

  async getDashboardData() {
    // Simulate API delay
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 800)
    })

    return {
      risk_overview: {
        total_active_risks: 6,
        high_risk_count: 2,
        escalation_alerts: this.alerts.filter(a => !a.acknowledged).length,
        pattern_matches_today: 3
      },
      active_patterns: this.patterns.slice(0, 3).map(pattern => ({
        pattern_name: pattern.pattern_name,
        confidence: pattern.confidence_score,
        next_occurrence: pattern.next_likely_occurrence.predicted_date,
        affected_projects: Math.floor(Math.random() * 5) + 1
      })),
      recent_alerts: this.alerts.slice(0, 3),
      mitigation_effectiveness: {
        strategies_in_progress: 2,
        recent_successes: 4,
        average_risk_reduction: 0.32,
        cost_savings_achieved: 45000
      },
      ai_insights: {
        model_accuracy: 0.852,
        prediction_confidence: 0.784,
        learning_rate: 0.12,
        last_model_update: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      recommendations: [
        {
          type: 'pattern' as const,
          priority: 1,
          title: 'Implement Sprint Capacity Reviews',
          description: 'Pattern analysis suggests implementing mid-sprint reviews could prevent 73% of resource crunch scenarios',
          action_required: true,
          estimated_impact: '25% risk reduction'
        },
        {
          type: 'escalation' as const,
          priority: 2,
          title: 'Address Technical Debt Alert',
          description: 'Technical debt in Sample Project is predicted to escalate within 3 days',
          action_required: true,
          estimated_impact: 'Prevent 40% risk increase'
        }
      ]
    }
  }

  async acknowledgeAlert(alertId: string, response: any) {
    const alertIndex = this.alerts.findIndex(a => a.alert_id === alertId)
    if (alertIndex !== -1) {
      this.alerts[alertIndex] = {
        ...this.alerts[alertIndex],
        acknowledged: true,
        acknowledged_by: response.acknowledged_by,
        acknowledged_at: response.acknowledged_at
      }

      return {
        success: true,
        updated_alert: this.alerts[alertIndex],
        follow_up_actions: [
          'Monitor risk score changes',
          'Schedule follow-up review in 48 hours',
          'Update stakeholders on mitigation progress'
        ]
      }
    }

    throw new Error('Alert not found')
  }

  async recordMitigationOutcome(outcome: RiskLearningOutcome) {
    this.learningOutcomes.push(outcome)

    return {
      learning_outcome: outcome,
      model_improvements: {
        pattern_recognition_update: true,
        strategy_effectiveness_update: true,
        prediction_accuracy_adjustment: 0.05,
        new_insights_discovered: [
          'Strategy effectiveness varies by team size',
          'Implementation timing affects success rate'
        ]
      },
      updated_recommendations: {
        strategy_refinements: [
          {
            strategy_id: 'strategy_1',
            refinement: 'Add team size consideration to implementation',
            expected_improvement: 0.08
          }
        ],
        pattern_detection_improvements: [
          'Enhanced team dynamics analysis',
          'Improved timing prediction accuracy'
        ],
        alert_threshold_adjustments: [
          {
            metric: 'code_complexity',
            old_threshold: 7.5,
            new_threshold: 7.2,
            reason: 'Recent outcomes show earlier intervention is more effective'
          }
        ]
      }
    }
  }
}

// Export singleton instance
export const mockAIRiskManagementService = MockAIRiskManagementService.getInstance()