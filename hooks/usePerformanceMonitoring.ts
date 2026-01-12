/**
 * Performance monitoring hooks for dashboard components
 * Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { diagnosticCollector, logPerformanceMetric } from '../lib/diagnostics/diagnostic-collector'
import { performanceMonitor } from '../lib/monitoring/performance-utils'

export interface PerformanceMetrics {
  renderTime: number
  mountTime: number
  updateCount: number
  lastUpdateTime: number
  memoryUsage?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    usagePercentage: number
  }
}

export interface ComponentPerformanceData {
  componentName: string
  metrics: PerformanceMetrics
  isSlowComponent: boolean
  recommendations: string[]
}

/**
 * Hook for monitoring component render performance
 */
export function useComponentPerformance(componentName: string) {
  const mountTimeRef = useRef<number>(Date.now())
  const renderStartRef = useRef<number>(0)
  const updateCountRef = useRef<number>(0)
  const lastUpdateTimeRef = useRef<number>(0)
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    mountTime: 0,
    updateCount: 0,
    lastUpdateTime: 0
  })

  // Mark render start
  const markRenderStart = useCallback(() => {
    renderStartRef.current = performance.now()
  }, [])

  // Mark render end and calculate metrics
  const markRenderEnd = useCallback(() => {
    if (renderStartRef.current > 0) {
      const renderTime = performance.now() - renderStartRef.current
      const mountTime = Date.now() - mountTimeRef.current
      updateCountRef.current += 1
      lastUpdateTimeRef.current = Date.now()

      const newMetrics: PerformanceMetrics = {
        renderTime,
        mountTime,
        updateCount: updateCountRef.current,
        lastUpdateTime: lastUpdateTimeRef.current
      }

      // Add memory usage if available
      const memoryInfo = performanceMonitor.getMemoryUsage()
      if (memoryInfo) {
        newMetrics.memoryUsage = memoryInfo
      }

      setMetrics(newMetrics)

      // Log performance metric
      logPerformanceMetric({
        name: 'component_render_time',
        value: renderTime,
        unit: 'ms',
        component: componentName,
        context: {
          updateCount: updateCountRef.current,
          mountTime,
          memoryUsage: memoryInfo
        }
      })

      // Warn about slow renders
      if (renderTime > 16) { // More than one frame at 60fps
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`)
        
        logPerformanceMetric({
          name: 'slow_component_render',
          value: renderTime,
          unit: 'ms',
          component: componentName,
          context: {
            threshold: 16,
            severity: renderTime > 100 ? 'high' : 'medium'
          }
        })
      }

      renderStartRef.current = 0
    }
  }, [componentName])

  // Auto-track renders
  useEffect(() => {
    markRenderStart()
    markRenderEnd()
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const totalMountTime = Date.now() - mountTimeRef.current
      logPerformanceMetric({
        name: 'component_lifetime',
        value: totalMountTime,
        unit: 'ms',
        component: componentName,
        context: {
          totalUpdates: updateCountRef.current,
          averageRenderTime: metrics.renderTime
        }
      })
    }
  }, [componentName, metrics.renderTime])

  const getPerformanceData = useCallback((): ComponentPerformanceData => {
    const isSlowComponent = metrics.renderTime > 16 || (metrics.memoryUsage?.usagePercentage || 0) > 80
    const recommendations: string[] = []

    if (metrics.renderTime > 16) {
      recommendations.push('Consider optimizing render logic or using React.memo')
    }
    if (metrics.updateCount > 100) {
      recommendations.push('High update frequency detected - consider debouncing or throttling')
    }
    if ((metrics.memoryUsage?.usagePercentage || 0) > 80) {
      recommendations.push('High memory usage - check for memory leaks')
    }

    return {
      componentName,
      metrics,
      isSlowComponent,
      recommendations
    }
  }, [componentName, metrics])

  return {
    metrics,
    markRenderStart,
    markRenderEnd,
    getPerformanceData
  }
}

/**
 * Hook for monitoring page load performance
 */
export function usePageLoadPerformance(pageName: string) {
  const [loadMetrics, setLoadMetrics] = useState<{
    loadTime: number
    domContentLoaded: number
    firstContentfulPaint: number
    largestContentfulPaint: number
    cumulativeLayoutShift: number
    firstInputDelay: number
  } | null>(null)

  useEffect(() => {
    const measurePageLoad = () => {
      if (typeof performance === 'undefined') return

      // Wait for page to be fully loaded
      if (document.readyState !== 'complete') {
        window.addEventListener('load', measurePageLoad, { once: true })
        return
      }

      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (!navigation) return

      const loadTime = navigation.loadEventEnd - navigation.startTime
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.startTime

      // Get paint metrics
      let firstContentfulPaint = 0
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0]
      if (fcpEntry) {
        firstContentfulPaint = fcpEntry.startTime
      }

      // Get Core Web Vitals from performance monitor
      const lcpMetric = performanceMonitor.getMetricsByName('LCP')
      const clsMetric = performanceMonitor.getMetricsByName('CLS')
      const fidMetric = performanceMonitor.getMetricsByName('FID')

      const largestContentfulPaint = lcpMetric?.[lcpMetric.length - 1]?.value ?? 0
      const cumulativeLayoutShift = clsMetric?.[clsMetric.length - 1]?.value ?? 0
      const firstInputDelay = fidMetric?.[fidMetric.length - 1]?.value ?? 0

      const metrics = {
        loadTime,
        domContentLoaded,
        firstContentfulPaint,
        largestContentfulPaint,
        cumulativeLayoutShift,
        firstInputDelay
      }

      setLoadMetrics(metrics)

      // Log all metrics
      Object.entries(metrics).forEach(([name, value]) => {
        logPerformanceMetric({
          name: `page_${name}`,
          value,
          unit: name.includes('shift') ? 'score' : 'ms',
          component: pageName,
          context: {
            pageName,
            url: window.location.href,
            referrer: document.referrer
          }
        })
      })

      // Log overall page performance
      logPerformanceMetric({
        name: 'page_load_complete',
        value: loadTime,
        unit: 'ms',
        component: pageName,
        context: {
          ...metrics,
          pageName,
          url: window.location.href
        }
      })
    }

    measurePageLoad()
  }, [pageName])

  return loadMetrics
}

/**
 * Hook for monitoring API call performance
 */
export function useApiPerformanceMonitoring() {
  const trackApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    endpoint: string,
    method: string = 'GET'
  ): Promise<T> => {
    const startTime = performance.now()
    const startTimestamp = Date.now()

    try {
      const result = await apiCall()
      const endTime = performance.now()
      const responseTime = endTime - startTime

      // Log successful API call
      logPerformanceMetric({
        name: 'api_response_time',
        value: responseTime,
        unit: 'ms',
        component: 'api-client',
        context: {
          endpoint,
          method,
          success: true,
          timestamp: startTimestamp
        }
      })

      // Log to diagnostic collector
      diagnosticCollector.logUserAction({
        action: 'api_call_success',
        component: 'api-client',
        data: {
          endpoint,
          method,
          responseTime,
          timestamp: startTimestamp
        }
      })

      return result
    } catch (error) {
      const endTime = performance.now()
      const responseTime = endTime - startTime

      // Log failed API call
      logPerformanceMetric({
        name: 'api_response_time',
        value: responseTime,
        unit: 'ms',
        component: 'api-client',
        context: {
          endpoint,
          method,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: startTimestamp
        }
      })

      // Log error to diagnostic collector
      if (error instanceof Error) {
        diagnosticCollector.logApiError({
          endpoint,
          method,
          statusCode: 0, // Unknown status for network errors
          error,
          responseTime,
          context: {
            timestamp: startTimestamp
          }
        })
      }

      throw error
    }
  }, [])

  return { trackApiCall }
}

/**
 * Hook for monitoring memory usage
 */
export function useMemoryMonitoring(componentName: string, interval: number = 30000) {
  const [memoryMetrics, setMemoryMetrics] = useState<{
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
    usagePercentage: number
  } | null>(null)

  useEffect(() => {
    const checkMemory = () => {
      const memoryInfo = performanceMonitor.getMemoryUsage()
      if (memoryInfo) {
        setMemoryMetrics(memoryInfo)

        logPerformanceMetric({
          name: 'memory_usage',
          value: memoryInfo.usagePercentage,
          unit: 'percent',
          component: componentName,
          context: memoryInfo
        })

        // Warn about high memory usage
        if (memoryInfo.usagePercentage > 80) {
          console.warn(`High memory usage in ${componentName}: ${memoryInfo.usagePercentage}%`)
          
          diagnosticCollector.logError({
            error: new Error(`High memory usage: ${memoryInfo.usagePercentage}%`),
            component: componentName,
            errorType: 'component',
            severity: memoryInfo.usagePercentage > 90 ? 'high' : 'medium',
            context: memoryInfo
          })
        }
      }
    }

    checkMemory()
    const intervalId = setInterval(checkMemory, interval)

    return () => clearInterval(intervalId)
  }, [componentName, interval])

  return memoryMetrics
}

/**
 * Hook for monitoring user interaction performance
 */
export function useInteractionPerformance(componentName: string) {
  const trackInteraction = useCallback((
    interactionType: string,
    callback: () => void | Promise<void>
  ) => {
    return async () => {
      const startTime = performance.now()

      try {
        await callback()
        const endTime = performance.now()
        const duration = endTime - startTime

        logPerformanceMetric({
          name: 'user_interaction_time',
          value: duration,
          unit: 'ms',
          component: componentName,
          context: {
            interactionType,
            timestamp: Date.now()
          }
        })

        diagnosticCollector.logUserAction({
          action: interactionType,
          component: componentName,
          data: {
            duration,
            timestamp: Date.now()
          }
        })

        // Warn about slow interactions
        if (duration > 100) {
          console.warn(`Slow interaction in ${componentName}: ${interactionType} took ${duration.toFixed(2)}ms`)
        }
      } catch (error) {
        const endTime = performance.now()
        const duration = endTime - startTime

        diagnosticCollector.logError({
          error: error instanceof Error ? error : new Error(String(error)),
          component: componentName,
          errorType: 'component',
          severity: 'medium',
          context: {
            interactionType,
            duration,
            timestamp: Date.now()
          }
        })

        throw error
      }
    }
  }, [componentName])

  return { trackInteraction }
}

/**
 * Hook for comprehensive dashboard performance monitoring
 */
export function useDashboardPerformance(dashboardName: string) {
  const componentPerf = useComponentPerformance(dashboardName)
  const pageLoadMetrics = usePageLoadPerformance(dashboardName)
  const memoryMetrics = useMemoryMonitoring(dashboardName)
  const { trackApiCall } = useApiPerformanceMonitoring()
  const { trackInteraction } = useInteractionPerformance(dashboardName)

  const getOverallPerformanceScore = useCallback(() => {
    let score = 100
    const issues: string[] = []

    // Component performance
    if (componentPerf.metrics.renderTime > 16) {
      score -= 20
      issues.push('Slow component renders')
    }

    // Page load performance
    if (pageLoadMetrics) {
      if (pageLoadMetrics.loadTime > 3000) {
        score -= 15
        issues.push('Slow page load')
      }
      if (pageLoadMetrics.largestContentfulPaint > 2500) {
        score -= 15
        issues.push('Poor LCP')
      }
      if (pageLoadMetrics.cumulativeLayoutShift > 0.1) {
        score -= 10
        issues.push('Layout shifts')
      }
    }

    // Memory usage
    if (memoryMetrics && memoryMetrics.usagePercentage > 80) {
      score -= 20
      issues.push('High memory usage')
    }

    return {
      score: Math.max(0, score),
      issues,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
    }
  }, [componentPerf.metrics, pageLoadMetrics, memoryMetrics])

  return {
    componentPerformance: componentPerf,
    pageLoadMetrics,
    memoryMetrics,
    trackApiCall,
    trackInteraction,
    getOverallPerformanceScore
  }
}