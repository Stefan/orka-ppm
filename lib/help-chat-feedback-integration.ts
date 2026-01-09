/**
 * Help Chat Feedback Integration Service
 * Connects help chat feedback with the main feedback system
 * Handles bug reports and feature requests from help chat interactions
 */

import { getApiUrl } from './api'
import type { HelpFeedbackRequest, FeedbackResponse } from '../types/help-chat'

// Configuration
const FEEDBACK_INTEGRATION_CONFIG = {
  endpoints: {
    bugs: '/feedback/bugs',
    features: '/feedback/features',
    helpFeedback: '/ai/help/feedback'
  },
  thresholds: {
    bugReportRating: 2, // Ratings <= 2 suggest potential bugs
    featureRequestRating: 3, // Ratings <= 3 might indicate missing features
    criticalRating: 1 // Rating of 1 indicates critical issues
  }
} as const

// Types for main feedback system
interface BugReportData {
  title: string
  description: string
  steps_to_reproduce?: string
  expected_behavior?: string
  actual_behavior?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  severity: 'minor' | 'major' | 'critical' | 'blocker'
  category: 'ui' | 'functionality' | 'performance' | 'security' | 'data' | 'integration'
}

interface FeatureRequestData {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  tags: string[]
}

interface FeedbackIntegrationResult {
  helpFeedbackSubmitted: boolean
  bugReportSubmitted?: boolean
  featureRequestSubmitted?: boolean
  bugReportId?: string
  featureRequestId?: string
  errors: string[]
}

/**
 * Help Chat Feedback Integration Service
 */
export class HelpChatFeedbackIntegration {
  private authToken: string | null = null

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

