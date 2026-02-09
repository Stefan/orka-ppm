'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from './SupabaseAuthProvider'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { useLanguage } from '../../hooks/useLanguage'
import { useTranslations } from '../../lib/i18n/context'
import { helpChatAPI } from '../../lib/help-chat/api'
import { helpChatFeedbackIntegration } from '../../lib/help-chat-feedback-integration'
import type {
  HelpChatState,
  HelpChatContextType,
  PageContext,
  HelpChatUserPreferences,
  ChatMessage,
  ProactiveTip,
  HelpQueryRequest,
  HelpQueryResponse,
  HelpFeedbackRequest,
  HelpChatStorage,
  HelpChatError
} from '../../types/help-chat'

// Default preferences
const DEFAULT_PREFERENCES: HelpChatUserPreferences = {
  language: 'en',
  proactiveTips: true,
  chatPosition: 'right',
  soundEnabled: false,
  tipFrequency: 'medium',
  theme: 'auto'
}

// Default state
const DEFAULT_STATE: HelpChatState = {
  isOpen: false,
  messages: [],
  isLoading: false,
  currentContext: {
    route: '/',
    pageTitle: 'Dashboard',
    userRole: 'user'
  },
  userPreferences: DEFAULT_PREFERENCES,
  sessionId: '',
  proactiveTipsEnabled: true,
  language: 'en',
  isTyping: false,
  error: null
}

// Storage keys
const STORAGE_KEYS = {
  PREFERENCES: 'help-chat-preferences',
  SESSION_ID: 'help-chat-session-id',
  DISMISSED_TIPS: 'help-chat-dismissed-tips',
  LAST_ACTIVE: 'help-chat-last-active'
} as const

// Create context
const HelpChatContext = createContext<HelpChatContextType | undefined>(undefined)

interface HelpChatProviderProps {
  children: React.ReactNode
}

