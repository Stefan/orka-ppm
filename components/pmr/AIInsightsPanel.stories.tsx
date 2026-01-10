import type { Meta, StoryObj } from '@storybook/react'
import AIInsightsPanel from './AIInsightsPanel'
import type { AIInsight } from './types'

const meta: Meta<typeof AIInsightsPanel> = {
  title: 'PMR/AIInsightsPanel',
  component: AIInsightsPanel,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// Mock insights data
const mockInsights: AIInsight[] = [
  {
    id: '1',
    type: 'prediction',
    category: 'budget',
    title: 'Budget Variance Prediction',
    content: 'Based on current spending patterns and remaining work, the project is likely to finish 5% under budget. This is due to efficient resource utilization and some scope optimizations made in the previous quarter.',
    confidence_score: 0.87,
    supporting_data: {
      current_spend: 85000,
      projected_total: 95000,
      budget: 100000,
      variance_percentage: -5,
      key_factors: ['efficient_resource_use', 'scope_optimization', 'vendor_negotiations']
    },
    predicted_impact: 'Positive impact on project profitability and potential for reinvestment in quality improvements',
    recommended_actions: [
      'Consider reallocating saved budget to quality improvements or additional testing',
      'Document cost-saving measures for application to future similar projects',
      'Communicate budget efficiency to stakeholders to build confidence'
    ],
    priority: 'medium',
    generated_at: '2024-01-15T10:30:00Z',
    validated: false,
    user_feedback: null
  },
  {
    id: '2',
    type: 'alert',
    category: 'schedule',
    title: 'Critical Path Schedule Risk',
    content: 'Analysis of current progress indicates that critical path activities are experiencing delays that could impact the final delivery date. Three key milestones are at risk.',
    confidence_score: 0.92,
    supporting_data: {
      delayed_tasks: 3,
      critical_path_impact: '2 weeks',
      affected_milestones: ['Design Review', 'Integration Testing', 'User Acceptance'],
      risk_probability: 0.78
    },
    predicted_impact: 'Potential 2-week delay in project delivery, affecting downstream projects and client commitments',
    recommended_actions: [
      'Immediately increase resources on critical path activities',
      'Consider parallel execution of dependent tasks where possible',
      'Escalate to stakeholders for priority adjustment and resource reallocation',
      'Implement daily standups for critical path activities'
    ],
    priority: 'high',
    generated_at: '2024-01-15T11:00:00Z',
    validated: true,
    validation_notes: 'Confirmed by project manager and validated against current project timeline',
    user_feedback: 'helpful'
  },
  {
    id: '3',
    type: 'recommendation',
    category: 'resource',
    title: 'Resource Optimization Opportunity',
    content: 'Current resource allocation analysis suggests that reallocating 2 senior developers from Module B to Module A could improve overall project velocity by 15%.',
    confidence_score: 0.73,
    supporting_data: {
      current_velocity: 45,
      projected_velocity: 52,
      affected_modules: ['Module A', 'Module B'],
      resource_utilization: {
        'Module A': 0.95,
        'Module B': 0.67
      }
    },
    predicted_impact: 'Improved project velocity and more balanced resource utilization across modules',
    recommended_actions: [
      'Review Module B requirements to confirm reduced resource needs',
      'Coordinate with team leads for smooth resource transition',
      'Monitor velocity metrics after reallocation'
    ],
    priority: 'medium',
    generated_at: '2024-01-15T09:15:00Z',
    validated: false,
    user_feedback: null
  },
  {
    id: '4',
    type: 'alert',
    category: 'risk',
    title: 'Third-Party Dependency Risk',
    content: 'Critical third-party API showing increased latency and error rates. This could impact system performance and user experience.',
    confidence_score: 0.89,
    supporting_data: {
      api_name: 'PaymentGateway API',
      error_rate: 0.12,
      avg_latency: 2300,
      threshold_latency: 1500,
      incidents_last_week: 3
    },
    predicted_impact: 'Potential system downtime and degraded user experience, affecting customer satisfaction',
    recommended_actions: [
      'Implement fallback payment processing mechanism',
      'Contact third-party vendor for resolution timeline',
      'Consider alternative payment gateway integration',
      'Increase monitoring and alerting for this dependency'
    ],
    priority: 'critical',
    generated_at: '2024-01-15T14:20:00Z',
    validated: true,
    validation_notes: 'Confirmed by DevOps team - multiple incidents logged',
    user_feedback: 'helpful'
  },
  {
    id: '5',
    type: 'summary',
    category: 'quality',
    title: 'Code Quality Metrics Summary',
    content: 'Overall code quality has improved by 23% this month. Test coverage increased to 87%, and technical debt decreased by 15%.',
    confidence_score: 0.95,
    supporting_data: {
      test_coverage: 0.87,
      previous_coverage: 0.82,
      technical_debt_hours: 120,
      previous_debt_hours: 141,
      code_quality_score: 8.7,
      previous_quality_score: 7.1
    },
    predicted_impact: 'Reduced maintenance costs and improved system reliability',
    recommended_actions: [
      'Continue current quality improvement initiatives',
      'Share best practices with other teams',
      'Set target for 90% test coverage next month'
    ],
    priority: 'low',
    generated_at: '2024-01-15T16:45:00Z',
    validated: true,
    validation_notes: 'Metrics validated against automated quality tools',
    user_feedback: 'helpful'
  }
]

// Default story
export const Default: Story = {
  args: {
    reportId: 'report-123',
    insights: mockInsights,
    onInsightValidate: (insightId: string, isValid: boolean, notes?: string) => {
      console.log('Validate insight:', insightId, isValid, notes)
    },
    onInsightApply: (insightId: string) => {
      console.log('Apply insight:', insightId)
    },
    onGenerateInsights: (categories?: string[]) => {
      console.log('Generate insights for categories:', categories)
    },
    onInsightFeedback: (insightId: string, feedback: 'helpful' | 'not_helpful') => {
      console.log('Insight feedback:', insightId, feedback)
    },
    isLoading: false,
  },
}

// Loading state
export const Loading: Story = {
  args: {
    ...Default.args,
    isLoading: true,
  },
}

// Empty state
export const Empty: Story = {
  args: {
    ...Default.args,
    insights: [],
  },
}

// Single category
export const BudgetInsightsOnly: Story = {
  args: {
    ...Default.args,
    insights: mockInsights.filter(insight => insight.category === 'budget'),
  },
}

// High priority insights only
export const HighPriorityOnly: Story = {
  args: {
    ...Default.args,
    insights: mockInsights.filter(insight => insight.priority === 'high' || insight.priority === 'critical'),
  },
}

// All validated insights
export const ValidatedInsights: Story = {
  args: {
    ...Default.args,
    insights: mockInsights.filter(insight => insight.validated),
  },
}

// Compact view (for smaller screens)
export const Compact: Story = {
  args: {
    ...Default.args,
    className: 'w-80',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}