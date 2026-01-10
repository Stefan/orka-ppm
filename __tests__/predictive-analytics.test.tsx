/**
 * Tests for Predictive Analytics System
 * Requirements: 6.4, 6.5
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { 
  PredictiveAnalyticsEngine,
  calculateCapacityUtilization,
  assessCapacityRisk,
  generateCapacityRecommendations,
  type CapacityPrediction
} from '../lib/ai/predictive-analytics'
import PredictiveAnalyticsDashboard from '../components/ai/PredictiveAnalyticsDashboard'
import PredictiveInsightsWidget from '../components/ai/PredictiveInsightsWidget'

// Mock the API
jest.mock('../lib/api', () => ({
  getApiUrl: jest.fn((path: string) => `http://localhost:3001${path}`)
}))

// Mock fetch
global.fetch = jest.fn()

describe('Predictive Analytics Engine', () => {
  let engine: PredictiveAnalyticsEngine
  
  beforeEach(() => {
    engine = new PredictiveAnalyticsEngine('test-token')
    jest.clearAllMocks()
  })

  describe('Capacity Predictions', () => {
    it('should generate capacity predictions with confidence scores', async () => {
      const mockResponse = {
        predictions: [
          {
            id: 'pred_1',
            resource_id: 'res_1',
            resource_name: 'John Doe',
            horizon: '3_months',
            predicted_utilization: 85,
            confidence: 0.82,
            capacity: {
              available: 160,
              billable: 136
            }
          }
        ],
        aggregate_insights: {
          total_capacity_trend: 'increasing',
          critical_skill_gaps: ['React', 'Python']
        }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await engine.generateCapacityPredictions({
        prediction_horizons: ['3_months'],
        include_skill_breakdown: true
      })

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/ai/predictive-analytics/capacity-predictions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          })
        })
      )

      expect(result.predictions).toHaveLength(1)
      expect(result.predictions[0].resource_name).toBe('John Doe')
      expect(result.predictions[0].confidence_score).toBe(0.82)
      expect(result.predictions[0].predicted_utilization.realistic).toBe(85)
    })

    it('should handle prediction errors gracefully', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(engine.generateCapacityPredictions()).rejects.toThrow(
        'Failed to generate capacity predictions'
      )
    })
  })

  describe('Performance Patterns', () => {
    it('should identify performance patterns', async () => {
      const mockResponse = {
        patterns: [
          {
            pattern_id: 'pattern_1',
            pattern_type: 'seasonal',
            pattern_name: 'Q4 Capacity Surge',
            description: 'Increased capacity demand in Q4',
            strength: 0.85,
            significance: 0.9,
            next_occurrence: {
              predicted_date: '2024-10-01',
              confidence: 0.8
            }
          }
        ],
        pattern_summary: {
          total_patterns_found: 1,
          high_impact_patterns: 1
        }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await engine.identifyPerformancePatterns({
        analysis_period_months: 12,
        include_predictions: true
      })

      expect(result.patterns).toHaveLength(1)
      expect(result.patterns[0].pattern_name).toBe('Q4 Capacity Surge')
      expect(result.patterns[0].strength).toBe(0.85)
    })
  })

  describe('Learning Outcomes', () => {
    it('should record optimization outcomes for learning', async () => {
      const mockResponse = {
        learning_outcome: {
          outcome_id: 'outcome_1',
          optimization_id: 'opt_123',
          improvement_percentage: 15.5,
          prediction_accuracy: 0.88
        },
        model_updates: {
          accuracy_improvement: 0.02,
          new_patterns_discovered: ['workload_balancing_pattern']
        }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const outcome = {
        implementation_date: '2024-01-15',
        measurement_period_days: 30,
        actual_results: {
          utilization_change: 15.5,
          productivity_change: 8.2,
          quality_change: 5.1,
          cost_impact: -1200,
          user_satisfaction: 4.2
        },
        implementation_challenges: ['Initial resistance to change'],
        success_factors: ['Clear communication', 'Gradual rollout'],
        lessons_learned: ['Need better change management'],
        would_recommend: true,
        confidence_in_measurement: 0.9
      }

      const result = await engine.recordOptimizationOutcome('opt_123', outcome)

      expect(result.learning_outcome.improvement_percentage).toBe(15.5)
      expect(result.model_updates.accuracy_improvement).toBe(0.02)
    })
  })
})

describe('Utility Functions', () => {
  describe('calculateCapacityUtilization', () => {
    it('should calculate utilization percentage correctly', () => {
      expect(calculateCapacityUtilization(160, 120)).toBe(75)
      expect(calculateCapacityUtilization(160, 160)).toBe(100)
      expect(calculateCapacityUtilization(0, 120)).toBe(0)
    })
  })

  describe('assessCapacityRisk', () => {
    it('should assess risk levels correctly', () => {
      expect(assessCapacityRisk(98, 'increasing')).toBe('critical')
      expect(assessCapacityRisk(88, 'increasing')).toBe('high')
      expect(assessCapacityRisk(88, 'stable')).toBe('medium')
      expect(assessCapacityRisk(70, 'decreasing')).toBe('low')
    })
  })

  describe('generateCapacityRecommendations', () => {
    it('should generate appropriate recommendations', () => {
      const mockPredictions: CapacityPrediction[] = [
        {
          prediction_id: 'pred_1',
          resource_id: 'res_1',
          resource_name: 'John Doe',
          prediction_horizon: '3_months',
          predicted_utilization: {
            optimistic: 90,
            realistic: 85,
            pessimistic: 80,
            confidence_interval: [80, 90]
          },
          predicted_capacity: {
            available_hours: 160,
            billable_hours: 136,
            development_hours: 16,
            buffer_hours: 8
          },
          demand_forecast: {
            expected_project_count: 3,
            skill_demand: { 'React': 40, 'Python': 30 },
            peak_periods: []
          },
          confidence_score: 0.85,
          prediction_accuracy_history: 0.8,
          data_quality_score: 0.9,
          model_version: '1.0.0',
          capacity_gaps: [
            {
              skill: 'React',
              gap_hours: 20,
              severity: 'critical',
              recommended_action: 'Hire React developer'
            }
          ],
          optimization_opportunities: [
            {
              type: 'skill_development',
              description: 'Cross-train team in React',
              potential_improvement: 15,
              implementation_effort: 'medium'
            }
          ],
          risk_factors: [],
          generated_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-08T00:00:00Z',
          last_updated: '2024-01-01T00:00:00Z'
        }
      ]

      const recommendations = generateCapacityRecommendations(mockPredictions)

      expect(recommendations).toHaveLength(2)
      expect(recommendations[0].type).toBe('hiring')
      expect(recommendations[0].priority).toBe(1)
      expect(recommendations[1].type).toBe('training')
    })
  })
})

describe('PredictiveAnalyticsDashboard Component', () => {
  beforeEach(() => {
    // Mock successful API responses
    ;(fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            capacity_overview: {
              current_utilization: 78.5,
              predicted_utilization_next_month: 82.3,
              capacity_trend: 'increasing',
              critical_alerts: [
                {
                  type: 'capacity_shortage',
                  severity: 'high',
                  message: 'Potential capacity shortage in Q2',
                  recommended_action: 'Consider hiring additional resources'
                }
              ]
            },
            performance_patterns: {
              active_patterns: 3,
              high_impact_patterns: 1,
              next_predicted_event: {
                pattern_name: 'Q4 Capacity Surge',
                predicted_date: '2024-10-01',
                confidence: 0.85,
                preparation_time: '6 weeks'
              }
            },
            learning_metrics: {
              model_accuracy: 0.87,
              recent_optimizations: 12,
              success_rate: 0.73,
              improvement_trend: 'improving'
            },
            recommendations: [
              {
                type: 'capacity',
                priority: 1,
                title: 'Capacity Planning',
                description: 'Plan for Q4 capacity increase',
                action_required: true,
                estimated_impact: '15% efficiency improvement'
              }
            ]
          })
        })
      }
      
      if (url.includes('/capacity-predictions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            predictions: [],
            aggregate_insights: {},
            model_performance: {}
          })
        })
      }
      
      if (url.includes('/performance-patterns')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            patterns: [],
            pattern_summary: {},
            optimization_recommendations: []
          })
        })
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      })
    })
  })

  it('should render dashboard with key metrics', async () => {
    await act(async () => {
      render(<PredictiveAnalyticsDashboard />)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Predictive Analytics')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Check for key metrics
    await waitFor(() => {
      expect(screen.getByText('78.5%')).toBeInTheDocument() // Current utilization
    })
    expect(screen.getByText('82.3%')).toBeInTheDocument() // Predicted utilization
    expect(screen.getByText('87.0%')).toBeInTheDocument() // Model accuracy
  })

  it('should display critical alerts', async () => {
    await act(async () => {
      render(<PredictiveAnalyticsDashboard />)
    })

    await waitFor(() => {
      expect(screen.getByText('Critical Alerts')).toBeInTheDocument()
    })

    expect(screen.getByText('Potential capacity shortage in Q2')).toBeInTheDocument()
    expect(screen.getByText('Consider hiring additional resources')).toBeInTheDocument()
  })

  it('should show AI recommendations', async () => {
    await act(async () => {
      render(<PredictiveAnalyticsDashboard />)
    })

    await waitFor(() => {
      expect(screen.getByText('AI Recommendations')).toBeInTheDocument()
    })

    expect(screen.getByText('Capacity Planning')).toBeInTheDocument()
    expect(screen.getByText('Plan for Q4 capacity increase')).toBeInTheDocument()
  })

  it('should handle time horizon changes', async () => {
    await act(async () => {
      render(<PredictiveAnalyticsDashboard />)
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('3 Months')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('3 Months')
    
    await act(async () => {
      fireEvent.change(select, { target: { value: '6_months' } })
    })

    expect(select).toHaveValue('6_months')
  })
})

// Mock the hook before importing components
jest.mock('../hooks/usePredictiveAnalytics')

describe('PredictiveInsightsWidget Component', () => {
  const mockUsePredictiveAnalytics = require('../hooks/usePredictiveAnalytics').usePredictiveAnalytics as jest.Mock

  beforeEach(() => {
    mockUsePredictiveAnalytics.mockReturnValue({
      dashboardData: {
        capacity_overview: {
          current_utilization: 75.2,
          predicted_utilization_next_month: 78.8,
          capacity_trend: 'increasing'
        },
        learning_metrics: {
          model_accuracy: 0.84
        },
        performance_patterns: {
          active_patterns: 2,
          high_impact_patterns: 1
        }
      },
      criticalAlerts: [
        {
          type: 'capacity_shortage',
          severity: 'high',
          message: 'High utilization predicted for next month'
        }
      ],
      performanceInsights: [
        {
          type: 'utilization',
          level: 'info',
          message: 'Utilization trending upward'
        }
      ],
      isLoading: false,
      error: null,
      loadAllData: jest.fn()
    })
  })

  it('should render widget with key insights', () => {
    render(<PredictiveInsightsWidget />)

    expect(screen.getByText('AI Insights')).toBeInTheDocument()
    expect(screen.getByText('75.2%')).toBeInTheDocument() // Current utilization
    expect(screen.getByText('78.8%')).toBeInTheDocument() // Predicted utilization
  })

  it('should expand to show additional details', () => {
    render(<PredictiveInsightsWidget />)

    const expandButton = screen.getByRole('button')
    fireEvent.click(expandButton)

    expect(screen.getByText('Model Accuracy')).toBeInTheDocument()
    expect(screen.getByText('84.0%')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    mockUsePredictiveAnalytics.mockReturnValue({
      dashboardData: null,
      isLoading: true,
      error: null,
      loadAllData: jest.fn()
    })

    render(<PredictiveInsightsWidget />)
    
    // Check for loading animation class instead of test id
    expect(screen.getByText('AI Insights')).toBeInTheDocument()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})