/**
 * Performance Monitoring Hook for Enhanced PMR
 * Client-side performance tracking and reporting
 */

import { useEffect, useCallback, useRef, useState } from 'react'

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
  }
  resourceTiming: {
    totalResources: number
    totalSize: number
    totalDuration: number
  }
  customMetrics: Record<string, number>
}

// ============================================================================
// Performance Monitoring Hook
// ============================================================================

export function usePerformanceMonitoring(options: {
  enabled?: boolean
  reportInterval?: number // milliseconds
  onReport?: (report: PerformanceReport) => void
} = {}) {
  const {
    enabled = true,
    reportInterval = 30000, // 30 seconds
    onReport
  } = options

  const metricsRef = useRef<PerformanceMetric[]>([])
  const customMetricsRef = useRef<Record<string, number>>({})
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
    if (!enabled || typeof window === 'undefined') return {}

    const vitals: PerformanceReport['webVitals'] = {}

    try {
      // Get navigation timing
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigation) {
        vitals.ttfb = navigation.responseStart - navigation.requestStart
        vitals.fcp = navigation.domContentLoadedEventEnd - navigation.fetchStart
      }

      // Get paint timing
      const paintEntries = performance.getEntriesByType('paint')
      const lcp = paintEntries.find(entry => entry.name === 'largest-contentful-paint')
      if (lcp) {
        vitals.lcp = lcp.startTime
      }

      // Get layout shift (CLS)
      const layoutShifts = performance.getEntriesByType('layout-shift') as any[]
      if (layoutShifts.length > 0) {
        vitals.cls = layoutShifts.reduce((sum, entry) => sum + entry.value, 0)
      }

      // Get first input delay (FID)
      const firstInput = performance.getEntriesByType('first-input') as any[]
      if (firstInput.length > 0) {
        vitals.fid = firstInput[0].processingStart - firstInput[0].startTime
      }
    } catch (error) {
      console.error('Error capturing web vitals:', error)
    }

    return vitals
  }, [enabled])

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
      webVitals: captureWebVitals(),
      resourceTiming: captureResourceTiming(),
      customMetrics: { ...customMetricsRef.current }
    }
  }, [captureWebVitals, captureResourceTiming])

  const sendReport = useCallback(() => {
    if (!enabled || !onReport) return

    const report = generateReport()
    onReport(report)

    // Clear metrics after reporting
    metricsRef.current = []
  }, [enabled, onReport, generateReport])

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

  useEffect(() => {
    if (!enabled) return

    setIsMonitoring(true)

    // Set up periodic reporting
    if (onReport && reportInterval > 0) {
      reportTimerRef.current = setInterval(sendReport, reportInterval)
    }

    // Capture initial web vitals
    if (typeof window !== 'undefined') {
      // Wait for page load
      if (document.readyState === 'complete') {
        captureWebVitals()
      } else {
        window.addEventListener('load', captureWebVitals)
      }
    }

    return () => {
      setIsMonitoring(false)
      
      if (reportTimerRef.current) {
        clearInterval(reportTimerRef.current)
      }

      // Send final report
      if (onReport) {
        sendReport()
      }

      if (typeof window !== 'undefined') {
        window.removeEventListener('load', captureWebVitals)
      }
    }
  }, [enabled, onReport, reportInterval, sendReport, captureWebVitals])

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
// Component Render Time Hook
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
