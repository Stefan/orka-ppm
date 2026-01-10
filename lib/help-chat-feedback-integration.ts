/**
 * Help Chat Feedback Integration
 * Handles feedback collection and integration with the help chat system
 */

import type {
  HelpFeedbackRequest,
  FeedbackResponse,
  ChatMessage,
  HelpChatAnalytics,
  HelpChatEvent
} from '../types/help-chat'
import { helpChatAPI } from './help-chat-api'
import { logger } from './monitoring/logger'

export interface FeedbackMetrics {
  totalFeedback: number
  averageRating: number
  helpfulCount: number
  notHelpfulCount: number
  suggestionCount: number
  responseTimeMs: number
}

export interface FeedbackAnalytics {
  messageId: string
  rating: number
  feedbackType: string
  timestamp: Date
  sessionId: string
  context: any
}

export class HelpChatFeedbackIntegration {
  private feedbackCache: Map<string, FeedbackAnalytics> = new Map()
  private authToken: string | null = null
  private metrics: FeedbackMetrics = {
    totalFeedback: 0,
    averageRating: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
    suggestionCount: 0,
    responseTimeMs: 0
  }

  setAuthToken(token: string) {
    this.authToken = token
  }

  async submitFeedback(
    messageId: string,
    feedback: HelpFeedbackRequest,
    context?: any
  ): Promise<FeedbackResponse> {
    try {
      const startTime = Date.now()
      
      // Submit feedback to API
      const response = await helpChatAPI.submitFeedback(feedback)
      
      // Track analytics
      const analytics: FeedbackAnalytics = {
        messageId,
        rating: feedback.rating,
        feedbackType: feedback.feedbackType,
        timestamp: new Date(),
        sessionId: context?.sessionId || 'unknown',
        context
      }
      
      this.feedbackCache.set(messageId, analytics)
      this.updateMetrics(analytics, Date.now() - startTime)
      
      logger.info('Feedback submitted successfully', {
        messageId,
        rating: feedback.rating,
        type: feedback.feedbackType
      })
      
      return response
    } catch (error) {
      logger.error('Failed to submit feedback', error, 'HelpChatFeedback')
      throw error
    }
  }

  async submitIntegratedFeedback(
    messageId: string,
    feedback: HelpFeedbackRequest,
    messageContent: string,
    context: any,
    options?: {
      createBugReport?: boolean
      createFeatureRequest?: boolean
    }
  ): Promise<{
    helpFeedbackSubmitted: boolean
    bugReportSubmitted: boolean
    featureRequestSubmitted: boolean
    bugReportId?: string
    featureRequestId?: string
    errors: string[]
  }> {
    const result = {
      helpFeedbackSubmitted: false,
      bugReportSubmitted: false,
      featureRequestSubmitted: false,
      bugReportId: undefined as string | undefined,
      featureRequestId: undefined as string | undefined,
      errors: [] as string[]
    }

    try {
      // Submit regular feedback
      await this.submitFeedback(messageId, feedback, context)
      result.helpFeedbackSubmitted = true

      // Auto-create bug report for low ratings
      if (feedback.rating <= 2 && (options?.createBugReport !== false)) {
        try {
          // Mock bug report creation - in real implementation, this would call a bug tracking API
          result.bugReportId = `bug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          result.bugReportSubmitted = true
          
          logger.info('Bug report created', {
            bugReportId: result.bugReportId,
            messageId,
            rating: feedback.rating
          })
        } catch (error) {
          result.errors.push('Failed to create bug report')
          logger.error('Failed to create bug report', error)
        }
      }

      // Auto-create feature request for suggestions
      if (feedback.feedbackType === 'suggestion' && (options?.createFeatureRequest !== false)) {
        try {
          // Mock feature request creation - in real implementation, this would call a feature request API
          result.featureRequestId = `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          result.featureRequestSubmitted = true
          
          logger.info('Feature request created', {
            featureRequestId: result.featureRequestId,
            messageId,
            feedbackType: feedback.feedbackType
          })
        } catch (error) {
          result.errors.push('Failed to create feature request')
          logger.error('Failed to create feature request', error)
        }
      }

      return result
    } catch (error) {
      result.errors.push('Failed to submit feedback')
      logger.error('Failed to submit integrated feedback', error)
      throw error
    }
  }