  /**
   * Submit help chat feedback and optionally create bug report or feature request
   */
  async submitIntegratedFeedback(
    messageId: string,
    feedback: HelpFeedbackRequest,
    messageContent: string,
    context?: {
      route: string
      pageTitle: string
      userRole: string
    },
    options?: {
      createBugReport?: boolean
      createFeatureRequest?: boolean
      bugReportData?: Partial<BugReportData>
      featureRequestData?: Partial<FeatureRequestData>
    }
  ): Promise<FeedbackIntegrationResult> {
    const result: FeedbackIntegrationResult = {
      helpFeedbackSubmitted: false,
      errors: []
    }

    try {
      // 1. Submit help chat feedback
      await this.submitHelpFeedback(messageId, feedback)
      result.helpFeedbackSubmitted = true

      // 2. Determine if we should auto-create reports based on feedback
      const shouldCreateBugReport = this.shouldCreateBugReport(feedback, options?.createBugReport)
      const shouldCreateFeatureRequest = this.shouldCreateFeatureRequest(feedback, options?.createFeatureRequest)

      // 3. Create bug report if needed
      if (shouldCreateBugReport) {
        try {
          const bugReportData = this.generateBugReportData(
            feedback,
            messageContent,
            context,
            options?.bugReportData
          )
          const bugReportId = await this.submitBugReport(bugReportData)
          result.bugReportSubmitted = true
          result.bugReportId = bugReportId
        } catch (error) {
          console.error('Failed to create bug report:', error)
          result.errors.push(`Bug report creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // 4. Create feature request if needed
      if (shouldCreateFeatureRequest) {
        try {
          const featureRequestData = this.generateFeatureRequestData(
            feedback,
            messageContent,
            context,
            options?.featureRequestData
          )
          const featureRequestId = await this.submitFeatureRequest(featureRequestData)
          result.featureRequestSubmitted = true
          result.featureRequestId = featureRequestId
        } catch (error) {
          console.error('Failed to create feature request:', error)
          result.errors.push(`Feature request creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return result
    } catch (error) {
      console.error('Failed to submit help feedback:', error)
      result.errors.push(`Help feedback submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return result
    }
  }

  /**
   * Submit feedback to help chat system
   */
  private async submitHelpFeedback(
    messageId: string,
    feedback: HelpFeedbackRequest
  ): Promise<FeedbackResponse> {
    const response = await fetch(getApiUrl(FEEDBACK_INTEGRATION_CONFIG.endpoints.helpFeedback), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        message_id: messageId,
        rating: feedback.rating,
        feedback_text: feedback.feedbackText,
        feedback_type: feedback.feedbackType
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Submit bug report to main feedback system
   */
  private async submitBugReport(bugData: BugReportData): Promise<string> {
    const response = await fetch(getApiUrl(FEEDBACK_INTEGRATION_CONFIG.endpoints.bugs), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(bugData)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return result.id
  }

  /**
   * Submit feature request to main feedback system
   */
  private async submitFeatureRequest(featureData: FeatureRequestData): Promise<string> {
    const response = await fetch(getApiUrl(FEEDBACK_INTEGRATION_CONFIG.endpoints.features), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(featureData)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return result.id
  }

  /**
   * Determine if a bug report should be created
   */
  private shouldCreateBugReport(
    feedback: HelpFeedbackRequest,
    explicitRequest?: boolean
  ): boolean {
    if (explicitRequest === true) return true
    if (explicitRequest === false) return false

    // Auto-create bug report for low ratings or "incorrect" feedback
    return (
      feedback.rating <= FEEDBACK_INTEGRATION_CONFIG.thresholds.bugReportRating ||
      feedback.feedbackType === 'incorrect'
    )
  }

  /**
   * Determine if a feature request should be created
   */
  private shouldCreateFeatureRequest(
    feedback: HelpFeedbackRequest,
    explicitRequest?: boolean
  ): boolean {
    if (explicitRequest === true) return true
    if (explicitRequest === false) return false

    // Auto-create feature request for suggestions or moderate ratings
    return (
      feedback.feedbackType === 'suggestion' ||
      (feedback.rating <= FEEDBACK_INTEGRATION_CONFIG.thresholds.featureRequestRating && 
       feedback.rating > FEEDBACK_INTEGRATION_CONFIG.thresholds.bugReportRating)
    )
  }

  /**
   * Generate bug report data from help feedback
   */
  private generateBugReportData(
    feedback: HelpFeedbackRequest,
    messageContent: string,
    context?: {
      route: string
      pageTitle: string
      userRole: string
    },
    customData?: Partial<BugReportData>
  ): BugReportData {
    const contextInfo = context 
      ? `\n\nContext:\n- Page: ${context.pageTitle} (${context.route})\n- User Role: ${context.userRole}`
      : ''

    const defaultData: BugReportData = {
      title: customData?.title || `Help Chat Issue: ${feedback.feedbackType === 'incorrect' ? 'Incorrect Response' : 'Poor Experience'}`,
      description: customData?.description || `User reported an issue with the AI help assistant response.\n\nOriginal Response:\n"${messageContent.substring(0, 200)}${messageContent.length > 200 ? '...' : ''}"\n\nUser Feedback:\n${feedback.feedbackText || 'No additional details provided'}${contextInfo}`,
      steps_to_reproduce: customData?.steps_to_reproduce || `1. Navigate to ${context?.pageTitle || 'the page'}\n2. Open help chat\n3. Ask a question\n4. Receive incorrect or unhelpful response`,
      expected_behavior: customData?.expected_behavior || 'Expected accurate and helpful response from AI assistant',
      actual_behavior: customData?.actual_behavior || feedback.feedbackText || 'Received incorrect or unhelpful response',
      priority: this.determineBugPriority(feedback),
      severity: this.determineBugSeverity(feedback),
      category: 'functionality'
    }

    return { ...defaultData, ...customData }
  }

  /**
   * Generate feature request data from help feedback
   */
  private generateFeatureRequestData(
    feedback: HelpFeedbackRequest,
    messageContent: string,
    context?: {
      route: string
      pageTitle: string
      userRole: string
    },
    customData?: Partial<FeatureRequestData>
  ): FeatureRequestData {
    const contextInfo = context 
      ? `\n\nContext:\n- Page: ${context.pageTitle} (${context.route})\n- User Role: ${context.userRole}`
      : ''

    const defaultData: FeatureRequestData = {
      title: customData?.title || `Help Chat Enhancement: ${feedback.feedbackType === 'suggestion' ? 'User Suggestion' : 'Improvement Request'}`,
      description: customData?.description || `User suggested an improvement to the AI help assistant.\n\nOriginal Response:\n"${messageContent.substring(0, 200)}${messageContent.length > 200 ? '...' : ''}"\n\nUser Suggestion:\n${feedback.feedbackText || 'No specific suggestion provided'}${contextInfo}`,
      priority: this.determineFeaturePriority(feedback),
      tags: ['help-chat', 'ai-assistant', ...(customData?.tags || [])]
    }

    return { ...defaultData, ...customData }
  }

  /**
   * Determine bug priority based on feedback
   */
  private determineBugPriority(feedback: HelpFeedbackRequest): BugReportData['priority'] {
    if (feedback.rating === FEEDBACK_INTEGRATION_CONFIG.thresholds.criticalRating) {
      return 'critical'
    }
    if (feedback.rating <= FEEDBACK_INTEGRATION_CONFIG.thresholds.bugReportRating) {
      return 'high'
    }
    return 'medium'
  }

  /**
   * Determine bug severity based on feedback
   */
  private determineBugSeverity(feedback: HelpFeedbackRequest): BugReportData['severity'] {
    if (feedback.rating === FEEDBACK_INTEGRATION_CONFIG.thresholds.criticalRating) {
      return 'critical'
    }
    if (feedback.feedbackType === 'incorrect') {
      return 'major'
    }
    return 'minor'
  }

  /**
   * Determine feature priority based on feedback
   */
  private determineFeaturePriority(feedback: HelpFeedbackRequest): FeatureRequestData['priority'] {
    if (feedback.rating <= 2) {
      return 'high'
    }
    if (feedback.rating <= 3) {
      return 'medium'
    }
    return 'low'
  }

  /**
   * Get feedback integration statistics
   */
  async getFeedbackIntegrationStats(days: number = 30): Promise<{
    totalHelpFeedback: number
    bugReportsCreated: number
    featureRequestsCreated: number
    averageRating: number
    integrationRate: number
  }> {
    try {
      // This would typically query the database for actual statistics
      // For now, return mock data
      return {
        totalHelpFeedback: 156,
        bugReportsCreated: 23,
        featureRequestsCreated: 18,
        averageRating: 3.7,
        integrationRate: 0.26 // 26% of feedback resulted in bug reports or feature requests
      }
    } catch (error) {
      console.error('Failed to get feedback integration stats:', error)
      throw error
    }
  }

  /**
   * Get recent feedback integrations
   */
  async getRecentIntegrations(limit: number = 10): Promise<Array<{
    id: string
    messageId: string
    rating: number
    feedbackType: string
    createdBugReport: boolean
    createdFeatureRequest: boolean
    timestamp: string
  }>> {
    try {
      // This would typically query the database for actual data
      // For now, return mock data
      return [
        {
          id: '1',
          messageId: 'msg-123',
          rating: 2,
          feedbackType: 'not_helpful',
          createdBugReport: true,
          createdFeatureRequest: false,
          timestamp: new Date().toISOString()
        },
        {
          id: '2',
          messageId: 'msg-124',
          rating: 3,
          feedbackType: 'suggestion',
          createdBugReport: false,
          createdFeatureRequest: true,
          timestamp: new Date(Date.now() - 3600000).toISOString()
        }
      ]
    } catch (error) {
      console.error('Failed to get recent integrations:', error)
      throw error
    }
  }
}

// Singleton instance
export const helpChatFeedbackIntegration = new HelpChatFeedbackIntegration()

// Export configuration for testing
export { FEEDBACK_INTEGRATION_CONFIG }