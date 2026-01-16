/**
 * Help Chat API Service
 * Handles communication with the AI-powered help chat backend
 */

import type {
  HelpQueryRequest,
  HelpQueryResponse,
  HelpFeedbackRequest,
  FeedbackResponse,
  ProactiveTipsResponse,
  HelpContextResponse,
  HelpChatError
} from '../types/help-chat'

// Configuration
export const HELP_CHAT_CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_HELP_CHAT_API_URL || '/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  endpoints: {
    query: '/ai/help/query',
    feedback: '/ai/help/feedback',
    context: '/ai/help/context',
    tips: '/ai/help/tips',
    translate: '/ai/help/translate',
    detectLanguage: '/ai/help/detect-language',
    sessions: '/ai/help/sessions',
    preferences: '/ai/help/preferences',
    errorReport: '/ai/help/error-report'
  },
  cache: {
    maxSize: 100,
    ttl: 300000 // 5 minutes
  },
  retry: {
    attempts: 3,
    delay: 1000,
    backoffMultiplier: 2
  },
  rateLimits: {
    minute: 60,
    hour: 1000
  }
}

// Error handling
export function createHelpChatError(
  message: string,
  code: HelpChatError['code'] = 'UNKNOWN_ERROR',
  context?: Record<string, any>,
  retryable?: boolean
): HelpChatError {
  const error = new Error(message) as HelpChatError
  error.code = code
  if (context) {
    error.context = context
  }
  error.retryable = retryable !== undefined ? retryable : (code === 'NETWORK_ERROR' || code === 'RATE_LIMIT_ERROR')
  return error
}

export function isRetryableError(error: any): boolean {
  return error?.retryable === true || 
         error?.code === 'NETWORK_ERROR' || 
         error?.code === 'RATE_LIMIT_ERROR'
}

// API Service Class
export class HelpChatAPIService {
  private authToken: string | null = null
  private baseUrl: string
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private rateLimitTracking = {
    minute: { count: 0, resetTime: Date.now() + 60000 },
    hour: { count: 0, resetTime: Date.now() + 3600000 }
  }

  constructor(baseUrl: string = HELP_CHAT_CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl
  }

