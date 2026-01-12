/**
 * Help Chat API Service Usage Examples
 * Demonstrates how to use the comprehensive API integration service
 */

import { helpChatAPI } from './api'
import type {
  HelpQueryRequest,
  HelpQueryResponse,
  HelpFeedbackRequest
} from '../../types/help-chat'

/**
 * Example: Basic help query submission
 */
export async function submitBasicHelpQuery() {
  try {
    // Set authentication token (usually from your auth provider)
    helpChatAPI.setAuthToken('your-auth-token-here')

    // Prepare the query request
    const request: HelpQueryRequest = {
      query: 'How do I create a new project?',
      context: {
        route: '/projects',
        pageTitle: 'Projects',
        userRole: 'user',
        currentPortfolio: 'portfolio-123'
      },
      language: 'en',
      sessionId: 'session-abc123',
      includeProactiveTips: true
    }

    // Submit the query
    const response = await helpChatAPI.submitQuery(request)

    console.log('Help response:', response.response)
    console.log('Confidence:', response.confidence)
    console.log('Sources:', response.sources)
    console.log('Response time:', response.responseTimeMs, 'ms')

    // Handle proactive tips if available
    if (response.proactiveTips && response.proactiveTips.length > 0) {
      console.log('Proactive tips:', response.proactiveTips)
    }

    return response
  } catch (error) {
    console.error('Failed to submit help query:', error)
    throw error
  }
}

/**
 * Example: Streaming help query for real-time responses
 */
export async function submitStreamingHelpQuery(): Promise<{ content: string; metadata: HelpQueryResponse } | undefined> {
  try {
    const request: HelpQueryRequest = {
      query: 'Explain the Monte Carlo simulation feature in detail',
      context: {
        route: '/monte-carlo',
        pageTitle: 'Monte Carlo Simulations',
        userRole: 'analyst'
      },
      language: 'en'
    }

    console.log('Starting streaming query...')
    
    // Process streaming response
    const generator = helpChatAPI.submitQueryStream(request)
    let fullResponse = ''

    for await (const chunk of generator) {
      if (typeof chunk === 'string') {
        fullResponse += chunk
        console.log('Received chunk:', chunk)
        
        // You can update UI here in real-time
        // updateChatUI(fullResponse)
      } else {
        // Final response object
        console.log('Final response metadata:', chunk)
        return { content: fullResponse, metadata: chunk }
      }
    }
    
    // Fallback return
    return undefined
  } catch (error) {
    console.error('Streaming query failed:', error)
    throw error
  }
}

/**
 * Example: Submit feedback for a help response
 */
export async function submitHelpFeedback(messageId: string) {
  try {
    const feedback: HelpFeedbackRequest = {
      messageId,
      rating: 5,
      feedbackText: 'Very helpful explanation!',
      feedbackType: 'helpful'
    }

    const result = await helpChatAPI.submitFeedback(feedback)
    
    console.log('Feedback submitted:', result.success)
    console.log('Tracking ID:', result.trackingId)

    return result
  } catch (error) {
    console.error('Failed to submit feedback:', error)
    throw error
  }
}

/**
 * Example: Get contextual help information
 */
export async function getContextualHelp(pageRoute: string) {
  try {
    const contextResponse = await helpChatAPI.getHelpContext(pageRoute)
    
    console.log('Page context:', contextResponse.context)
    console.log('Available actions:', contextResponse.availableActions)
    console.log('Relevant tips:', contextResponse.relevantTips)

    return contextResponse
  } catch (error) {
    console.error('Failed to get help context:', error)
    throw error
  }
}

/**
 * Example: Get proactive tips for current context
 */
export async function getProactiveTips(context: string) {
  try {
    const tipsResponse = await helpChatAPI.getProactiveTips(context)
    
    console.log('Available tips:', tipsResponse.tips)
    console.log('Context:', tipsResponse.context)

    // Filter tips by priority
    const highPriorityTips = tipsResponse.tips.filter(tip => tip.priority === 'high')
    console.log('High priority tips:', highPriorityTips)

    return tipsResponse
  } catch (error) {
    console.error('Failed to get proactive tips:', error)
    throw error
  }
}

/**
 * Example: Error handling with retry logic
 */
