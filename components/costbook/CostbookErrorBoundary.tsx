'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Bug } from 'lucide-react'

export interface CostbookErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode
  /** Fallback component to render on error */
  fallback?: ReactNode
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Whether to show error details */
  showDetails?: boolean
  /** Test ID for testing */
  'data-testid'?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
}

/**
 * Error boundary for catching and handling React errors
 * Provides user-friendly error display with reload option
 */
export class CostbookErrorBoundary extends Component<
  CostbookErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: CostbookErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    
    // Log error to console
    console.error('CostbookErrorBoundary caught error:', error)
    console.error('Error info:', errorInfo)
    
    // Call error callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    })
  }

  toggleDetails = (): void => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  render(): ReactNode {
    const { hasError, error, errorInfo, showDetails } = this.state
    const { children, fallback, 'data-testid': testId = 'costbook-error-boundary' } = this.props

    if (hasError) {
      // Return custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Default error UI
      return (
        <div 
          className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-red-50 rounded-lg border border-red-200"
          data-testid={testId}
          role="alert"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-10 h-10 text-red-500" />
            <div>
              <h2 className="text-xl font-semibold text-red-700">
                Something went wrong
              </h2>
              <p className="text-red-600 text-sm">
                An error occurred while loading the Costbook
              </p>
            </div>
          </div>

          {/* Error message */}
          <p className="text-gray-600 text-center mb-6 max-w-md">
            We apologize for the inconvenience. Please try refreshing the page or contact support if the problem persists.
          </p>

          {/* Action buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              data-testid={`${testId}-retry`}
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              data-testid={`${testId}-reload`}
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
          </div>

          {/* Error details toggle */}
          {(this.props.showDetails ?? process.env.NODE_ENV === 'development') && (
            <div className="w-full max-w-lg">
              <button
                onClick={this.toggleDetails}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                {showDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                <Bug className="w-4 h-4" />
                Technical Details
              </button>

              {showDetails && (
                <div className="bg-gray-900 text-gray-100 p-4 rounded-md text-xs font-mono overflow-auto max-h-48">
                  <p className="text-red-400 mb-2">
                    {error?.name}: {error?.message}
                  </p>
                  {errorInfo?.componentStack && (
                    <pre className="text-gray-400 whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    return children
  }
}

export default CostbookErrorBoundary