  private updateMetrics(analytics: FeedbackAnalytics, responseTime: number) {
    this.metrics.totalFeedback++
    this.metrics.responseTimeMs = (this.metrics.responseTimeMs + responseTime) / 2
    
    // Update rating average
    const totalRating = this.metrics.averageRating * (this.metrics.totalFeedback - 1) + analytics.rating
    this.metrics.averageRating = totalRating / this.metrics.totalFeedback
    
    // Update counts
    switch (analytics.feedbackType) {
      case 'helpful':
        this.metrics.helpfulCount++
        break
      case 'not_helpful':
        this.metrics.notHelpfulCount++
        break
      case 'suggestion':
        this.metrics.suggestionCount++
        break
    }
  }

  getFeedbackMetrics(): FeedbackMetrics {
    return { ...this.metrics }
  }

  getFeedbackForMessage(messageId: string): FeedbackAnalytics | undefined {
    return this.feedbackCache.get(messageId)
  }

  getAllFeedback(): FeedbackAnalytics[] {
    return Array.from(this.feedbackCache.values())
  }

  getFeedbackByRating(rating: number): FeedbackAnalytics[] {
    return this.getAllFeedback().filter(f => f.rating === rating)
  }

  getFeedbackByType(type: string): FeedbackAnalytics[] {
    return this.getAllFeedback().filter(f => f.feedbackType === type)
  }

  getRecentFeedback(hours: number = 24): FeedbackAnalytics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.getAllFeedback().filter(f => f.timestamp > cutoff)
  }

  generateFeedbackReport(): {
    summary: FeedbackMetrics
    trends: {
      dailyFeedback: number[]
      ratingDistribution: Record<number, number>
      typeDistribution: Record<string, number>
    }
    insights: string[]
  } {
    const allFeedback = this.getAllFeedback()
    
    // Calculate daily feedback for last 7 days
    const dailyFeedback = Array(7).fill(0)
    const now = new Date()
    
    allFeedback.forEach(feedback => {
      const daysAgo = Math.floor((now.getTime() - feedback.timestamp.getTime()) / (24 * 60 * 60 * 1000))
      if (daysAgo < 7) {
        dailyFeedback[6 - daysAgo]++
      }
    })
    
    // Rating distribution
    const ratingDistribution: Record<number, number> = {}
    allFeedback.forEach(feedback => {
      ratingDistribution[feedback.rating] = (ratingDistribution[feedback.rating] || 0) + 1
    })
    
    // Type distribution
    const typeDistribution: Record<string, number> = {}
    allFeedback.forEach(feedback => {
      typeDistribution[feedback.feedbackType] = (typeDistribution[feedback.feedbackType] || 0) + 1
    })
    
    // Generate insights
    const insights: string[] = []
    
    if (this.metrics.averageRating > 4) {
      insights.push('Users are highly satisfied with help responses')
    } else if (this.metrics.averageRating < 3) {
      insights.push('Help response quality needs improvement')
    }
    
    if (this.metrics.suggestionCount > this.metrics.totalFeedback * 0.2) {
      insights.push('High number of suggestions indicates areas for improvement')
    }
    
    if (this.metrics.responseTimeMs > 2000) {
      insights.push('Feedback submission response time could be improved')
    }
    
    return {
      summary: this.metrics,
      trends: {
        dailyFeedback,
        ratingDistribution,
        typeDistribution
      },
      insights
    }
  }

  clearFeedbackCache() {
    this.feedbackCache.clear()
    this.metrics = {
      totalFeedback: 0,
      averageRating: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      suggestionCount: 0,
      responseTimeMs: 0
    }
  }

  exportFeedbackData(): string {
    return JSON.stringify({
      metrics: this.metrics,
      feedback: this.getAllFeedback(),
      exportedAt: new Date().toISOString()
    }, null, 2)
  }

  async importFeedbackData(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data)
      
      if (parsed.metrics) {
        this.metrics = parsed.metrics
      }
      
      if (parsed.feedback && Array.isArray(parsed.feedback)) {
        this.feedbackCache.clear()
        parsed.feedback.forEach((feedback: FeedbackAnalytics) => {
          this.feedbackCache.set(feedback.messageId, {
            ...feedback,
            timestamp: new Date(feedback.timestamp)
          })
        })
      }
      
      logger.info('Feedback data imported successfully')
    } catch (error) {
      logger.error('Failed to import feedback data', error)
      throw error
    }
  }
}

// Export singleton instance
export const helpChatFeedbackIntegration = new HelpChatFeedbackIntegration()

// Export default
export default helpChatFeedbackIntegration