'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, ArrowLeft, HelpCircle } from 'lucide-react'
import { logger } from '../../lib/monitoring/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showNavigation?: boolean
  contextInfo?: string
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorId?: string
}

/**
 * Error Boundary component for graceful error handling
 */
class ErrorBoundaryComponent extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return { hasError: true, error, errorId }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error)
    console.error('Error info:', errorInfo)
    
    // Store error info in state for display
    this.setState({ errorInfo })
    
    // Enhanced error logging for development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 ErrorBoundary Details')
      console.error('Error message:', error.message)
      console.error('Error name:', error.name)
      console.error('Error stack:', error.stack)
      console.error('Component stack:', errorInfo.componentStack)
      console.error('Full error object:', error)
      console.error('Full errorInfo object:', errorInfo)
      console.groupEnd()
    }
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      // Integrate with error reporting service (e.g., Sentry)
      logger.error('Production error caught by ErrorBoundary', { 
        message: error.message,
        name: error.name,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId
      })
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false })
  }

  private handleGoHome = () => {
    window.location.href = '/dashboards'
  }

  private handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      this.handleGoHome()
    }
  }

  private getErrorTypeMessage = (error?: Error): string => {
    if (!error) return 'An unexpected error occurred'
    
    const errorMessage = error.message?.toLowerCase() || ''
    const errorName = error.name?.toLowerCase() || ''
    
    // Categorize common error types
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'Network connection issue detected. Please check your internet connection and try again.'
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return 'Access permission issue. You may need to log in again or contact support.'
    }
    
    if (errorMessage.includes('timeout')) {
      return 'Request timed out. The server may be busy. Please try again in a moment.'
    }
    
    if (errorName.includes('typeerror') || errorMessage.includes('undefined') || errorMessage.includes('null')) {
      return 'Data loading issue detected. Some information may be temporarily unavailable.'
    }
    
    if (errorMessage.includes('syntax') || errorName.includes('syntaxerror')) {
      return 'Application configuration issue detected. Please refresh the page or contact support.'
    }
    
    return 'An unexpected error occurred while loading this section.'
  }

  private getContextualInfo = (): string => {
    if (this.props.contextInfo) {
      return this.props.contextInfo
    }
    
    // Try to determine context from current URL
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      
      if (path.includes('/dashboards')) return 'Portfolio Dashboard'
      if (path.includes('/reports')) return 'AI Reports & Analytics'
      if (path.includes('/risks')) return 'Risk/Issue Registers'
      if (path.includes('/scenarios')) return 'What-If Scenarios'
      if (path.includes('/resources')) return 'Resource Management'
      if (path.includes('/financials')) return 'Financial Tracking'
      if (path.includes('/changes')) return 'Change Management'
      if (path.includes('/admin')) return 'Administration'
      if (path.includes('/feedback')) return 'Feedback & Ideas'
      if (path.includes('/monte-carlo')) return 'Monte Carlo Analysis'
    }
    
    return 'Application'
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      const contextualInfo = this.getContextualInfo()
      const errorTypeMessage = this.getErrorTypeMessage(this.state.error)
      const showNavigation = this.props.showNavigation !== false // Default to true

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
            
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {contextualInfo} Error
            </h1>
            
            <p className="text-gray-600 mb-4">
              {errorTypeMessage}
            </p>

            {/* Error ID for support */}
            {this.state.errorId && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-sm text-gray-600">
                  <strong>Error ID:</strong> {this.state.errorId}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Please include this ID when contacting support
                </p>
              </div>
            )}

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-left">
                <h3 className="text-sm font-medium text-red-800 mb-2">Development Error Details:</h3>
                <div className="space-y-2">
                  <div>
                    <strong className="text-xs text-red-700">Message:</strong>
                    <pre className="text-xs text-red-700 overflow-auto mt-1 bg-red-100 p-2 rounded">
                      {this.state.error.message}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong className="text-xs text-red-700">Stack Trace:</strong>
                      <pre className="text-xs text-red-700 overflow-auto mt-1 bg-red-100 p-2 rounded max-h-32">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong className="text-xs text-red-700">Component Stack:</strong>
                      <pre className="text-xs text-red-700 overflow-auto mt-1 bg-red-100 p-2 rounded max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Retry loading this section"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                aria-label="Refresh the entire page"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </button>
            </div>

            {/* Navigation options */}
            {showNavigation && (
              <>
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Or navigate to a different section:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <button
                      onClick={this.handleGoHome}
                      className="flex items-center justify-center px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                      aria-label="Go to Portfolio Dashboards home page"
                    >
                      <Home className="h-4 w-4 mr-2" />
                      Dashboard Home
                    </button>
                    
                    <button
                      onClick={this.handleGoBack}
                      className="flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      aria-label="Go back to previous page"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Go Back
                    </button>
                  </div>
                </div>

                {/* Quick navigation links */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-500 mb-2">Quick Navigation:</p>
                  <div className="flex flex-wrap gap-2 justify-center text-xs">
                    <a 
                      href="/reports" 
                      className="px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                      aria-label="Go to AI Reports & Analytics"
                    >
                      Reports
                    </a>
                    <a 
                      href="/risks" 
                      className="px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                      aria-label="Go to Risk/Issue Registers"
                    >
                      Risks
                    </a>
                    <a 
                      href="/scenarios" 
                      className="px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                      aria-label="Go to What-If Scenarios"
                    >
                      Scenarios
                    </a>
                    <a 
                      href="/feedback" 
                      className="px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                      aria-label="Go to Feedback & Ideas"
                    >
                      <HelpCircle className="h-3 w-3 inline mr-1" />
                      Help
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Functional wrapper for the ErrorBoundary to ensure proper JSX rendering
 */
export const ErrorBoundary: React.FC<Props> = (props) => {
  return <ErrorBoundaryComponent {...props} />
}

/**
 * Hook-based error boundary for functional components
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} {...(onError && { onError })}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}