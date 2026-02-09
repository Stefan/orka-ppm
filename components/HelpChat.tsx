'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Send,
  MessageSquare,
  Loader2,
  AlertCircle,
  RefreshCw,
  Mic,
  MicOff
} from 'lucide-react'
import { useHelpChat } from '../hooks/useHelpChat'
import { useAuth } from '../app/providers/SupabaseAuthProvider'
import { useLanguage } from '../hooks/useLanguage'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useTranslations } from '../lib/i18n/context'
import type { HelpFeedbackRequest } from '../types/help-chat'
import { cn } from '../lib/utils/design-system'
import { MessageRenderer } from './help-chat/MessageRenderer'

// Lazy load heavy components if needed
// const MessageRenderer = lazy(() => import('./help-chat/MessageRenderer').then(module => ({ default: module.MessageRenderer })))
import { sendHelpQuery, submitFeedback } from '../lib/help-chat-api'
import type { ChatMessage, QuickAction } from '../types/help-chat'

// Accessibility constants
const ARIA_LABELS = {
  chatRegion: 'AI Help Chat Assistant',
  messagesList: 'Chat messages',
  messageInput: 'Type your question about PPM features',
  sendButton: 'Send message',
  closeButton: 'Close help chat',
  clearButton: 'Clear chat messages',
  retryButton: 'Retry last message',
  loadingMessage: 'AI Assistant is processing your request',
  errorMessage: 'Error occurred in chat',
  typingIndicator: 'AI Assistant is typing a response'
} as const

interface HelpChatProps {
  className?: string
  /** Called when the backend returns an open_modal action (modalType, data?). App can open the appropriate modal. */
  onOpenModal?: (modalType: string, data?: Record<string, unknown>) => void
}

interface RAGMessageData {
  citations?: any[];
  sources?: any[];
  confidence?: number;
  cache_hit?: boolean;
  is_fallback?: boolean;
  error_message?: string;
}

/**
 * Main HelpChat component with responsive design and WCAG 2.1 AA compliance
 * Implements sidebar for desktop, overlay for mobile with full accessibility support
 * Enhanced with RAG capabilities for intelligent responses
 */
