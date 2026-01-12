'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { 
  X, 
  Send, 
  MessageSquare, 
  Loader2,
  AlertCircle,
  RefreshCw,
  Minimize2,
  Maximize2
} from 'lucide-react'
import { useHelpChat } from '../hooks/useHelpChat'
import { useMediaQuery } from '../hooks/useMediaQuery'
import type { HelpFeedbackRequest } from '../types/help-chat'
import { cn } from '../lib/utils/design-system'
import { MessageRenderer } from './help-chat/MessageRenderer'
import { LanguageSelector } from './help-chat/LanguageSelector'
import type { QuickAction } from '../types/help-chat'

// Accessibility constants
const ARIA_LABELS = {
  chatRegion: 'AI Help Chat Assistant',
  messagesList: 'Chat messages',
  messageInput: 'Type your question about PPM features',
  sendButton: 'Send message',
  closeButton: 'Close help chat',
  minimizeButton: 'Minimize help chat',
  maximizeButton: 'Maximize help chat',
  clearButton: 'Clear chat messages',
  retryButton: 'Retry last message',
  loadingMessage: 'AI Assistant is processing your request',
  errorMessage: 'Error occurred in chat',
  typingIndicator: 'AI Assistant is typing a response'
} as const

interface HelpChatProps {
  className?: string
}

/**
 * Main HelpChat component with responsive design and WCAG 2.1 AA compliance
 * Implements sidebar for desktop, overlay for mobile with full accessibility support
 */
