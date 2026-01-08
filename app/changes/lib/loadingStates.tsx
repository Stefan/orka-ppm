/**
 * Centralized Loading State Management for Change Management System
 * Provides consistent loading patterns across all components
 */

import React from 'react'
import { AlertCircle } from 'lucide-react'

// Loading state types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface LoadingConfig {
  state: LoadingState
  message?: string
  error?: string
  progress?: number
  showProgress?: boolean
}

// Centralized loading component
export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg'
  className?: string
}> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  return (
    <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]} ${className}`} 
         data-testid="loading-spinner" />
  )
}

// Enhanced loading state component
export const LoadingState: React.FC<LoadingConfig & {
  children?: React.ReactNode
  fallback?: React.ReactNode
}> = ({ 
  state, 
  message, 
  error, 
  progress, 
  showProgress = false, 
  children, 
  fallback 
}) => {
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          {message && (
            <p className="mt-4 text-sm text-gray-600">{message}</p>
          )}
          {showProgress && progress !== undefined && (
            <div className="mt-4 w-48 mx-auto">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex items-center justify-center h-64" role="alert">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Error Loading Data</h3>
          <p className="mt-2 text-sm text-gray-600">
            {error || 'An unexpected error occurred. Please try again.'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (state === 'success' && children) {
    return <>{children}</>
  }

  if (state === 'idle' && fallback) {
    return <>{fallback}</>
  }

  return null
}

// Skeleton loading components for specific content types
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-white rounded-lg shadow p-6 ${className}`}>
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
    <div className="flex space-x-2">
      <div className="h-6 bg-gray-200 rounded w-16"></div>
      <div className="h-6 bg-gray-200 rounded w-20"></div>
    </div>
  </div>
)

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => (
  <div className="animate-pulse">
    <div className="bg-gray-50 px-6 py-3">
      <div className="flex space-x-4">
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded flex-1"></div>
        ))}
      </div>
    </div>
    {Array.from({ length: rows }, (_, rowIndex) => (
      <div key={rowIndex} className="border-t border-gray-200 px-6 py-4">
        <div className="flex space-x-4">
          {Array.from({ length: columns }, (_, colIndex) => (
            <div key={colIndex} className="h-4 bg-gray-200 rounded flex-1"></div>
          ))}
        </div>
      </div>
    ))}
  </div>
)

export const SkeletonChart: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
  <div className={`animate-pulse bg-white rounded-lg shadow p-6 ${height}`}>
    <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
    <div className="flex items-end space-x-2 h-32">
      {Array.from({ length: 8 }, (_, i) => (
        <div 
          key={i} 
          className="bg-gray-200 rounded flex-1"
          style={{ height: `${Math.random() * 80 + 20}%` }}
        ></div>
      ))}
    </div>
  </div>
)

// Hook for managing loading states
export const useLoadingState = (initialState: LoadingState = 'idle') => {
  const [loadingConfig, setLoadingConfig] = React.useState<LoadingConfig>({
    state: initialState
  })

  const setLoading = (message?: string, progress?: number) => {
    setLoadingConfig({
      state: 'loading',
      message,
      progress,
      showProgress: progress !== undefined
    })
  }

  const setSuccess = () => {
    setLoadingConfig({ state: 'success' })
  }

  const setError = (error: string) => {
    setLoadingConfig({ state: 'error', error })
  }

  const setIdle = () => {
    setLoadingConfig({ state: 'idle' })
  }

  return {
    ...loadingConfig,
    setLoading,
    setSuccess,
    setError,
    setIdle,
    isLoading: loadingConfig.state === 'loading',
    isError: loadingConfig.state === 'error',
    isSuccess: loadingConfig.state === 'success',
    isIdle: loadingConfig.state === 'idle'
  }
}

// Higher-order component for consistent loading behavior
export const withLoadingState = <P extends object>(
  Component: React.ComponentType<P>,
  loadingMessage?: string
) => {
  return React.forwardRef<any, P & { loading?: boolean; error?: string }>((props, ref) => {
    const { loading, error, ...componentProps } = props

    if (loading) {
      return <LoadingState state="loading" message={loadingMessage} />
    }

    if (error) {
      return <LoadingState state="error" error={error} />
    }

    return <Component {...(componentProps as P)} ref={ref} />
  })
}

// Async data fetching hook with loading states
export const useAsyncData = <T,>(
  fetchFn: () => Promise<T>,
  dependencies: React.DependencyList = []
) => {
  const [data, setData] = React.useState<T | null>(null)
  const loadingState = useLoadingState('loading')

  React.useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        loadingState.setLoading('Loading data...')
        const result = await fetchFn()
        
        if (!cancelled) {
          setData(result)
          loadingState.setSuccess()
        }
      } catch (error) {
        if (!cancelled) {
          loadingState.setError(error instanceof Error ? error.message : 'Failed to load data')
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, dependencies)

  return {
    data,
    ...loadingState,
    refetch: () => {
      const fetchData = async () => {
        try {
          loadingState.setLoading('Refreshing data...')
          const result = await fetchFn()
          setData(result)
          loadingState.setSuccess()
        } catch (error) {
          loadingState.setError(error instanceof Error ? error.message : 'Failed to refresh data')
        }
      }
      fetchData()
    }
  }
}

// Progress tracking for multi-step operations
export const useProgressTracker = (steps: string[]) => {
  const [currentStep, setCurrentStep] = React.useState(0)
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set())
  const loadingState = useLoadingState()

  const startStep = (stepIndex: number) => {
    setCurrentStep(stepIndex)
    loadingState.setLoading(
      `${steps[stepIndex]}...`,
      Math.round(((stepIndex) / steps.length) * 100)
    )
  }

  const completeStep = (stepIndex: number) => {
    setCompletedSteps(prev => new Set([...prev, stepIndex]))
    
    if (stepIndex === steps.length - 1) {
      loadingState.setSuccess()
    } else {
      const nextStep = stepIndex + 1
      startStep(nextStep)
    }
  }

  const failStep = (error: string) => {
    loadingState.setError(`Failed at step "${steps[currentStep]}": ${error}`)
  }

  const reset = () => {
    setCurrentStep(0)
    setCompletedSteps(new Set())
    loadingState.setIdle()
  }

  return {
    currentStep,
    completedSteps,
    progress: Math.round(((completedSteps.size) / steps.length) * 100),
    ...loadingState,
    startStep,
    completeStep,
    failStep,
    reset
  }
}

// Loading state context for global state management
export const LoadingContext = React.createContext<{
  globalLoading: boolean
  setGlobalLoading: (loading: boolean) => void
  loadingMessage: string
  setLoadingMessage: (message: string) => void
}>({
  globalLoading: false,
  setGlobalLoading: () => {},
  loadingMessage: '',
  setLoadingMessage: () => {}
})

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [globalLoading, setGlobalLoading] = React.useState(false)
  const [loadingMessage, setLoadingMessage] = React.useState('')

  return (
    <LoadingContext.Provider value={{
      globalLoading,
      setGlobalLoading,
      loadingMessage,
      setLoadingMessage
    }}>
      {children}
      {globalLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center space-x-3">
              <LoadingSpinner />
              <span className="text-gray-900">{loadingMessage || 'Loading...'}</span>
            </div>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  )
}

export const useGlobalLoading = () => {
  const context = React.useContext(LoadingContext)
  if (!context) {
    throw new Error('useGlobalLoading must be used within a LoadingProvider')
  }
  return context
}