export function HelpChat({ className, onOpenModal }: HelpChatProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { currentLanguage } = useLanguage()
  const { t } = useTranslations()
  const {
    state,
    toggleChat,
    sendMessage,
    clearMessages,
    submitFeedback,
    canSendMessage,
    retryLastMessage,
    getErrorMessage
  } = useHelpChat()

  const isMobile = useMediaQuery('(max-width: 768px)')
  const [inputValue, setInputValue] = useState('')
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null)
  const [announceMessage, setAnnounceMessage] = useState('')
  const [ragData, setRagData] = useState<Record<string, RAGMessageData>>({})
  const [isListening, setIsListening] = useState(false)

  const startVoiceInput = useCallback(() => {
    if (typeof window === 'undefined') return
    const win = window as unknown as { webkitSpeechRecognition?: new () => { start: () => void; onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void; onerror: () => void; onend: () => void }; SpeechRecognition?: new () => { start: () => void; onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void; onerror: () => void; onend: () => void } }
    const Rec = win.webkitSpeechRecognition ?? win.SpeechRecognition
    if (!Rec) return
    try {
      const rec = new Rec()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = navigator.language || 'en-US'
      rec.onresult = (e: { results: Array<Array<{ transcript: string }>> }) => {
        const t = (e.results?.[0]?.[0]?.transcript ?? '').trim()
        if (t) setInputValue(t)
        setIsListening(false)
      }
      rec.onerror = () => setIsListening(false)
      rec.onend = () => setIsListening(false)
      rec.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
    }
  }, [])

  // Get the correct send button text based on current language
  const getSendButtonText = useCallback(() => {
    const sendTexts = {
      'en': 'Send',
      'de': 'Senden',
      'fr': 'Envoyer',
      'es': 'Enviar',
      'pl': 'Wyślij',
      'gsw': 'Schicke'
    }
    return sendTexts[currentLanguage as keyof typeof sendTexts] || 'Send'
  }, [currentLanguage])

  // Refs for accessibility
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const chatRegionRef = useRef<HTMLDivElement>(null)
  const announceRef = useRef<HTMLDivElement>(null)

  // Announce messages to screen readers
  const announceToScreenReader = useCallback((message: string) => {
    setAnnounceMessage(message)
    // Clear after announcement
    setTimeout(() => setAnnounceMessage(''), 1000)
  }, [])

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (state.messages.length > 0) {
      scrollToBottom()
      // Announce new messages to screen readers
      const lastMessage = state.messages[state.messages.length - 1]
      if (lastMessage.type === 'assistant') {
        announceToScreenReader('New response from AI Assistant received')
      }
    }
  }, [state.messages, scrollToBottom, announceToScreenReader])

  // Focus management
  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [state.isOpen])

  // Announce state changes
  useEffect(() => {
    if (state.isLoading) {
      announceToScreenReader('AI Assistant is processing your request')
    } else if (state.error) {
      announceToScreenReader('An error occurred. Please try again.')
    }
  }, [state.isLoading, state.error, announceToScreenReader])

  // Handle input submission with accessibility announcements and RAG integration
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !canSendMessage) return

    const message = inputValue.trim()
    setInputValue('')
    announceToScreenReader('Message sent. Waiting for AI response.')

    try {
      // Send user message through provider
      await sendMessage(message)

      // Send RAG query for enhanced response
      const ragResponse = await sendHelpQuery({
        query: message,
        session_id: state.sessionId,
        context: {
          user_id: user?.id || 'anonymous',
          role: state.currentContext.userRole,
          current_page: state.currentContext.pageTitle,
          current_project: state.currentContext.currentProject,
          current_portfolio: state.currentContext.currentPortfolio
        },
        language: state.language,
        include_proactive_tips: state.userPreferences.proactiveTips
      })

      // Store RAG data for this message
      setRagData(prev => ({
        ...prev,
        [ragResponse.query_id]: {
          citations: ragResponse.citations,
          sources: ragResponse.sources,
          confidence: ragResponse.confidence,
          cache_hit: ragResponse.cache_hit,
          is_fallback: ragResponse.is_fallback,
          error_message: ragResponse.error_message
        }
      }))

      // Send AI response through provider with RAG data attached
      await sendMessage(ragResponse.response)

    } catch (error) {
      console.error('Error sending message:', error)
      announceToScreenReader('Failed to send message. Please try again.')
    }
  }, [inputValue, canSendMessage, sendMessage, announceToScreenReader, state, user])

  // Enhanced keyboard navigation
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    } else if (e.key === 'Escape') {
      // Close chat on Escape
      toggleChat()
    }
  }, [handleSubmit, toggleChat])

  // Handle quick action clicks: navigate, open_modal, or call action function (Task 10.3)
  const handleQuickAction = useCallback((action: QuickAction) => {
    announceToScreenReader(`Executing action: ${action.label}`)
    const actionStr = typeof action.action === 'string' ? action.action : ''
    const target = (action as QuickAction & { target?: string }).target

    if (typeof action.action === 'function') {
      action.action()
      return
    }
    // Backend returns action: "navigate" with target: "/path" or action: "navigate:/path"
    if (actionStr === 'navigate' && target) {
      toggleChat()
      router.push(target)
      return
    }
    if (actionStr.startsWith('navigate:')) {
      const path = target || actionStr.slice('navigate:'.length).trim() || '/'
      toggleChat()
      router.push(path)
      return
    }
    // open_modal: call optional app callback or fallback
    if (actionStr === 'open_modal' || actionStr.startsWith('open_modal:')) {
      const modalType = target || actionStr.slice('open_modal:'.length).trim() || 'default'
      if (onOpenModal) {
        onOpenModal(modalType, {})
      } else {
        toggleChat()
        router.push('/')
      }
      return
    }
    // show_data: NL action "fetch_data" (e.g. EAC) -> navigate to financials/costbook (Task 10.3)
    if (actionStr === 'show_data' && target) {
      toggleChat()
      router.push(target === 'eac' ? '/financials' : '/costbook')
      return
    }
    // Fallback: target as path (e.g. backend sends only target)
    if (target && target.startsWith('/')) {
      toggleChat()
      router.push(target)
    }
  }, [announceToScreenReader, router, toggleChat, onOpenModal])

  // Handle feedback submission with announcements
  const handleFeedback = useCallback(async (
    messageId: string,
    feedback: HelpFeedbackRequest
  ) => {
    try {
      await submitFeedback(messageId, feedback)
      setFeedbackMessageId(null)
      announceToScreenReader('Feedback submitted successfully')
    } catch (error) {
      console.error('Error submitting feedback:', error)
      announceToScreenReader('Failed to submit feedback')
    }
  }, [submitFeedback, announceToScreenReader])

  // Handle copy to clipboard with announcements
  const handleCopyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      announceToScreenReader('Message copied to clipboard')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      announceToScreenReader('Failed to copy message')
    }
  }, [announceToScreenReader])

  // Handle retry with announcements
  const handleRetry = useCallback(async () => {
    try {
      announceToScreenReader('Retrying last message')
      await retryLastMessage()
    } catch (error) {
      console.error('Error retrying message:', error)
      announceToScreenReader('Failed to retry message')
    }
  }, [retryLastMessage, announceToScreenReader])

  // Handle clear messages with confirmation
  const handleClearMessages = useCallback(() => {
    if (state.messages.length > 0) {
      clearMessages()
      announceToScreenReader('Chat messages cleared')
      // Focus input after clearing
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [clearMessages, state.messages.length, announceToScreenReader])

  // Always render for smooth animation

  // Mobile overlay design
  if (isMobile) {
    return (
      <>
        {/* Screen reader announcements */}
        <div
          ref={announceRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announceMessage}
        </div>

        {/* Backdrop with proper focus trap */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleChat}
          aria-hidden="true"
        />

        {/* Mobile Chat Overlay */}
        <div
          ref={chatRegionRef}
          className={cn(
            'fixed inset-0 lg:hidden',
            'transform transition-transform duration-300 ease-in-out',
            className
          )}
          style={{ zIndex: 10000 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-chat-title"
          aria-describedby="help-chat-description"
        >
          <div className="flex flex-col h-full bg-white dark:bg-slate-800">
            {/* Header with enhanced accessibility */}
            <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center space-x-3">
                <MessageSquare
                  className="h-6 w-6 text-blue-600 dark:text-blue-400"
                  aria-hidden="true"
                />
                <h1
                  id="help-chat-title"
                  className="text-lg font-semibold text-gray-900 dark:text-slate-100"
                >
                  {t('help.title')}
                </h1>
              </div>
              <div className="flex items-center space-x-2">
                {state.messages.length > 0 && (
                  <button
                    onClick={handleClearMessages}
                    className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label={ARIA_LABELS.clearButton}
                    title={ARIA_LABELS.clearButton}
                  >
                    <RefreshCw className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
                <button
                  onClick={toggleChat}
                  className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label={ARIA_LABELS.closeButton}
                  title={ARIA_LABELS.closeButton}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Hidden description for screen readers */}
            <div id="help-chat-description" className="sr-only">
              AI-powered help assistant for PPM platform features. Ask questions and get contextual assistance with citations and sources.
            </div>

            {/* Messages Area with proper ARIA labels */}
            <main
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
              role="log"
              aria-live="polite"
              aria-label={ARIA_LABELS.messagesList}
              tabIndex={0}
            >
              {state.messages.length === 0 ? (
                <div className="text-center py-8" role="status">
                  <MessageSquare
                    className="h-12 w-12 text-gray-500 dark:text-slate-400 mx-auto mb-4"
                    aria-hidden="true"
                  />
                  <p className="text-gray-700 dark:text-slate-300 mb-2">{t('helpChat.welcome')}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    {t('helpChat.welcomeMessage')}
                  </p>
                </div>
              ) : (
                <div role="list" aria-label="Chat conversation">
                  {state.messages.map((message, index) => (
                    <div key={message.id} role="listitem">
                      <MessageRenderer
                        message={message}
                        onFeedback={handleFeedback}
                        onCopy={handleCopyMessage}
                        onQuickAction={handleQuickAction}
                        feedbackMessageId={feedbackMessageId}
                        setFeedbackMessageId={setFeedbackMessageId}
                        messageIndex={index + 1}
                        totalMessages={state.messages.length}
                        ragData={ragData[message.id]}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Typing indicator with accessibility */}
              {state.isTyping && (
                <div
                  className="flex items-center space-x-2 text-gray-700 dark:text-slate-300"
                  role="status"
                  aria-live="polite"
                  aria-label={ARIA_LABELS.typingIndicator}
                >
                  <div className="flex space-x-1" aria-hidden="true">
                    <div className="w-2 h-2 bg-gray-400 dark:bg-slate-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-400 dark:bg-slate-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 dark:bg-slate-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-sm">{t('helpChat.typing')}</span>
                </div>
              )}

              {/* Error state with accessibility */}
              {state.error && (
                <div
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
                  role="alert"
                  aria-live="assertive"
                >
                  <div className="flex items-start space-x-3">
                    <AlertCircle
                      className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                        {ARIA_LABELS.errorMessage}
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                        {getErrorMessage() || 'An unexpected error occurred.'}
                      </p>
                      <button
                        onClick={handleRetry}
                        className="mt-2 inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        aria-label={ARIA_LABELS.retryButton}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                        {t('helpChat.tryAgain')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </main>

            {/* Input Area with enhanced accessibility */}
            <footer className="border-t border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
              <form onSubmit={handleSubmit} className="flex items-end space-x-3">
                <div className="flex-1">
                  <label htmlFor="mobile-chat-input" className="sr-only">
                    {ARIA_LABELS.messageInput}
                  </label>
                  <textarea
                    id="mobile-chat-input"
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t('helpChat.placeholder')}
                    className="w-full resize-none rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-0 min-h-[40px] max-h-32 dark:placeholder-slate-400 outline-none ring-0 shadow-none appearance-none"
                    rows={1}
                    disabled={!canSendMessage}
                    aria-label={ARIA_LABELS.messageInput}
                    aria-describedby="mobile-input-help"
                  />
                  <div id="mobile-input-help" className="sr-only">
                    Press Enter to send, Shift+Enter for new line, Escape to close chat
                  </div>
                </div>
                {typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
                  <button
                    type="button"
                    onClick={startVoiceInput}
                    disabled={isListening || !canSendMessage}
                    className={cn(
                      'p-2 rounded-lg min-h-[40px] min-w-[40px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                      isListening ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                    )}
                    aria-label={isListening ? 'Listening...' : 'Voice input'}
                    title={isListening ? 'Listening...' : 'Voice input'}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!canSendMessage || !inputValue.trim()}
                  className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={t('helpChat.sendButtonLabel')}
                  title={t('helpChat.sendButtonLabel')}
                >
                  {state.isLoading ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </form>
            </footer>
          </div>
        </div>
      </>
    )
  }

  // Desktop sidebar design
  return (
    <>
      {/* Screen reader announcements */}
      <div
        ref={announceRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announceMessage}
      </div>

      {/* Desktop Sidebar */}
      <aside
        ref={chatRegionRef}
        className={cn(
          'fixed top-0 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 shadow-xl flex flex-col',
          'transform transition-all duration-300 ease-in-out',
          'right-0 w-96', // bottom offset via inline style (bottom: 4rem)
          className
        )}
        style={{
          zIndex: 10000,
          bottom: '4rem',
          transform: state.isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          // CSS containment for better performance isolation
          contain: 'layout style paint',
        }}
        role="complementary"
        aria-labelledby="desktop-help-chat-title"
        aria-describedby="desktop-help-chat-description"
      >
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex items-center space-x-3">
            <MessageSquare
              className="h-6 w-6 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <h1
              id="desktop-help-chat-title"
              className="text-lg font-semibold text-gray-900 dark:text-slate-100"
            >
              {t('help.title')}
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            {state.messages.length > 0 && (
              <button
                onClick={handleClearMessages}
                className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={ARIA_LABELS.clearButton}
                title={ARIA_LABELS.clearButton}
              >
                <RefreshCw className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <button
              onClick={toggleChat}
              className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={ARIA_LABELS.closeButton}
              title={ARIA_LABELS.closeButton}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Hidden description for screen readers */}
        <div id="desktop-help-chat-description" className="sr-only">
          AI-powered help assistant for PPM platform features. Ask questions and get contextual assistance with citations and sources.
        </div>

        {/* Messages Area */}
        <main
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          role="log"
          aria-live="polite"
          aria-label={ARIA_LABELS.messagesList}
          tabIndex={0}
        >
              {state.messages.length === 0 ? (
                <div className="text-center py-8" role="status">
                  <MessageSquare
                    className="h-12 w-12 text-gray-500 dark:text-slate-400 mx-auto mb-4"
                    aria-hidden="true"
                  />
                  <p className="text-gray-700 dark:text-slate-300 mb-2">{t('helpChat.welcome')}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    {t('helpChat.welcomeMessage')}
                  </p>
                </div>
              ) : (
                <div role="list" aria-label="Chat conversation">
                  {state.messages.map((message, index) => (
                    <div key={message.id} role="listitem">
                      <MessageRenderer
                        message={message}
                        onFeedback={handleFeedback}
                        onCopy={handleCopyMessage}
                        onQuickAction={handleQuickAction}
                        feedbackMessageId={feedbackMessageId}
                        setFeedbackMessageId={setFeedbackMessageId}
                        messageIndex={index + 1}
                        totalMessages={state.messages.length}
                        ragData={ragData[message.id]}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Typing indicator */}
              {state.isTyping && (
                <div
                  className="flex items-center space-x-2 text-gray-700 dark:text-slate-300"
                  role="status"
                  aria-live="polite"
                  aria-label={ARIA_LABELS.typingIndicator}
                >
                  <div className="flex space-x-1" aria-hidden="true">
                    <div className="w-2 h-2 bg-gray-400 dark:bg-slate-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-400 dark:bg-slate-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 dark:bg-slate-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-sm">{t('helpChat.typing')}</span>
                </div>
              )}

              {/* Error state */}
              {state.error && (
                <div
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
                  role="alert"
                  aria-live="assertive"
                >
                  <div className="flex items-start space-x-3">
                    <AlertCircle
                      className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                        {ARIA_LABELS.errorMessage}
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                        {getErrorMessage() || 'An unexpected error occurred.'}
                      </p>
                      <button
                        onClick={handleRetry}
                        className="mt-2 inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        aria-label={ARIA_LABELS.retryButton}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                        {t('helpChat.tryAgain')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </main>

        {/* Input Area */}
        <footer className="border-t border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
              <form onSubmit={handleSubmit} className="space-y-2">
                <div>
                  <label htmlFor="desktop-chat-input" className="sr-only">
                    {ARIA_LABELS.messageInput}
                  </label>
                  <textarea
                    id="desktop-chat-input"
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t('helpChat.placeholder')}
                    className="w-full resize-none rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-0 min-h-[40px] max-h-32 dark:placeholder-slate-400 outline-none ring-0 shadow-none appearance-none"
                    rows={1}
                    disabled={!canSendMessage}
                    aria-label={ARIA_LABELS.messageInput}
                    aria-describedby="desktop-input-help"
                  />
                  <div id="desktop-input-help" className="sr-only">
                    Press Enter to send, Shift+Enter for new line, Escape to close chat
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
                    <button
                      type="button"
                      onClick={startVoiceInput}
                      disabled={isListening || !canSendMessage}
                      className={cn(
                        'p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                        isListening ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                      )}
                      aria-label={isListening ? 'Listening...' : 'Voice input'}
                      title={isListening ? 'Listening...' : 'Voice input'}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!canSendMessage || !inputValue.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-2 min-h-[40px] px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('helpChat.sendButtonLabel')}
                    title={t('helpChat.sendButtonLabel')}
                  >
                    {state.isLoading ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <>
                        <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {getSendButtonText()}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </footer>
      </aside>
    </>
  )
}

export default HelpChat