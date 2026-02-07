/**
 * React hook for Chrome scroll event logging
 * Implements Requirements 8.5 for Chrome-specific scroll debugging
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { 
  ChromeScrollLogger, 
  ChromeScrollEvent, 
  ChromeScrollMetrics,
  ChromeScrollLoggerConfig 
} from '../lib/utils/browser/chrome-scroll-logger'

export interface UseChromeScrollLoggerOptions extends Partial<ChromeScrollLoggerConfig> {
  elementRef?: React.RefObject<HTMLElement | null> | undefined
  onScrollEvent?: (event: ChromeScrollEvent) => void
  onMetricsUpdate?: (metrics: ChromeScrollMetrics) => void
  autoStart?: boolean
}

export interface ChromeScrollLoggerHookReturn {
  scrollEvents: ChromeScrollEvent[]
  scrollMetrics: ChromeScrollMetrics
  isLogging: boolean
  isChromeBrowser: boolean
  chromeVersion: string
  startLogging: () => void
  stopLogging: () => void
  clearEvents: () => void
  exportData: () => string
  getEventsFromStorage: () => ChromeScrollEvent[]
}

/**
 * Hook for Chrome-specific scroll event logging and debugging
 */
export function useChromeScrollLogger(
  options: UseChromeScrollLoggerOptions = {}
): ChromeScrollLoggerHookReturn {
  const {
    elementRef,
    onScrollEvent,
    onMetricsUpdate,
    autoStart = true,
    ...rest
  } = options
  const config: Partial<ChromeScrollLoggerConfig> = rest

  const [scrollEvents, setScrollEvents] = useState<ChromeScrollEvent[]>([])
  const [scrollMetrics, setScrollMetrics] = useState<ChromeScrollMetrics>({
    totalEvents: 0,
    scrollDuration: 0,
    averageSpeed: 0,
    maxSpeed: 0,
    minSpeed: 0,
    scrollDistance: 0,
    overscrollEvents: 0,
    momentumEvents: 0,
    backgroundArtifacts: 0,
    performanceScore: 100
  })
  const [isLogging, setIsLogging] = useState(false)

  const loggerRef = useRef<ChromeScrollLogger | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize Chrome scroll logger
  useEffect(() => {
    loggerRef.current = new ChromeScrollLogger(config)
  }, [])

  // Update metrics periodically
  const updateMetrics = useCallback(() => {
    if (!loggerRef.current) return

    const events = loggerRef.current.getChromeScrollEvents()
    const metrics = loggerRef.current.getChromeScrollMetrics()

    setScrollEvents([...events])
    setScrollMetrics(metrics)

    // Call callback if provided
    onMetricsUpdate?.(metrics)

    // Call scroll event callback for new events
    if (events.length > scrollEvents.length) {
      const newEvents = events.slice(scrollEvents.length)
      newEvents.forEach(event => onScrollEvent?.(event))
    }
  }, [onScrollEvent, onMetricsUpdate, scrollEvents.length])

  // Start logging
  const startLogging = useCallback(() => {
    const element = elementRef?.current
    if (!element || !loggerRef.current || isLogging) return

    // Initialize Chrome scroll logging
    const cleanup = loggerRef.current.initializeChromeScrollLogging(element)
    cleanupRef.current = cleanup
    setIsLogging(true)

    // Start metrics updates
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current)
    }
    metricsIntervalRef.current = setInterval(updateMetrics, config.metricsInterval || 5000)

    // Initial metrics update
    updateMetrics()
  }, [elementRef?.current, isLogging, updateMetrics, config.metricsInterval])

  // Stop logging
  const stopLogging = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current)
      metricsIntervalRef.current = null
    }

    setIsLogging(false)

    // Final metrics update
    updateMetrics()
  }, [updateMetrics])

  // Clear events
  const clearEvents = useCallback(() => {
    loggerRef.current?.clearChromeScrollEvents()
    setScrollEvents([])
    setScrollMetrics({
      totalEvents: 0,
      scrollDuration: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      minSpeed: 0,
      scrollDistance: 0,
      overscrollEvents: 0,
      momentumEvents: 0,
      backgroundArtifacts: 0,
      performanceScore: 100
    })
  }, [])

  // Export data
  const exportData = useCallback(() => {
    return loggerRef.current?.exportChromeScrollData() || '{}'
  }, [])

  // Get events from storage
  const getEventsFromStorage = useCallback(() => {
    return loggerRef.current?.getChromeScrollEventsFromStorage() || []
  }, [])

  // Auto-start logging when element is available
  useEffect(() => {
    if (autoStart && elementRef?.current && !isLogging) {
      startLogging()
    }
  }, [autoStart, elementRef?.current, isLogging, startLogging])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLogging()
    }
  }, [stopLogging])

  // Get Chrome browser info
  const isChromeBrowser = loggerRef.current?.isChrome() || false
  const chromeVersion = loggerRef.current?.getChromeVersion() || 'Unknown'

  return {
    scrollEvents,
    scrollMetrics,
    isLogging,
    isChromeBrowser,
    chromeVersion,
    startLogging,
    stopLogging,
    clearEvents,
    exportData,
    getEventsFromStorage
  }
}

/**
 * Hook for global Chrome scroll logging (window-level)
 */
export function useGlobalChromeScrollLogger(
  options: Omit<UseChromeScrollLoggerOptions, 'elementRef'> = {}
) {
  const windowRef = useRef<HTMLElement>(document.documentElement)
  
  return useChromeScrollLogger({
    ...options,
    elementRef: windowRef
  })
}

/**
 * Hook for Chrome scroll debugging with console output
 */
export function useChromeScrollDebugger(
  elementRef?: React.RefObject<HTMLElement | null>
) {
  const [debugInfo, setDebugInfo] = useState<{
    lastEvent: ChromeScrollEvent | null
    eventCount: number
    performanceIssues: string[]
  }>({
    lastEvent: null,
    eventCount: 0,
    performanceIssues: []
  })

  const logger = useChromeScrollLogger({
    elementRef,
    enableDebugOutput: true,
    logToConsole: true,
    onScrollEvent: (event) => {
      setDebugInfo(prev => ({
        lastEvent: event,
        eventCount: prev.eventCount + 1,
        performanceIssues: [
          ...prev.performanceIssues,
          ...(event.isOverscrolling ? ['Overscroll detected'] : []),
          ...(event.scrollSpeed > 20 ? ['High scroll speed'] : []),
          ...(event.backgroundAttachment !== 'local' ? ['Background attachment issue'] : [])
        ].slice(-10) // Keep last 10 issues
      }))
    }
  })

  return {
    ...logger,
    debugInfo
  }
}