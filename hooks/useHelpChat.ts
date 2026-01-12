'use client'

import { useMemo, useCallback } from 'react'
import { useHelpChat as useHelpChatContext } from '../app/providers/HelpChatProvider'
import { useVisualGuideIntegration } from '../components/help-chat/VisualGuideIntegration'
import type { 
  UseHelpChatReturn, 
  ChatMessage, 
  HelpChatUserPreferences 
} from '../types/help-chat'

/**
 * Enhanced useHelpChat hook with computed values and utility functions
 * Provides a comprehensive interface for help chat functionality
 */
export function useHelpChat(): UseHelpChatReturn {
  const context = useHelpChatContext()
  const visualGuideIntegration = useVisualGuideIntegration()
  
  if (!context) {
    throw new Error('useHelpChat must be used within a HelpChatProvider')
  }

  // Computed values
  const hasUnreadTips = useMemo(() => {
    return context.state.messages.some(
      message => message.type === 'tip' && !message.id.includes('read')
    )
  }, [context.state.messages])

  const canSendMessage = useMemo(() => {
    return !context.state.isLoading && 
           !context.state.isTyping && 
           context.state.isOpen &&
           !context.state.error
  }, [context.state.isLoading, context.state.isTyping, context.state.isOpen, context.state.error])

  const isSessionActive = useMemo(() => {
    return Boolean(context.state.sessionId) && context.state.messages.length > 0
  }, [context.state.sessionId, context.state.messages.length])

  const messageCount = useMemo(() => {
    return context.state.messages.filter(msg => msg.type !== 'system').length
  }, [context.state.messages])

  // Additional utility functions
  const getLastUserMessage = useCallback((): ChatMessage | null => {
    const userMessages = context.state.messages.filter(msg => msg.type === 'user')
    const lastMessage = userMessages[userMessages.length - 1]
    return lastMessage || null
  }, [context.state.messages])

  const getLastAssistantMessage = useCallback((): ChatMessage | null => {
    const assistantMessages = context.state.messages.filter(msg => msg.type === 'assistant')
    const lastMessage = assistantMessages[assistantMessages.length - 1]
    return lastMessage || null
  }, [context.state.messages])

  const getMessagesByType = useCallback((type: ChatMessage['type']): ChatMessage[] => {
    return context.state.messages.filter(msg => msg.type === type)
  }, [context.state.messages])

  const hasMessagesOfType = useCallback((type: ChatMessage['type']): boolean => {
    return context.state.messages.some(msg => msg.type === type)
  }, [context.state.messages])

  const getAverageResponseTime = useCallback((): number => {
    const assistantMessages = context.state.messages.filter(msg => msg.type === 'assistant')
    if (assistantMessages.length === 0) return 0

    // Calculate average based on message timestamps (simplified)
    let totalTime = 0
    let count = 0

    for (let i = 1; i < context.state.messages.length; i++) {
      const current = context.state.messages[i]
      const previous = context.state.messages[i - 1]
      
      if (current && previous && current.type === 'assistant' && previous.type === 'user') {
        totalTime += current.timestamp.getTime() - previous.timestamp.getTime()
        count++
      }
    }

    return count > 0 ? totalTime / count : 0
  }, [context.state.messages])

  const getSessionDuration = useCallback((): number => {
    if (context.state.messages.length === 0) return 0
    
    const firstMessage = context.state.messages[0]
    const lastMessage = context.state.messages[context.state.messages.length - 1]
    
    if (!firstMessage || !lastMessage) return 0
    
    return lastMessage.timestamp.getTime() - firstMessage.timestamp.getTime()
  }, [context.state.messages])

  const searchMessages = useCallback((query: string): ChatMessage[] => {
    const lowercaseQuery = query.toLowerCase()
    return context.state.messages.filter(msg => 
      msg.content.toLowerCase().includes(lowercaseQuery)
    )
  }, [context.state.messages])

  const getContextSummary = useCallback((): string => {
    const ctx = context.state.currentContext
    let summary = `Currently on ${ctx.pageTitle}`
    
    if (ctx.currentProject) {
      summary += ` (Project: ${ctx.currentProject})`
    }
    
    if (ctx.currentPortfolio) {
      summary += ` (Portfolio: ${ctx.currentPortfolio})`
    }
    
    summary += ` as ${ctx.userRole}`
    
    return summary
  }, [context.state.currentContext])

  const isFeatureEnabled = useCallback((feature: keyof HelpChatUserPreferences): boolean => {
    return Boolean(context.state.userPreferences[feature])
  }, [context.state.userPreferences])

  const getLanguageDisplayName = useCallback((): string => {
    const languageNames = {
      'en': 'English',
      'de': 'Deutsch',
      'fr': 'Français'
    }
    return languageNames[context.state.language] || 'English'
  }, [context.state.language])

  const canShowProactiveTips = useMemo(() => {
    return context.state.proactiveTipsEnabled && 
           context.state.userPreferences.proactiveTips &&
           context.state.userPreferences.tipFrequency !== 'off'
  }, [
    context.state.proactiveTipsEnabled, 
    context.state.userPreferences.proactiveTips,
    context.state.userPreferences.tipFrequency
  ])

  const getErrorMessage = useCallback((): string | null => {
    return context.state.error
  }, [context.state.error])

  const clearError = useCallback(() => {
    // This would need to be added to the context provider
    // For now, we'll just return a placeholder
    console.log('Clear error functionality would be implemented in context provider')
  }, [])

  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = getLastUserMessage()
    if (lastUserMessage && !context.state.isLoading) {
      await context.sendMessage(lastUserMessage.content)
    }
  }, [getLastUserMessage, context.sendMessage, context.state.isLoading])

  const getToggleButtonText = useCallback(() => {
    if (hasUnreadTips) return 'New tips available'
    if (context.state.isOpen) return 'Close help'
    return 'Get help'
  }, [hasUnreadTips, context.state.isOpen])

  // Return enhanced interface
  return {
    // Original context properties
    ...context,
    
    // Visual guide integration
    visualGuides: {
      isOpen: visualGuideIntegration.isGuideOpen,
      currentGuide: visualGuideIntegration.currentGuide,
      openGuides: visualGuideIntegration.openGuides,
      closeGuides: visualGuideIntegration.closeGuides,
      selectGuide: visualGuideIntegration.selectGuide,
      generateGuideActions: visualGuideIntegration.generateGuideActions,
      generateGuideSuggestions: visualGuideIntegration.generateGuideSuggestions
    },
    
    // Computed values
    hasUnreadTips,
    canSendMessage,
    isSessionActive,
    messageCount,
    
    // Additional utility functions
    getLastUserMessage,
    getLastAssistantMessage,
    getMessagesByType,
    hasMessagesOfType,
    getAverageResponseTime,
    getSessionDuration,
    searchMessages,
    getContextSummary,
    isFeatureEnabled,
    getLanguageDisplayName,
    canShowProactiveTips,
    getErrorMessage,
    clearError,
    retryLastMessage,
    getToggleButtonText
  }
}

