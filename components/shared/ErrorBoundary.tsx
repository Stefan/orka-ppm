'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, ArrowLeft, HelpCircle } from 'lucide-react'
import { logger } from '@/lib/monitoring/logger'
import { loadTranslations } from '@/lib/i18n/loader'
import type { TranslationDictionary } from '@/lib/i18n/types'

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
  translations?: TranslationDictionary
  locale?: string
}

/**
 * Error Boundary component for graceful error handling
 */
class ErrorBoundaryComponent extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public async componentDidMount() {
    // Load translations for error boundary
    try {
      const locale = typeof window !== 'undefined' 
        ? localStorage.getItem('i18n_locale') || 'en'
        : 'en'
      const translations = await loadTranslations(locale)
      this.setState({ translations, locale })
    } catch (error) {
      console.error('Failed to load translations for ErrorBoundary:', error)
      // Continue without translations - will use fallback English text
    }
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

    logger.error('Production error caught by ErrorBoundary', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId
    })
    // Optional: when @sentry/nextjs is installed, call Sentry.captureException(error, { extra: { componentStack, errorId } })
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

  private t = (key: string, params?: Record<string, string | number>): string => {
    if (!this.state.translations) {
      // Fallback to English if translations not loaded
      const fallbackMap: Record<string, string> = {
        'errors.boundary.tryAgain': 'Try Again',
        'errors.boundary.refreshPage': 'Refresh Page',
        'errors.boundary.navigateSection': 'Or navigate to a different section:',
        'errors.boundary.dashboardHome': 'Dashboard Home',
        'errors.boundary.goBack': 'Go Back',
        'errors.boundary.quickNavigation': 'Quick Navigation:',
        'errors.boundary.help': 'Help',
        'errors.boundary.errorId': 'Error ID:',
        'errors.boundary.includeIdInSupport': 'Please include this ID when contacting support',
        'errors.boundary.devDetails': 'Development Error Details:',
        'errors.boundary.message': 'Message:',
        'errors.boundary.stackTrace': 'Stack Trace:',
        'errors.boundary.componentStack': 'Component Stack:',
        'nav.reports': 'Reports',
        'nav.risks': 'Risks',
        'nav.scenarios': 'Scenarios',
      }
      let result = fallbackMap[key] || key
      if (params) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          result = result.replace(`{${paramKey}}`, String(paramValue))
        })
      }
      return result
    }

    // Navigate nested object using dot notation
    const keys = key.split('.')
    let value: any = this.state.translations

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return key // Return key if not found
      }
    }

    if (typeof value !== 'string') {
      return key
    }

    // Handle interpolation
    if (params) {
      return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
        return str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
      }, value)
    }

    return value
  }

  private getErrorTypeMessage = (error?: Error): string => {
    if (!error) return this.t('errors.boundary.unexpected')
    
    const errorMessage = error.message?.toLowerCase() || ''
    const errorName = error.name?.toLowerCase() || ''
    
    // Categorize common error types
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return this.t('errors.boundary.network')
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return this.t('errors.boundary.permission')
    }
    
    if (errorMessage.includes('timeout')) {
      return this.t('errors.boundary.timeout')
    }
    
    if (errorName.includes('typeerror') || errorMessage.includes('undefined') || errorMessage.includes('null')) {
      return this.t('errors.boundary.dataLoading')
    }
    
    if (errorMessage.includes('syntax') || errorName.includes('syntaxerror')) {
      return this.t('errors.boundary.configuration')
    }
    
    return this.t('errors.boundary.defaultMessage')
  }

  private getContextualInfo = (): string => {
    if (this.props.contextInfo) {
      return this.props.contextInfo
    }
    
    // Try to determine context from current URL
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      
      if (path.includes('/dashboards')) return this.t('errors.contexts.dashboard')
      if (path.includes('/reports')) return this.t('errors.contexts.reports')
      if (path.includes('/risks')) return this.t('errors.contexts.risks')
      if (path.includes('/scenarios')) return this.t('errors.contexts.scenarios')
      if (path.includes('/resources')) return this.t('errors.contexts.resources')
      if (path.includes('/financials')) return this.t('errors.contexts.financials')
      if (path.includes('/changes')) return this.t('errors.contexts.changes')
      if (path.includes('/admin')) return this.t('errors.contexts.admin')
      if (path.includes('/feedback')) return this.t('errors.contexts.feedback')
      if (path.includes('/monte-carlo')) return this.t('errors.contexts.monteCarlo')
    }
    
    return this.t('errors.contexts.application')
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
          <div className="max-w-lg w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 text-center border border-gray-200 dark:border-slate-700">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-red-500 dark:text-red-400" aria-hidden />
            </div>
            
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
              {this.t('errors.boundary.title', { context: contextualInfo })}
            </h1>
            
            <p className="text-gray-700 dark:text-slate-200 mb-4">
              {errorTypeMessage}
            </p>

            {/* Error ID for support */}
            {this.state.errorId && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-md">
                <p className="text-sm text-gray-700 dark:text-slate-200">
                  <strong>{this.t('errors.boundary.errorId')}</strong> {this.state.errorId}
                </p>
                <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">
                  {this.t('errors.boundary.includeIdInSupport')}
                </p>
              </div>
            )}

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-left">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">{this.t('errors.boundary.devDetails')}</h3>
                <div className="space-y-2">
                  <div>
                    <strong className="text-xs text-red-900 dark:text-red-400">{this.t('errors.boundary.message')}</strong>
                    <pre className="text-xs text-red-800 dark:text-red-300 overflow-auto mt-1 bg-red-100 dark:bg-red-900/30 p-2 rounded">
                      {this.state.error.message}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong className="text-xs text-red-900 dark:text-red-400">{this.t('errors.boundary.stackTrace')}</strong>
                      <pre className="text-xs text-red-800 dark:text-red-300 overflow-auto mt-1 bg-red-100 dark:bg-red-900/30 p-2 rounded max-h-32">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong className="text-xs text-red-900 dark:text-red-400">{this.t('errors.boundary.componentStack')}</strong>
                      <pre className="text-xs text-red-800 dark:text-red-300 overflow-auto mt-1 bg-red-100 dark:bg-red-900/30 p-2 rounded max-h-32">
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
                className="flex items-center justify-center px-4 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
                {this.t('errors.boundary.tryAgain')}
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
                {this.t('errors.boundary.refreshPage')}
              </button>
            </div>

            {/* Navigation options */}
            {showNavigation && (
              <>
                <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mb-4">
                  <p className="text-sm text-gray-700 dark:text-slate-200 mb-3">
                    {this.t('errors.boundary.navigateSection')}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <button
                      onClick={this.handleGoHome}
                      className="flex items-center justify-center px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors"
                    >
                      <Home className="h-4 w-4 mr-2" aria-hidden />
                      {this.t('errors.boundary.dashboardHome')}
                    </button>
                    
                    <button
                      onClick={this.handleGoBack}
                      className="flex items-center justify-center px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" aria-hidden />
                      {this.t('errors.boundary.goBack')}
                    </button>
                  </div>
                </div>

                {/* Quick navigation links */}
                <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                  <p className="text-xs text-gray-700 dark:text-slate-300 mb-2">{this.t('errors.boundary.quickNavigation')}</p>
                  <div className="flex flex-wrap gap-2 justify-center text-xs">
                    <a 
                      href="/reports" 
                      className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                    >
                      {this.t('nav.reports')}
                    </a>
                    <a 
                      href="/risks" 
                      className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                    >
                      {this.t('nav.risks')}
                    </a>
                    <a 
                      href="/scenarios" 
                      className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                    >
                      {this.t('nav.scenarios')}
                    </a>
                    <a 
                      href="/feedback" 
                      className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                    >
                      <HelpCircle className="h-3 w-3 inline mr-1" />
                      {this.t('errors.boundary.help')}
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