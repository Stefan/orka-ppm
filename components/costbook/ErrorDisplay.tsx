'use client'

import React from 'react'
import { AlertCircle, RefreshCw, X, AlertTriangle, WifiOff, ServerCrash } from 'lucide-react'

export interface ErrorDisplayProps {
  /** Error object or message */
  error: Error | string
  /** Handler for retry action */
  onRetry?: () => void
  /** Handler for dismiss action */
  onDismiss?: () => void
  /** Error type for styling */
  type?: 'error' | 'warning' | 'info'
  /** Whether to show as inline or full block */
  variant?: 'inline' | 'block' | 'toast'
  /** Show retry button */
  showRetry?: boolean
  /** Show dismiss button */
  showDismiss?: boolean
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * Get error icon based on error message
 */
function getErrorIcon(error: Error | string): React.ReactNode {
  const message = typeof error === 'string' ? error : error.message
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return <WifiOff className="w-5 h-5" />
  }
  if (lowerMessage.includes('server') || lowerMessage.includes('500')) {
    return <ServerCrash className="w-5 h-5" />
  }
  return <AlertCircle className="w-5 h-5" />
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: Error | string): string {
  const message = typeof error === 'string' ? error : error.message
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'Unable to connect. Please check your internet connection.'
  }
  if (lowerMessage.includes('server') || lowerMessage.includes('500')) {
    return 'Server error. Please try again later.'
  }
  if (lowerMessage.includes('timeout')) {
    return 'Request timed out. Please try again.'
  }
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('401')) {
    return 'Session expired. Please sign in again.'
  }
  if (lowerMessage.includes('forbidden') || lowerMessage.includes('403')) {
    return 'You don\'t have permission to access this resource.'
  }
  if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
    return 'The requested resource was not found.'
  }

  return message
}

/**
 * ErrorDisplay component for showing errors in Costbook
 * Provides user-friendly error messages with retry option
 */
export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  type = 'error',
  variant = 'block',
  showRetry = true,
  showDismiss = true,
  className = '',
  'data-testid': testId = 'error-display'
}: ErrorDisplayProps) {
  const typeStyles = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-500',
      title: 'text-red-700',
      text: 'text-red-600'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: 'text-yellow-500',
      title: 'text-yellow-700',
      text: 'text-yellow-600'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-500',
      title: 'text-blue-700',
      text: 'text-blue-600'
    }
  }

  const styles = typeStyles[type]
  const message = getUserFriendlyMessage(error)
  const icon = type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : getErrorIcon(error)

  if (variant === 'inline') {
    return (
      <span 
        className={`inline-flex items-center gap-1 text-sm ${styles.text} ${className}`}
        data-testid={testId}
        role="alert"
      >
        <span className={styles.icon}>{icon}</span>
        {message}
        {showRetry && onRetry && (
          <button 
            onClick={onRetry}
            className="underline hover:no-underline ml-1"
          >
            Retry
          </button>
        )}
      </span>
    )
  }

  if (variant === 'toast') {
    return (
      <div
        className={`
          fixed bottom-4 right-4
          flex items-center gap-3
          px-4 py-3
          ${styles.bg}
          border ${styles.border}
          rounded-lg
          shadow-lg
          max-w-md
          z-50
          animate-in slide-in-from-bottom-4
          ${className}
        `}
        data-testid={testId}
        role="alert"
      >
        <span className={styles.icon}>{icon}</span>
        <span className={`flex-1 text-sm ${styles.text}`}>{message}</span>
        
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className={`p-1 rounded hover:bg-white/50 ${styles.icon}`}
            title="Retry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        
        {showDismiss && onDismiss && (
          <button
            onClick={onDismiss}
            className={`p-1 rounded hover:bg-white/50 ${styles.icon}`}
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  // Block variant (default)
  return (
    <div
      className={`
        ${styles.bg}
        border ${styles.border}
        rounded-lg
        p-4
        ${className}
      `}
      data-testid={testId}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className={`${styles.icon} mt-0.5`}>{icon}</span>
        
        <div className="flex-1">
          <h4 className={`font-medium ${styles.title}`}>
            {type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Info'}
          </h4>
          <p className={`text-sm ${styles.text} mt-1`}>
            {message}
          </p>
          
          {/* Actions */}
          {(showRetry || showDismiss) && (
            <div className="flex gap-2 mt-3">
              {showRetry && onRetry && (
                <button
                  onClick={onRetry}
                  className={`
                    flex items-center gap-1
                    px-3 py-1.5
                    text-sm font-medium
                    bg-white
                    border ${styles.border}
                    rounded-md
                    ${styles.text}
                    hover:bg-gray-50
                    transition-colors
                  `}
                  data-testid={`${testId}-retry`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try again
                </button>
              )}
              
              {showDismiss && onDismiss && (
                <button
                  onClick={onDismiss}
                  className={`
                    px-3 py-1.5
                    text-sm
                    ${styles.text}
                    hover:underline
                  `}
                  data-testid={`${testId}-dismiss`}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Close button for block variant */}
        {showDismiss && onDismiss && (
          <button
            onClick={onDismiss}
            className={`p-1 rounded hover:bg-white/50 ${styles.icon}`}
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default ErrorDisplay