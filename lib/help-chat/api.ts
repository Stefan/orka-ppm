/**
 * Help Chat API Service
 * Provides comprehensive API integration for the AI-powered help chat system
 * 
 * Features:
 * - Query submission with context
 * - Response streaming support
 * - Error handling and retry logic
 * - Request/response caching
 * - Rate limiting compliance
 */

import { apiRequest, getApiUrl } from '../api'
import { logger } from '../monitoring/logger'
import type {
  HelpQueryRequest,
  HelpQueryResponse,
  HelpContextResponse,
  HelpFeedbackRequest,
  FeedbackResponse,
  ProactiveTipsResponse,
  HelpChatError
} from '../../types/help-chat'

// Configuration
const HELP_CHAT_CONFIG = {
  endpoints: {
    query: '/api/ai/help/query',
    context: '/api/ai/help/context',
    feedback: '/api/ai/help/feedback',
    tips: '/api/ai/help/tips',
    languages: '/api/ai/help/languages',
    languagePreference: '/api/ai/help/language/preference',
    detectLanguage: '/api/ai/help/language/detect',
    translate: '/api/ai/help/translate',
    clearCache: '/api/ai/help/translation/cache'
  },
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000
  },
  streaming: {
    enabled: true,
    chunkSize: 1024
  },
  rateLimits: {
    messagesPerMinute: 20,
    messagesPerHour: 100
  }
} as const

// Cache implementation
class HelpChatCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly maxSize: number

  constructor(maxSize: number = HELP_CHAT_CONFIG.cache.maxSize) {
    this.maxSize = maxSize
  }

  private generateKey(endpoint: string, params: any): string {
    return `${endpoint}:${JSON.stringify(params)}`
  }

  set(endpoint: string, params: any, data: any, ttl: number = HELP_CHAT_CONFIG.cache.ttl): void {
    const key = this.generateKey(endpoint, params)
    
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get(endpoint: string, params: any): any | null {
    const key = this.generateKey(endpoint, params)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Rate limiter implementation
class RateLimiter {
  private requests: number[] = []
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  canMakeRequest(): boolean {
    const now = Date.now()
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs)
    
    return this.requests.length < this.maxRequests
  }

  recordRequest(): void {
    this.requests.push(Date.now())
  }

  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0
    
    const oldestRequest = Math.min(...this.requests)
    const timeUntilReset = this.windowMs - (Date.now() - oldestRequest)
    
    return Math.max(0, timeUntilReset)
  }

  getRemainingRequests(): number {
    const now = Date.now()
    const recentRequests = this.requests.filter(timestamp => now - timestamp < this.windowMs)
    return Math.max(0, this.maxRequests - recentRequests.length)
  }
}

// Error handling utilities
function createHelpChatError(
  message: string,
  code: HelpChatError['code'],
  context?: Record<string, any>,
  retryable: boolean = true
): HelpChatError {
  const error = new Error(message) as HelpChatError
  error.code = code
  if (context) {
    error.context = context
  }
  error.retryable = retryable
  return error
}

function isRetryableError(error: any): boolean {
  if (error.retryable === false) return false
  
  // Rate limit errors should be retried after delay
  if (error.code === 'RATE_LIMIT_ERROR') return true
  
  // Check HTTP status codes from context
  const status = error.status || error.context?.status
  if (status) {
    return status >= 500 || status === 429
  }
  
  // Network errors are generally retryable, but only if no specific status code
  if (error.code === 'NETWORK_ERROR' && !status) return true
  
  return false
}

async function delay(ms: number): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(() => resolve(), ms)
  })
}

// Streaming response handler
class StreamingResponseHandler {
  private decoder: TextDecoder
  private buffer = ''

  constructor() {
    // Handle both browser and Node.js environments
    if (typeof TextDecoder !== 'undefined') {
      this.decoder = new TextDecoder()
    } else {
      // Fallback for Node.js environment
      this.decoder = {
        decode: (input: Uint8Array, _options?: { stream?: boolean }) => {
          return Buffer.from(input).toString('utf-8')
        }
      } as TextDecoder
    }
  }

