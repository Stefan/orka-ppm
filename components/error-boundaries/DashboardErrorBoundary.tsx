'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { diagnosticCollector } from '@/lib/diagnostics/diagnostic-collector'
import { errorReportingService } from '@/lib/diagnostics/error-reporting'

export interface ErrorFallbackProps {
  error: Error
  resetError: () => void
  errorId: string
  componentStack?: string
}

interface DashboardErrorBoundaryProps {
  children: ReactNode
  fallback?: React.ComponentType<ErrorFallbackProps>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  enableRetry?: boolean
  enableDiagnostics?: boolean
}

interface DashboardErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorId: string
  retryCount: number
  isRetrying: boolean
  componentStack?: string
}

export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  private diagnosticCollector = diagnosticCollector
  private errorReporter = errorReportingService

  constructor(props: DashboardErrorBoundaryProps) {
    super(props)
    
    this.state = {
      hasError: false,
      error: null,
      errorId: '',
      retryCount: 0,
      isRetrying: false,
      componentStack: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<DashboardErrorBoundaryState> {
    const errorId = `dashboard-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      hasError: true,
      error,
      errorId,
      isRetrying: false
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, enableDiagnostics = true } = this.props
    
    // Update state with component stack
    this.setState({
      componentStack: errorInfo.componentStack || ''
    })

    // Log error with diagnostic collector
    if (enableDiagnostics) {
      this.diagnosticCollector.logError({
        error,
        component: 'DashboardErrorBoundary',
        errorType: 'component',
        severity: 'critical',
        context: {
          componentStack: errorInfo.componentStack,
          errorBoundary: 'dashboard',
          retryCount: this.state.retryCount,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      })
    }

    // Report error for monitoring
    this.errorReporter.reportCriticalError(error, 'DashboardErrorBoundary', {
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      retryCount: this.state.retryCount
    })

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }

    console.error('Dashboard Error Boundary caught an error:', error)
    console.error('Component Stack:', errorInfo.componentStack)
  }

  handleRetry = async () => {
    const { enableRetry = true } = this.props
    
    if (!enableRetry) return

    this.setState({ 
      isRetrying: true,
      retryCount: this.state.retryCount + 1
    })

    // Log retry attempt
    this.diagnosticCollector.logUserAction({
      action: 'error_boundary_retry',
      component: 'DashboardErrorBoundary',
      data: {
        errorId: this.state.errorId,
        retryCount: this.state.retryCount + 1,
        error: this.state.error?.message
      }
    })

    // Wait a moment to show retry state
    await new Promise(resolve => setTimeout(resolve, 500))

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorId: '',
      isRetrying: false,
      componentStack: ''
    })
  }

  handleGoHome = () => {
    this.diagnosticCollector.logUserAction({
      action: 'error_boundary_go_home',
      component: 'DashboardErrorBoundary',
      data: {
        errorId: this.state.errorId,
        error: this.state.error?.message
      }
    })

    window.location.href = '/'
  }

  render() {
    const { hasError, error, errorId, isRetrying, componentStack } = this.state
    const { children, fallback: CustomFallback, enableRetry = true } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (CustomFallback) {
        return (
          <CustomFallback
            error={error}
            resetError={this.handleRetry}
            errorId={errorId}
            componentStack={componentStack || ''}
          />
        )
      }

      // Default error fallback UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Dashboard Error
              </h2>
              <p className="text-gray-600">
                Something went wrong while loading the dashboard. Don't worry, we're here to help.
              </p>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <Alert>
                <Bug className="h-4 w-4" />
                <AlertDescription>
                  <strong>Error ID:</strong> {errorId}
                  <br />
                  <strong>Error:</strong> {error.message}
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {enableRetry && (
                  <Button
                    onClick={this.handleRetry}
                    disabled={isRetrying}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? 'Retrying...' : 'Try Again'}
                  </Button>
                )}
                
                <Button
                  variant="secondary"
                  onClick={this.handleGoHome}
                  className="flex items-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                    Technical Details (Development)
                  </summary>
                  <div className="mt-2 p-4 bg-gray-100 rounded-md">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words">
                      {error.stack}
                    </pre>
                    {componentStack && (
                      <div className="mt-4">
                        <h4 className="font-medium text-gray-700 mb-2">Component Stack:</h4>
                        <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words">
                          {componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return children
  }
}

export default DashboardErrorBoundary