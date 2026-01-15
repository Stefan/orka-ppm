'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAuth } from '../app/providers/SupabaseAuthProvider'
import { getApiUrl } from '../lib/api/client'

/**
 * PMR-specific chat action types
 */
export type PMRChatAction = 
  | 'update_section'
  | 'generate_insight'
  | 'analyze_data'
  | 'suggest_content'
  | 'modify_content'
  | 'add_visualization'
  | 'export_report'

/**
 * PMR context for AI chat
 */
export interface PMRContext {
  reportId?: string
  projectId?: string
  reportMonth?: string
  reportYear?: number
  currentSection?: string
  templateId?: string
  reportStatus?: string
}

/**
 * Enhanced chat message with PMR-specific metadata
 */
export interface EnhancedChatMessage {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  action?: PMRChatAction
  actionData?: Record<string, any>
  suggestedChanges?: SuggestedChange[]
  confidence?: number
  sources?: Array<{type: string, count?: number, data?: string}>
}

/**
 * Suggested change from AI
 */
export interface SuggestedChange {
  id: string
  section: string
  changeType: 'add' | 'modify' | 'remove'
  content: string
  reason: string
  confidence: number
  applied: boolean
}

/**
 * PMR chat request
 */
export interface PMRChatRequest {
  message: string
  context: PMRContext
  action?: PMRChatAction
  sessionId?: string
}

/**
 * PMR chat response
 */
export interface PMRChatResponse {
  response: string
  action?: PMRChatAction
  actionData?: Record<string, any>
  suggestedChanges?: SuggestedChange[]
  confidence: number
  sources?: Array<{type: string, id: string, similarity: number}>
  sessionId: string
}

/**
 * Hook state
 */
interface UseEnhancedAIChatState {
  messages: EnhancedChatMessage[]
  isLoading: boolean
  error: string | null
  sessionId: string | null
  context: PMRContext
  pendingChanges: SuggestedChange[]
}

/**
 * Enhanced AI Chat Hook for PMR-specific interactions
 * 
 * Provides PMR context-aware chat functionality with:
 * - Section updates
 * - Insight generation
 * - Data analysis
 * - Content suggestions and modifications
 */
