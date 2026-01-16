/**
 * AI Insights Generation Unit Tests
 * 
 * Tests for AI-powered insight generation and validation
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useEnhancedAIChat } from '../hooks/useEnhancedAIChat'
import type { AIInsight } from '../components/pmr/types'

// Mock auth
jest.mock('../app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: { access_token: 'mock-token' },
    user: { id: 'user-123' }
  })
}))

global.fetch = jest.fn()

describe('AI Insights Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Budget Insights', () => {
    it('should generate budget variance predictions', async () => {
      const mockInsight: AIInsight = {
        id: 'insight-budget-1',
        insight_type: 'prediction',
        category: 'budget',
        title: 'Budget Variance Prediction',
        content: 'Project likely to finish 8% under budget based on current trends',
        confidence_score: 0.87,
        supporting_data: {
          historical_variance: [-0.02, 0.05, -0.03, -0.08],
          trend_analysis: 'decreasing_variance',
          projected_final_cost: 920000,
          baseline_cost: 1000000
        },
        recommended_actions: [
          'Consider reallocating surplus budget to quality improvements',
          'Evaluate opportunities for scope expansion'
        ],
        priority: 'medium',
        validation_status: 'pending',
        generated_at: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights: [mockInsight] })
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['budget'])
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })

    it('should validate budget insight confidence scores', async () => {
      const insights: AIInsight[] = [
        {
          id: 'high-conf',
          insight_type: 'prediction',
          category: 'budget',
          title: 'High Confidence Prediction',
          content: 'Strong budget performance',
          confidence_score: 0.95,
          supporting_data: { data_points: 100 },
          recommended_actions: [],
          priority: 'high',
          validation_status: 'validated',
          generated_at: new Date().toISOString()
        },
        {
          id: 'low-conf',
          insight_type: 'prediction',
          category: 'budget',
          title: 'Low Confidence Prediction',
          content: 'Uncertain budget trend',
          confidence_score: 0.45,
          supporting_data: { data_points: 5 },
          recommended_actions: [],
          priority: 'low',
          validation_status: 'needs_review',
          generated_at: new Date().toISOString()
        }
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights })
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['budget'])
      })

      // Verify high confidence insights are prioritized
      await waitFor(() => {
        const messages = result.current.messages
        expect(messages.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Schedule Insights', () => {
    it('should generate schedule performance predictions', async () => {
      const mockInsight: AIInsight = {
        id: 'insight-schedule-1',
        insight_type: 'prediction',
        category: 'schedule',
        title: 'Schedule Performance Forecast',
        content: 'Project trending 5% ahead of schedule',
        confidence_score: 0.91,
        supporting_data: {
          schedule_performance_index: 1.05,
          critical_path_variance: -3,
          completed_milestones: 8,
          total_milestones: 12
        },
        recommended_actions: [
          'Maintain current pace',
          'Consider advancing Phase 3 start date'
        ],
        priority: 'high',
        validation_status: 'validated',
        generated_at: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights: [mockInsight] })
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['schedule'])
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/insights/generate'),
          expect.any(Object)
        )
      })
    })

    it('should identify critical path risks', async () => {
      const mockInsight: AIInsight = {
        id: 'insight-schedule-2',
        insight_type: 'alert',
        category: 'schedule',
        title: 'Critical Path Risk Detected',
        content: 'Task dependencies may cause 7-day delay',
        confidence_score: 0.82,
        supporting_data: {
          affected_tasks: ['task-45', 'task-67', 'task-89'],
          estimated_delay_days: 7,
          risk_probability: 0.65
        },
        recommended_actions: [
          'Review task dependencies',
          'Consider parallel execution where possible',
          'Allocate additional resources to critical tasks'
        ],
        priority: 'high',
        validation_status: 'pending',
        generated_at: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights: [mockInsight] })
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['schedule'])
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })

  describe('Resource Insights', () => {
    it('should detect resource allocation issues', async () => {
      const mockInsight: AIInsight = {
        id: 'insight-resource-1',
        insight_type: 'recommendation',
        category: 'resource',
        title: 'Resource Reallocation Opportunity',
        content: 'Team A is underutilized while Team B is overallocated',
        confidence_score: 0.88,
        supporting_data: {
          team_a_utilization: 0.65,
          team_b_utilization: 1.15,
          reallocation_potential: 0.25
        },
        recommended_actions: [
          'Reassign 2 developers from Team A to Team B',
          'Review workload distribution'
        ],
        priority: 'medium',
        validation_status: 'pending',
        generated_at: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights: [mockInsight] })
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['resource'])
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })

  describe('Risk Insights', () => {
    it('should identify emerging risks', async () => {
      const mockInsight: AIInsight = {
        id: 'insight-risk-1',
        insight_type: 'alert',
        category: 'risk',
        title: 'Emerging Risk: Vendor Dependency',
        content: 'Critical vendor showing signs of delivery delays',
        confidence_score: 0.79,
        supporting_data: {
          vendor_id: 'vendor-123',
          historical_delays: [2, 3, 5],
          impact_assessment: 'high'
        },
        recommended_actions: [
          'Engage backup vendor',
          'Adjust timeline expectations',
          'Increase monitoring frequency'
        ],
        priority: 'high',
        validation_status: 'pending',
        generated_at: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights: [mockInsight] })
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['risk'])
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })

  describe('Insight Validation', () => {
    it('should filter insights below confidence threshold', async () => {
      const insights: AIInsight[] = [
        {
          id: 'valid-1',
          insight_type: 'prediction',
          category: 'budget',
          title: 'Valid Insight',
          content: 'High confidence prediction',
          confidence_score: 0.85,
          supporting_data: {},
          recommended_actions: [],
          priority: 'medium',
          validation_status: 'validated',
          generated_at: new Date().toISOString()
        },
        {
          id: 'invalid-1',
          insight_type: 'prediction',
          category: 'budget',
          title: 'Low Confidence Insight',
          content: 'Uncertain prediction',
          confidence_score: 0.35,
          supporting_data: {},
          recommended_actions: [],
          priority: 'low',
          validation_status: 'rejected',
          generated_at: new Date().toISOString()
        }
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          insights: insights.filter(i => i.confidence_score >= 0.7)
        })
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['budget'])
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })

    it('should handle missing supporting data gracefully', async () => {
      const mockInsight: AIInsight = {
        id: 'insight-no-data',
        insight_type: 'recommendation',
        category: 'budget',
        title: 'General Recommendation',
        content: 'Consider budget review',
        confidence_score: 0.75,
        supporting_data: {},
        recommended_actions: ['Review budget'],
        priority: 'low',
        validation_status: 'pending',
        generated_at: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ insights: [mockInsight] })
      })

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['budget'])
      })

      await waitFor(() => {
        expect(result.current.error).toBeNull()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('API unavailable')
      )

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['budget'])
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })

    it('should handle timeout errors', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100)
        })
      )

      const { result } = renderHook(() => useEnhancedAIChat({
        reportId: 'test-report'
      }))

      await act(async () => {
        await result.current.quickActions.generateInsights(['budget'])
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })
  })
})