// Additional specialized hooks for specific use cases

/**
 * Hook for managing help chat UI state
 */
export function useHelpChatUI() {
  const { 
    state, 
    toggleChat, 
    canSendMessage, 
    hasUnreadTips,
    isSessionActive 
  } = useHelpChat()

  const shouldShowToggle = useMemo(() => {
    return !state.isOpen || hasUnreadTips
  }, [state.isOpen, hasUnreadTips])

  const getToggleButtonText = useCallback(() => {
    if (hasUnreadTips) return 'New tips available'
    if (state.isOpen) return 'Close help'
    return 'Get help'
  }, [hasUnreadTips, state.isOpen])

  const getChatHeaderText = useCallback(() => {
    if (state.isLoading) return 'AI Assistant is thinking...'
    if (state.isTyping) return 'AI Assistant is typing...'
    if (state.error) return 'Help Assistant (Error)'
    return 'AI Help Assistant'
  }, [state.isLoading, state.isTyping, state.error])

  return {
    isOpen: state.isOpen,
    isLoading: state.isLoading,
    isTyping: state.isTyping,
    error: state.error,
    toggleChat,
    canSendMessage,
    hasUnreadTips,
    isSessionActive,
    shouldShowToggle,
    getToggleButtonText,
    getChatHeaderText
  }
}

/**
 * Hook for managing help chat messages
 */
export function useHelpChatMessages() {
  const { 
    state, 
    sendMessage, 
    clearMessages,
    getMessagesByType,
    searchMessages,
    submitFeedback
  } = useHelpChat()

  const userMessages = useMemo(() => 
    getMessagesByType('user'), 
    [getMessagesByType]
  )

  const assistantMessages = useMemo(() => 
    getMessagesByType('assistant'), 
    [getMessagesByType]
  )

  const systemMessages = useMemo(() => 
    getMessagesByType('system'), 
    [getMessagesByType]
  )

  const tipMessages = useMemo(() => 
    getMessagesByType('tip'), 
    [getMessagesByType]
  )

  const sendQuickMessage = useCallback(async (template: string, variables: Record<string, string> = {}) => {
    let message = template
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(`{{${key}}}`, value)
    })
    await sendMessage(message)
  }, [sendMessage])

  return {
    messages: state.messages,
    userMessages,
    assistantMessages,
    systemMessages,
    tipMessages,
    sendMessage,
    sendQuickMessage,
    clearMessages,
    searchMessages,
    submitFeedback,
    isLoading: state.isLoading,
    isTyping: state.isTyping
  }
}

/**
 * Hook for managing help chat preferences
 */
export function useHelpChatPreferences() {
  const { 
    state, 
    updatePreferences,
    isFeatureEnabled,
    getLanguageDisplayName
  } = useHelpChat()

  const toggleProactiveTips = useCallback(() => {
    updatePreferences({ 
      proactiveTips: !state.userPreferences.proactiveTips 
    })
  }, [updatePreferences, state.userPreferences.proactiveTips])

  const setLanguage = useCallback((language: 'en' | 'de' | 'fr') => {
    updatePreferences({ language })
  }, [updatePreferences])

  const setChatPosition = useCallback((position: 'right' | 'left') => {
    updatePreferences({ chatPosition: position })
  }, [updatePreferences])

  const setTipFrequency = useCallback((frequency: 'high' | 'medium' | 'low' | 'off') => {
    updatePreferences({ tipFrequency: frequency })
  }, [updatePreferences])

  const toggleSound = useCallback(() => {
    updatePreferences({ 
      soundEnabled: !state.userPreferences.soundEnabled 
    })
  }, [updatePreferences, state.userPreferences.soundEnabled])

  return {
    preferences: state.userPreferences,
    updatePreferences,
    toggleProactiveTips,
    setLanguage,
    setChatPosition,
    setTipFrequency,
    toggleSound,
    isFeatureEnabled,
    getLanguageDisplayName,
    currentLanguage: state.language
  }
}

export default useHelpChat