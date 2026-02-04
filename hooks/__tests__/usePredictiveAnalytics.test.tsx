/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePredictiveAnalytics } from '../usePredictiveAnalytics'

const mockGenerateCapacityPredictions = jest.fn()
const mockIdentifyPerformancePatterns = jest.fn()
const mockGetLearningInsights = jest.fn()
const mockGetDashboardData = jest.fn()
const mockRecordOptimizationOutcome = jest.fn()

jest.mock('../../lib/ai/predictive-analytics', () => ({
  predictiveAnalyticsEngine: {
    generateCapacityPredictions: (...args: unknown[]) => mockGenerateCapacityPredictions(...args),
    identifyPerformancePatterns: (...args: unknown[]) => mockIdentifyPerformancePatterns(...args),
    getLearningInsights: (...args: unknown[]) => mockGetLearningInsights(...args),
    getDashboardData: (...args: unknown[]) => mockGetDashboardData(...args),
    recordOptimizationOutcome: (...args: unknown[]) => mockRecordOptimizationOutcome(...args),
  },
  generateCapacityRecommendations: jest.fn(() => []),
}))

describe('usePredictiveAnalytics', () => {
  beforeEach(() => {
    mockGenerateCapacityPredictions.mockResolvedValue({ predictions: [] })
    mockIdentifyPerformancePatterns.mockResolvedValue({ patterns: [] })
    mockGetLearningInsights.mockResolvedValue(null)
    mockGetDashboardData.mockResolvedValue(null)
    mockRecordOptimizationOutcome.mockResolvedValue({})
  })

  it('returns expected state and action shape', () => {
    const { result } = renderHook(() => usePredictiveAnalytics({}))

    expect(result.current.capacityPredictions).toEqual([])
    expect(result.current.performancePatterns).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.hasData).toBe(false)
    expect(typeof result.current.generateCapacityPredictions).toBe('function')
    expect(typeof result.current.identifyPerformancePatterns).toBe('function')
    expect(typeof result.current.getLearningInsights).toBe('function')
    expect(typeof result.current.getDashboardData).toBe('function')
    expect(typeof result.current.loadAllData).toBe('function')
    expect(typeof result.current.refresh).toBe('function')
    expect(typeof result.current.clearError).toBe('function')
    expect(result.current.capacityRecommendations).toEqual([])
    expect(Array.isArray(result.current.criticalAlerts)).toBe(true)
    expect(Array.isArray(result.current.performanceInsights)).toBe(true)
  })

  it('clearError sets error to null', async () => {
    mockGenerateCapacityPredictions.mockRejectedValueOnce(new Error('API error'))

    const { result } = renderHook(() => usePredictiveAnalytics({}))

    await act(async () => {
      try {
        await result.current.generateCapacityPredictions()
      } catch {
        // expected
      }
    })
    expect(result.current.error).toBe('API error')

    act(() => {
      result.current.clearError()
    })
    expect(result.current.error).toBeNull()
  })

  it('generateCapacityPredictions updates state on success', async () => {
    const predictions = [
      {
        prediction_id: 'p1',
        resource_id: 'r1',
        resource_name: 'Resource 1',
        prediction_horizon: '3_months' as const,
        predicted_utilization: { optimistic: 80, realistic: 70, pessimistic: 60, confidence_interval: [60, 80] },
        predicted_capacity: { available_hours: 100, billable_hours: 80, development_hours: 60, buffer_hours: 20 },
        demand_forecast: { expected_project_count: 2, skill_demand: {}, peak_periods: [] },
        confidence_score: 0.85,
        prediction_accuracy_history: 0.8,
        data_quality_score: 0.9,
        model_version: '1.0',
        capacity_gaps: [],
        optimization_opportunities: [],
      },
    ]
    mockGenerateCapacityPredictions.mockResolvedValueOnce({ predictions })

    const { result } = renderHook(() => usePredictiveAnalytics({}))

    await act(async () => {
      await result.current.generateCapacityPredictions()
    })

    await waitFor(() => {
      expect(result.current.capacityPredictions).toHaveLength(1)
      expect(result.current.capacityPredictions[0].prediction_id).toBe('p1')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.hasData).toBe(true)
    })
  })

  it('generateCapacityPredictions sets error on failure', async () => {
    mockGenerateCapacityPredictions.mockRejectedValueOnce(new Error('Backend unavailable'))

    const { result } = renderHook(() => usePredictiveAnalytics({}))

    await act(async () => {
      try {
        await result.current.generateCapacityPredictions()
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(result.current.error).toBe('Backend unavailable')
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('getCapacityRecommendations returns empty when no predictions', () => {
    const { result } = renderHook(() => usePredictiveAnalytics({}))
    expect(result.current.capacityRecommendations).toEqual([])
  })
})
