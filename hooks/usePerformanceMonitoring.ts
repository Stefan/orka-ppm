/**
 * Performance Monitoring Hook for Enhanced PMR
 * Client-side performance tracking and reporting
 */

import React, { useEffect, useCallback, useRef, useState } from 'react'
import { onCLS, onLCP, onTTFB, onINP, onFCP, type Metric } from 'web-vitals'

// ============================================================================
// Types
// ============================================================================

export interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
}

export interface PerformanceReport {
  metrics: PerformanceMetric[]
  webVitals: {
    lcp?: number // Largest Contentful Paint
    fid?: number // First Input Delay
    cls?: number // Cumulative Layout Shift
    fcp?: number // First Contentful Paint
    ttfb?: number // Time to First Byte
    inp?: number // Interaction to Next Paint
  }
  resourceTiming: {
    totalResources: number
    totalSize: number
    totalDuration: number
  }
  customMetrics: Record<string, number>
  longTasks: LongTaskEntry[]
}

export interface LongTaskEntry {
  duration: number
  startTime: number
  name: string
}

// ============================================================================
// Performance Monitoring Hook
// ============================================================================

export function usePerformanceMonitoring(options: {
  enabled?: boolean
  reportInterval?: number // milliseconds
  onReport?: (report: PerformanceReport) => void
  analyticsEndpoint?: string
} = {}) {
  const {
    enabled = true,
    reportInterval = 30000, // 30 seconds
    onReport,
    analyticsEndpoint = '/api/analytics/performance'
  } = options

  const metricsRef = useRef<PerformanceMetric[]>([])
  const customMetricsRef = useRef<Record<string, number>>({})
  const webVitalsRef = useRef<PerformanceReport['webVitals']>({})
  const longTasksRef = useRef<LongTaskEntry[]>([])
  const reportTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)

  // ========================================================================
  // Core Metric Recording
  // ========================================================================

  const recordMetric = useCallback((
    name: string,
    value: number,
    tags?: Record<string, string>
  ) => {
    if (!enabled) return

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags
    }

    metricsRef.current.push(metric)

    // Keep only last 100 metrics to prevent memory issues
    if (metricsRef.current.length > 100) {
      metricsRef.current = metricsRef.current.slice(-100)
    }
  }, [enabled])

  const recordCustomMetric = useCallback((name: string, value: number) => {
    if (!enabled) return
    customMetricsRef.current[name] = value
  }, [enabled])

  // ========================================================================
  // Web Vitals Monitoring
  // ========================================================================

  const captureWebVitals = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return

    // Use web-vitals library for accurate measurements
    // These callbacks will be called when metrics are available
    // Note: These are registered once and persist for the page lifetime
    onCLS((metric: Metric) => {
      webVitalsRef.current.cls = metric.value
      recordMetric('web_vitals.cls', metric.value, { rating: metric.rating })
    })

    // Note: FID has been deprecated in favor of INP in web-vitals v4
    // We're using INP which is a more comprehensive interaction metric

    onLCP((metric: Metric) => {
      webVitalsRef.current.lcp = metric.value
      recordMetric('web_vitals.lcp', metric.value, { rating: metric.rating })
    })

    onTTFB((metric: Metric) => {
      webVitalsRef.current.ttfb = metric.value
      recordMetric('web_vitals.ttfb', metric.value, { rating: metric.rating })
    })

    onINP((metric: Metric) => {
      webVitalsRef.current.inp = metric.value
      recordMetric('web_vitals.inp', metric.value, { rating: metric.rating })
    })

    onFCP((metric: Metric) => {
      webVitalsRef.current.fcp = metric.value
      recordMetric('web_vitals.fcp', metric.value, { rating: metric.rating })
    })
  }, [enabled, recordMetric])

  // ========================================================================
  // Long Task Monitoring
  // ========================================================================

  const monitorLongTasks = useCallback(() => {
    if (!enabled || typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          const longTask: LongTaskEntry = {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name
          }
          
          longTasksRef.current.push(longTask)
          
          // Keep only last 50 long tasks to prevent memory issues
          if (longTasksRef.current.length > 50) {
            longTasksRef.current = longTasksRef.current.slice(-50)
          }

          // Record metric for tasks exceeding 50ms
          if (entry.duration > 50) {
            recordMetric('long_task', entry.duration, {
              name: entry.name,
              exceeds_threshold: 'true'
            })
          }
        })
      })

      observer.observe({ entryTypes: ['longtask'] })

      return () => observer.disconnect()
    } catch (error) {
      console.error('Error monitoring long tasks:', error)
    }
  }, [enabled, recordMetric])

  // ========================================================================
  // Resource Timing
  // ========================================================================

  const captureResourceTiming = useCallback(() => {
    if (!enabled || typeof window === 'undefined') {
      return {
        totalResources: 0,
        totalSize: 0,
        totalDuration: 0
      }
    }

    try {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      
      const totalSize = resources.reduce((sum, resource) => {
        return sum + (resource.transferSize || 0)
      }, 0)

      const totalDuration = resources.reduce((sum, resource) => {
        return sum + resource.duration
      }, 0)

      return {
        totalResources: resources.length,
        totalSize,
        totalDuration
      }
    } catch (error) {
      console.error('Error capturing resource timing:', error)
      return {
        totalResources: 0,
        totalSize: 0,
        totalDuration: 0
      }
    }
  }, [enabled])

  // ========================================================================
  // Report Generation
  // ========================================================================

  const generateReport = useCallback((): PerformanceReport => {
    return {
      metrics: [...metricsRef.current],
      webVitals: { ...webVitalsRef.current },
      resourceTiming: captureResourceTiming(),
      customMetrics: { ...customMetricsRef.current },
      longTasks: [...longTasksRef.current]
    }
  }, [captureResourceTiming])

  const sendReport = useCallback(async () => {
    if (!enabled) return

    const report = generateReport()

    // Call custom onReport callback if provided
    if (onReport) {
      onReport(report)
    }

    // Send to analytics endpoint
    if (analyticsEndpoint && typeof window !== 'undefined') {
      try {
        const response = await fetch(analyticsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...report,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: Date.now()
          })
        })
        
        // Silently handle 404 - endpoint not implemented yet
        if (!response.ok && response.status === 404) {
          // Endpoint not implemented, skip logging
          return
        }
      } catch (error) {
        // Silently ignore network errors for analytics endpoint
        // This is non-critical functionality
      }
    }

    // Clear metrics after reporting
    metricsRef.current = []
  }, [enabled, onReport, analyticsEndpoint, generateReport])

  // ========================================================================
  // PMR-Specific Metrics
  // ========================================================================

  const recordReportLoadTime = useCallback((reportId: string, duration: number) => {
    recordMetric('pmr.report.load_time', duration, { report_id: reportId })
    recordCustomMetric('last_report_load_time', duration)
  }, [recordMetric, recordCustomMetric])

  const recordSectionRenderTime = useCallback((sectionId: string, duration: number) => {
    recordMetric('pmr.section.render_time', duration, { section_id: sectionId })
  }, [recordMetric])

  const recordInsightGenerationTime = useCallback((duration: number) => {
    recordMetric('pmr.insights.generation_time', duration)
    recordCustomMetric('last_insight_generation_time', duration)
  }, [recordMetric, recordCustomMetric])

  const recordExportTime = useCallback((format: string, duration: number) => {
    recordMetric('pmr.export.time', duration, { format })
  }, [recordMetric])

  const recordWebSocketLatency = useCallback((latency: number) => {
    recordMetric('pmr.websocket.latency', latency)
    recordCustomMetric('websocket_latency', latency)
  }, [recordMetric, recordCustomMetric])

  const recordCacheHit = useCallback((cacheKey: string) => {
    recordMetric('pmr.cache.hit', 1, { key: cacheKey })
  }, [recordMetric])

  const recordCacheMiss = useCallback((cacheKey: string) => {
    recordMetric('pmr.cache.miss', 1, { key: cacheKey })
  }, [recordMetric])

  const recordAPICall = useCallback((endpoint: string, duration: number, status: number) => {
    recordMetric('pmr.api.call', duration, { endpoint, status: String(status) })
  }, [recordMetric])

  // ========================================================================
  // Performance Timing Utilities
  // ========================================================================

  const measureAsync = useCallback(async <T,>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> => {
    const start = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - start
      recordMetric(name, duration, tags)
      return result
    } catch (error) {
      const duration = performance.now() - start
      recordMetric(name, duration, { ...tags, error: 'true' })
      throw error
    }
  }, [recordMetric])

  const measureSync = useCallback(<T,>(
    name: string,
    fn: () => T,
    tags?: Record<string, string>
  ): T => {
    const start = performance.now()
    try {
      const result = fn()
      const duration = performance.now() - start
      recordMetric(name, duration, tags)
      return result
    } catch (error) {
      const duration = performance.now() - start
      recordMetric(name, duration, { ...tags, error: 'true' })
      throw error
    }
  }, [recordMetric])

  // ========================================================================
  // Lifecycle
  // ========================================================================

  // Register Web Vitals observers once on mount
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    // Web Vitals observers are registered once and persist for page lifetime
    captureWebVitals()
  }, []) // Empty deps - only run once on mount

  useEffect(() => {
    if (!enabled) return

    setIsMonitoring(true)

    // Set up periodic reporting
    if (reportInterval > 0) {
      reportTimerRef.current = setInterval(sendReport, reportInterval)
    }

    // Start monitoring long tasks
    const cleanupLongTasks = monitorLongTasks()

    return () => {
      setIsMonitoring(false)
      
      if (reportTimerRef.current) {
        clearInterval(reportTimerRef.current)
      }

      // Send final report
      sendReport()

      // Cleanup long task observer
      if (cleanupLongTasks) {
        cleanupLongTasks()
      }
    }
  }, [enabled, reportInterval, sendReport, monitorLongTasks])

  // ========================================================================
  // Return API
  // ========================================================================

  return {
    // State
    isMonitoring,

    // Core functions
    recordMetric,
    recordCustomMetric,
    generateReport,
    sendReport,

    // PMR-specific functions
    recordReportLoadTime,
    recordSectionRenderTime,
    recordInsightGenerationTime,
    recordExportTime,
    recordWebSocketLatency,
    recordCacheHit,
    recordCacheMiss,
    recordAPICall,

    // Timing utilities
    measureAsync,
    measureSync,

    // Web vitals
    captureWebVitals,
    captureResourceTiming
  }
}

// ============================================================================
// Performance Observer Hook
// ============================================================================

export function usePerformanceObserver(
  entryTypes: string[],
  callback: (entries: PerformanceEntry[]) => void
) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries())
      })

      entryTypes.forEach(type => {
        try {
          observer.observe({ entryTypes: [type] })
        } catch (error) {
          console.warn(`Failed to observe ${type}:`, error)
        }
      })

      return () => observer.disconnect()
    } catch (error) {
      console.error('Failed to create PerformanceObserver:', error)
    }
  }, [entryTypes, callback])
}

// ============================================================================
// Component Render Time Hook with React Profiler
// ============================================================================

export function useRenderTime(componentName: string) {
  const renderStartRef = useRef<number>(0)
  const { recordMetric } = usePerformanceMonitoring()

  useEffect(() => {
    renderStartRef.current = performance.now()
  })

  useEffect(() => {
    const renderTime = performance.now() - renderStartRef.current
    recordMetric(`component.${componentName}.render_time`, renderTime)
  })
}

// ============================================================================
// Export Default
// ============================================================================

export default usePerformanceMonitoring
