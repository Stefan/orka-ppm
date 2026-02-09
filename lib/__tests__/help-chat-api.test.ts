/**
 * Help Chat API Service Tests
 * Tests for the comprehensive API integration service
 */

import { HelpChatAPIService, helpChatAPI, createHelpChatError, isRetryableError, HELP_CHAT_CONFIG } from '../help-chat/api'
import type {
  HelpQueryRequest,
  HelpQueryResponse,
  HelpFeedbackRequest,
  FeedbackResponse,
  HelpContextResponse,
  ProactiveTipsResponse
} from '../../types/help-chat'
import * as libApi from '../api'

// Mock fetch globally
global.fetch = jest.fn()

// Mock apiRequest for methods that use lib/api (languages, language preference, translate, etc.)
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  apiRequest: jest.fn()
}))

describe('HelpChatAPIService', () => {
  let apiService: HelpChatAPIService
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    apiService = new HelpChatAPIService()
    mockFetch.mockReset()
    apiService.clearLocalCache()
    apiService.resetRateLimits()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('Authentication', () => {
    it('should set and use auth token in headers', async () => {
      const token = 'test-token-123'
      apiService.setAuthToken(token)

      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test Page',
          userRole: 'user'
        },
        language: 'en'
      }

      const mockResponse: HelpQueryResponse = {
        response: 'Test response',
        sessionId: 'session-123',
        sources: [],
        confidence: 0.9,
        responseTimeMs: 100
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers()
      } as Response)

      await apiService.submitQuery(mockRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${token}`
          })
        })
      )
    })

    it('should work without auth token', async () => {
      apiService.setAuthToken(null)

      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test Page',
          userRole: 'user'
        },
        language: 'en'
      }

      const mockResponse: HelpQueryResponse = {
        response: 'Test response',
        sessionId: 'session-123',
        sources: [],
        confidence: 0.9,
        responseTimeMs: 100
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers()
      } as Response)

      await apiService.submitQuery(mockRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String)
          })
        })
      )
    })
  })

  describe('Query Submission', () => {
    it('should submit query successfully', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'How do I create a project?',
        context: {
          route: '/projects',
          pageTitle: 'Projects',
          userRole: 'user'
        },
        language: 'en',
        sessionId: 'session-123'
      }

      const mockResponse: HelpQueryResponse = {
        response: 'To create a project, click the "New Project" button...',
        sessionId: 'session-123',
        sources: [
          {
            id: 'source-1',
            title: 'Project Creation Guide',
            type: 'guide',
            relevance: 0.9
          }
        ],
        confidence: 0.95,
        responseTimeMs: 150,
        suggestedActions: [
          {
            id: 'action-1',
            label: 'Create New Project',
            action: () => {},
            variant: 'primary'
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers()
      } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result).toEqual(expect.objectContaining({
        response: mockResponse.response,
        sessionId: mockResponse.sessionId,
        sources: mockResponse.sources,
        confidence: mockResponse.confidence,
        responseTimeMs: expect.any(Number)
      }))

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/help/query'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(mockRequest)
        })
      )
    })

    it('should validate empty query', async () => {
      const mockRequest: HelpQueryRequest = {
        query: '',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      await expect(apiService.submitQuery(mockRequest)).rejects.toThrow('Query cannot be empty')
    })

    it('should validate missing context', async () => {
      const mockRequest = {
        query: 'test query',
        language: 'en'
      } as HelpQueryRequest

      await expect(apiService.submitQuery(mockRequest)).rejects.toThrow('Context is required')
    })

    it('should handle network errors with retry', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: 'Success after retry',
            sessionId: 'session-123',
            sources: [],
            confidence: 0.8,
            responseTimeMs: 200
          }),
          headers: new Headers()
        } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result.response).toBe('Success after retry')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle rate limit errors', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      // Mock all retry attempts to return 429
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers()
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers()
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers()
        } as Response)

      await expect(apiService.submitQuery(mockRequest)).rejects.toThrow('failed after 3 attempts')
    })
  })

  describe('Caching', () => {
    it('should cache successful responses', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'cached query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      const mockResponse: HelpQueryResponse = {
        response: 'Cached response',
        sessionId: 'session-123',
        sources: [],
        confidence: 0.8,
        responseTimeMs: 100
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers()
      } as Response)

      // First call
      const result1 = await apiService.submitQuery(mockRequest)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const result2 = await apiService.submitQuery(mockRequest)
      expect(mockFetch).toHaveBeenCalledTimes(1) // No additional call
      expect(result2).toEqual(result1)
    })

    it('should provide cache statistics', () => {
      const stats = apiService.getCacheStats()
      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('maxSize')
      expect(typeof stats.size).toBe('number')
      expect(typeof stats.maxSize).toBe('number')
    })

    it('should clear cache', async () => {
      // Add something to cache first
      const mockRequest: HelpQueryRequest = {
        query: 'test',
        context: { route: '/test', pageTitle: 'Test', userRole: 'user' },
        language: 'en'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'test', sessionId: 'test', sources: [], confidence: 0.8, responseTimeMs: 100 }),
        headers: new Headers()
      } as Response)

      await apiService.submitQuery(mockRequest)
      expect(apiService.getCacheStats().size).toBeGreaterThan(0)

      apiService.clearLocalCache()
      expect(apiService.getCacheStats().size).toBe(0)
    })
  })

  describe('Rate Limiting', () => {
    it('should track rate limit status', () => {
      const status = apiService.getRateLimitStatus()
      
      expect(status).toHaveProperty('minute')
      expect(status).toHaveProperty('hour')
      expect(status.minute).toHaveProperty('remaining')
      expect(status.minute).toHaveProperty('resetTime')
      expect(status.hour).toHaveProperty('remaining')
      expect(status.hour).toHaveProperty('resetTime')
    })

    it('should enforce rate limits', async () => {
      // Create a new service with very low rate limits for testing
      const testService = new HelpChatAPIService()
      
      // Mock the rate limiter to always return false
      const originalCheckRateLimit = (testService as any).checkRateLimit
      ;(testService as any).checkRateLimit = jest.fn(() => {
        throw createHelpChatError('Rate limit exceeded', 'RATE_LIMIT_ERROR')
      })

      const mockRequest: HelpQueryRequest = {
        query: 'test',
        context: { route: '/test', pageTitle: 'Test', userRole: 'user' },
        language: 'en'
      }

      await expect(testService.submitQuery(mockRequest)).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('Feedback Submission', () => {
    it('should submit feedback successfully', async () => {
      const mockFeedback: HelpFeedbackRequest = {
        messageId: 'msg-123',
        rating: 5,
        feedbackText: 'Very helpful!',
        feedbackType: 'helpful'
      }

      const mockResponse: FeedbackResponse = {
        success: true,
        message: 'Feedback submitted successfully',
        trackingId: 'feedback-123'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers()
      } as Response)

      const result = await apiService.submitFeedback(mockFeedback)

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/help/feedback'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            message_id: mockFeedback.messageId,
            query_id: undefined,
            rating: mockFeedback.rating,
            feedback_text: mockFeedback.feedbackText,
            feedback_type: mockFeedback.feedbackType
          })
        })
      )
    })

    it('should submit feedback with queryId only (help_query_feedback)', async () => {
      const mockFeedback: HelpFeedbackRequest = {
        queryId: 'query-uuid-123',
        rating: 4,
        feedbackType: 'helpful'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Feedback submitted successfully' }),
        headers: new Headers()
      } as Response)

      await apiService.submitFeedback(mockFeedback)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/help/feedback'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"query_id":"query-uuid-123"')
        })
      )
    })

    it('should validate feedback data', async () => {
      const invalidFeedback = {
        messageId: '',
        rating: 6,
        feedbackType: 'helpful'
      } as HelpFeedbackRequest

      await expect(apiService.submitFeedback(invalidFeedback)).rejects.toThrow('Message ID or query ID is required')

      const invalidRating = {
        messageId: 'msg-123',
        rating: 6,
        feedbackType: 'helpful'
      } as HelpFeedbackRequest

      await expect(apiService.submitFeedback(invalidRating)).rejects.toThrow('Rating must be between 1 and 5')
    })
  })

  describe('Context Retrieval', () => {
    it('should get help context successfully', async () => {
      const mockContext: HelpContextResponse = {
        context: {
          route: '/projects',
          pageTitle: 'Projects',
          userRole: 'user'
        },
        availableActions: [
          {
            id: 'create-project',
            label: 'Create Project',
            action: () => {}
          }
        ],
        relevantTips: []
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockContext,
        headers: new Headers()
      } as Response)

      const result = await apiService.getHelpContext('/projects')

      expect(result).toEqual(mockContext)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/help/context?page_route=%2Fprojects'),
        expect.objectContaining({
          method: 'GET'
        })
      )
    })
  })

  describe('Proactive Tips', () => {
    it('should get proactive tips successfully', async () => {
      const mockTips: ProactiveTipsResponse = {
        tips: [
          {
            id: 'tip-1',
            type: 'feature_discovery',
            title: 'Try the new dashboard',
            content: 'Check out the updated dashboard features',
            priority: 'medium',
            triggerContext: ['/dashboard'],
            dismissible: true,
            showOnce: false,
            isRead: false
          }
        ],
        context: {
          route: '/dashboard',
          pageTitle: 'Dashboard',
          userRole: 'user'
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTips,
        headers: new Headers()
      } as Response)

      const result = await apiService.getProactiveTips('/dashboard')

      expect(result).toEqual(mockTips)
      
      // Validate the URL format matches backend expectations
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/help/tips?page_route=%2Fdashboard'),
        expect.objectContaining({
          method: 'GET'
        })
      )
      
      // Verify the URL structure
      const callUrl = mockFetch.mock.calls[0][0] as string
      const url = new URL(callUrl, 'http://test.com')
      expect(url.searchParams.has('page_route')).toBe(true)
      expect(url.searchParams.get('page_route')).toBe('/dashboard')
    })

    it('should handle complex query parameters', async () => {
      const mockTips: ProactiveTipsResponse = {
        tips: [],
        context: {
          route: '/projects',
          pageTitle: 'Projects',
          userRole: 'user'
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTips,
        headers: new Headers()
      } as Response)

      // Test with query string (like HelpChatProvider uses)
      const queryString = 'page_route=/projects&page_title=Projects&user_role=user'
      const result = await apiService.getProactiveTips(queryString)

      expect(result).toEqual(mockTips)
      
      // Verify all parameters are present
      const callUrl = mockFetch.mock.calls[0][0] as string
      const url = new URL(callUrl, 'http://test.com')
      expect(url.searchParams.get('page_route')).toBe('/projects')
      expect(url.searchParams.get('page_title')).toBe('Projects')
      expect(url.searchParams.get('user_role')).toBe('user')
    })

    it('should handle object parameters', async () => {
      const mockTips: ProactiveTipsResponse = {
        tips: [],
        context: {
          route: '/dashboard',
          pageTitle: 'Dashboard',
          userRole: 'admin'
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTips,
        headers: new Headers()
      } as Response)

      // Test with object (alternative usage)
      const params = {
        page_route: '/dashboard',
        page_title: 'Dashboard',
        user_role: 'admin',
        current_project: 'project-123'
      }
      const result = await apiService.getProactiveTips(params)

      expect(result).toEqual(mockTips)
      
      // Verify all parameters are present
      const callUrl = mockFetch.mock.calls[0][0] as string
      const url = new URL(callUrl, 'http://test.com')
      expect(url.searchParams.get('page_route')).toBe('/dashboard')
      expect(url.searchParams.get('page_title')).toBe('Dashboard')
      expect(url.searchParams.get('user_role')).toBe('admin')
      expect(url.searchParams.get('current_project')).toBe('project-123')
    })
  })

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Health check OK',
          sessionId: 'health-session',
          sources: [],
          confidence: 1.0,
          responseTimeMs: 50
        }),
        headers: new Headers()
      } as Response)

      const result = await apiService.healthCheck()

      expect(result.status).toBe('healthy')
      expect(result.details).toHaveProperty('responseTime')
      expect(result.details).toHaveProperty('cache')
      expect(result.details).toHaveProperty('rateLimits')
      expect(result.details).toHaveProperty('timestamp')
    })

    it('should report unhealthy status on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Service unavailable'))

      const result = await apiService.healthCheck()

      expect(result.status).toBe('unhealthy')
      expect(result.details).toHaveProperty('error')
      expect(result.details).toHaveProperty('timestamp')
    })
  })

  describe('Error Handling', () => {
    it('should create help chat errors correctly', () => {
      const error = createHelpChatError('Test error', 'NETWORK_ERROR', { test: 'context' }, true)

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('NETWORK_ERROR')
      expect(error.context).toEqual({ test: 'context' })
      expect(error.retryable).toBe(true)
    })

    it('should identify retryable errors correctly', () => {
      const retryableError = createHelpChatError('Network error', 'NETWORK_ERROR')
      const nonRetryableError = createHelpChatError('Validation error', 'VALIDATION_ERROR', {}, false)

      expect(isRetryableError(retryableError)).toBe(true)
      expect(isRetryableError(nonRetryableError)).toBe(false)
    })
  })

  describe('Streaming Support', () => {
    it('should handle streaming responses', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'streaming test',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      // Mock streaming response
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello '))
          controller.enqueue(new TextEncoder().encode('world!'))
          controller.close()
        }
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/stream' }),
        body: mockStream
      } as Response)

      const chunks: string[] = []
      const generator = apiService.submitQueryStream(mockRequest)

      for await (const chunk of generator) {
        if (typeof chunk === 'string') {
          chunks.push(chunk)
        }
      }

      expect(chunks.length).toBeGreaterThan(0)
    })
  })

  describe('Rate limit status', () => {
    it('should return rate limit status with remaining and reset time', () => {
      const status = apiService.getRateLimitStatus()
      expect(status).toHaveProperty('minute')
      expect(status.minute).toHaveProperty('remaining')
      expect(status.minute).toHaveProperty('resetTime')
      expect(status).toHaveProperty('hour')
      expect(status.hour).toHaveProperty('remaining')
      expect(status.hour).toHaveProperty('resetTime')
    })
  })

  describe('Language and API helpers', () => {
    const mockApiRequest = (libApi as { apiRequest: jest.Mock }).apiRequest

    beforeEach(() => {
      mockApiRequest.mockReset()
    })

    it('should get supported languages', async () => {
      mockApiRequest.mockResolvedValue({ data: [{ code: 'en', name: 'English' }, { code: 'de', name: 'German' }] })
      const result = await apiService.getSupportedLanguages()
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ code: 'en', name: 'English' })
    })

    it('should return empty array when languages endpoint fails', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      mockApiRequest.mockRejectedValue(new Error('Network error'))
      const result = await apiService.getSupportedLanguages()
      expect(result).toEqual([])
      warn.mockRestore()
    })

    it('should get user language preference', async () => {
      mockApiRequest.mockResolvedValue({ data: { language: 'de' } })
      const result = await apiService.getUserLanguagePreference()
      expect(result).toEqual({ language: 'de' })
    })

    it('should set user language preference', async () => {
      mockApiRequest.mockResolvedValue({ data: { success: true, message: 'Updated' } })
      const result = await apiService.setUserLanguagePreference('de')
      expect(result).toEqual({ success: true, message: 'Updated' })
    })

    it('should detect language', async () => {
      mockApiRequest.mockResolvedValue({ data: { language: 'en', confidence: 0.9 } })
      const result = await apiService.detectLanguage('Hello world')
      expect(result).toHaveProperty('data')
      expect((result as { data: { language: string } }).data.language).toBe('en')
    })

    it('should translate content', async () => {
      mockApiRequest.mockResolvedValue({ data: { translated: 'Hallo Welt' } })
      const result = await apiService.translateContent('Hello world', 'de', 'en', 'general')
      expect(result).toHaveProperty('data')
      expect((result as { data: { translated: string } }).data.translated).toBe('Hallo Welt')
    })

    it('should clear translation cache', async () => {
      mockApiRequest.mockResolvedValue({ data: { success: true, message: 'Cache cleared' } })
      const result = await apiService.clearTranslationCache()
      expect(result).toEqual({ success: true, message: 'Cache cleared' })
    })

    it('should clear translation cache for language', async () => {
      mockApiRequest.mockResolvedValue({ data: { success: true } })
      const result = await apiService.clearTranslationCache('de')
      expect(result).toEqual({ success: true })
    })

    it('should get performance metrics', async () => {
      mockApiRequest.mockResolvedValue({ data: { queriesToday: 10 } })
      const result = await apiService.getPerformanceMetrics()
      expect(result).toHaveProperty('data')
      expect((result as { data: { queriesToday: number } }).data.queriesToday).toBe(10)
    })

    it('should clear admin cache', async () => {
      mockApiRequest.mockResolvedValue({ data: { cleared: true } })
      const result = await apiService.clearServerCache('*')
      expect(result).toHaveProperty('data')
      expect((result as { data: { cleared: boolean } }).data.cleared).toBe(true)
    })

    it('should get health status', async () => {
      mockApiRequest.mockResolvedValue({ data: { status: 'ok' } })
      const result = await apiService.getHealthStatus()
      expect(result).toHaveProperty('data')
      expect((result as { data: { status: string } }).data.status).toBe('ok')
    })
  })

  describe('Dismiss proactive tip', () => {
    it('should dismiss proactive tip', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Dismissed' }),
        headers: new Headers()
      } as Response)

      const result = await apiService.dismissProactiveTip('tip-1')
      expect(result).toEqual({ success: true, message: 'Dismissed' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/help/tips/dismiss'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ tip_id: 'tip-1' })
        })
      )
    })
  })

  describe('Visual guides', () => {
    it('should get visual guide recommendations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: 'vg-1', title: 'Guide 1' }]),
        headers: new Headers()
      } as Response)

      const result = await apiService.getVisualGuideRecommendations(
        { route: '/projects', pageTitle: 'Projects', userRole: 'user' },
        5
      )
      expect(result).toEqual([{ id: 'vg-1', title: 'Guide 1' }])
    })

    it('should get visual guide by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'vg-1', steps: [] }),
        headers: new Headers()
      } as Response)

      const result = await apiService.getVisualGuide('vg-1')
      expect(result).toEqual({ id: 'vg-1', steps: [] })
    })

    it('should throw on visual guide 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers()
      } as Response)

      await expect(apiService.getVisualGuide('missing')).rejects.toThrow('Visual guide not found')
    })

    it('should track visual guide completion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
        headers: new Headers()
      } as Response)

      const result = await apiService.trackVisualGuideCompletion('vg-1', ['step1'], 120)
      expect(result).toEqual({ success: true })
    })
  })
})

describe('Singleton Instance', () => {
  it('should provide a singleton instance', () => {
    expect(helpChatAPI).toBeInstanceOf(HelpChatAPIService)
  })

  it('should maintain state across imports', () => {
    helpChatAPI.setAuthToken('test-token')
    
    // The token should be set on the singleton
    const headers = (helpChatAPI as any).getAuthHeaders()
    expect(headers.Authorization).toBe('Bearer test-token')
  })
})

describe('Configuration', () => {
  it('should export configuration for testing', () => {
    expect(HELP_CHAT_CONFIG).toBeDefined()
    expect(HELP_CHAT_CONFIG.endpoints).toBeDefined()
    expect(HELP_CHAT_CONFIG.cache).toBeDefined()
    expect(HELP_CHAT_CONFIG.retry).toBeDefined()
    expect(HELP_CHAT_CONFIG.rateLimits).toBeDefined()
  })
})

describe('API Calls with Various Contexts', () => {
  let apiService: HelpChatAPIService
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    apiService = new HelpChatAPIService()
    mockFetch.mockReset()
    apiService.clearLocalCache()
    apiService.resetRateLimits()
  })

  describe('Context Variations', () => {
    it('should handle project context correctly', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'How do I manage project resources?',
        context: {
          route: '/projects/123',
          pageTitle: 'Project Management',
          userRole: 'project_manager',
          currentProject: 'project-123',
          relevantData: {
            projectStatus: 'active',
            teamSize: 15,
            budget: 100000
          }
        },
        language: 'en'
      }

      const mockResponse: HelpQueryResponse = {
        response: 'To manage project resources...',
        sessionId: 'session-123',
        sources: [],
        confidence: 0.9,
        responseTimeMs: 150
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers()
      } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result).toEqual(expect.objectContaining(mockResponse))
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(mockRequest)
        })
      )
    })

    it('should handle portfolio context correctly', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'Show me portfolio analytics',
        context: {
          route: '/portfolios/456',
          pageTitle: 'Portfolio Dashboard',
          userRole: 'portfolio_manager',
          currentPortfolio: 'portfolio-456',
          relevantData: {
            portfolioType: 'strategic',
            projectCount: 8,
            totalBudget: 500000
          }
        },
        language: 'de'
      }

      const mockResponse: HelpQueryResponse = {
        response: 'Hier sind die Portfolio-Analysen...',
        sessionId: 'session-456',
        sources: [],
        confidence: 0.85,
        responseTimeMs: 200
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers()
      } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result).toEqual(expect.objectContaining(mockResponse))
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(mockRequest)
        })
      )
    })

    it('should handle admin context correctly', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'How do I configure system settings?',
        context: {
          route: '/admin/settings',
          pageTitle: 'System Administration',
          userRole: 'admin',
          relevantData: {
            systemVersion: '2.1.0',
            userCount: 150,
            activeProjects: 25
          }
        },
        language: 'en'
      }

      const mockResponse: HelpQueryResponse = {
        response: 'To configure system settings...',
        sessionId: 'session-admin',
        sources: [],
        confidence: 0.95,
        responseTimeMs: 120
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers()
      } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result).toEqual(expect.objectContaining(mockResponse))
    })

    it('should handle minimal context correctly', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'General help question',
        context: {
          route: '/dashboard',
          pageTitle: 'Dashboard',
          userRole: 'user'
        },
        language: 'en'
      }

      const mockResponse: HelpQueryResponse = {
        response: 'Here is general help...',
        sessionId: 'session-minimal',
        sources: [],
        confidence: 0.7,
        responseTimeMs: 180
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers()
      } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result).toEqual(expect.objectContaining(mockResponse))
    })

    it('should handle different language contexts', async () => {
      const languages: Array<'en' | 'de' | 'fr'> = ['en', 'de', 'fr']
      
      for (const language of languages) {
        const mockRequest: HelpQueryRequest = {
          query: 'Test query',
          context: {
            route: '/test',
            pageTitle: 'Test',
            userRole: 'user'
          },
          language
        }

        const mockResponse: HelpQueryResponse = {
          response: `Response in ${language}`,
          sessionId: `session-${language}`,
          sources: [],
          confidence: 0.8,
          responseTimeMs: 150
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
          headers: new Headers()
        } as Response)

        const result = await apiService.submitQuery(mockRequest)

        expect(result.response).toBe(`Response in ${language}`)
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify(mockRequest)
          })
        )

        mockFetch.mockClear()
      }
    })
  })

  describe('Context-Specific API Endpoints', () => {
    it('should call context endpoint with proper parameters', async () => {
      const mockContext: HelpContextResponse = {
        context: {
          route: '/projects/123',
          pageTitle: 'Project Details',
          userRole: 'project_manager'
        },
        availableActions: [
          {
            id: 'edit-project',
            label: 'Edit Project',
            action: () => {}
          }
        ],
        relevantTips: []
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockContext,
        headers: new Headers()
      } as Response)

      const result = await apiService.getHelpContext('/projects/123')

      expect(result).toEqual(mockContext)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/help/context?page_route=%2Fprojects%2F123'),
        expect.objectContaining({
          method: 'GET'
        })
      )
    })

    it('should call proactive tips endpoint with context', async () => {
      const mockTips: ProactiveTipsResponse = {
        tips: [
          {
            id: 'tip-context-1',
            type: 'feature_discovery',
            title: 'Context-specific tip',
            content: 'This tip is relevant to your current context',
            priority: 'medium',
            triggerContext: ['/projects'],
            dismissible: true,
            showOnce: false,
            isRead: false
          }
        ],
        context: {
          route: '/projects',
          pageTitle: 'Projects',
          userRole: 'user'
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTips,
        headers: new Headers()
      } as Response)

      // Pass page_route as query string; API uses page_route for path context
      const result = await apiService.getProactiveTips(new URLSearchParams({ page_route: '/projects' }))

      expect(result).toEqual(mockTips)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/help/tips'),
        expect.objectContaining({
          method: 'GET'
        })
      )
      const callUrl = mockFetch.mock.calls[0][0] as string
      expect(callUrl).toContain('page_route=%2Fprojects')
    })
  })
})

describe('Enhanced Error Handling and Retry Logic', () => {
  let apiService: HelpChatAPIService
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    apiService = new HelpChatAPIService()
    mockFetch.mockReset()
    apiService.clearLocalCache()
    apiService.resetRateLimits()
  })

  describe('Network Error Scenarios', () => {
    it('should retry on network timeout errors', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      // First two calls timeout, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: 'Success after timeout retries',
            sessionId: 'session-timeout',
            sources: [],
            confidence: 0.8,
            responseTimeMs: 300
          }),
          headers: new Headers()
        } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result.response).toBe('Success after timeout retries')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should retry on connection refused errors', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      // Connection refused, then success
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: 'Success after connection retry',
            sessionId: 'session-conn',
            sources: [],
            confidence: 0.8,
            responseTimeMs: 250
          }),
          headers: new Headers()
        } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result.response).toBe('Success after connection retry')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should handle DNS resolution errors with retry', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      // DNS error, then success
      mockFetch
        .mockRejectedValueOnce(new Error('ENOTFOUND'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: 'Success after DNS retry',
            sessionId: 'session-dns',
            sources: [],
            confidence: 0.8,
            responseTimeMs: 400
          }),
          headers: new Headers()
        } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result.response).toBe('Success after DNS retry')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('HTTP Error Status Codes', () => {
    it('should retry on 500 Internal Server Error', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      // 500 error, then success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers()
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: 'Success after 500 retry',
            sessionId: 'session-500',
            sources: [],
            confidence: 0.8,
            responseTimeMs: 200
          }),
          headers: new Headers()
        } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result.response).toBe('Success after 500 retry')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should retry on 502 Bad Gateway', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      // 502 error, then success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          headers: new Headers()
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: 'Success after 502 retry',
            sessionId: 'session-502',
            sources: [],
            confidence: 0.8,
            responseTimeMs: 180
          }),
          headers: new Headers()
        } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result.response).toBe('Success after 502 retry')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should retry on 503 Service Unavailable', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      // 503 error, then success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers()
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: 'Success after 503 retry',
            sessionId: 'session-503',
            sources: [],
            confidence: 0.8,
            responseTimeMs: 220
          }),
          headers: new Headers()
        } as Response)

      const result = await apiService.submitQuery(mockRequest)

      expect(result.response).toBe('Success after 503 retry')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should not retry on 400 Bad Request', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers()
      } as Response)

      await expect(apiService.submitQuery(mockRequest)).rejects.toThrow('HTTP 400: Bad Request')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 401 Unauthorized', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers()
      } as Response)

      await expect(apiService.submitQuery(mockRequest)).rejects.toThrow('HTTP 401: Unauthorized')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 403 Forbidden', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers()
      } as Response)

      await expect(apiService.submitQuery(mockRequest)).rejects.toThrow('HTTP 403: Forbidden')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff between retries', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      const startTime = Date.now()

      // All calls fail to test full retry sequence
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))

      await expect(apiService.submitQuery(mockRequest)).rejects.toThrow('failed after 3 attempts')

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Should take at least base delay (1000ms) + exponential backoff (2000ms) = 3000ms
      expect(totalTime).toBeGreaterThan(3000)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('Error Context and Logging', () => {
    it('should preserve error context through retries', async () => {
      const mockRequest: HelpQueryRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      mockFetch
        .mockRejectedValueOnce(new Error('First error'))
        .mockRejectedValueOnce(new Error('Second error'))
        .mockRejectedValueOnce(new Error('Final error'))

      try {
        await apiService.submitQuery(mockRequest)
      } catch (error: any) {
        expect(error.code).toBe('NETWORK_ERROR')
        expect(error.context).toHaveProperty('attempts', 3)
        expect(error.context).toHaveProperty('originalError')
      }
    })

    it('should create appropriate error types for different scenarios', () => {
      const networkError = createHelpChatError('Network failed', 'NETWORK_ERROR', { status: 500 })
      const validationError = createHelpChatError('Invalid input', 'VALIDATION_ERROR', {}, false)
      const rateLimitError = createHelpChatError('Rate limited', 'RATE_LIMIT_ERROR')

      expect(networkError.code).toBe('NETWORK_ERROR')
      expect(networkError.retryable).toBe(true)

      expect(validationError.code).toBe('VALIDATION_ERROR')
      expect(validationError.retryable).toBe(false)

      expect(rateLimitError.code).toBe('RATE_LIMIT_ERROR')
      expect(rateLimitError.retryable).toBe(true)
    })
  })

  describe('Retry Logic for Different Endpoints', () => {
    it('should retry context endpoint failures', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            context: { route: '/test', pageTitle: 'Test', userRole: 'user' },
            availableActions: [],
            relevantTips: []
          }),
          headers: new Headers()
        } as Response)

      const result = await apiService.getHelpContext('/test')

      expect(result.context.route).toBe('/test')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should retry feedback submission failures', async () => {
      const mockFeedback: HelpFeedbackRequest = {
        messageId: 'msg-123',
        rating: 5,
        feedbackText: 'Great help!',
        feedbackType: 'helpful'
      }

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Feedback submitted',
            trackingId: 'feedback-123'
          }),
          headers: new Headers()
        } as Response)

      const result = await apiService.submitFeedback(mockFeedback)

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should retry proactive tips endpoint failures', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tips: [],
            context: { route: '/test', pageTitle: 'Test', userRole: 'user' }
          }),
          headers: new Headers()
        } as Response)

      const result = await apiService.getProactiveTips('/test')

      expect(result.tips).toEqual([])
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})