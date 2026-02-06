'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { diagnosticCollector } from '@/lib/diagnostics/diagnostic-collector'
import { errorReportingService } from '@/lib/diagnostics/error-reporting'

interface ComponentErrorBoundaryProps {
  children: ReactNode
  componentName: string
  fallbackComponent?: React.ComponentType<ComponentErrorFallbackProps>
  isolateErrors?: boolean
  enableRetry?: boolean
  showErrorDetails?: boolean
  className?: string
}

export interface ComponentErrorFallbackProps {
  error: Error
  componentName: string
  resetError: () => void
  errorId: string
}

interface ComponentErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorId: string
  retryCount: number
  isRetrying: boolean
  showDetails: boolean
}

export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  private diagnosticCollector = diagnosticCollector
  private errorReporter = errorReportingService

  constructor(props: ComponentErrorBoundaryProps) {
    super(props)
    
    this.state = {
      hasError: false,
      error: null,
      errorId: '',
      retryCount: 0,
      isRetrying: false,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ComponentErrorBoundaryState> {
    const errorId = `component-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      hasError: true,
      error,
      errorId,
      isRetrying: false
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { componentName, isolateErrors = true } = this.props
    
    // Log error with diagnostic collector
    this.diagnosticCollector.logError({
      error,
      component: componentName,
      errorType: 'component',
      severity: 'medium',
      context: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'component',
        isolated: isolateErrors,
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
      isolated: isolateErrors
    })

    console.error(`Component Error Boundary (${componentName}) caught an error:`, error)
    console.error('Component Stack:', errorInfo.componentStack)
  }

  handleRetry = async () => {
    const { enableRetry = true, componentName } = this.props
    
    if (!enableRetry) return

    this.setState({ 
      isRetrying: true,
      retryCount: this.state.retryCount + 1
    })

    // Log retry attempt
    this.diagnosticCollector.logUserAction({
      action: 'component_error_retry',
      component: componentName,
      data: {
        errorId: this.state.errorId,
        retryCount: this.state.retryCount + 1,
        error: this.state.error?.message
      }
    })

    // Wait a moment to show retry state
    await new Promise(resolve => setTimeout(resolve, 300))

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorId: '',
      isRetrying: false,
      showDetails: false
    })
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
    
    this.diagnosticCollector.logUserAction({
      action: 'component_error_toggle_details',
      component: this.props.componentName,
      data: {
        errorId: this.state.errorId,
        showDetails: !this.state.showDetails
      }
    })
  }

  render() {
    const { hasError, error, errorId, isRetrying, showDetails } = this.state
    const { 
      children, 
      componentName, 
      fallbackComponent: CustomFallback,
      enableRetry = true,
      showErrorDetails = true,
      className = ''
    } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (CustomFallback) {
        return (
          <CustomFallback
            error={error}
            componentName={componentName}
            resetError={this.handleRetry}
            errorId={errorId}
          />
        )
      }

      // Default component error fallback UI
      return (
        <Card className={`border-red-200 dark:border-red-800 bg-red-50 ${className}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="text-lg text-red-800 dark:text-red-300">
                {componentName} Error
              </h3>
            </div>
            <p className="text-red-700">
              This component encountered an error and couldn't load properly.
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {enableRetry && (
                <Button
                  size="sm"
                  onClick={this.handleRetry}
                  disabled={isRetrying}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                  {isRetrying ? 'Retrying...' : 'Retry'}
                </Button>
              )}
              
              {showErrorDetails && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={this.toggleDetails}
                  className="flex items-center gap-2"
                >
                  {showDetails ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Show Details
                    </>
                  )}
                </Button>
              )}
            </div>

            {showDetails && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-md border border-red-200 dark:border-red-800">
                <div className="text-sm">
                  <div className="font-medium text-red-800 dark:text-red-300 mb-1">Error ID:</div>
                  <div className="text-red-700 mb-3 font-mono text-xs">{errorId}</div>
                  
                  <div className="font-medium text-red-800 dark:text-red-300 mb-1">Error Message:</div>
                  <div className="text-red-700 mb-3">{error.message}</div>
                  
                  {process.env.NODE_ENV === 'development' && (
                    <>
                      <div className="font-medium text-red-800 dark:text-red-300 mb-1">Stack Trace:</div>
                      <pre className="text-xs text-red-700 whitespace-pre-wrap break-words bg-red-50 dark:bg-red-900/20 p-2 rounded border">
                        {error.stack}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    return children
  }
}

export default ComponentErrorBoundary