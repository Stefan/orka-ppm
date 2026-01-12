/**
 * Enhanced console error interceptor for comprehensive error logging
 * Provides detailed error context and environment-specific logging levels
 */

import { logger } from './logger'

export interface EnhancedErrorInfo {
  message: string
  stack?: string
  componentStack?: string
  errorBoundary?: string
  timestamp: string
  userAgent: string
  url: string
  environment: string
  errorType: 'console' | 'boundary' | 'unhandled'
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, any>
}

export interface ErrorInterceptorConfig {
  enableConsoleInterception: boolean
  enableUnhandledRejectionInterception: boolean
  enableErrorBoundaryLogging: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  maxErrorsPerSession: number
  enableStackTrace: boolean
  enableComponentStack: boolean
}

class ErrorInterceptor {
  private config: ErrorInterceptorConfig
  private errorCount: number = 0
  private originalConsoleError: typeof console.error
  private originalConsoleWarn: typeof console.warn
  private isInitialized: boolean = false

  constructor(config?: Partial<ErrorInterceptorConfig>) {
    this.config = {
      enableConsoleInterception: true,
      enableUnhandledRejectionInterception: true,
      enableErrorBoundaryLogging: true,
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
      maxErrorsPerSession: 100,
      enableStackTrace: true,
      enableComponentStack: true,
      ...config
    }

    // Store original console methods
    this.originalConsoleError = console.error
    this.originalConsoleWarn = console.warn
  }

  /**
   * Initialize error interception
   */
  public initialize(): void {
    if (this.isInitialized) {
      return
    }

    if (typeof window === 'undefined') {
      // Server-side initialization
      this.initializeServerSide()
    } else {
      // Client-side initialization
      this.initializeClientSide()
    }

    this.isInitialized = true
  }