  setAuthToken(token: string | null) {
    this.authToken = token
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`
    }
    return headers
  }

  clearCache() {
    this.cache.clear()
  }

  clearLocalCache() {
    this.cache.clear()
  }

  resetRateLimits() {
    const now = Date.now()
    this.rateLimitTracking = {
      minute: { count: 0, resetTime: now + 60000 },
      hour: { count: 0, resetTime: now + 3600000 }
    }
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: HELP_CHAT_CONFIG.cache.maxSize
    }
  }

  getRateLimitStatus() {
    const now = Date.now()
    
    // Reset counters if time has passed
    if (now > this.rateLimitTracking.minute.resetTime) {
      this.rateLimitTracking.minute.count = 0
      this.rateLimitTracking.minute.resetTime = now + 60000
    }
    if (now > this.rateLimitTracking.hour.resetTime) {
      this.rateLimitTracking.hour.count = 0
      this.rateLimitTracking.hour.resetTime = now + 3600000
    }

    return {
      minute: {
        remaining: Math.max(0, HELP_CHAT_CONFIG.rateLimits.minute - this.rateLimitTracking.minute.count),
        resetTime: this.rateLimitTracking.minute.resetTime
      },
      hour: {
        remaining: Math.max(0, HELP_CHAT_CONFIG.rateLimits.hour - this.rateLimitTracking.hour.count),
        resetTime: this.rateLimitTracking.hour.resetTime
      }
    }
  }

  private checkRateLimit() {
    const now = Date.now()
    
    // Reset counters if time has passed
    if (now > this.rateLimitTracking.minute.resetTime) {
      this.rateLimitTracking.minute.count = 0
      this.rateLimitTracking.minute.resetTime = now + 60000
    }
    if (now > this.rateLimitTracking.hour.resetTime) {
      this.rateLimitTracking.hour.count = 0
      this.rateLimitTracking.hour.resetTime = now + 3600000
    }

    // Check limits
    if (this.rateLimitTracking.minute.count >= HELP_CHAT_CONFIG.rateLimits.minute) {
      throw createHelpChatError('Rate limit exceeded (per minute)', 'RATE_LIMIT_ERROR')
    }
    if (this.rateLimitTracking.hour.count >= HELP_CHAT_CONFIG.rateLimits.hour) {
      throw createHelpChatError('Rate limit exceeded (per hour)', 'RATE_LIMIT_ERROR')
    }

    // Increment counters
    this.rateLimitTracking.minute.count++
    this.rateLimitTracking.hour.count++
  }

  private getCacheKey(endpoint: string, data?: any): string {
    return `${endpoint}:${JSON.stringify(data || {})}`
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > HELP_CHAT_CONFIG.cache.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  private setCache(key: string, data: any) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= HELP_CHAT_CONFIG.cache.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders()
    }

    // Add custom headers if provided
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value
        })
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value
        })
      } else {
        Object.assign(headers, options.headers)
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HELP_CHAT_CONFIG.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 429) {
          throw createHelpChatError(
            'Rate limit exceeded. Please try again later.',
            'RATE_LIMIT_ERROR',
            { status: response.status }
          )
        }

        if (response.status >= 500) {
          throw createHelpChatError(
            'Server error occurred. Please try again.',
            'NETWORK_ERROR',
            { status: response.status }
          )
        }

        const errorData = await response.json().catch(() => ({}))
        throw createHelpChatError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          'VALIDATION_ERROR',
          { status: response.status, ...errorData },
          false
        )
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw createHelpChatError(
          'Request timeout. Please check your connection.',
          'NETWORK_ERROR'
        )
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw createHelpChatError(
          'Network error. Please check your connection.',
          'NETWORK_ERROR'
        )
      }

      throw error
    }
  }

  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    attempts: number = HELP_CHAT_CONFIG.retryAttempts
  ): Promise<T> {
    let lastError: any
    let attemptCount = 0

    for (let i = 0; i < attempts; i++) {
      attemptCount++
      try {
        return await requestFn()
      } catch (error) {
        lastError = error

        if (!isRetryableError(error) || i === attempts - 1) {
          // Add attempt context to final error
          if (lastError && typeof lastError === 'object') {
            lastError.context = {
              ...lastError.context,
              attempts: attemptCount,
              originalError: lastError.message
            }
          }
          
          // Wrap in a more descriptive error for max retries
          if (i === attempts - 1 && isRetryableError(error)) {
            throw createHelpChatError(
              `Request failed after ${attempts} attempts: ${lastError.message}`,
              lastError.code || 'NETWORK_ERROR',
              { attempts: attemptCount, originalError: lastError }
            )
          }
          
          throw error
        }

        // Exponential backoff
        const delay = HELP_CHAT_CONFIG.retryDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  async submitQuery(request: HelpQueryRequest): Promise<HelpQueryResponse> {
    // Validation
    if (!request.query || request.query.trim() === '') {
      throw createHelpChatError('Query cannot be empty', 'VALIDATION_ERROR', {}, false)
    }
    if (!request.context) {
      throw createHelpChatError('Context is required', 'VALIDATION_ERROR', {}, false)
    }

    // Check rate limits
    this.checkRateLimit()

    // Check cache
    const cacheKey = this.getCacheKey(HELP_CHAT_CONFIG.endpoints.query, request)
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    const result = await this.retryRequest(() =>
      this.makeRequest<HelpQueryResponse>(HELP_CHAT_CONFIG.endpoints.query, {
        method: 'POST',
        body: JSON.stringify(request)
      })
    )

    // Cache successful response
    this.setCache(cacheKey, result)

    return result
  }

  async submitFeedback(request: HelpFeedbackRequest): Promise<FeedbackResponse> {
    // Validation
    if (!request.messageId || request.messageId.trim() === '') {
      throw createHelpChatError('Message ID is required', 'VALIDATION_ERROR', {}, false)
    }
    if (request.rating !== undefined && (request.rating < 1 || request.rating > 5)) {
      throw createHelpChatError('Rating must be between 1 and 5', 'VALIDATION_ERROR', {}, false)
    }

    return this.retryRequest(() =>
      this.makeRequest<FeedbackResponse>(HELP_CHAT_CONFIG.endpoints.feedback, {
        method: 'POST',
        body: JSON.stringify(request)
      })
    )
  }

  async getProactiveTips(contextOrParams: string | Record<string, any>): Promise<ProactiveTipsResponse> {
    let queryString: string
    
    if (typeof contextOrParams === 'string') {
      // If it's already a query string (contains =), use it directly
      if (contextOrParams.includes('=')) {
        queryString = contextOrParams
      } else {
        // Otherwise, treat it as page_route
        const params = new URLSearchParams()
        params.append('page_route', contextOrParams)
        queryString = params.toString()
      }
    } else {
      // If it's an object, convert to query string
      const params = new URLSearchParams()
      Object.entries(contextOrParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
      queryString = params.toString()
    }
    
    return this.retryRequest(() =>
      this.makeRequest<ProactiveTipsResponse>(`${HELP_CHAT_CONFIG.endpoints.tips}?${queryString}`, {
        method: 'GET'
      })
    )
  }

  async getHelpContext(pageRoute: string): Promise<HelpContextResponse> {
    const encodedRoute = encodeURIComponent(pageRoute)
    return this.retryRequest(() =>
      this.makeRequest<HelpContextResponse>(`${HELP_CHAT_CONFIG.endpoints.context}?page_route=${encodedRoute}`, {
        method: 'GET'
      })
    )
  }

  async *submitQueryStream(request: HelpQueryRequest): AsyncGenerator<string | HelpQueryResponse, void, unknown> {
    // Validation
    if (!request.query || request.query.trim() === '') {
      throw createHelpChatError('Query cannot be empty', 'VALIDATION_ERROR', {}, false)
    }
    if (!request.context) {
      throw createHelpChatError('Context is required', 'VALIDATION_ERROR', {}, false)
    }

    // Check rate limits
    this.checkRateLimit()

    const url = `${this.baseUrl}${HELP_CHAT_CONFIG.endpoints.query}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders()
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw createHelpChatError(
        `HTTP ${response.status}: ${response.statusText}`,
        'NETWORK_ERROR'
      )
    }

