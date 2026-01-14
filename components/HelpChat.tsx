'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
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
import type { QuickAction } from '../types/help-chat'

// Dynamic import for LanguageSelector to reduce initial bundle
const LanguageSelector = dynamic(
  () => import('./help-chat/LanguageSelector').then(mod => ({ default: mod.LanguageSelector })),
  { ssr: false }
)

interface HelpChatProps {
  className?: string
}

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (state.messages.length > 0) {
      scrollToBottom()
    }
  }, [state.messages, scrollToBottom])

  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [state.isOpen])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !canSendMessage) return

    const message = inputValue.trim()
    setInputValue('')
    
    try {
      await sendMessage(message)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }, [inputValue, canSendMessage, sendMessage])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }, [handleSubmit])

  const handleQuickAction = useCallback((action: QuickAction) => {
    action.action()
  }, [])

  const handleFeedback = useCallback(async (
    messageId: string, 
    feedback: HelpFeedbackRequest
  ) => {
    try {
      await submitFeedback(messageId, feedback)
      setFeedbackMessageId(null)
    } catch (error) {
      console.error('Error submitting feedback:', error)
    }
  }, [submitFeedback])

  const handleCopyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }, [])

  const handleRetry = useCallback(async () => {
    try {
      await retryLastMessage()
    } catch (error) {
      console.error('Error retrying message:', error)
    }
  }, [retryLastMessage])

  const handleClearMessages = useCallback(() => {
    if (state.messages.length > 0) {
      clearMessages()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [clearMessages, state.messages.length])

  // Mobile version with slide animation
  if (isMobile) {
    return (
      <>
        <div
          className={cn(
            'fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300',
            state.isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={toggleChat}
        />
        
        <div
          className={cn(
            'fixed inset-0 z-50 lg:hidden',
            'transform transition-transform duration-300 ease-in-out',
            state.isOpen ? 'translate-x-0' : 'translate-x-full',
            className
          )}
          style={{
            willChange: state.isOpen ? 'transform' : 'auto'
          }}
        >
          <div className="flex flex-col h-full bg-white">
            <header className="flex items-center justify-between p-4 border-b-2 border-gray-200 bg-white">
              <div className="flex items-center space-x-3">
                <MessageSquare className="h-6 w-6 text-blue-600" />
                <h1 className="text-lg font-semibold text-gray-900">
                  AI Help Assistant
                </h1>
              </div>
              <div className="flex items-center space-x-2">
                <LanguageSelector compact />
                {state.messages.length > 0 && (
                  <button
                    onClick={handleClearMessages}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                )}
              </div>
            </header>

            <main 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {state.messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">Welcome to AI Help Assistant!</p>
                  <p className="text-sm text-gray-400">
                    Ask me anything about the PPM platform features and I'll help you out.
                  </p>
                </div>
              ) : (
                <div>
                  {state.messages.map((message) => (
                    <div key={message.id}>
                      <MessageRenderer
                        message={message}
                        onFeedback={handleFeedback}
                        onCopy={handleCopyMessage}
                        onQuickAction={handleQuickAction}
                        feedbackMessageId={feedbackMessageId}
                        setFeedbackMessageId={setFeedbackMessageId}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {state.isTyping && (
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-sm">AI is typing...</span>
                </div>
              )}
              
              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 mb-2">{getErrorMessage()}</p>
                      <button
                        onClick={handleRetry}
                        className="text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </main>

            <footer className="border-t border-gray-200 p-4 bg-white">
              <form onSubmit={handleSubmit} className="flex space-x-3">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about PPM features..."
                  className="flex-1 resize-none rounded-lg border-2 border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none min-h-[44px] max-h-32"
                  rows={1}
                  disabled={!canSendMessage}
                />
                <button
                  type="submit"
                  disabled={!canSendMessage || !inputValue.trim()}
                  className={cn(
                    'px-4 py-3 rounded-lg font-medium transition-colors min-h-[44px] min-w-[44px]',
                    canSendMessage && inputValue.trim()
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  )}
                >
                  {state.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </form>
            </footer>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <aside 
        className={cn(
          'fixed right-0 top-0 h-full w-96 bg-white border-l-2 border-gray-200 shadow-lg z-40',
          'transform transition-transform duration-300 ease-in-out',
          state.isOpen ? 'translate-x-0' : 'translate-x-full',
          isMinimized && 'translate-x-full',
          className
        )}
        style={{
          willChange: state.isOpen ? 'transform' : 'auto'
        }}
      >
        <div className="flex flex-col h-full">
          <header className="flex items-center justify-between p-4 border-b-2 border-gray-200 bg-white">
            <div className="flex items-center space-x-3">
              <MessageSquare className="h-6 w-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                AI Help Assistant
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <LanguageSelector compact />
              {state.messages.length > 0 && (
                <button
                  onClick={handleClearMessages}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              >
                {isMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </header>

          <main 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {state.messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">Welcome to AI Help Assistant!</p>
                <p className="text-sm text-gray-400">
                  Ask me anything about the PPM platform features and I'll help you out.
                </p>
              </div>
            ) : (
              <div>
                {state.messages.map((message) => (
                  <div key={message.id}>
                    <MessageRenderer
                      message={message}
                      onFeedback={handleFeedback}
                      onCopy={handleCopyMessage}
                      onQuickAction={handleQuickAction}
                      feedbackMessageId={feedbackMessageId}
                      setFeedbackMessageId={setFeedbackMessageId}
                    />
                  </div>
                ))}
              </div>
            )}
            
            {state.isTyping && (
              <div className="flex items-center space-x-2 text-gray-500">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <span className="text-sm">AI is typing...</span>
              </div>
            )}
            
            {state.error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 mb-2">{getErrorMessage()}</p>
                    <button
                      onClick={handleRetry}
                      className="text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </main>

          <footer className="border-t-2 border-gray-200 p-4 bg-white">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about PPM features..."
                className="flex-1 resize-none rounded-lg border-2 border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none min-h-[40px] max-h-32"
                rows={1}
                disabled={!canSendMessage}
              />
              <button
                type="submit"
                disabled={!canSendMessage || !inputValue.trim()}
                className={cn(
                  'px-3 py-2 rounded-lg font-medium transition-colors min-h-[40px] min-w-[40px]',
                  canSendMessage && inputValue.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                {state.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
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