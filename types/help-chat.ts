/**
 * Help Chat Type Definitions
 * Type definitions for the AI-powered help chat system
 */

// Supported languages type
export type SupportedLanguage = 'en' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'nl' | 'pl' | 'ru' | 'zh' | 'ja'

// Core Help Chat Types
export interface HelpChatState {
  isOpen: boolean
  messages: ChatMessage[]
  isLoading: boolean
  currentContext: PageContext
  userPreferences: HelpChatUserPreferences
  sessionId: string
  proactiveTipsEnabled: boolean
  language: SupportedLanguage
  isTyping: boolean
  error: string | null
}

export interface PageContext {
  route: string
  pageTitle: string
  userRole: string
  currentProject?: string
  currentPortfolio?: string
  relevantData?: Record<string, any>
}

export interface HelpChatUserPreferences {
  language: SupportedLanguage
  proactiveTips: boolean
  chatPosition: 'right' | 'left'
  soundEnabled: boolean
  tipFrequency: 'high' | 'medium' | 'low' | 'off'
  theme: 'light' | 'dark' | 'auto'
}

export interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tip'
  content: string
  timestamp: Date
  sources?: SourceReference[]
  confidence?: number
  actions?: QuickAction[]
  attachments?: Attachment[]
  isStreaming?: boolean
  /** Backend help_logs id for feedback (help_query_feedback) */
  queryId?: string
}

export interface SourceReference {
  id: string
  title: string
  url?: string
  type: 'documentation' | 'guide' | 'faq' | 'feature'
  relevance: number
}

export interface QuickAction {
  id: string
  label: string
  action: (() => void) | string  // Support both function and string actions (e.g. "navigate", "open_modal")
  /** Target path or modal type when action is a string (e.g. "/projects" for navigate) */
  target?: string
  icon?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

export interface Attachment {
  id: string
  type: 'image' | 'video' | 'document' | 'link' | 'visual_guide'
  url: string
  title: string
  description?: string
  thumbnail?: string
  metadata?: {
    guideId?: string
    stepCount?: number
    estimatedTime?: number
    difficulty?: 'beginner' | 'intermediate' | 'advanced'
  }
}

export interface ProactiveTip {
  id: string
  type: 'welcome' | 'feature_discovery' | 'optimization' | 'best_practice'
  title: string
  content: string
  priority: 'low' | 'medium' | 'high'
  triggerContext: string[]
  actions?: QuickAction[]
  dismissible: boolean
  showOnce: boolean
  isRead: boolean
}

// API Request/Response Types
export interface HelpQueryRequest {
  query: string
  sessionId?: string
  context: PageContext
  language: SupportedLanguage
  includeProactiveTips?: boolean
}

export interface HelpQueryResponse {
  response: string
  sessionId: string
  sources: SourceReference[]
  confidence: number
  responseTimeMs: number
  /** Backend help_logs id for feedback */
  queryId?: string
  proactiveTips?: ProactiveTip[]
  suggestedActions?: QuickAction[]
  relatedGuides?: GuideReference[]
  isCached?: boolean
  isFallback?: boolean
}

export interface HelpContextResponse {
  context: PageContext
  availableActions: QuickAction[]
  relevantTips: ProactiveTip[]
}

export interface HelpFeedbackRequest {
  messageId?: string
  queryId?: string
  rating: 1 | 2 | 3 | 4 | 5
  feedbackText?: string
  feedbackType: 'helpful' | 'not_helpful' | 'incorrect' | 'suggestion'
}

export interface FeedbackResponse {
  success: boolean
  message: string
  trackingId?: string
}

export interface ProactiveTipsResponse {
  tips: ProactiveTip[]
  context: PageContext
  nextCheckTime?: Date
}

export interface GuideReference {
  id: string
  title: string
  description: string
  url: string
  type: 'step_by_step' | 'video' | 'interactive' | 'visual_guide'
  estimatedTime: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  thumbnail?: string
  stepCount?: number
  category?: 'feature' | 'workflow' | 'troubleshooting' | 'onboarding'
}

// Context Provider Types
export interface HelpChatContextType {
  // State
  state: HelpChatState
  