    if (!response.body) {
      throw createHelpChatError('No response body', 'NETWORK_ERROR')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        yield chunk
      }
    } finally {
      reader.releaseLock()
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const startTime = Date.now()
      
      await this.makeRequest<HelpQueryResponse>(HELP_CHAT_CONFIG.endpoints.query, {
        method: 'POST',
        body: JSON.stringify({
          query: 'health check',
          context: { route: '/health', pageTitle: 'Health Check', userRole: 'system' },
          language: 'en'
        })
      })

      const responseTime = Date.now() - startTime

      return {
        status: 'healthy',
        details: {
          responseTime,
          cache: this.getCacheStats(),
          rateLimits: this.getRateLimitStatus(),
          timestamp: new Date().toISOString()
        }
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        }
      }
    }
  }

  async translateMessage(content: string, targetLanguage: string): Promise<string> {
    const response = await this.retryRequest(() =>
      this.makeRequest<{ translatedText: string }>('/translate', {
        method: 'POST',
        body: JSON.stringify({ content, targetLanguage })
      })
    )
    return response.translatedText
  }

  async detectLanguage(content: string): Promise<{ language: string; confidence: number }> {
    return this.retryRequest(() =>
      this.makeRequest<{ language: string; confidence: number }>('/detect-language', {
        method: 'POST',
        body: JSON.stringify({ content })
      })
    )
  }

  async getSessionHistory(sessionId: string): Promise<any[]> {
    return this.retryRequest(() =>
      this.makeRequest<any[]>(`/sessions/${sessionId}/history`)
    )
  }

  async updateUserPreferences(preferences: any): Promise<void> {
    await this.retryRequest(() =>
      this.makeRequest<void>('/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences)
      })
    )
  }

  async getUserPreferences(): Promise<any> {
    return this.retryRequest(() =>
      this.makeRequest<any>('/preferences')
    )
  }

  async reportError(error: any, context?: any): Promise<void> {
    try {
      await this.makeRequest<void>('/error-report', {
        method: 'POST',
        body: JSON.stringify({
          error: {
            message: error.message,
            stack: error.stack,
            code: error.code
          },
          context,
          timestamp: new Date().toISOString()
        })
      })
    } catch (reportError) {
      // Silently fail error reporting to avoid infinite loops
      console.warn('Failed to report error:', reportError)
    }
  }
}

// Export singleton instance
export const helpChatAPI = new HelpChatAPIService()

// Export default
export default helpChatAPI