export function HelpChat({ className }: HelpChatProps) {
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
  const [isMinimized, setIsMinimized] = useState(false)
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null)
  const [announceMessage, setAnnounceMessage] = useState('')
  
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
      if (lastMessage && lastMessage.type === 'assistant') {
        announceToScreenReader('New response from AI Assistant received')
      }
    }
  }, [state.messages, scrollToBottom, announceToScreenReader])

  // Focus management
  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      // Delay focus to ensure component is fully rendered
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
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

  // Handle input submission with accessibility announcements
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !canSendMessage) return

    const message = inputValue.trim()
    setInputValue('')
    announceToScreenReader('Message sent. Waiting for AI response.')
    
    try {
      await sendMessage(message)
    } catch (error) {
      console.error('Error sending message:', error)
      announceToScreenReader('Failed to send message. Please try again.')
    }
  }, [inputValue, canSendMessage, sendMessage, announceToScreenReader])

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

  // Handle quick action clicks with announcements
  const handleQuickAction = useCallback((action: QuickAction) => {
    announceToScreenReader(`Executing action: ${action.label}`)
    action.action()
  }, [announceToScreenReader])

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

  // Don't render if chat is closed
  if (!state.isOpen) {
    return null
  }

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
            'fixed inset-0 z-50 lg:hidden',
            'transform transition-transform duration-300 ease-in-out',
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-chat-title"
          aria-describedby="help-chat-description"
        >
          <div className="flex flex-col h-full bg-white">
            {/* Header with enhanced accessibility */}
            <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center space-x-3">
                <MessageSquare 
                  className="h-6 w-6 text-blue-600" 
                  aria-hidden="true"
                />
                <h1 
                  id="help-chat-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  {state.isLoading ? ARIA_LABELS.loadingMessage : 
                   state.isTyping ? ARIA_LABELS.typingIndicator : 
                   state.error ? ARIA_LABELS.errorMessage : 
                   'AI Help Assistant'}
                </h1>
              </div>
              <div className="flex items-center space-x-2">
                <LanguageSelector 
                  compact 
                  className="mr-2" 
                  aria-label="Select language for help chat"
                />
                {state.messages.length > 0 && (
                  <button
                    onClick={handleClearMessages}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label={ARIA_LABELS.clearButton}
                    title={ARIA_LABELS.clearButton}
                  >
                    <RefreshCw className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
                <button
                  onClick={toggleChat}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label={ARIA_LABELS.closeButton}
                  title={ARIA_LABELS.closeButton}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Hidden description for screen readers */}
            <div id="help-chat-description" className="sr-only">
              AI-powered help assistant for PPM platform features. Ask questions and get contextual assistance.
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
                    className="h-12 w-12 text-gray-300 mx-auto mb-4" 
                    aria-hidden="true"
                  />
                  <p className="text-gray-500 mb-2">Welcome to AI Help Assistant!</p>
                  <p className="text-sm text-gray-400">
                    Ask me anything about the PPM platform features and I'll help you out.
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
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Typing indicator with accessibility */}
              {state.isTyping && (
                <div 
                  className="flex items-center space-x-2 text-gray-500"
                  role="status"
                  aria-live="polite"
                  aria-label={ARIA_LABELS.typingIndicator}
                >
                  <div className="flex space-x-1" aria-hidden="true">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-sm">AI is typing...</span>
                </div>
              )}
              
              {/* Error state with accessibility */}
              {state.error && (
                <div 
                  className="bg-red-50 border border-red-200 rounded-lg p-4"
                  role="alert"
                  aria-live="assertive"
                >
                  <div className="flex items-start space-x-3">
                    <AlertCircle 
                      className="h-5 w-5 text-red-500 mt-0.5" 
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 mb-2">{getErrorMessage()}</p>
                      <button
                        onClick={handleRetry}
                        className="text-sm text-red-600 hover:text-red-800 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
                        aria-label={ARIA_LABELS.retryButton}
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} aria-hidden="true" />
            </main>

            {/* Input Area with enhanced accessibility */}
            <footer className="border-t border-gray-200 p-4 bg-white">
              <form onSubmit={handleSubmit} className="flex space-x-3">
                <label htmlFor="mobile-chat-input" className="sr-only">
                  {ARIA_LABELS.messageInput}
                </label>
                <textarea
                  id="mobile-chat-input"
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about PPM features..."
                  className="flex-1 resize-none rounded-lg border-2 border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none min-h-[44px] max-h-32"
                  rows={1}
                  disabled={!canSendMessage}
                  aria-label={ARIA_LABELS.messageInput}
                  aria-describedby="mobile-input-help"
                />
                <div id="mobile-input-help" className="sr-only">
                  Press Enter to send, Shift+Enter for new line, Escape to close chat
                </div>
                <button
                  type="submit"
                  disabled={!canSendMessage || !inputValue.trim()}
                  className={cn(
                    'px-4 py-3 rounded-lg font-medium transition-colors min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-offset-2',
                    canSendMessage && inputValue.trim()
                      ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed focus:ring-gray-300'
                  )}
                  aria-label={ARIA_LABELS.sendButton}
                  title={ARIA_LABELS.sendButton}
                >
                  {state.isLoading ? (
                    <Loader2 
                      className="h-5 w-5 animate-spin" 
                      aria-hidden="true"
                    />
                  ) : (
                    <Send 
                      className="h-5 w-5" 
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

      <aside 
        ref={chatRegionRef}
        className={cn(
          'fixed right-0 top-0 h-full w-96 bg-white border-l-2 border-gray-200 shadow-lg z-40',
          'transform transition-transform duration-300 ease-in-out',
          isMinimized && 'translate-x-full',
          className
        )}
        role="complementary"
        aria-labelledby="desktop-help-chat-title"
        aria-describedby="desktop-help-chat-description"
      >
        <div className="flex flex-col h-full">
          {/* Header with enhanced accessibility */}
          <header className="flex items-center justify-between p-4 border-b-2 border-gray-200 bg-white">
            <div className="flex items-center space-x-3">
              <MessageSquare 
                className="h-6 w-6 text-blue-600" 
                aria-hidden="true"
              />
              <h2 
                id="desktop-help-chat-title"
                className="text-lg font-semibold text-gray-900"
              >
                {state.isLoading ? ARIA_LABELS.loadingMessage : 
                 state.isTyping ? ARIA_LABELS.typingIndicator : 
                 state.error ? ARIA_LABELS.errorMessage : 
                 'AI Help Assistant'}
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <LanguageSelector 
                compact 
                className="mr-2" 
                aria-label="Select language for help chat"
              />
              {state.messages.length > 0 && (
                <button
                  onClick={handleClearMessages}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label={ARIA_LABELS.clearButton}
                  title={ARIA_LABELS.clearButton}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={isMinimized ? ARIA_LABELS.maximizeButton : ARIA_LABELS.minimizeButton}
                title={isMinimized ? ARIA_LABELS.maximizeButton : ARIA_LABELS.minimizeButton}
              >
                {isMinimized ? (
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Minimize2 className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <button
                onClick={toggleChat}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={ARIA_LABELS.closeButton}
                title={ARIA_LABELS.closeButton}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Hidden description for screen readers */}
          <div id="desktop-help-chat-description" className="sr-only">
            AI-powered help assistant for PPM platform features. Ask questions and get contextual assistance.
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
                  className="h-12 w-12 text-gray-300 mx-auto mb-4" 
                  aria-hidden="true"
                />
                <p className="text-gray-500 mb-2">Welcome to AI Help Assistant!</p>
                <p className="text-sm text-gray-400">
                  Ask me anything about the PPM platform features and I'll help you out.
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
                    />
                  </div>
                ))}
              </div>
            )}
            
            {/* Typing indicator with accessibility */}
            {state.isTyping && (
              <div 
                className="flex items-center space-x-2 text-gray-500"
                role="status"
                aria-live="polite"
                aria-label={ARIA_LABELS.typingIndicator}
              >
                <div className="flex space-x-1" aria-hidden="true">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <span className="text-sm">AI is typing...</span>
              </div>
            )}
            
            {/* Error state with accessibility */}
            {state.error && (
              <div 
                className="bg-red-50 border-2 border-red-200 rounded-lg p-4"
                role="alert"
                aria-live="assertive"
              >
                <div className="flex items-start space-x-3">
                  <AlertCircle 
                    className="h-5 w-5 text-red-500 mt-0.5" 
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 mb-2">{getErrorMessage()}</p>
                    <button
                      onClick={handleRetry}
                      className="text-sm text-red-600 hover:text-red-800 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
                      aria-label={ARIA_LABELS.retryButton}
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} aria-hidden="true" />
          </main>

          {/* Input Area with enhanced accessibility */}
          <footer className="border-t-2 border-gray-200 p-4 bg-white">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <label htmlFor="desktop-chat-input" className="sr-only">
                {ARIA_LABELS.messageInput}
              </label>
              <textarea
                id="desktop-chat-input"
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about PPM features..."
                className="flex-1 resize-none rounded-lg border-2 border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none min-h-[40px] max-h-32"
                rows={1}
                disabled={!canSendMessage}
                aria-label={ARIA_LABELS.messageInput}
                aria-describedby="desktop-input-help"
              />
              <div id="desktop-input-help" className="sr-only">
                Press Enter to send, Shift+Enter for new line, Escape to close chat
              </div>
              <button
                type="submit"
                disabled={!canSendMessage || !inputValue.trim()}
                className={cn(
                  'px-3 py-2 rounded-lg font-medium transition-colors min-h-[40px] min-w-[40px] focus:outline-none focus:ring-2 focus:ring-offset-2',
                  canSendMessage && inputValue.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed focus:ring-gray-300'
                )}
                aria-label={ARIA_LABELS.sendButton}
                title={ARIA_LABELS.sendButton}
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
      </aside>
    </>
  )
}

export default HelpChat