  async *processStream(response: Response): AsyncGenerator<string, void, unknown> {
    if (!response.body) {
      throw createHelpChatError('No response body for streaming', 'NETWORK_ERROR')
    }

    const reader = response.body.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          // Yield any remaining buffer content
          if (this.buffer.trim()) {
            yield this.buffer
          }
          break
        }

        // Decode chunk and add to buffer
        const chunk = this.decoder.decode(value, { stream: true })
        this.buffer += chunk

        // Process complete lines
        const lines = this.buffer.split('\n')
        this.buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            yield line
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  reset(): void {
    this.buffer = ''
  }
}

// Main API service class
export class HelpChatAPIService {
  private cache: HelpChatCache
  private rateLimiterMinute: RateLimiter
  private rateLimiterHour: RateLimiter
  private streamingHandler: StreamingResponseHandler
  private authToken: string | null = null

  constructor() {
    this.cache = new HelpChatCache()
    this.rateLimiterMinute = new RateLimiter(
      HELP_CHAT_CONFIG.rateLimits.messagesPerMinute,
      60 * 1000 // 1 minute
    )
    this.rateLimiterHour = new RateLimiter(
      HELP_CHAT_CONFIG.rateLimits.messagesPerHour,
      60 * 60 * 1000 // 1 hour
    )
    this.streamingHandler = new StreamingResponseHandler()

    // Cleanup cache periodically
    setInterval(() => {
      this.cache.cleanup()
    }, 60 * 1000) // Every minute
  }

  setAuthToken(token: string | null): void {
    this.authToken = token
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    return headers
  }

  private checkRateLimit(): void {
    if (!this.rateLimiterMinute.canMakeRequest()) {
      const timeUntilReset = this.rateLimiterMinute.getTimeUntilReset()
      throw createHelpChatError(
        `Rate limit exceeded. Try again in ${Math.ceil(timeUntilReset / 1000)} seconds.`,
        'RATE_LIMIT_ERROR',
        { timeUntilReset, remainingRequests: 0 },
        true
      )
    }

    if (!this.rateLimiterHour.canMakeRequest()) {
      const timeUntilReset = this.rateLimiterHour.getTimeUntilReset()
      throw createHelpChatError(
        `Hourly rate limit exceeded. Try again in ${Math.ceil(timeUntilReset / 60000)} minutes.`,
        'RATE_LIMIT_ERROR',
        { timeUntilReset, remainingRequests: 0 },
        true
      )
    }
  }

  private recordRequest(): void {
    this.rateLimiterMinute.recordRequest()
    this.rateLimiterHour.recordRequest()
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: any
    
    for (let attempt = 1; attempt <= HELP_CHAT_CONFIG.retry.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
        // Don't retry if error is not retryable
        if (!isRetryableError(error)) {
          throw error
        }

        // Don't retry on last attempt
        if (attempt === HELP_CHAT_CONFIG.retry.maxAttempts) {
          break
        }

        // Calculate delay with exponential backoff
        const baseDelay = HELP_CHAT_CONFIG.retry.baseDelay
        const maxDelay = HELP_CHAT_CONFIG.retry.maxDelay
        const delayMs = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
        
        console.warn(`${context} failed (attempt ${attempt}), retrying in ${delayMs}ms:`, error)
        await delay(delayMs)
      }
    }

