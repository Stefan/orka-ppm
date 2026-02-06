'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary für Dashboard-Komponenten
 * Fängt Fehler ab und zeigt eine benutzerfreundliche Fehlermeldung
 */
export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback 
          error={this.state.error} 
          onReset={this.handleReset} 
        />
      )
    }

    return this.props.children
  }
}

/**
 * Error Fallback Component mit i18n
 */
function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { t } = useTranslations()
  
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
          {t('errors.somethingWentWrong')}
        </h3>
        
        <p className="text-gray-600 dark:text-slate-400 mb-6">
          {t('errors.componentLoadError')}
        </p>
        
        {error && (
          <details className="text-left mb-6 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg text-sm">
            <summary className="cursor-pointer font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t('errors.technicalDetails')}
            </summary>
            <pre className="text-xs text-gray-600 dark:text-slate-400 overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
        
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t('errors.reloadPage')}
        </button>
      </div>
    </div>
  )
}

/**
 * Lightweight Error Boundary für einzelne Widgets
 */
export function WidgetErrorBoundary({ 
  children, 
  widgetName 
}: { 
  children: ReactNode
  widgetName: string 
}) {
  const { t } = useTranslations()
  
  return (
    <DashboardErrorBoundary
      fallback={
        <div className="p-6 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-1">
                {t('errors.widgetNotAvailable', { widget: widgetName })}
              </h4>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                {t('errors.widgetLoadError')}
              </p>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </DashboardErrorBoundary>
  )
}
