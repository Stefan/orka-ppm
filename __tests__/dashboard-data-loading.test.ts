/**
 * Tests for optimized dashboard data loading
 * 
 * Validates:
 * - Parallel API requests
 * - Response caching
 * - Progressive data loading
 * - Request deduplication
 */

import {
  loadCriticalData,
  loadSecondaryData,
  loadDashboardData,
  clearDashboardCache,
  clearCacheEntry
} from '../lib/api/dashboard-loader'

// Mock the API client
jest.mock('../lib/api/client', () => ({
  apiRequest: jest.fn(),
  getApiUrl: jest.fn((endpoint: string) => `http://localhost:3000/api${endpoint}`)
}))

import { apiRequest } from '../lib/api/client'

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>

describe('Dashboard Data Loading', () => {
  const mockAccessToken = 'test-token-123'

  beforeEach(() => {
    jest.clearAllMocks()
    clearDashboardCache()
  })

  describe('Parallel API Requests', () => {
    it('should load critical data using optimized endpoint', async () => {
      const mockResponse = {
        quick_stats: {
          total_projects: 10,
          active_projects: 7,
          health_distribution: { green: 5, yellow: 3, red: 2 },
          critical_alerts: 2,
          at_risk_projects: 3
        },
        kpis: {
          project_success_rate: 85,
          budget_performance: 92,
          timeline_performance: 78,
          average_health_score: 2.1,
          resource_efficiency: 88,
          active_projects_ratio: 70
        }
      }

      mockApiRequest.mockResolvedValueOnce(mockResponse)

      const result = await loadCriticalData(mockAccessToken)

      expect(mockApiRequest).toHaveBeenCalledTimes(1)
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/optimized/dashboard/quick-stats',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockAccessToken}`
          })
        })
      )
      expect(result.quickStats).toEqual(mockResponse.quick_stats)
      expect(result.kpis).toEqual(mockResponse.kpis)
    })

    it('should fallback to parallel requests when optimized endpoint fails', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', status: 'active', health: 'green' as const },
        { id: '2', name: 'Project 2', status: 'active', health: 'yellow' as const }
      ]
      const mockMetrics = {
        project_success_rate: 85,
        budget_performance: 92,
        timeline_performance: 78,
        average_health_score: 2.1,
        resource_efficiency: 88,
        active_projects_ratio: 100
      }

      // First call fails (optimized endpoint)
      mockApiRequest.mockRejectedValueOnce(new Error('Optimized endpoint not available'))
      // Second call succeeds (projects)
      mockApiRequest.mockResolvedValueOnce(mockProjects)
      // Third call succeeds (metrics)
      mockApiRequest.mockResolvedValueOnce(mockMetrics)

      const result = await loadCriticalData(mockAccessToken)

      // Should have made 3 calls: 1 failed optimized, 2 successful fallback
      expect(mockApiRequest).toHaveBeenCalledTimes(3)
      expect(result.quickStats.total_projects).toBe(2)
      expect(result.quickStats.active_projects).toBe(2)
      expect(result.kpis).toEqual(mockMetrics)
    })
  })

  describe('Response Caching', () => {
    it('should cache responses and return cached data on subsequent calls', async () => {
      const mockResponse = {
        quick_stats: {
          total_projects: 10,
          active_projects: 7,
          health_distribution: { green: 5, yellow: 3, red: 2 },
          critical_alerts: 2,
          at_risk_projects: 3
        },
        kpis: {
          project_success_rate: 85,
          budget_performance: 92,
          timeline_performance: 78,
          average_health_score: 2.1,
          resource_efficiency: 88,
          active_projects_ratio: 70
        }
      }

      mockApiRequest.mockResolvedValue(mockResponse)

      // First call - should hit API
      const result1 = await loadCriticalData(mockAccessToken)
      expect(mockApiRequest).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      const result2 = await loadCriticalData(mockAccessToken)
      expect(mockApiRequest).toHaveBeenCalledTimes(1) // Still 1, not 2
      expect(result2).toEqual(result1)
    })

    it('should clear cache when clearDashboardCache is called', async () => {
      const mockResponse = {
        quick_stats: {
          total_projects: 10,
          active_projects: 7,
          health_distribution: { green: 5, yellow: 3, red: 2 },
          critical_alerts: 2,
          at_risk_projects: 3
        },
        kpis: {
          project_success_rate: 85,
          budget_performance: 92,
          timeline_performance: 78,
          average_health_score: 2.1,
          resource_efficiency: 88,
          active_projects_ratio: 70
        }
      }

      mockApiRequest.mockResolvedValue(mockResponse)

      // First call
      await loadCriticalData(mockAccessToken)
      expect(mockApiRequest).toHaveBeenCalledTimes(1)

      // Clear cache
      clearDashboardCache()

      // Second call - should hit API again
      await loadCriticalData(mockAccessToken)
      expect(mockApiRequest).toHaveBeenCalledTimes(2)
    })

    it('should clear specific cache entry', async () => {
      const mockResponse = {
        quick_stats: {
          total_projects: 10,
          active_projects: 7,
          health_distribution: { green: 5, yellow: 3, red: 2 },
          critical_alerts: 2,
          at_risk_projects: 3
        },
        kpis: {
          project_success_rate: 85,
          budget_performance: 92,
          timeline_performance: 78,
          average_health_score: 2.1,
          resource_efficiency: 88,
          active_projects_ratio: 70
        }
      }

      mockApiRequest.mockResolvedValue(mockResponse)

      // First call
      await loadCriticalData(mockAccessToken)
      expect(mockApiRequest).toHaveBeenCalledTimes(1)

      // Clear specific entry
      clearCacheEntry('dashboard:critical')

      // Second call - should hit API again
      await loadCriticalData(mockAccessToken)
      expect(mockApiRequest).toHaveBeenCalledTimes(2)
    })
  })

  describe('Progressive Data Loading', () => {
    it('should call onCriticalDataLoaded callback before loading secondary data', async () => {
      const mockCriticalResponse = {
        quick_stats: {
          total_projects: 10,
          active_projects: 7,
          health_distribution: { green: 5, yellow: 3, red: 2 },
          critical_alerts: 2,
          at_risk_projects: 3
        },
        kpis: {
          project_success_rate: 85,
          budget_performance: 92,
          timeline_performance: 78,
          average_health_score: 2.1,
          resource_efficiency: 88,
          active_projects_ratio: 70
        }
      }

      const mockProjects = [
        { id: '1', name: 'Project 1', status: 'active', health: 'green' as const, created_at: '2024-01-01' }
      ]

      mockApiRequest
        .mockResolvedValueOnce(mockCriticalResponse)
        .mockResolvedValueOnce(mockProjects)

      const onCriticalDataLoaded = jest.fn()
      const onSecondaryDataLoaded = jest.fn()

      await loadDashboardData(
        mockAccessToken,
        onCriticalDataLoaded,
        onSecondaryDataLoaded
      )

      expect(onCriticalDataLoaded).toHaveBeenCalledWith({
        quickStats: mockCriticalResponse.quick_stats,
        kpis: mockCriticalResponse.kpis
      })
      expect(onSecondaryDataLoaded).toHaveBeenCalledWith(mockProjects)
    })
  })

  describe('Request Deduplication', () => {
    it('should deduplicate simultaneous requests to the same endpoint', async () => {
      const mockResponse = {
        quick_stats: {
          total_projects: 10,
          active_projects: 7,
          health_distribution: { green: 5, yellow: 3, red: 2 },
          critical_alerts: 2,
          at_risk_projects: 3
        },
        kpis: {
          project_success_rate: 85,
          budget_performance: 92,
          timeline_performance: 78,
          average_health_score: 2.1,
          resource_efficiency: 88,
          active_projects_ratio: 70
        }
      }

      mockApiRequest.mockResolvedValue(mockResponse)

      // Make 3 simultaneous requests
      const [result1, result2, result3] = await Promise.all([
        loadCriticalData(mockAccessToken),
        loadCriticalData(mockAccessToken),
        loadCriticalData(mockAccessToken)
      ])

      // Should only make 1 API call due to deduplication
      expect(mockApiRequest).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(result2)
      expect(result2).toEqual(result3)
    })
  })

  describe('Secondary Data Loading', () => {
    it('should load projects with limit parameter', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', status: 'active', health: 'green' as const, created_at: '2024-01-01' },
        { id: '2', name: 'Project 2', status: 'active', health: 'yellow' as const, created_at: '2024-01-02' }
      ]

      mockApiRequest.mockResolvedValue(mockProjects)

      const result = await loadSecondaryData(mockAccessToken, 5)

      expect(mockApiRequest).toHaveBeenCalledWith(
        '/optimized/dashboard/projects-summary?limit=5',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockAccessToken}`
          })
        })
      )
      expect(result).toEqual(mockProjects)
    })

    it('should fallback to regular projects endpoint when optimized fails', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', status: 'active', health: 'green' as const, created_at: '2024-01-01' }
      ]

      // First call fails (optimized)
      mockApiRequest.mockRejectedValueOnce(new Error('Not found'))
      // Second call succeeds (fallback)
      mockApiRequest.mockResolvedValueOnce(mockProjects)

      const result = await loadSecondaryData(mockAccessToken, 5)

      expect(mockApiRequest).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockProjects)
    })
  })
})