  // Actions
  toggleChat: () => void
  sendMessage: (message: string) => Promise<void>
  clearMessages: () => void
  updateContext: (context: Partial<PageContext>) => void
  updatePreferences: (preferences: Partial<HelpChatUserPreferences>) => Promise<void>
  dismissTip: (tipId: string) => void
  submitFeedback: (messageId: string, feedback: HelpFeedbackRequest) => Promise<FeedbackResponse>
  
  // Utility functions
  isContextRelevant: (context: PageContext) => boolean
  getProactiveTips: () => Promise<ProactiveTip[]>
  exportChatHistory: () => string
  
  // Language functions
  translateMessage: (content: string, targetLanguage?: string) => Promise<string>
  detectMessageLanguage: (content: string) => Promise<any>
  formatMessageDate: (date: Date) => string
  formatMessageNumber: (number: number) => string
  getLanguageName: (code: string) => string
  currentLanguage: string
}

// Visual Guide Integration Types
export interface VisualGuideIntegration {
  isOpen: boolean
  currentGuide: any | null
  openGuides: () => void
  closeGuides: () => void
  selectGuide: (guide: any) => void
  generateGuideActions: (context?: PageContext) => QuickAction[]
  generateGuideSuggestions: (userQuery: string, context?: PageContext) => ChatMessage[]
}

// Hook Types
export interface UseHelpChatReturn extends HelpChatContextType {
  // Visual guide integration
  visualGuides: VisualGuideIntegration
  
  // Additional computed values
  hasUnreadTips: boolean
  canSendMessage: boolean
  isSessionActive: boolean
  messageCount: number
  
  // Additional utility functions
  getLastUserMessage: () => ChatMessage | null
  getLastAssistantMessage: () => ChatMessage | null
  getMessagesByType: (type: ChatMessage['type']) => ChatMessage[]
  hasMessagesOfType: (type: ChatMessage['type']) => boolean
  getAverageResponseTime: () => number
  getSessionDuration: () => number
  searchMessages: (query: string) => ChatMessage[]
  getContextSummary: () => string
  isFeatureEnabled: (feature: keyof HelpChatUserPreferences) => boolean
  getLanguageDisplayName: () => string
  canShowProactiveTips: boolean
  getErrorMessage: () => string | null
  clearError: () => void
  retryLastMessage: () => Promise<void>
  getToggleButtonText: () => string
}

// Event Types
export interface HelpChatEvent {
  type: 'message_sent' | 'message_received' | 'tip_shown' | 'tip_dismissed' | 'feedback_submitted' | 'context_changed'
  payload: any
  timestamp: Date
  sessionId: string
}

// Error Types
export interface HelpChatError extends Error {
  code: 'NETWORK_ERROR' | 'VALIDATION_ERROR' | 'RATE_LIMIT_ERROR' | 'CONTEXT_ERROR' | 'UNKNOWN_ERROR'
  context?: Record<string, any>
  retryable: boolean
}

// Storage Types
export interface HelpChatStorage {
  preferences: HelpChatUserPreferences
  sessionId: string
  dismissedTips: string[]
  lastActiveTime: Date
  messageHistory?: ChatMessage[]
}

// Analytics Types
export interface HelpChatAnalytics {
  sessionId: string
  userId?: string
  events: HelpChatEvent[]
  startTime: Date
  endTime?: Date
  messageCount: number
  tipCount: number
  feedbackCount: number
}

// Configuration Types
export interface HelpChatConfig {
  apiBaseUrl: string
  maxMessages: number
  sessionTimeout: number
  retryAttempts: number
  enableAnalytics: boolean
  enableProactiveTips: boolean
  supportedLanguages: SupportedLanguage[]
  defaultLanguage: SupportedLanguage
  rateLimits: {
    messagesPerMinute: number
    messagesPerHour: number
  }
}