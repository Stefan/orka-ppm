/**
 * Chrome Scroll Logger Integration Example
 * Demonstrates how to integrate Chrome scroll logging into components
 */

import { chromeScrollLogger } from './chrome-scroll-logger'

/**
 * Example: Integrate Chrome scroll logging into a main content component
 */
export function setupChromeScrollLogging(element: HTMLElement) {
  // Check if browser is Chrome-based
  if (!chromeScrollLogger.isChrome()) {
    console.log('Chrome scroll logging is only available in Chrome-based browsers')
    return () => {}
  }

  console.log(`Initializing Chrome scroll logging for ${chromeScrollLogger.getChromeVersion()}`)

  // Initialize Chrome scroll logging with debug output
  chromeScrollLogger.updateConfig({
    enableLogging: true,
    enableMetrics: true,
    enableDebugOutput: true,
    logToConsole: true,
    logToStorage: true
  })

  const cleanup = chromeScrollLogger.initializeChromeScrollLogging(element)

  // Log metrics periodically
  const metricsInterval = setInterval(() => {
    const metrics = chromeScrollLogger.getChromeScrollMetrics()
    
    if (metrics.totalEvents > 0) {
      console.log('Chrome Scroll Performance:', {
        events: metrics.totalEvents,
        avgSpeed: metrics.averageSpeed,
        overscrollEvents: metrics.overscrollEvents,
        performanceScore: metrics.performanceScore
      })

      // Warn about performance issues
      if (metrics.performanceScore < 80) {
        console.warn('Chrome scroll performance issues detected:', {
          overscrollEvents: metrics.overscrollEvents,
          backgroundArtifacts: metrics.backgroundArtifacts,
          score: metrics.performanceScore
        })
      }
    }
  }, 10000) // Every 10 seconds

  // Return cleanup function
  return () => {
    cleanup()
    clearInterval(metricsInterval)
    
    // Export final metrics
    const finalMetrics = chromeScrollLogger.getChromeScrollMetrics()
    console.log('Final Chrome scroll metrics:', finalMetrics)
    
    // Optionally export data for analysis
    if (finalMetrics.totalEvents > 0) {
      const exportData = chromeScrollLogger.exportChromeScrollData()
      console.log('Chrome scroll data export available:', exportData.length, 'characters')
    }
  }
}

/**
 * Example: React component integration
 */
export const ChromeScrollLoggerExample = `
import { useEffect, useRef } from 'react'
import { useChromeScrollLogger } from '../../hooks/useChromeScrollLogger'

export function MainContent() {
  const contentRef = useRef<HTMLDivElement>(null)
  
  const {
    scrollMetrics,
    isLogging,
    isChromeBrowser,
    chromeVersion,
    exportData
  } = useChromeScrollLogger({
    elementRef: contentRef,
    enableDebugOutput: process.env.NODE_ENV === 'development',
    onScrollEvent: (event) => {
      if (event.isOverscrolling) {
        console.warn('Chrome overscroll detected:', event)
      }
    },
    onMetricsUpdate: (metrics) => {
      if (metrics.performanceScore < 80) {
        console.warn('Chrome scroll performance degraded:', metrics)
      }
    }
  })

  useEffect(() => {
    if (isChromeBrowser) {
      console.log('Chrome scroll logging active for:', chromeVersion)
    }
  }, [isChromeBrowser, chromeVersion])

  return (
    <div 
      ref={contentRef}
      className="flex-1 min-h-screen bg-white overflow-auto chrome-scroll-optimized"
      style={{
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        backgroundAttachment: 'local'
      }}
    >
      {/* Your content here */}
      
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black text-white p-2 text-xs rounded">
          Chrome Scroll Debug: {isLogging ? 'Active' : 'Inactive'}
          <br />
          Events: {scrollMetrics.totalEvents}
          <br />
          Score: {scrollMetrics.performanceScore}
        </div>
      )}
    </div>
  )
}
`

/**
 * Example: Global scroll monitoring setup
 */
export function setupGlobalChromeScrollMonitoring() {
  if (!chromeScrollLogger.isChrome()) {
    return
  }

  // Monitor document scroll
  const cleanup = chromeScrollLogger.initializeChromeScrollLogging(document.documentElement)

  // Set up performance monitoring
  let lastWarningTime = 0
  const checkPerformance = () => {
    const metrics = chromeScrollLogger.getChromeScrollMetrics()
    const now = Date.now()
    
    // Warn about issues at most once per minute
    if (metrics.performanceScore < 70 && now - lastWarningTime > 60000) {
      console.warn('Chrome scroll performance issues detected globally:', {
        score: metrics.performanceScore,
        overscrollEvents: metrics.overscrollEvents,
        backgroundArtifacts: metrics.backgroundArtifacts,
        suggestion: 'Check CSS properties: overscroll-behavior, background-attachment, will-change'
      })
      lastWarningTime = now
    }
  }

  const performanceInterval = setInterval(checkPerformance, 5000)

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    cleanup()
    clearInterval(performanceInterval)
    
    // Log final session metrics
    const sessionMetrics = chromeScrollLogger.getChromeScrollMetrics()
    if (sessionMetrics.totalEvents > 0) {
      console.log('Chrome scroll session summary:', sessionMetrics)
    }
  })

  return cleanup
}