/**
 * Global error handling utilities for ORKA-PPM
 */

export interface AppError extends Error {
  code?: string
  statusCode?: number
  context?: Record<string, unknown>
  timestamp?: number
  userId?: string
}

export class ErrorHandler {
  private static instance: ErrorHandler
  private errorQueue: AppError[] = []
  private isOnline = true

  private constructor() {
    if (typeof window !== 'undefined') {
      this.setupGlobalHandlers()
      this.setupNetworkMonitoring()
    }
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  private setupGlobalHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason)
      
      const error = this.createAppError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        'UNHANDLED_PROMISE_REJECTION'
      )
      
      this.handleError(error)
      event.preventDefault()
    })

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      console.error('Uncaught error:', event.error)
      
      const error = this.createAppError(
        event.error || new Error(event.message),
        'UNCAUGHT_ERROR',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      )
      
      this.handleError(error)
    })

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement
        const error = this.createAppError(
          new Error(`Failed to load resource: ${target.tagName}`),
          'RESOURCE_LOAD_ERROR',
          {
            tagName: target.tagName,
            src: (target as any).src || (target as any).href,
            id: target.id,
            className: target.className
          }
        )
        
        this.handleError(error)
      }
    }, true)
  }

  private setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.flushErrorQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  private createAppError(
    error: Error,
    code?: string,
    context?: Record<string, unknown>
  ): AppError {
    const appError: AppError = {
      ...error,
      code: code || 'UNKNOWN_ERROR',
      timestamp: Date.now(),
      context: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        ...context
      }
    }

    return appError
  }

  handleError(error: AppError | Error, context?: Record<string, unknown>) {
    const appError = error instanceof Error && !('code' in error)
      ? this.createAppError(error, undefined, context)
      : error as AppError

    // Add to queue for offline handling
    this.errorQueue.push(appError)

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Handler')
      console.error('Error:', appError.message)
      console.error('Code:', appError.code)
      console.error('Context:', appError.context)
      console.error('Stack:', appError.stack)
      console.groupEnd()
    }

    // Send to error reporting service if online
    if (this.isOnline) {
      this.sendToErrorService(appError)
    }

    // Store locally for offline scenarios
    this.storeErrorLocally(appError)
  }

  private async sendToErrorService(error: AppError) {
    try {
      // TODO: Integrate with error reporting service (e.g., Sentry, Bugsnag)
      // For now, just log to console in production
      if (process.env.NODE_ENV === 'production') {
        console.error('Production error:', {
          message: error.message,
          code: error.code,
          context: error.context,
          stack: error.stack
        })
      }

      // Mock API call
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(error)
      // })

    } catch (e) {
      console.warn('Failed to send error to service:', e)
    }
  }

  private storeErrorLocally(error: AppError) {
    try {
      const stored = localStorage.getItem('orka_error_log')
      const errors = stored ? JSON.parse(stored) : []
      
      errors.push({
        message: error.message,
        code: error.code,
        timestamp: error.timestamp,
        context: error.context
      })

      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50)
      }

      localStorage.setItem('orka_error_log', JSON.stringify(errors))
    } catch (e) {
      console.warn('Failed to store error locally:', e)
    }
  }

  private flushErrorQueue() {
    while (this.errorQueue.length > 0) {
      const error = this.errorQueue.shift()
      if (error) {
        this.sendToErrorService(error)
      }
    }
  }

  // API Error handling
  handleApiError(response: Response, context?: Record<string, unknown>): AppError {
    const error = this.createAppError(
      new Error(`API Error: ${response.status} ${response.statusText}`),
      'API_ERROR',
      {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        ...context
      }
    )

    error.statusCode = response.status
    this.handleError(error)
    return error
  }

  // Network Error handling
  handleNetworkError(error: Error, context?: Record<string, unknown>): AppError {
    const appError = this.createAppError(
      error,
      'NETWORK_ERROR',
      {
        isOnline: this.isOnline,
        ...context
      }
    )

    this.handleError(appError)
    return appError
  }

  // Validation Error handling
  handleValidationError(message: string, field?: string, context?: Record<string, unknown>): AppError {
    const error = this.createAppError(
      new Error(message),
      'VALIDATION_ERROR',
      {
        field,
        ...context
      }
    )

    this.handleError(error)
    return error
  }

  // Get stored errors for debugging
  getStoredErrors(): any[] {
    try {
      const stored = localStorage.getItem('orka_error_log')
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      return []
    }
  }

  // Clear stored errors
  clearStoredErrors() {
    try {
      localStorage.removeItem('orka_error_log')
    } catch (e) {
      console.warn('Failed to clear stored errors:', e)
    }
  }
}

// Singleton instance
export const errorHandler = ErrorHandler.getInstance()

// Utility functions
export const handleError = (error: Error | AppError, context?: Record<string, unknown>) => {
  errorHandler.handleError(error, context)
}

export const handleApiError = (response: Response, context?: Record<string, unknown>) => {
  return errorHandler.handleApiError(response, context)
}

export const handleNetworkError = (error: Error, context?: Record<string, unknown>) => {
  return errorHandler.handleNetworkError(error, context)
}

export const handleValidationError = (message: string, field?: string, context?: Record<string, unknown>) => {
  return errorHandler.handleValidationError(message, field, context)
}

export default errorHandler