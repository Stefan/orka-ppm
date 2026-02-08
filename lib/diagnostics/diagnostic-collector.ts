/**
 * Comprehensive diagnostic and error logging system
 * Implements Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { logger } from '../monitoring/logger'
import { performanceMonitor } from '../monitoring/performance-utils'

export interface ErrorLog {
  id: string
  timestamp: Date
  component: string
  error: Error
  stackTrace: string
  userAgent: string
  url: string
  userId?: string
  sessionId: string
  errorType: 'javascript' | 'authentication' | 'api' | 'component' | 'network' | 'validation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, any>
  breadcrumbs: BreadcrumbEntry[]
}

export interface BreadcrumbEntry {
  timestamp: Date
  category: 'navigation' | 'user-action' | 'api-call' | 'error' | 'info'
  message: string
  data?: Record<string, any>
}

export interface PerformanceMetric {
  id: string
  timestamp: Date
  name: string
  value: number
  unit: string
  component?: string
  context?: Record<string, any>
}

export interface ApiMetric {
  id: string
  timestamp: Date
  endpoint: string
  method: string
  statusCode: number
  responseTime: number
  requestSize?: number
  responseSize?: number
  error?: string
  retryCount: number
}

export interface UserAction {
  id: string
  timestamp: Date
  action: string
  component: string
  data?: Record<string, any>
  userId?: string
  sessionId: string
}

export interface DiagnosticData {
  errorLogs: ErrorLog[]
  performanceMetrics: PerformanceMetric[]
  apiMetrics: ApiMetric[]
  userActions: UserAction[]
  systemInfo: SystemInfo
  sessionInfo: SessionInfo
}

export interface SystemInfo {
  userAgent: string
  platform: string
  language: string
  cookieEnabled: boolean
  onLine: boolean
  screenResolution: string
  viewportSize: string
  colorDepth: number
  timezone: string
  memoryInfo?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

export interface SessionInfo {
  sessionId: string
  startTime: Date
  userId?: string
  isAuthenticated: boolean
  pageViews: number
  totalTime: number
  lastActivity: Date
}

class DiagnosticCollector {
  private static instance: DiagnosticCollector
  private errorLogs: ErrorLog[] = []
  private performanceMetrics: PerformanceMetric[] = []
  private apiMetrics: ApiMetric[] = []
  private userActions: UserAction[] = []
  private breadcrumbs: BreadcrumbEntry[] = []
  private sessionId: string
  private sessionStartTime: Date
  private lastActivity: Date
  private pageViews: number = 0
  private maxStoredItems = 1000

  private constructor() {
    this.sessionId = this.generateSessionId()
    this.sessionStartTime = new Date()
    this.lastActivity = new Date()
    
    if (typeof window !== 'undefined') {
      this.setupGlobalHandlers()
      this.startPerformanceMonitoring()
      this.trackPageView()
    }
  }

  static getInstance(): DiagnosticCollector {
    if (!DiagnosticCollector.instance) {
      DiagnosticCollector.instance = new DiagnosticCollector()
    }
    return DiagnosticCollector.instance
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private setupGlobalHandlers() {
    // Only set up handlers in browser environment
    if (typeof window === 'undefined') {
      return
    }

    // JavaScript error handler
    window.addEventListener('error', (event) => {
      this.logError({
        error: event.error || new Error(event.message),
        component: 'global',
        errorType: 'javascript',
        severity: 'high',
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          message: event.message
        }
      })
    })

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        component: 'global',
        errorType: 'javascript',
        severity: 'high',
        context: {
          type: 'unhandled_promise_rejection',
          reason: event.reason
        }
      })
    })

    // Resource loading error handler
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement
        this.logError({
          error: new Error(`Failed to load resource: ${target.tagName}`),
          component: 'resource-loader',
          errorType: 'network',
          severity: 'medium',
          context: {
            tagName: target.tagName,
            src: (target as any).src || (target as any).href,
            id: target.id,
            className: target.className
          }
        })
      }
    }, true)

    // User activity tracking
    try {
      ['click', 'keydown', 'scroll', 'mousemove'].forEach(eventType => {
        window.addEventListener(eventType, () => {
          this.lastActivity = new Date()
        }, { passive: true })
      })
    } catch (error) {
      // Silently fail in test environment
      console.warn('Failed to set up user activity tracking:', error)
    }

    // Page visibility change
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.addBreadcrumb({
          category: 'info',
          message: `Page visibility changed to ${document.visibilityState}`
        })
      })
    }

    // Network status changes
    window.addEventListener('online', () => {
      this.addBreadcrumb({
        category: 'info',
        message: 'Network connection restored'
      })
    })

    window.addEventListener('offline', () => {
      this.addBreadcrumb({
        category: 'info',
        message: 'Network connection lost'
      })
    })
  }

  private startPerformanceMonitoring() {
    // Only start performance monitoring in browser environment
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
      return
    }

    // Monitor performance metrics every 30 seconds
    setInterval(() => {
      this.collectPerformanceMetrics()
    }, 30000)

    // Initial collection
    setTimeout(() => {
      this.collectPerformanceMetrics()
    }, 1000)
  }

  private collectPerformanceMetrics() {
    // Skip if not in browser environment
    if (typeof window === 'undefined') {
      return
    }

    try {
      // Memory usage
      const memoryInfo = performanceMonitor.getMemoryUsage()
      if (memoryInfo) {
        this.logPerformanceMetric({
          name: 'memory_usage_percentage',
          value: memoryInfo.usagePercentage,
          unit: 'percent',
          component: 'system',
          context: memoryInfo
        })
      }

      // Core Web Vitals (CLS is unitless 'score', others ms)
      const metrics = performanceMonitor.getMetrics()
      metrics.forEach(metric => {
        const name = metric.name.toLowerCase()
        this.logPerformanceMetric({
          name,
          value: metric.value,
          unit: name === 'cls' ? 'score' : 'ms',
          component: 'core-web-vitals',
          context: { rating: metric.rating }
        })
      })
    } catch (error) {
      // Silently fail in test environment
      console.warn('Performance monitoring failed:', error)
    }
  }

  private trackPageView() {
    if (typeof window === 'undefined') {
      return
    }

    this.pageViews++
    this.addBreadcrumb({
      category: 'navigation',
      message: `Page view: ${window.location.pathname}`,
      data: {
        url: window.location.href,
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        pageViews: this.pageViews
      }
    })
  }

  // Public methods for logging different types of events

  logError(params: {
    error: Error
    component: string
    errorType: ErrorLog['errorType']
    severity: ErrorLog['severity']
    context?: Record<string, any>
    userId?: string
  }) {
    const errorLog: ErrorLog = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      component: params.component,
      error: params.error,
      stackTrace: params.error.stack || '',
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.sessionId,
      errorType: params.errorType,
      severity: params.severity,
      breadcrumbs: [...this.breadcrumbs]
    }

    if (params.userId) {
      errorLog.userId = params.userId
    }

    if (params.context) {
      errorLog.context = params.context
    }

    this.errorLogs.push(errorLog)
    this.trimArray(this.errorLogs, this.maxStoredItems)

    // Add breadcrumb for this error
    this.addBreadcrumb({
      category: 'error',
      message: `${params.errorType} error in ${params.component}: ${params.error.message || 'Unknown error'}`,
      data: {
        errorId: errorLog.id,
        severity: params.severity
      }
    })

    // Log to console and external services
    logger.error(`[${params.component}] ${params.error.message}`, {
      errorId: errorLog.id,
      errorType: params.errorType,
      severity: params.severity,
      context: params.context,
      stack: params.error.stack
    })

    return errorLog.id
  }

  logAuthenticationError(error: Error, context?: Record<string, any>) {
    return this.logError({
      error,
      component: 'authentication',
      errorType: 'authentication',
      severity: 'high',
      context: {
        ...context,
        authState: 'failed',
        timestamp: new Date().toISOString()
      }
    })
  }

  logApiError(params: {
    endpoint: string
    method: string
    statusCode: number
    error: Error
    responseTime: number
    retryCount?: number
    context?: Record<string, any>
  }) {
    const apiMetric: ApiMetric = {
      id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      endpoint: params.endpoint,
      method: params.method,
      statusCode: params.statusCode,
      responseTime: params.responseTime,
      error: params.error.message || 'Unknown API error',
      retryCount: params.retryCount || 0
    }

    this.apiMetrics.push(apiMetric)
    this.trimArray(this.apiMetrics, this.maxStoredItems)

    // Also log as error - return the error ID from logError
    const errorId = this.logError({
      error: params.error,
      component: 'api-client',
      errorType: 'api',
      severity: params.statusCode >= 500 ? 'high' : 'medium',
      context: {
        endpoint: params.endpoint,
        method: params.method,
        statusCode: params.statusCode,
        responseTime: params.responseTime,
        retryCount: params.retryCount,
        ...params.context
      }
    })

    return errorId
  }

  logComponentError(error: Error, componentName: string, context?: Record<string, any>) {
    return this.logError({
      error,
      component: componentName,
      errorType: 'component',
      severity: 'medium',
      context: {
        ...context,
        componentName,
        renderError: true
      }
    })
  }

  logPerformanceMetric(params: {
    name: string
    value: number
    unit: string
    component?: string
    context?: Record<string, any>
  }) {
    const metric: PerformanceMetric = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      name: params.name,
      value: params.value,
      unit: params.unit
    }

    if (params.component) {
      metric.component = params.component
    }

    if (params.context) {
      metric.context = params.context
    }

    this.performanceMetrics.push(metric)
    this.trimArray(this.performanceMetrics, this.maxStoredItems)

    // Log performance warnings
    if (this.isPerformanceIssue(params.name, params.value)) {
      // #region agent log
      if (params.name === 'cls' && typeof fetch !== 'undefined') {
        fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/diagnostics/diagnostic-collector.ts:logPerformanceMetric',message:'CLS performance issue logged',data:{name:params.name,value:params.value,unit:params.unit},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      }
      // #endregion
      logger.warn(`Performance issue detected: ${params.name}`, metric)
    }

    return metric.id
  }

  logUserAction(params: {
    action: string
    component: string
    data?: Record<string, any>
    userId?: string
  }) {
    const userAction: UserAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action: params.action,
      component: params.component,
      sessionId: this.sessionId
    }

    if (params.data) {
      userAction.data = params.data
    }

    if (params.userId) {
      userAction.userId = params.userId
    }

    this.userActions.push(userAction)
    this.trimArray(this.userActions, this.maxStoredItems)

    this.addBreadcrumb({
      category: 'user-action',
      message: `User ${params.action} in ${params.component}`,
      ...(params.data && { data: params.data })
    })

    return userAction.id
  }

  addBreadcrumb(params: {
    category: BreadcrumbEntry['category']
    message: string
    data?: Record<string, any>
  }) {
    const breadcrumb: BreadcrumbEntry = {
      timestamp: new Date(),
      category: params.category,
      message: params.message
    }

    if (params.data) {
      breadcrumb.data = params.data
    }

    this.breadcrumbs.push(breadcrumb)
    this.trimArray(this.breadcrumbs, 100) // Keep last 100 breadcrumbs
  }

  private isPerformanceIssue(metricName: string, value: number): boolean {
    const thresholds: Record<string, number> = {
      'lcp': 2500,
      'fid': 100,
      'cls': 0.1,
      'fcp': 1800,
      'ttfb': 800,
      'memory_usage_percentage': 80,
      'api_response_time': 2000
    }

    return thresholds[metricName] ? value > thresholds[metricName] : false
  }

  private trimArray<T>(array: T[], maxLength: number) {
    if (array.length > maxLength) {
      array.splice(0, array.length - maxLength)
    }
  }

  private getSystemInfo(): SystemInfo {
    // Provide defaults for test environment
    const defaultSystemInfo: SystemInfo = {
      userAgent: 'Test Environment',
      platform: 'Test Platform',
      language: 'en-US',
      cookieEnabled: true,
      onLine: true,
      screenResolution: '1920x1080',
      viewportSize: '1920x1080',
      colorDepth: 24,
      timezone: 'UTC'
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return defaultSystemInfo
    }

    const systemInfo: SystemInfo = {
      userAgent: navigator.userAgent || defaultSystemInfo.userAgent,
      platform: navigator.platform || defaultSystemInfo.platform,
      language: navigator.language || defaultSystemInfo.language,
      cookieEnabled: navigator.cookieEnabled ?? defaultSystemInfo.cookieEnabled,
      onLine: navigator.onLine ?? defaultSystemInfo.onLine,
      screenResolution: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : defaultSystemInfo.screenResolution,
      viewportSize: `${window.innerWidth || 1920}x${window.innerHeight || 1080}`,
      colorDepth: typeof screen !== 'undefined' ? screen.colorDepth : defaultSystemInfo.colorDepth,
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : defaultSystemInfo.timezone
    }

    try {
      const memoryInfo = performanceMonitor.getMemoryUsage()
      if (memoryInfo) {
        systemInfo.memoryInfo = memoryInfo
      }
    } catch (error) {
      // Silently fail in test environment
    }

    return systemInfo
  }

  private getSessionInfo(): SessionInfo {
    const sessionInfo: SessionInfo = {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      isAuthenticated: false, // Will be updated by authentication system
      pageViews: this.pageViews,
      totalTime: Date.now() - this.sessionStartTime.getTime(),
      lastActivity: this.lastActivity
    }

    // Don't set userId if it's undefined - let it remain optional
    return sessionInfo
  }

  // Public API for retrieving diagnostic data

  getDiagnosticData(): DiagnosticData {
    return {
      errorLogs: [...this.errorLogs],
      performanceMetrics: [...this.performanceMetrics],
      apiMetrics: [...this.apiMetrics],
      userActions: [...this.userActions],
      systemInfo: this.getSystemInfo(),
      sessionInfo: this.getSessionInfo()
    }
  }

  getErrorLogs(filter?: {
    component?: string
    errorType?: ErrorLog['errorType']
    severity?: ErrorLog['severity']
    since?: Date
  }): ErrorLog[] {
    let logs = [...this.errorLogs]

    if (filter) {
      if (filter.component) {
        logs = logs.filter(log => log.component === filter.component)
      }
      if (filter.errorType) {
        logs = logs.filter(log => log.errorType === filter.errorType)
      }
      if (filter.severity) {
        logs = logs.filter(log => log.severity === filter.severity)
      }
      if (filter.since) {
        logs = logs.filter(log => log.timestamp >= filter.since!)
      }
    }

    return logs
  }

  getPerformanceMetrics(filter?: {
    name?: string
    component?: string
    since?: Date
  }): PerformanceMetric[] {
    let metrics = [...this.performanceMetrics]

    if (filter) {
      if (filter.name) {
        metrics = metrics.filter(metric => metric.name === filter.name)
      }
      if (filter.component) {
        metrics = metrics.filter(metric => metric.component === filter.component)
      }
      if (filter.since) {
        metrics = metrics.filter(metric => metric.timestamp >= filter.since!)
      }
    }

    return metrics
  }

  exportDiagnosticReport(): string {
    const data = this.getDiagnosticData()
    return JSON.stringify(data, null, 2)
  }

  clearDiagnosticData() {
    this.errorLogs = []
    this.performanceMetrics = []
    this.apiMetrics = []
    this.userActions = []
    this.breadcrumbs = []
  }

  // Update session info (called by authentication system)
  updateSessionInfo(updates: Partial<Pick<SessionInfo, 'userId' | 'isAuthenticated'>>) {
    // This will be used by the authentication system to update user info
    if (updates.userId !== undefined) {
      this.addBreadcrumb({
        category: 'info',
        message: `User ID updated: ${updates.userId}`
      })
    }
    if (updates.isAuthenticated !== undefined) {
      this.addBreadcrumb({
        category: 'info',
        message: `Authentication status: ${updates.isAuthenticated ? 'authenticated' : 'unauthenticated'}`
      })
    }
  }
}

// Export singleton instance
export const diagnosticCollector = DiagnosticCollector.getInstance()

// Utility functions for easy access
export const logError = (params: Parameters<typeof diagnosticCollector.logError>[0]) => 
  diagnosticCollector.logError(params)

export const logAuthenticationError = (error: Error, context?: Record<string, any>) =>
  diagnosticCollector.logAuthenticationError(error, context)

export const logApiError = (params: Parameters<typeof diagnosticCollector.logApiError>[0]) =>
  diagnosticCollector.logApiError(params)

export const logComponentError = (error: Error, componentName: string, context?: Record<string, any>) =>
  diagnosticCollector.logComponentError(error, componentName, context)

export const logPerformanceMetric = (params: Parameters<typeof diagnosticCollector.logPerformanceMetric>[0]) =>
  diagnosticCollector.logPerformanceMetric(params)

export const logUserAction = (params: Parameters<typeof diagnosticCollector.logUserAction>[0]) =>
  diagnosticCollector.logUserAction(params)

export const addBreadcrumb = (params: Parameters<typeof diagnosticCollector.addBreadcrumb>[0]) =>
  diagnosticCollector.addBreadcrumb(params)

export default diagnosticCollector