export async function handleHelpQueryWithRetry() {
  try {
    const request: HelpQueryRequest = {
      query: 'What are the system requirements?',
      context: {
        route: '/admin',
        pageTitle: 'Administration',
        userRole: 'admin'
      },
      language: 'en'
    }

    // The API service automatically handles retries for network errors
    const response = await helpChatAPI.submitQuery(request)
    return response
  } catch (error) {
    // Handle different error types
    if (error && typeof error === 'object' && 'code' in error) {
      const helpError = error as any
      
      switch (helpError.code) {
        case 'RATE_LIMIT_ERROR':
          console.log('Rate limited. Please wait before trying again.')
          // Show user-friendly rate limit message
          break
        case 'NETWORK_ERROR':
          console.log('Network error. Please check your connection.')
          // Show network error message
          break
        case 'VALIDATION_ERROR':
          console.log('Invalid request. Please check your input.')
          // Show validation error message
          break
        default:
          console.log('Unknown error occurred.')
      }
    }
    
    throw error
  }
}

/**
 * Example: Monitor API service health
 */
export async function monitorAPIHealth() {
  try {
    const healthStatus = await helpChatAPI.healthCheck()
    
    console.log('API Health Status:', healthStatus.status)
    console.log('Response Time:', healthStatus.details.responseTime)
    console.log('Cache Stats:', healthStatus.details.cache)
    console.log('Rate Limits:', healthStatus.details.rateLimits)

    // Take action based on health status
    switch (healthStatus.status) {
      case 'healthy':
        console.log('✅ API is healthy')
        break
      case 'degraded':
        console.log('⚠️ API is degraded - slower than expected')
        break
      case 'unhealthy':
        console.log('❌ API is unhealthy')
        // Maybe show fallback UI or cached responses
        break
    }

    return healthStatus
  } catch (error) {
    console.error('Health check failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { status: 'unhealthy' as const, details: { error: errorMessage } }
  }
}

/**
 * Example: Cache management
 */
export function manageCacheAndRateLimits() {
  // Get current cache statistics
  const cacheStats = helpChatAPI.getCacheStats()
  console.log('Cache size:', cacheStats.size, '/', cacheStats.maxSize)

  // Get rate limit status
  const rateLimitStatus = helpChatAPI.getRateLimitStatus()
  console.log('Remaining requests this minute:', rateLimitStatus.minute.remaining)
  console.log('Remaining requests this hour:', rateLimitStatus.hour.remaining)

  // Clear cache if needed (e.g., when user logs out)
  if (cacheStats.size > cacheStats.maxSize * 0.8) {
    console.log('Cache is getting full, clearing...')
    helpChatAPI.clearCache()
  }

  return { cacheStats, rateLimitStatus }
}

/**
 * Example: Multi-language support
 */
export async function submitMultiLanguageQuery() {
  try {
    // German query
    const germanRequest: HelpQueryRequest = {
      query: 'Wie erstelle ich ein neues Projekt?',
      context: {
        route: '/projects',
        pageTitle: 'Projekte',
        userRole: 'user'
      },
      language: 'de'
    }

    const germanResponse = await helpChatAPI.submitQuery(germanRequest)
    console.log('German response:', germanResponse.response)

    // French query
    const frenchRequest: HelpQueryRequest = {
      query: 'Comment créer un nouveau projet?',
      context: {
        route: '/projects',
        pageTitle: 'Projets',
        userRole: 'user'
      },
      language: 'fr'
    }

    const frenchResponse = await helpChatAPI.submitQuery(frenchRequest)
    console.log('French response:', frenchResponse.response)

    return { german: germanResponse, french: frenchResponse }
  } catch (error) {
    console.error('Multi-language query failed:', error)
    throw error
  }
}

/**
 * Example: Complete help chat workflow
 */
export async function completeHelpChatWorkflow() {
  try {
    // 1. Set authentication
    helpChatAPI.setAuthToken('user-auth-token')

    // 2. Check API health
    const health = await monitorAPIHealth()
    if (health.status === 'unhealthy') {
      throw new Error('API is not available')
    }

    // 3. Get contextual information
    const context = await getContextualHelp('/dashboard')

    // 4. Submit a help query
    const queryResponse = await submitBasicHelpQuery()

    // 5. Submit feedback
    const feedbackResponse = await submitHelpFeedback(queryResponse.sessionId)

    // 6. Get proactive tips
    const tips = await getProactiveTips('/dashboard')

    // 7. Monitor cache and rate limits
    const stats = manageCacheAndRateLimits()

    console.log('Complete workflow completed successfully!')
    
    return {
      health,
      context,
      queryResponse,
      feedbackResponse,
      tips,
      stats
    }
  } catch (error) {
    console.error('Complete workflow failed:', error)
    throw error
  }
}

// Export all examples for easy testing
export const examples = {
  submitBasicHelpQuery,
  submitStreamingHelpQuery,
  submitHelpFeedback,
  getContextualHelp,
  getProactiveTips,
  handleHelpQueryWithRetry,
  monitorAPIHealth,
  manageCacheAndRateLimits,
  submitMultiLanguageQuery,
  completeHelpChatWorkflow
}