'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { diagnosticCollector } from '@/lib/diagnostics/diagnostic-collector'
import { errorReportingService } from '@/lib/diagnostics/error-reporting'

interface LazyComponentErrorBoundaryProps {
  children: ReactNode
  componentName: string
  fallbackMessage?: string
  onRetry?: () => void
}

interface LazyComponentErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorId: string
  retryCount: number
  isRetrying: boolean
}

// Maximum number of retry attempts before giving up
const MAX_RETRY_ATTEMPTS = 3

// Base delay for exponential backoff (in milliseconds)
const BASE_RETRY_DELAY = 300

// Maximum retry delay (in milliseconds)
const MAX_RETRY_DELAY = 3000

/**
 * Error boundary specifically designed for lazy-loaded components.
 * Provides a lightweight fallback UI and automatic retry functionality.
 * 
 * Requirements: 6.1, 6.2
 */
export class LazyComponentErrorBoundary extends Component<
  LazyComponentErrorBoundaryProps,
  LazyComponentErrorBoundaryState
> {
  private diagnosticCollector = diagnosticCollector
  private errorReporter = errorReportingService

  constructor(props: LazyComponentErrorBoundaryProps) {
    super(props)
    
    this.state = {
      hasError: false,
      error: null,
      errorId: '',
      retryCount: 0,
      isRetrying: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<LazyComponentErrorBoundaryState> {
    const errorId = `lazy-component-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      hasError: true,
      error,
      errorId,
      isRetrying: false
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { componentName } = this.props
    
    // Log error with diagnostic collector
    this.diagnosticCollector.logError({
      error,
      component: componentName,
      errorType: 'lazy-load',
      severity: 'medium',
      context: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'lazy-component',
        retryCount: this.state.retryCount,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    })

    // Report error for monitoring
    this.errorReporter.reportCriticalError(error, componentName, {
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
      lazyLoad: true
    })

    console.error(`Lazy Component Error Boundary (${componentName}) caught an error:`, error)
    console.error('Component Stack:', errorInfo.componentStack)
  }

  handleRetry = async () => {
    const { componentName, onRetry } = this.props
    const { retryCount } = this.state
    
    // Check if max retries exceeded
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      console.warn(`Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for ${componentName}`)
      
      // Log that we've given up
      this.diagnosticCollector.logError({
        error: new Error('Max retry attempts exceeded'),
        component: componentName,
        errorType: 'lazy-load-max-retries',
        severity: 'high',
        context: {
          retryCount,
          maxRetries: MAX_RETRY_ATTEMPTS,
          errorId: this.state.errorId
        }
      })
      
      return // Don't retry anymore
    }
    
    this.setState({ 
      isRetrying: true,
      retryCount: retryCount + 1
    })

    // Log retry attempt
    this.diagnosticCollector.logUserAction({
      action: 'lazy_component_error_retry',
      component: componentName,
      data: {
        errorId: this.state.errorId,
        retryCount: retryCount + 1,
        error: this.state.error?.message
      }
    })

    // Call custom retry handler if provided
    if (onRetry) {
      onRetry()
    }

    // Calculate exponential backoff delay: baseDelay * 2^retryCount
    // Example: 300ms, 600ms, 1200ms, capped at 3000ms
    const exponentialDelay = BASE_RETRY_DELAY * Math.pow(2, retryCount)
    const backoffDelay = Math.min(exponentialDelay, MAX_RETRY_DELAY)
    
    console.log(`Retrying ${componentName} (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS}) after ${backoffDelay}ms`)

    // Wait with exponential backoff before retrying
    await new Promise(resolve => setTimeout(resolve, backoffDelay))

    // Reset error state to trigger retry
    this.setState({
      hasError: false,
      error: null,
      errorId: '',
      isRetrying: false
    })
  }

  render() {
    const { hasError, error, isRetrying, retryCount } = this.state
    const { children, componentName, fallbackMessage } = this.props

    if (hasError && error) {
      const canRetry = retryCount < MAX_RETRY_ATTEMPTS
      
      // Lightweight fallback UI for lazy-loaded components
      return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-red-800 dark:text-red-300">
                {fallbackMessage || `Unable to load ${componentName}`}
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {error.message}
              </p>
              {retryCount > 0 && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  Retry attempt {retryCount} of {MAX_RETRY_ATTEMPTS}
                </p>
              )}
            </div>
          </div>
          
          {canRetry ? (
            <button
              onClick={this.handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          ) : (
            <div className="text-sm text-red-700 bg-red-50 dark:bg-red-900/20 p-3 rounded">
              <p className="font-medium">Maximum retry attempts reached</p>
              <p className="mt-1">Please refresh the page to try again.</p>
            </div>
          )}
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-red-700 hover:text-red-900">
                Error Details (Development)
              </summary>
              <pre className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-800 dark:text-red-300 overflow-auto">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return children
  }
}

export default LazyComponentErrorBoundary