  /**
   * Initialize client-side error interception
   */
  private initializeClientSide(): void {
    // Intercept console.error
    if (this.config.enableConsoleInterception) {
      console.error = (...args: any[]) => {
        this.handleConsoleError('error', args)
        this.originalConsoleError.apply(console, args)
      }

      console.warn = (...args: any[]) => {
        this.handleConsoleError('warn', args)
        this.originalConsoleWarn.apply(console, args)
      }
    }

    // Intercept unhandled promise rejections
    if (this.config.enableUnhandledRejectionInterception) {
      window.addEventListener('unhandledrejection', (event) => {
        this.handleUnhandledRejection(event)
      })
    }

    // Intercept global errors
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event)
    })
  }

  /**
   * Initialize server-side error interception
   */
  private initializeServerSide(): void {
    // Server-side error handling for SSR
    if (this.config.enableConsoleInterception) {
      console.error = (...args: any[]) => {
        this.handleConsoleError('error', args)
        this.originalConsoleError.apply(console, args)
      }
    }

    // Handle unhandled promise rejections in Node.js
    if (this.config.enableUnhandledRejectionInterception) {
      process.on('unhandledRejection', (reason, promise) => {
        this.handleServerUnhandledRejection(reason, promise)
      })
    }
  }

  /**
   * Handle console errors with enhanced logging
   */
  private handleConsoleError(level: 'error' | 'warn', args: any[]): void {
    if (this.errorCount >= this.config.maxErrorsPerSession) {
      return
    }

    const errorInfo = this.createEnhancedErrorInfo({
      message: this.formatConsoleArgs(args),
      errorType: 'console',
      severity: level === 'error' ? 'high' : 'medium',
      context: {
        consoleLevel: level,
        arguments: args
      }
    })

    this.logError(errorInfo)
    this.errorCount++
  }

  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const errorInfo = this.createEnhancedErrorInfo({
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack,
      errorType: 'unhandled',
      severity: 'critical',
      context: {
        reason: event.reason,
        promise: event.promise
      }
    })

    this.logError(errorInfo)
    this.errorCount++
  }

  /**
   * Handle global errors
   */
  private handleGlobalError(event: ErrorEvent): void {
    const errorInfo = this.createEnhancedErrorInfo({
      message: event.message,
      stack: event.error?.stack,
      errorType: 'unhandled',
      severity: 'critical',
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      }
    })

    this.logError(errorInfo)
    this.errorCount++
  }

  /**
   * Handle server-side unhandled rejections
   */
  private handleServerUnhandledRejection(reason: any, promise: Promise<any>): void {
    const errorInfo = this.createEnhancedErrorInfo({
      message: `Server Unhandled Promise Rejection: ${reason}`,
      stack: reason?.stack,
      errorType: 'unhandled',
      severity: 'critical',
      context: {
        reason,
        promise: promise.toString()
      }
    })

    this.logError(errorInfo)
    this.errorCount++
  }

  /**
   * Log React Error Boundary errors
   */
  public logErrorBoundaryError(
    error: Error,
    errorInfo: { componentStack?: string; digest?: string },
    errorBoundary?: string
  ): void {
    if (!this.config.enableErrorBoundaryLogging) {
      return
    }

    const enhancedErrorInfo = this.createEnhancedErrorInfo({
      message: error.message,
      ...(this.config.enableStackTrace && error.stack ? { stack: error.stack } : {}),
      ...(this.config.enableComponentStack && errorInfo.componentStack ? { componentStack: errorInfo.componentStack } : {}),
      ...(errorBoundary ? { errorBoundary } : {}),
      errorType: 'boundary',
      severity: 'high',
      context: {
        errorName: error.name,
        digest: errorInfo.digest,
        errorInfo
      }
    })

    this.logError(enhancedErrorInfo)
    this.errorCount++
  }

  /**
   * Create enhanced error information object
   */
  private createEnhancedErrorInfo(params: {
    message: string
    stack?: string
    componentStack?: string
    errorBoundary?: string
    errorType: EnhancedErrorInfo['errorType']
    severity: EnhancedErrorInfo['severity']
    context?: Record<string, any>
  }): EnhancedErrorInfo {
    return {
      message: params.message,
      ...(params.stack ? { stack: params.stack } : {}),
      ...(params.componentStack ? { componentStack: params.componentStack } : {}),
      ...(params.errorBoundary ? { errorBoundary: params.errorBoundary } : {}),
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
      url: typeof window !== 'undefined' ? window.location.href : 'Server',
      environment: process.env.NODE_ENV || 'unknown',
      errorType: params.errorType,
      severity: params.severity,
      ...(params.context ? { context: params.context } : {})
    }
  }

  /**
   * Log error with appropriate level based on environment
   */
  private logError(errorInfo: EnhancedErrorInfo): void {
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (isDevelopment) {
      // Development: Detailed logging with full context
      console.group(`🚨 Enhanced Error Interceptor - ${errorInfo.severity.toUpperCase()}`)
      console.error('Error Message:', errorInfo.message)
      console.error('Error Type:', errorInfo.errorType)
      console.error('Timestamp:', errorInfo.timestamp)
      console.error('URL:', errorInfo.url)
      
      if (errorInfo.stack) {
        console.error('Stack Trace:', errorInfo.stack)
      }
      
      if (errorInfo.componentStack) {
        console.error('Component Stack:', errorInfo.componentStack)
      }
      
      if (errorInfo.errorBoundary) {
        console.error('Error Boundary:', errorInfo.errorBoundary)
      }
      
      if (errorInfo.context) {
        console.error('Context:', errorInfo.context)
      }
      
      console.error('Full Error Info:', errorInfo)
      console.groupEnd()
    } else {
      // Production: Structured logging for monitoring services
      logger.error('Enhanced Error Interceptor', {
        errorInfo,
        sessionErrorCount: this.errorCount
      })
    }

    // Always log to internal logger for consistency
    logger.error(`[${errorInfo.errorType}] ${errorInfo.message}`, {
      ...errorInfo,
      sessionErrorCount: this.errorCount
    })
  }

  /**
   * Format console arguments into a readable string
   */
  private formatConsoleArgs(args: any[]): string {
    return args
      .map(arg => {
        if (typeof arg === 'string') {
          return arg
        }
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}`
        }
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      })
      .join(' ')
  }

  /**
   * Get current error count for this session
   */
  public getErrorCount(): number {
    return this.errorCount
  }

  /**
   * Reset error count
   */
  public resetErrorCount(): void {
    this.errorCount = 0
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ErrorInterceptorConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Restore original console methods
   */
  public restore(): void {
    if (typeof window !== 'undefined') {
      console.error = this.originalConsoleError
      console.warn = this.originalConsoleWarn
    }
    this.isInitialized = false
  }
}

// Create singleton instance
export const errorInterceptor = new ErrorInterceptor()

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  errorInterceptor.initialize()
}

// Export for manual initialization
export { ErrorInterceptor }
export default errorInterceptor