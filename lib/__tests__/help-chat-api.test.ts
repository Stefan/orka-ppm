/**
 * Help Chat API Service Tests
 * Tests for the comprehensive API integration service
 */

import { HelpChatAPIService, helpChatAPI, createHelpChatError, isRetryableError, HELP_CHAT_CONFIG } from '../help-chat-api'
import type {
  HelpQueryRequest,
  HelpQueryResponse,
  HelpFeedbackRequest,
  FeedbackResponse,
  HelpContextResponse,
  ProactiveTipsResponse
} from '../../types/help-chat'

// Mock fetch globally
global.fetch = jest.fn()

describe('HelpChatAPIService', () => {
  let apiService: HelpChatAPIService
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    apiService = new HelpChatAPIService()
    mockFetch.mockClear()
    apiService.clearCache()
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

      apiService.clearCache()
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
          body: JSON.stringify(mockFeedback)
        })
      )
    })

    it('should validate feedback data', async () => {
      const invalidFeedback = {
        messageId: '',
        rating: 6,
        feedbackType: 'helpful'
      } as HelpFeedbackRequest

      await expect(apiService.submitFeedback(invalidFeedback)).rejects.toThrow('Message ID is required')

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
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/help/tips?context=%2Fdashboard'),
        expect.objectContaining({
          method: 'GET'
        })
      )
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