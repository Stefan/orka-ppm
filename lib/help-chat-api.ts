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
  apiBaseUrl: process.env.NEXT_PUBLIC_HELP_CHAT_API_URL || '/api/help-chat',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
}

// Error handling
export function createHelpChatError(
  message: string,
  code: HelpChatError['code'] = 'UNKNOWN_ERROR',
  context?: Record<string, any>
): HelpChatError {
  const error = new Error(message) as HelpChatError
  error.code = code
  if (context) {
    error.context = context
  }
  error.retryable = code === 'NETWORK_ERROR' || code === 'RATE_LIMIT_ERROR'
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

  constructor(baseUrl: string = HELP_CHAT_CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl
  }

  setAuthToken(token: string) {
    this.authToken = token
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
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

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`
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
          errorData.message || `HTTP ${response.status}`,
          'VALIDATION_ERROR',
          { status: response.status, ...errorData }
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

    for (let i = 0; i < attempts; i++) {
      try {
        return await requestFn()
      } catch (error) {
        lastError = error

        if (!isRetryableError(error) || i === attempts - 1) {
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
    return this.retryRequest(() =>
      this.makeRequest<HelpQueryResponse>('/query', {
        method: 'POST',
        body: JSON.stringify(request)
      })
    )
  }

  async submitFeedback(request: HelpFeedbackRequest): Promise<FeedbackResponse> {
    return this.retryRequest(() =>
      this.makeRequest<FeedbackResponse>('/feedback', {
        method: 'POST',
        body: JSON.stringify(request)
      })
    )
  }

  async getProactiveTips(context: any): Promise<ProactiveTipsResponse> {
    return this.retryRequest(() =>
      this.makeRequest<ProactiveTipsResponse>('/tips', {
        method: 'POST',
        body: JSON.stringify({ context })
      })
    )
  }

  async getContextHelp(context: any): Promise<HelpContextResponse> {
    return this.retryRequest(() =>
      this.makeRequest<HelpContextResponse>('/context', {
        method: 'POST',
        body: JSON.stringify({ context })
      })
    )
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