export function HelpChatProvider({ children }: HelpChatProviderProps) {
  const { user, session } = useAuth()
  const { currentPortfolioId } = usePortfolio()
  const pathname = usePathname()
  const { 
    currentLanguage, 
    setLanguage, 
    getUserLanguagePreference,
    translateContent,
    detectLanguage,
    getLanguageName,
    formatDate,
    formatNumber
  } = useLanguage()
  const { t } = useTranslations()
  
  // State
  const [state, setState] = useState<HelpChatState>(DEFAULT_STATE)
  const [dismissedTips, setDismissedTips] = useState<string[]>([])
  
  // Refs for cleanup and persistence
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Generate session ID
  const generateSessionId = useCallback(() => {
    return `help-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Load preferences and session data from localStorage
  const loadStoredData = useCallback(() => {
    try {
      // Load preferences
      const storedPreferences = localStorage.getItem(STORAGE_KEYS.PREFERENCES)
      const preferences = storedPreferences 
        ? { ...DEFAULT_PREFERENCES, ...JSON.parse(storedPreferences) }
        : DEFAULT_PREFERENCES

      // Load or generate session ID
      let sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID)
      const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE)
      
      // Check if session is expired (24 hours)
      const isSessionExpired = lastActive 
        ? Date.now() - new Date(lastActive).getTime() > 24 * 60 * 60 * 1000
        : true

      if (!sessionId || isSessionExpired) {
        sessionId = generateSessionId()
        localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId)
      }

      // Load dismissed tips
      const storedDismissedTips = localStorage.getItem(STORAGE_KEYS.DISMISSED_TIPS)
      const dismissed = storedDismissedTips ? JSON.parse(storedDismissedTips) : []

      return { preferences, sessionId, dismissed }
    } catch (error) {
      console.error('Error loading help chat data from localStorage:', error)
      return {
        preferences: DEFAULT_PREFERENCES,
        sessionId: generateSessionId(),
        dismissed: []
      }
    }
  }, [generateSessionId])

  // Save data to localStorage with debouncing
  const saveToStorage = useCallback((data: Partial<HelpChatStorage>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        if (data.preferences) {
          localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(data.preferences))
        }
        if (data.sessionId) {
          localStorage.setItem(STORAGE_KEYS.SESSION_ID, data.sessionId)
        }
        if (data.lastActiveTime) {
          localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, data.lastActiveTime.toISOString())
        }
        
        // Update dismissed tips
        localStorage.setItem(STORAGE_KEYS.DISMISSED_TIPS, JSON.stringify(dismissedTips))
      } catch (error) {
        console.error('Error saving help chat data to localStorage:', error)
      }
    }, 500) // Debounce for 500ms
  }, [dismissedTips])

  // Detect page context
  const detectPageContext = useCallback((): PageContext => {
    const pathSegments = pathname.split('/').filter(Boolean)
    
    // Extract page information
    let pageTitle = t('dashboard.title')
    let currentProject: string | undefined
    let currentPortfolio: string | undefined
    let relevantData: Record<string, any> = {}

    // Determine page title and context based on route; fill relevantData for AI context
    switch (pathSegments[0]) {
      case 'dashboards':
        pageTitle = t('nav.dashboards')
        relevantData = { page: 'dashboards', hint: 'User is on dashboards – KPIs and variance alerts are relevant.' }
        break
      case 'projects':
        pageTitle = 'Projects'
        if (pathSegments[1]) {
          currentProject = pathSegments[1]
          pageTitle = `Project: ${pathSegments[1]}`
          relevantData = { page: 'project', projectId: pathSegments[1], hint: 'User is viewing a specific project.' }
        } else {
          relevantData = { page: 'projects', hint: 'User is on project list.' }
        }
        break
      case 'portfolios':
        pageTitle = t('nav.portfolios')
        if (pathSegments[1]) {
          currentPortfolio = pathSegments[1]
          relevantData = { page: 'portfolio', portfolioId: pathSegments[1], hint: 'User is viewing a portfolio detail.' }
        } else {
          relevantData = { page: 'portfolios', hint: 'User is on portfolio list.' }
        }
        break
      case 'resources':
        pageTitle = t('resources.title')
        relevantData = { page: 'resources', hint: 'User is on resource planning – utilization and allocation are relevant.' }
        break
      case 'risks':
        pageTitle = t('risks.title')
        relevantData = { page: 'risks', hint: 'User is on risk management.' }
        break
      case 'financials':
        pageTitle = t('financials.title')
        relevantData = { page: 'financials', hint: 'User is on financials – EAC, variance, budget, and costbook are relevant. Prefer answers about columns and variance.' }
        break
      case 'reports':
        pageTitle = t('reports.title')
        relevantData = { page: 'reports', hint: 'User is on reports.' }
        break
      case 'scenarios':
        pageTitle = t('scenarios.title')
        relevantData = { page: 'scenarios', hint: 'User is on scenarios – what-if and comparisons are relevant.' }
        break
      case 'monte-carlo':
        pageTitle = t('monteCarlo.title')
        relevantData = { page: 'monte-carlo', hint: 'User is on Monte Carlo simulations – risk and forecasts are relevant.' }
        break
      case 'changes':
        pageTitle = t('nav.changes')
        relevantData = { page: 'changes', hint: 'User is on change management.' }
        break
      case 'admin':
        pageTitle = 'Administration'
        relevantData = { page: 'admin', hint: 'User is in admin area.' }
        break
      default:
        pageTitle = t('dashboard.title')
        relevantData = { page: 'dashboard', hint: 'User is on main dashboard.' }
    }

    // Add user role context; prefer global portfolio context over path-derived
    const userRole = user?.role || 'user'
    const portfolioContext = currentPortfolioId || currentPortfolio || ''

    return {
      route: pathname,
      pageTitle,
      userRole,
      currentProject: currentProject || '',
      currentPortfolio: portfolioContext,
      relevantData
    }
  }, [pathname, user, t, currentPortfolioId])

  // Sync language preference TO server (one-way: client -> server)
  // DISABLED: Server sync causes HTTP 400 errors, local preference is sufficient
  const syncLanguageToServer = useCallback(async (language: string) => {
    // DISABLED: Server sync not needed, local preference works fine
    return
  }, [])

  // Initialize provider
  useEffect(() => {
    const { preferences, sessionId, dismissed } = loadStoredData()
    
    setState(prevState => ({
      ...prevState,
      userPreferences: preferences,
      sessionId,
      language: currentLanguage || preferences.language, // Use global language first
      proactiveTipsEnabled: preferences.proactiveTips,
      currentContext: detectPageContext()
    }))
    
    setDismissedTips(dismissed)

    // Set auth token for API services
    if (session?.access_token) {
      helpChatAPI.setAuthToken(session.access_token)
    }
  }, [session?.access_token, currentLanguage]) // Watch currentLanguage changes

  // Sync HelpChat language with global language
  useEffect(() => {
    console.log('🔍 [HelpChat] Language sync check:', {
      currentLanguage,
      stateLanguage: state.language,
      needsUpdate: currentLanguage && currentLanguage !== state.language,
      currentLanguageType: typeof currentLanguage,
      stateLanguageType: typeof state.language
    })
    
    if (currentLanguage && currentLanguage !== state.language) {
      console.log('✅ [HelpChat] Updating state.language from', state.language, 'to', currentLanguage)
      setState(prevState => {
        console.log('🔄 [HelpChat] setState callback - prevState.language:', prevState.language, '-> newLanguage:', currentLanguage)
        return {
          ...prevState,
          language: currentLanguage
        }
      })
    }
  }, [currentLanguage, state.language])

  // Debug: Log when currentLanguage from useLanguage hook changes
  useEffect(() => {
    console.log('🌐 [HelpChat] currentLanguage from useLanguage changed to:', currentLanguage)
  }, [currentLanguage])

  // Update context when route or portfolio changes
  useEffect(() => {
    const newContext = detectPageContext()
    setState(prevState => ({
      ...prevState,
      currentContext: newContext
    }))
    
    // Save last active time
    saveToStorage({ lastActiveTime: new Date() })
  }, [pathname, user?.role, currentPortfolioId, detectPageContext])

  // Session timeout management
  useEffect(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current)
    }

    // Set session timeout for 30 minutes of inactivity
    sessionTimeoutRef.current = setTimeout(() => {
      setState(prevState => ({
        ...prevState,
        sessionId: generateSessionId(),
        messages: []
      }))
    }, 30 * 60 * 1000)

    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current)
      }
    }
  }, [state.messages.length, generateSessionId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current)
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Toggle chat visibility
  const toggleChat = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      isOpen: !prevState.isOpen,
      error: null
    }))
  }, [])

  // Send message to help chat API
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || state.isLoading) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      type: 'user',
      content: message.trim(),
      timestamp: new Date()
    }

    // Add user message immediately
    setState(prevState => ({
      ...prevState,
      messages: [...prevState.messages, userMessage],
      isLoading: true,
      isTyping: true,
      error: null
    }))

    try {
      // Get the most current language - prefer currentLanguage from hook, fall back to state
      const effectiveLanguage = currentLanguage || state.language || 'en'
      
      console.log('🔍 [HelpChat] Language resolution:', {
        currentLanguage,
        stateLanguage: state.language,
        effectiveLanguage,
        currentLanguageType: typeof currentLanguage,
        currentLanguageLength: currentLanguage?.length
      })
      
      // Prepare request with CURRENT language (not state.language which might be stale)
      const request: HelpQueryRequest = {
        query: message.trim(),
        sessionId: state.sessionId,
        context: state.currentContext,
        language: effectiveLanguage,
        includeProactiveTips: state.proactiveTipsEnabled
      }

      console.log('📤 [HelpChat] Sending query:', {
        query: message.trim().substring(0, 50) + '...',
        language: request.language,
        currentLanguage,
        stateLanguage: state.language,
        requestContext: request.context,
        fullRequest: JSON.stringify(request).substring(0, 500)
      })

      // Use direct API route call (with mock support)
      const apiResponse = await fetch('/api/ai/help/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      if (!apiResponse.ok) {
        throw new Error(`API Error: ${apiResponse.status} ${apiResponse.statusText}`)
      }

      const data: HelpQueryResponse = await apiResponse.json()

      // Create assistant message (include queryId for help_query_feedback)
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        type: 'assistant',
        content: data.response,
        timestamp: new Date(),
        sources: data.sources,
        confidence: data.confidence,
        actions: data.suggestedActions || [],
        queryId: (data as HelpQueryResponse & { query_id?: string }).query_id ?? data.queryId
      }

      setState(prevState => ({
        ...prevState,
        messages: [...prevState.messages, assistantMessage],
        isLoading: false,
        isTyping: false,
        sessionId: data.sessionId
      }))

      // Save session ID if it changed
      if (data.sessionId !== state.sessionId) {
        saveToStorage({ sessionId: data.sessionId })
      }

      // Add proactive tips if available
      if (data.proactiveTips && data.proactiveTips.length > 0) {
        const tipMessages: ChatMessage[] = data.proactiveTips
          .filter(tip => !dismissedTips.includes(tip.id))
          .map(tip => ({
            id: `tip-${tip.id}`,
            type: 'tip' as const,
            content: `💡 **${tip.title}**\n\n${tip.content}`,
            timestamp: new Date(),
            actions: tip.actions || []
          }))

        if (tipMessages.length > 0) {
          setState(prevState => ({
            ...prevState,
            messages: [...prevState.messages, ...tipMessages]
          }))
        }
      }

    } catch (error) {
      // Only log non-network errors to console to reduce noise
      // Network errors are expected when backend is unavailable
      const isNetworkError = error && typeof error === 'object' && 'code' in error && 
        (error as HelpChatError).code === 'NETWORK_ERROR'
      
      if (!isNetworkError) {
        console.error('Error sending help message:', error)
      }
      
      let errorContent = 'Sorry, I encountered an error processing your request. Please try again.'
      
      // Handle specific error types
      if (error && typeof error === 'object' && 'code' in error) {
        const helpError = error as HelpChatError
        switch (helpError.code) {
          case 'RATE_LIMIT_ERROR':
            errorContent = 'You\'ve reached the rate limit. Please wait a moment before sending another message.'
            break
          case 'NETWORK_ERROR':
            errorContent = 'Help chat is currently unavailable. Please try again later.'
            break
          case 'VALIDATION_ERROR':
            errorContent = 'Invalid request. Please check your message and try again.'
            break
          default:
            errorContent = helpError.message || errorContent
        }
      }
      
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        type: 'system',
        content: errorContent,
        timestamp: new Date()
      }

      setState(prevState => ({
        ...prevState,
        messages: [...prevState.messages, errorMessage],
        isLoading: false,
        isTyping: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }))
    }
  }, [state.sessionId, state.currentContext, state.language, currentLanguage, state.proactiveTipsEnabled, state.isLoading, dismissedTips, saveToStorage])

  // Clear messages
  const clearMessages = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      messages: [],
      error: null
    }))
  }, [])

  // Update context
  const updateContext = useCallback((context: Partial<PageContext>) => {
    setState(prevState => ({
      ...prevState,
      currentContext: { ...prevState.currentContext, ...context }
    }))
  }, [])

  // Update preferences
  const updatePreferences = useCallback(async (preferences: Partial<HelpChatUserPreferences>) => {
    setState(prevState => {
      const newPreferences = { ...prevState.userPreferences, ...preferences }
      
      return {
        ...prevState,
        userPreferences: newPreferences,
        language: newPreferences.language,
        proactiveTipsEnabled: newPreferences.proactiveTips
      }
    })

    // Save to localStorage
    saveToStorage({ preferences: { ...state.userPreferences, ...preferences } })

    // If language changed, sync TO server (but don't change global app language)
    if (preferences.language) {
      try {
        await syncLanguageToServer(preferences.language)
      } catch (error) {
        console.error('Failed to update language preference on server:', error)
      }
    }
  }, [saveToStorage, syncLanguageToServer, state.userPreferences])

  // Dismiss tip
  const dismissTip = useCallback(async (tipId: string) => {
    try {
      // Update local state directly (API call removed for now)
      const newDismissedTips = [...dismissedTips, tipId]
      setDismissedTips(newDismissedTips)
      
      // Remove tip from messages if it exists
      setState(prevState => ({
        ...prevState,
        messages: prevState.messages.filter(msg => 
          !(msg.type === 'tip' && (msg.id === tipId || msg.id === `tip-${tipId}`))
        )
      }))
    } catch (error) {
      console.error('Error dismissing tip:', error)
      // Still remove from UI even if API call fails
      const newDismissedTips = [...dismissedTips, tipId]
      setDismissedTips(newDismissedTips)
      
      setState(prevState => ({
        ...prevState,
        messages: prevState.messages.filter(msg => 
          !(msg.type === 'tip' && (msg.id === tipId || msg.id === `tip-${tipId}`))
        )
      }))
    }
  }, [dismissedTips])

  // Submit feedback
  const submitFeedback = useCallback(async (messageId: string, feedback: HelpFeedbackRequest) => {
    try {
      // Find the message to get its content, context, and optional queryId (for help_query_feedback)
      const message = state.messages.find(msg => msg.id === messageId)
      const messageContent = message?.content || ''
      const feedbackWithQueryId: HelpFeedbackRequest = {
        ...feedback,
        messageId: feedback.messageId ?? messageId,
        queryId: message?.queryId ?? feedback.queryId
      }
      // Use integrated feedback service
      const result = await helpChatFeedbackIntegration.submitIntegratedFeedback(
        messageId,
        feedbackWithQueryId,
        messageContent,
        state.currentContext,
        {
          // Auto-create reports based on feedback type and rating
        }
      )
      
      // Show success message with integration results
      let successMessage = 'Thank you for your feedback! It helps us improve the help system.'
      
      if (result.bugReportSubmitted) {
        successMessage += ' A bug report has been created for our development team.'
      }
      
      if (result.featureRequestSubmitted) {
        successMessage += ' Your suggestion has been submitted as a feature request.'
      }
      
      if (result.errors.length > 0) {
        successMessage += ` Note: ${result.errors.join(' ')}`
      }
      
      const feedbackMessage: ChatMessage = {
        id: `msg-${Date.now()}-feedback`,
        type: 'system',
        content: successMessage,
        timestamp: new Date()
      }

      setState(prevState => ({
        ...prevState,
        messages: [...prevState.messages, feedbackMessage]
      }))

      return {
        success: result.helpFeedbackSubmitted,
        message: successMessage,
        trackingId: result.bugReportId || result.featureRequestId || ''
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      
      // Show error message
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-feedback-error`,
        type: 'system',
        content: 'Sorry, we couldn\'t submit your feedback right now. Please try again later.',
        timestamp: new Date()
      }

      setState(prevState => ({
        ...prevState,
        messages: [...prevState.messages, errorMessage]
      }))
      
      throw error
    }
  }, [state.messages, state.currentContext])

  // Utility functions
  const isContextRelevant = useCallback((context: PageContext) => {
    return context.route === state.currentContext.route
  }, [state.currentContext.route])

  // Get proactive tips for current context
  const getProactiveTips = useCallback(async (): Promise<ProactiveTip[]> => {
    try {
      if (!state.proactiveTipsEnabled || !user) {
        return []
      }

      // Build query parameters
      const params = new URLSearchParams({
        page_route: state.currentContext.route,
        page_title: state.currentContext.pageTitle,
        user_role: state.currentContext.userRole,
        user_level: 'intermediate', // Could be determined from user data
        session_count: '1', // Could be tracked
        time_on_page: '0' // Could be tracked
      })

      if (state.currentContext.currentProject) {
        params.append('current_project', state.currentContext.currentProject)
      }
      if (state.currentContext.currentPortfolio) {
        params.append('current_portfolio', state.currentContext.currentPortfolio)
      }

      const response = await helpChatAPI.getProactiveTips(params)
      return response.tips.map((tip: any) => ({
        id: tip.id || tip.tip_id || '',
        type: (tip.type || tip.tip_type) as ProactiveTip['type'],
        title: tip.title,
        content: tip.content,
        priority: tip.priority as ProactiveTip['priority'],
        triggerContext: tip.triggerContext || tip.trigger_context,
        actions: tip.actions,
        dismissible: tip.dismissible,
        showOnce: tip.showOnce || tip.show_once,
        isRead: false
      }))
    } catch (error) {
      console.error('Error fetching proactive tips:', error)
      return []
    }
  }, [state.proactiveTipsEnabled, state.currentContext, user])

  // Load proactive tips when context changes
  useEffect(() => {
    // TEMPORARILY DISABLED: Proactive tips endpoint has issues
    // TODO: Fix backend /tips endpoint
    if (false && state.proactiveTipsEnabled && user) {
      const loadTips = async () => {
        const tips = await getProactiveTips()
        
        // Add tips as messages if they haven't been dismissed
        const newTipMessages: ChatMessage[] = tips
          .filter(tip => !dismissedTips.includes(tip.id))
          .map(tip => ({
            id: `tip-${tip.id}`,
            type: 'tip' as const,
            content: `💡 **${tip.title}**\n\n${tip.content}`,
            timestamp: new Date(),
            actions: tip.actions || []
          }))

        if (newTipMessages.length > 0) {
          setState(prevState => ({
            ...prevState,
            messages: [...prevState.messages, ...newTipMessages]
          }))
        }
      }

      // Debounce tip loading to avoid excessive API calls
      const timeoutId = setTimeout(loadTips, 1000)
      return () => clearTimeout(timeoutId)
    }
    
    // Return cleanup function for when condition is not met
    return () => {}
  }, [state.currentContext.route, state.proactiveTipsEnabled, user?.id, dismissedTips.length]) // Simplified dependencies

  const exportChatHistory = useCallback((): string => {
    const history = state.messages.map(msg => ({
      timestamp: msg.timestamp.toISOString(),
      type: msg.type,
      content: msg.content,
      sources: msg.sources?.map(s => s.title).join(', ') || ''
    }))
    
    return JSON.stringify(history, null, 2)
  }, [state.messages])

  // Language-related functions
  const translateMessage = useCallback(async (content: string, targetLanguage?: string): Promise<string> => {
    try {
      const target = targetLanguage || state.language
      if (target === 'en') return content // No translation needed
      
      const result = await translateContent(content, target, 'en', 'help_response')
      return result?.translated_content || content
    } catch (error) {
      console.error('Translation failed:', error)
      return content // Return original on failure
    }
  }, [state.language, translateContent])

  const detectMessageLanguage = useCallback(async (content: string) => {
    try {
      return await detectLanguage(content)
    } catch (error) {
      console.error('Language detection failed:', error)
      return null
    }
  }, [detectLanguage])

  const formatMessageDate = useCallback((date: Date): string => {
    return formatDate(date, state.language)
  }, [formatDate, state.language])

  const formatMessageNumber = useCallback((number: number): string => {
    return formatNumber(number, state.language)
  }, [formatNumber, state.language])

  // Context value
  const contextValue: HelpChatContextType = {
    state,
    toggleChat,
    sendMessage,
    clearMessages,
    updateContext,
    updatePreferences,
    dismissTip,
    submitFeedback,
    isContextRelevant,
    getProactiveTips,
    exportChatHistory,
    // Language functions
    translateMessage,
    detectMessageLanguage,
    formatMessageDate,
    formatMessageNumber,
    getLanguageName: (code: string) => getLanguageName(code),
    currentLanguage: state.language
  }

  return (
    <HelpChatContext.Provider value={contextValue}>
      {children}
    </HelpChatContext.Provider>
  )
}

// Custom hook to use help chat context
export const useHelpChat = () => {
  const context = useContext(HelpChatContext)
  if (context === undefined) {
    throw new Error('useHelpChat must be used within a HelpChatProvider')
  }
  return context
}

export default HelpChatProvider