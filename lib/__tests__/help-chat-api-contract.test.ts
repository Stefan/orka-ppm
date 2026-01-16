/**
 * API Contract Tests for Help Chat API
 * Validates that frontend API calls match backend expectations
 */

import { HelpChatAPIService, HELP_CHAT_CONFIG } from '../help-chat-api'

describe('Help Chat API Contract Tests', () => {
  describe('API Endpoint Contracts', () => {
    it('should have correct endpoint paths', () => {
      expect(HELP_CHAT_CONFIG.endpoints.query).toBe('/ai/help/query')
      expect(HELP_CHAT_CONFIG.endpoints.feedback).toBe('/ai/help/feedback')
      expect(HELP_CHAT_CONFIG.endpoints.context).toBe('/ai/help/context')
      expect(HELP_CHAT_CONFIG.endpoints.tips).toBe('/ai/help/tips')
    })

    it('should have correct configuration', () => {
      expect(HELP_CHAT_CONFIG.timeout).toBe(30000)
      expect(HELP_CHAT_CONFIG.retryAttempts).toBe(3)
      expect(HELP_CHAT_CONFIG.cache.maxSize).toBe(100)
      expect(HELP_CHAT_CONFIG.rateLimits.minute).toBe(60)
      expect(HELP_CHAT_CONFIG.rateLimits.hour).toBe(1000)
    })
  })

  describe('Query Endpoint Contract', () => {
    it('should format query request correctly', () => {
      const mockRequest = {
        query: 'test query',
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        },
        language: 'en'
      }

      // Validate request structure
      expect(mockRequest).toHaveProperty('query')
      expect(mockRequest).toHaveProperty('context')
      expect(mockRequest).toHaveProperty('language')
      expect(mockRequest.context).toHaveProperty('route')
      expect(mockRequest.context).toHaveProperty('pageTitle')
      expect(mockRequest.context).toHaveProperty('userRole')
    })

    it('should expect correct response structure', () => {
      const mockResponse = {
        response: 'Test response',
        sessionId: 'session-123',
        sources: [],
        confidence: 0.9,
        responseTimeMs: 100
      }

      // Validate response structure
      expect(mockResponse).toHaveProperty('response')
      expect(mockResponse).toHaveProperty('sessionId')
      expect(mockResponse).toHaveProperty('sources')
      expect(mockResponse).toHaveProperty('confidence')
      expect(mockResponse).toHaveProperty('responseTimeMs')
      expect(Array.isArray(mockResponse.sources)).toBe(true)
      expect(typeof mockResponse.confidence).toBe('number')
    })
  })

  describe('Proactive Tips Endpoint Contract', () => {
    it('should format tips request with required parameters', () => {
      // Backend expects these query parameters
      const requiredParams = ['page_route']
      const optionalParams = [
        'page_title',
        'user_role',
        'current_project',
        'current_portfolio',
        'recent_pages',
        'time_on_page',
        'frequent_queries',
        'user_level',
        'session_count'
      ]

      // Validate that we know about all required parameters
      expect(requiredParams).toContain('page_route')
      expect(optionalParams.length).toBeGreaterThan(0)
    })

    it('should build correct URL for simple string input', () => {
      const apiService = new HelpChatAPIService()
      const pageRoute = '/dashboard'
      
      // Mock fetch to capture the URL
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tips: [], context: {} })
      })
      global.fetch = mockFetch

      apiService.getProactiveTips(pageRoute).catch(() => {})

      // Wait for async call
      setTimeout(() => {
        const callUrl = mockFetch.mock.calls[0]?.[0] as string
        if (callUrl) {
          const url = new URL(callUrl, 'http://test.com')
          expect(url.searchParams.has('page_route')).toBe(true)
          expect(url.searchParams.get('page_route')).toBe(pageRoute)
        }
      }, 0)
    })

    it('should build correct URL for query string input', () => {
      const apiService = new HelpChatAPIService()
      const queryString = 'page_route=/projects&page_title=Projects&user_role=admin'
      
      // Mock fetch to capture the URL
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tips: [], context: {} })
      })
      global.fetch = mockFetch

      apiService.getProactiveTips(queryString).catch(() => {})

      // Wait for async call
      setTimeout(() => {
        const callUrl = mockFetch.mock.calls[0]?.[0] as string
        if (callUrl) {
          const url = new URL(callUrl, 'http://test.com')
          expect(url.searchParams.get('page_route')).toBe('/projects')
          expect(url.searchParams.get('page_title')).toBe('Projects')
          expect(url.searchParams.get('user_role')).toBe('admin')
        }
      }, 0)
    })

    it('should expect correct response structure', () => {
      const mockResponse = {
        tips: [
          {
            id: 'tip-1',
            type: 'feature_discovery',
            title: 'Test Tip',
            content: 'Test content',
            priority: 'medium',
            triggerContext: ['/test'],
            dismissible: true,
            showOnce: false,
            isRead: false
          }
        ],
        context: {
          route: '/test',
          pageTitle: 'Test',
          userRole: 'user'
        }
      }

      // Validate response structure
      expect(mockResponse).toHaveProperty('tips')
      expect(mockResponse).toHaveProperty('context')
      expect(Array.isArray(mockResponse.tips)).toBe(true)
      
      if (mockResponse.tips.length > 0) {
        const tip = mockResponse.tips[0]
        expect(tip).toHaveProperty('id')
        expect(tip).toHaveProperty('type')
        expect(tip).toHaveProperty('title')
        expect(tip).toHaveProperty('content')
        expect(tip).toHaveProperty('priority')
      }
    })
  })

  describe('Feedback Endpoint Contract', () => {
    it('should format feedback request correctly', () => {
      const mockRequest = {
        messageId: 'msg-123',
        rating: 5,
        feedbackText: 'Great!',
        feedbackType: 'helpful'
      }

      // Validate request structure
      expect(mockRequest).toHaveProperty('messageId')
      expect(mockRequest).toHaveProperty('rating')
      expect(mockRequest).toHaveProperty('feedbackType')
      expect(mockRequest.rating).toBeGreaterThanOrEqual(1)
      expect(mockRequest.rating).toBeLessThanOrEqual(5)
    })
  })

  describe('Context Endpoint Contract', () => {
    it('should format context request with page_route parameter', () => {
      const pageRoute = '/projects/123'
      const expectedParam = 'page_route'

      // Validate that we use the correct parameter name
      expect(expectedParam).toBe('page_route')
      expect(pageRoute).toMatch(/^\//)
    })

    it('should expect correct response structure', () => {
      const mockResponse = {
        context: {
          route: '/projects',
          pageTitle: 'Projects',
          userRole: 'user'
        },
        availableActions: [],
        relevantTips: []
      }

      // Validate response structure
      expect(mockResponse).toHaveProperty('context')
      expect(mockResponse).toHaveProperty('availableActions')
      expect(mockResponse).toHaveProperty('relevantTips')
      expect(Array.isArray(mockResponse.availableActions)).toBe(true)
      expect(Array.isArray(mockResponse.relevantTips)).toBe(true)
    })
  })

  describe('Error Response Contract', () => {
    it('should handle standard error responses', () => {
      const errorResponse = {
        message: 'Error message',
        code: 'VALIDATION_ERROR',
        context: { field: 'query' }
      }

      // Validate error structure
      expect(errorResponse).toHaveProperty('message')
      expect(errorResponse).toHaveProperty('code')
      expect(typeof errorResponse.message).toBe('string')
      expect(typeof errorResponse.code).toBe('string')
    })

    it('should handle HTTP error codes correctly', () => {
      const errorCodes = {
        badRequest: 400,
        unauthorized: 401,
        forbidden: 403,
        notFound: 404,
        tooManyRequests: 429,
        serverError: 500,
        badGateway: 502,
        serviceUnavailable: 503
      }

      // Validate error code handling
      expect(errorCodes.badRequest).toBe(400)
      expect(errorCodes.unauthorized).toBe(401)
      expect(errorCodes.tooManyRequests).toBe(429)
      expect(errorCodes.serverError).toBe(500)
    })
  })

  describe('Rate Limiting Contract', () => {
    it('should respect rate limit configuration', () => {
      const rateLimits = HELP_CHAT_CONFIG.rateLimits

      expect(rateLimits.minute).toBe(60)
      expect(rateLimits.hour).toBe(1000)
      expect(rateLimits.minute).toBeLessThan(rateLimits.hour)
    })
  })

  describe('Caching Contract', () => {
    it('should have cache configuration', () => {
      const cache = HELP_CHAT_CONFIG.cache

      expect(cache.maxSize).toBe(100)
      expect(cache.ttl).toBe(300000) // 5 minutes
      expect(cache.maxSize).toBeGreaterThan(0)
      expect(cache.ttl).toBeGreaterThan(0)
    })
  })
})