    // All retries failed
    throw createHelpChatError(
      `${context} failed after ${HELP_CHAT_CONFIG.retry.maxAttempts} attempts`,
      'NETWORK_ERROR',
      { originalError: lastError, attempts: HELP_CHAT_CONFIG.retry.maxAttempts }
    )
  }

  /**
   * Submit a help query with context
   */
  async submitQuery(request: HelpQueryRequest): Promise<HelpQueryResponse> {
    // Check rate limits
    this.checkRateLimit()

    // Check cache first
    const cachedResponse = this.cache.get('query', request)
    if (cachedResponse) {
      logger.debug('Returning cached help query response', { requestId: request.query.slice(0, 50) })
      return cachedResponse
    }

    // Validate request
    if (!request.query?.trim()) {
      throw createHelpChatError(
        'Query cannot be empty',
        'VALIDATION_ERROR',
        { request },
        false
      )
    }

    if (!request.context) {
      throw createHelpChatError(
        'Context is required for help queries',
        'VALIDATION_ERROR',
        { request },
        false
      )
    }

    const operation = async (): Promise<HelpQueryResponse> => {
      const startTime = Date.now()
      
      try {
        const response = await fetch(getApiUrl(HELP_CHAT_CONFIG.endpoints.query), {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(request)
        })

        if (!response.ok) {
          if (response.status === 429) {
            throw createHelpChatError(
              'Rate limit exceeded',
              'RATE_LIMIT_ERROR',
              { status: response.status }
            )
          }
          
          throw createHelpChatError(
            `HTTP ${response.status}: ${response.statusText}`,
            'NETWORK_ERROR',
            { status: response.status, statusText: response.statusText }
          )
        }

        const data: HelpQueryResponse = await response.json()
        
        // Add response time
        data.responseTimeMs = Date.now() - startTime

        // Cache successful response
        this.cache.set('query', request, data)
        
        return data
      } catch (error) {
        if (error instanceof Error && error.name === 'TypeError') {
          throw createHelpChatError(
            'Network error - please check your connection',
            'NETWORK_ERROR',
            { originalError: error.message }
          )
        }
        throw error
      }
    }

    try {
      const result = await this.retryWithBackoff(operation, 'Help query submission')
      this.recordRequest()
      return result
    } catch (error) {
      // Silently handle network errors - these are expected when backend is unavailable
      // Check if it's a HelpChatError with NETWORK_ERROR code
      if (error && typeof error === 'object' && 'code' in error) {
        const helpError = error as HelpChatError
        if (helpError.code === 'NETWORK_ERROR') {
          // Don't log to console - this is expected
          throw error
        }
      }
      
      // Log other types of errors
      console.error('Help query submission failed:', error)
      throw error
    }
  }

  /**
   * Submit a help query with streaming response
   */
  async *submitQueryStream(request: HelpQueryRequest): AsyncGenerator<string, HelpQueryResponse, unknown> {
    // Check rate limits
    this.checkRateLimit()

    // Validate request
    if (!request.query?.trim()) {
      throw createHelpChatError(
        'Query cannot be empty',
        'VALIDATION_ERROR',
        { request },
        false
      )
    }

    const operation = async function* (this: HelpChatAPIService): AsyncGenerator<string, HelpQueryResponse, unknown> {
      const startTime = Date.now()
      
      try {
        const response = await fetch(getApiUrl(HELP_CHAT_CONFIG.endpoints.query), {
          method: 'POST',
          headers: {
            ...this.getAuthHeaders(),
            'Accept': 'text/stream'
          },
          body: JSON.stringify({ ...request, stream: true })
        })

        if (!response.ok) {
          if (response.status === 429) {
            throw createHelpChatError(
              'Rate limit exceeded',
              'RATE_LIMIT_ERROR',
              { status: response.status }
            )
          }
          
          throw createHelpChatError(
            `HTTP ${response.status}: ${response.statusText}`,
            'NETWORK_ERROR',
            { status: response.status, statusText: response.statusText }
          )
        }

        // Check if response supports streaming
        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('text/stream') && !contentType?.includes('text/plain')) {
          // Fallback to regular JSON response
          const data: HelpQueryResponse = await response.json()
          data.responseTimeMs = Date.now() - startTime
          return data
        }

        // Process streaming response
        this.streamingHandler.reset()
        let fullResponse = ''
        
        for await (const chunk of this.streamingHandler.processStream(response)) {
          fullResponse += chunk
          yield chunk
        }

        // Return final response object
        const finalResponse: HelpQueryResponse = {
          response: fullResponse,
          sessionId: request.sessionId || `session-${Date.now()}`,
          sources: [],
          confidence: 0.8, // Default confidence for streaming
          responseTimeMs: Date.now() - startTime,
          proactiveTips: [],
          suggestedActions: []
        }

        return finalResponse
      } catch (error) {
        if (error instanceof Error && error.name === 'TypeError') {
          throw createHelpChatError(
            'Network error - please check your connection',
            'NETWORK_ERROR',
            { originalError: error.message }
          )
        }
        throw error
      }
    }.bind(this)

    try {
      this.recordRequest()
      const generator = operation()
      let result: IteratorResult<string, HelpQueryResponse>
      
      while (true) {
        result = await generator.next()
        if (result.done) {
          return result.value
        }
        yield result.value
      }
    } catch (error) {
      console.error('Streaming help query failed:', error)
      throw error
    }
  }

  /**
   * Get help context for current page
   */
  async getHelpContext(pageRoute: string): Promise<HelpContextResponse> {
    // Check cache first
    const cachedResponse = this.cache.get('context', { pageRoute })
    if (cachedResponse) {
      return cachedResponse
    }

    const operation = async (): Promise<HelpContextResponse> => {
      try {
        const url = `${getApiUrl(HELP_CHAT_CONFIG.endpoints.context)}?page_route=${encodeURIComponent(pageRoute)}`
        const response = await fetch(url, {
          method: 'GET',
          headers: this.getAuthHeaders()
        })

        if (!response.ok) {
          throw createHelpChatError(
            `HTTP ${response.status}: ${response.statusText}`,
            'NETWORK_ERROR',
            { status: response.status }
          )
        }

        const data: HelpContextResponse = await response.json()
        
        // Cache successful response
        this.cache.set('context', { pageRoute }, data, 10 * 60 * 1000) // 10 minutes cache
        
        return data
      } catch (error) {
        if (error instanceof Error && error.name === 'TypeError') {
          throw createHelpChatError(
            'Network error - please check your connection',
            'NETWORK_ERROR',
            { originalError: error.message }
          )
        }
        throw error
      }
    }

    try {
      return await this.retryWithBackoff(operation, 'Help context retrieval')
    } catch (error) {
      console.error('Help context retrieval failed:', error)
      throw error
    }
  }

  /**
   * Submit feedback for a help response
   */
  async submitFeedback(feedback: HelpFeedbackRequest): Promise<FeedbackResponse> {
    // Validate feedback
    if (!feedback.messageId) {
      throw createHelpChatError(
        'Message ID is required for feedback',
        'VALIDATION_ERROR',
        { feedback },
        false
      )
    }

    if (feedback.rating < 1 || feedback.rating > 5) {
      throw createHelpChatError(
        'Rating must be between 1 and 5',
        'VALIDATION_ERROR',
        { feedback },
        false
      )
    }

    const operation = async (): Promise<FeedbackResponse> => {
      try {
        const response = await fetch(getApiUrl(HELP_CHAT_CONFIG.endpoints.feedback), {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(feedback)
        })

        if (!response.ok) {
          throw createHelpChatError(
            `HTTP ${response.status}: ${response.statusText}`,
            'NETWORK_ERROR',
            { status: response.status }
          )
        }

        return await response.json()
      } catch (error) {
        if (error instanceof Error && error.name === 'TypeError') {
          throw createHelpChatError(
            'Network error - please check your connection',
            'NETWORK_ERROR',
            { originalError: error.message }
          )
        }
        throw error
      }
    }

    try {
      return await this.retryWithBackoff(operation, 'Feedback submission')
    } catch (error) {
      console.error('Feedback submission failed:', error)
      throw error
    }
  }

  /**
   * Dismiss a proactive tip
   */
  async dismissProactiveTip(tipId: string): Promise<FeedbackResponse> {
    const operation = async (): Promise<FeedbackResponse> => {
      try {
        const response = await fetch(getApiUrl('/ai/help/tips/dismiss'), {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ tip_id: tipId })
        })

        if (!response.ok) {
          throw createHelpChatError(
            `HTTP ${response.status}: ${response.statusText}`,
            'NETWORK_ERROR',
            { status: response.status }
          )
        }

        return await response.json()
      } catch (error) {
        if (error instanceof Error && error.name === 'TypeError') {
          throw createHelpChatError(
            'Network error - please check your connection',
            'NETWORK_ERROR',
            { originalError: error.message }
          )
        }
        throw error
      }
    }

    try {
      return await this.retryWithBackoff(operation, 'Tip dismissal')
    } catch (error) {
      console.error('Tip dismissal failed:', error)
      throw error
    }
  }
  async getProactiveTips(params: URLSearchParams): Promise<ProactiveTipsResponse> {
    // Check cache first
    const cacheKey = params.toString()
    const cachedResponse = this.cache.get('tips', { params: cacheKey })
    if (cachedResponse) {
      return cachedResponse
    }

    const operation = async (): Promise<ProactiveTipsResponse> => {
      try {
        const url = `${getApiUrl(HELP_CHAT_CONFIG.endpoints.tips)}?${params.toString()}`
        const response = await fetch(url, {
          method: 'GET',
          headers: this.getAuthHeaders()
        })

        if (!response.ok) {
          throw createHelpChatError(
            `HTTP ${response.status}: ${response.statusText}`,
            'NETWORK_ERROR',
            { status: response.status }
          )
        }

        const data: ProactiveTipsResponse = await response.json()
        
        // Cache successful response
        this.cache.set('tips', { params: cacheKey }, data, 15 * 60 * 1000) // 15 minutes cache
        
        return data
      } catch (error) {
        if (error instanceof Error && error.name === 'TypeError') {
          throw createHelpChatError(
            'Network error - please check your connection',
            'NETWORK_ERROR',
            { originalError: error.message }
          )
        }
        throw error
      }
    }

    try {
      return await this.retryWithBackoff(operation, 'Proactive tips retrieval')
    } catch (error) {
      console.error('Proactive tips retrieval failed:', error)
      throw error
    }
  }

  /**
   * Clear local cache
   */
  clearLocalCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size(),
      maxSize: HELP_CHAT_CONFIG.cache.maxSize
    }
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): {
    minute: { remaining: number; resetTime: number }
    hour: { remaining: number; resetTime: number }
  } {
    return {
      minute: {
        remaining: this.rateLimiterMinute.getRemainingRequests(),
        resetTime: this.rateLimiterMinute.getTimeUntilReset()
      },
      hour: {
        remaining: this.rateLimiterHour.getRemainingRequests(),
        resetTime: this.rateLimiterHour.getTimeUntilReset()
      }
    }
  }

  /**
   * Health check for the help chat API service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const startTime = Date.now()
      
      // Simple health check query
      const testRequest: HelpQueryRequest = {
        query: 'health check',
        context: {
          route: '/health',
          pageTitle: 'Health Check',
          userRole: 'system'
        },
        language: 'en'
      }

      await this.submitQuery(testRequest)
      
      const responseTime = Date.now() - startTime
      const cacheStats = this.getCacheStats()
      const rateLimitStatus = this.getRateLimitStatus()

      return {
        status: responseTime < 3000 ? 'healthy' : 'degraded',
        details: {
          responseTime,
          cache: cacheStats,
          rateLimits: rateLimitStatus,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<any[]> {
    try {
      // Set a very short timeout for this request (1 second for faster startup)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)

      const response = await apiRequest(HELP_CHAT_CONFIG.endpoints.languages, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.data || []
    } catch (error) {
      // Silently return empty array if endpoint is not available
      // This allows the app to work with fallback languages
      console.warn('Help chat languages endpoint not available, using fallback languages')
      return []
    }
  }

  /**
   * Get user's language preference
   */
  async getUserLanguagePreference(): Promise<{ language: string }> {
    try {
      const response = await apiRequest(HELP_CHAT_CONFIG.endpoints.languagePreference, {
        method: 'GET'
      })
      return response.data || { language: 'en' }
    } catch (error) {
      this.handleError('Failed to get language preference', error)
      throw error
    }
  }

  /**
   * Set user's language preference
   */
  async setUserLanguagePreference(language: string): Promise<FeedbackResponse> {
    try {
      const response = await apiRequest(HELP_CHAT_CONFIG.endpoints.languagePreference, {
        method: 'POST',
        body: JSON.stringify({ language })
      })
      return response.data || { success: true, message: 'Language preference updated' }
    } catch (error) {
      this.handleError('Failed to set language preference', error)
      throw error
    }
  }

  /**
   * Detect language of content
   */
  async detectLanguage(content: string): Promise<any> {
    try {
      return await apiRequest(HELP_CHAT_CONFIG.endpoints.detectLanguage, {
        method: 'POST',
        body: JSON.stringify(content)
      })
    } catch (error) {
      this.handleError('Failed to detect language', error)
      throw error
    }
  }

  /**
   * Translate content
   */
  async translateContent(
    content: string,
    targetLanguage: string,
    sourceLanguage: string = 'en',
    contentType: string = 'general'
  ): Promise<any> {
    try {
      return await apiRequest(HELP_CHAT_CONFIG.endpoints.translate, {
        method: 'POST',
        body: JSON.stringify({
          content,
          target_language: targetLanguage,
          source_language: sourceLanguage,
          content_type: contentType
        })
      })
    } catch (error) {
      this.handleError('Failed to translate content', error)
      throw error
    }
  }

  /**
   * Clear translation cache
   */
  async clearTranslationCache(language?: string): Promise<FeedbackResponse> {
    try {
      const url = language 
        ? `${HELP_CHAT_CONFIG.endpoints.clearCache}?language=${encodeURIComponent(language)}`
        : HELP_CHAT_CONFIG.endpoints.clearCache

      const response = await apiRequest(url, {
        method: 'DELETE'
      })
      return response.data || { success: true, message: 'Cache cleared successfully' }
    } catch (error) {
      this.handleError('Failed to clear translation cache', error)
      throw error
    }
  }

  /**
   * Get visual guide recommendations
   */
  async getVisualGuideRecommendations(context: {
    route: string
    pageTitle: string
    userRole: string
  }, limit: number = 5): Promise<any[]> {
    try {
      const url = `${getApiUrl('/ai/help/visual-guides/recommendations')}?page_route=${encodeURIComponent(context.route)}&page_title=${encodeURIComponent(context.pageTitle)}&user_role=${encodeURIComponent(context.userRole)}&limit=${limit}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        throw createHelpChatError(
          `HTTP ${response.status}: ${response.statusText}`,
          'NETWORK_ERROR',
          { status: response.status }
        )
      }

      return await response.json()
    } catch (error) {
      this.handleError('Failed to get visual guide recommendations', error)
      throw error
    }
  }

  /**
   * Get visual guide details
   */
  async getVisualGuide(guideId: string): Promise<any> {
    try {
      const response = await fetch(getApiUrl(`/ai/help/visual-guides/${guideId}`), {
        method: 'GET',
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw createHelpChatError(
            'Visual guide not found',
            'VALIDATION_ERROR',
            { guideId },
            false
          )
        }
        
        throw createHelpChatError(
          `HTTP ${response.status}: ${response.statusText}`,
          'NETWORK_ERROR',
          { status: response.status }
        )
      }

      return await response.json()
    } catch (error) {
      this.handleError('Failed to get visual guide', error)
      throw error
    }
  }

  /**
   * Track visual guide completion
   */
  async trackVisualGuideCompletion(
    guideId: string,
    completedSteps: string[],
    completionTime: number
  ): Promise<FeedbackResponse> {
    try {
      const response = await fetch(getApiUrl(`/ai/help/visual-guides/${guideId}/track-completion`), {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          completed_steps: completedSteps,
          completion_time: completionTime
        })
      })

      if (!response.ok) {
        throw createHelpChatError(
          `HTTP ${response.status}: ${response.statusText}`,
          'NETWORK_ERROR',
          { status: response.status }
        )
      }

      return await response.json()
    } catch (error) {
      this.handleError('Failed to track visual guide completion', error)
      throw error
    }
  }

  /**
   * Get help chat performance metrics (Admin only)
   */
  async getPerformanceMetrics(): Promise<any> {
    try {
      return await apiRequest('/ai/help/performance/metrics', {
        method: 'GET'
      })
    } catch (error) {
      this.handleError('Failed to get performance metrics', error)
      throw error
    }
  }

  /**
   * Clear help chat cache (Admin only)
   */
  async clearCache(pattern: string = '*'): Promise<any> {
    try {
      return await apiRequest('/ai/help/performance/cache/clear', {
        method: 'POST',
        body: JSON.stringify({ pattern })
      })
    } catch (error) {
      this.handleError('Failed to clear cache', error)
      throw error
    }
  }

  /**
   * Get help chat health status
   */
  async getHealthStatus(): Promise<any> {
    try {
      return await apiRequest('/ai/help/performance/health', {
        method: 'GET'
      })
    } catch (error) {
      this.handleError('Failed to get health status', error)
      throw error
    }
  }
  /**
   * Handle errors consistently
   */
  private handleError(message: string, error: any): void {
    console.error(`${message}:`, error)
  }
}

// Singleton instance
export const helpChatAPI = new HelpChatAPIService()

// Export utility functions
export { createHelpChatError, isRetryableError }

// Export configuration for testing
export { HELP_CHAT_CONFIG }