export function useEnhancedAIChat(initialContext: PMRContext = {}) {
  const { session } = useAuth()
  
  const [state, setState] = useState<UseEnhancedAIChatState>({
    messages: [],
    isLoading: false,
    error: null,
    sessionId: null,
    context: initialContext,
    pendingChanges: []
  })

  /**
   * Update PMR context
   */
  const updateContext = useCallback((newContext: Partial<PMRContext>) => {
    setState(prev => ({
      ...prev,
      context: { ...prev.context, ...newContext }
    }))
  }, [])

  /**
   * Send message to AI with PMR context
   */
  const sendMessage = useCallback(async (
    message: string,
    action?: PMRChatAction
  ): Promise<void> => {
    if (!session?.access_token) {
      setState(prev => ({
        ...prev,
        error: 'Authentication required'
      }))
      return
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }))

    // Add user message
    const userMessage: EnhancedChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
      action
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage]
    }))

    try {
      const request: PMRChatRequest = {
        message,
        context: state.context,
        action,
        sessionId: state.sessionId || undefined
      }

      const response = await fetch(getApiUrl('/reports/pmr/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: PMRChatResponse = await response.json()

      // Add assistant message
      const assistantMessage: EnhancedChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response,
        timestamp: new Date(),
        action: data.action,
        actionData: data.actionData,
        suggestedChanges: data.suggestedChanges,
        confidence: data.confidence,
        sources: data.sources?.map(s => ({
          type: s.type,
          count: 1,
          data: `${s.type}:${s.id} (${(s.similarity * 100).toFixed(1)}% match)`
        }))
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        sessionId: data.sessionId,
        pendingChanges: [
          ...prev.pendingChanges,
          ...(data.suggestedChanges || [])
        ],
        isLoading: false
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }))

      // Add error message to chat
      const errorChatMessage: EnhancedChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: `Error: ${errorMessage}`,
        timestamp: new Date()
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, errorChatMessage]
      }))
    }
  }, [session, state.context, state.sessionId])

  /**
   * Update report section via chat
   */
  const updateSection = useCallback(async (
    section: string,
    instruction: string
  ): Promise<void> => {
    updateContext({ currentSection: section })
    await sendMessage(
      `Update the ${section} section: ${instruction}`,
      'update_section'
    )
  }, [sendMessage, updateContext])

  /**
   * Generate AI insights for report
   */
  const generateInsight = useCallback(async (
    category: string,
    specificRequest?: string
  ): Promise<void> => {
    const message = specificRequest
      ? `Generate ${category} insight: ${specificRequest}`
      : `Generate ${category} insights for this report`
    
    await sendMessage(message, 'generate_insight')
  }, [sendMessage])

  /**
   * Analyze project data
   */
  const analyzeData = useCallback(async (
    dataType: string,
    analysisRequest: string
  ): Promise<void> => {
    await sendMessage(
      `Analyze ${dataType} data: ${analysisRequest}`,
      'analyze_data'
    )
  }, [sendMessage])

  /**
   * Request content suggestions
   */
  const suggestContent = useCallback(async (
    section: string,
    context?: string
  ): Promise<void> => {
    updateContext({ currentSection: section })
    const message = context
      ? `Suggest content for ${section}: ${context}`
      : `Suggest content for ${section} section`
    
    await sendMessage(message, 'suggest_content')
  }, [sendMessage, updateContext])

  /**
   * Modify existing content
   */
  const modifyContent = useCallback(async (
    section: string,
    modification: string
  ): Promise<void> => {
    updateContext({ currentSection: section })
    await sendMessage(
      `Modify ${section}: ${modification}`,
      'modify_content'
    )
  }, [sendMessage, updateContext])

  /**
   * Apply a suggested change
   */
  const applySuggestedChange = useCallback((changeId: string) => {
    setState(prev => ({
      ...prev,
      pendingChanges: prev.pendingChanges.map(change =>
        change.id === changeId
          ? { ...change, applied: true }
          : change
      )
    }))
  }, [])

  /**
   * Reject a suggested change
   */
  const rejectSuggestedChange = useCallback((changeId: string) => {
    setState(prev => ({
      ...prev,
      pendingChanges: prev.pendingChanges.filter(
        change => change.id !== changeId
      )
    }))
  }, [])

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      sessionId: null,
      pendingChanges: []
    }))
  }, [])

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }))
  }, [])

  /**
   * Get pending changes for a specific section
   */
  const getPendingChangesForSection = useCallback((section: string) => {
    return state.pendingChanges.filter(
      change => change.section === section && !change.applied
    )
  }, [state.pendingChanges])

  /**
   * Check if there are pending changes
   */
  const hasPendingChanges = useMemo(() => {
    return state.pendingChanges.some(change => !change.applied)
  }, [state.pendingChanges])

  /**
   * Get applied changes
   */
  const appliedChanges = useMemo(() => {
    return state.pendingChanges.filter(change => change.applied)
  }, [state.pendingChanges])

  /**
   * Quick action helpers
   */
  const quickActions = useMemo(() => ({
    summarizeProject: () => sendMessage(
      'Provide a comprehensive summary of the project status',
      'analyze_data'
    ),
    identifyRisks: () => sendMessage(
      'Identify and analyze key project risks',
      'generate_insight'
    ),
    analyzeBudget: () => sendMessage(
      'Analyze budget performance and variances',
      'analyze_data'
    ),
    reviewSchedule: () => sendMessage(
      'Review schedule performance and identify delays',
      'analyze_data'
    ),
    suggestImprovements: () => sendMessage(
      'Suggest improvements for this report',
      'suggest_content'
    )
  }), [sendMessage])

  return {
    // State
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    sessionId: state.sessionId,
    context: state.context,
    pendingChanges: state.pendingChanges,
    hasPendingChanges,
    appliedChanges,

    // Actions
    sendMessage,
    updateSection,
    generateInsight,
    analyzeData,
    suggestContent,
    modifyContent,
    applySuggestedChange,
    rejectSuggestedChange,
    clearMessages,
    clearError,
    updateContext,
    getPendingChangesForSection,

    // Quick actions
    quickActions
  }
}

export default useEnhancedAIChat
