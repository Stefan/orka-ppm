'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { performanceMonitor } from '../../lib/monitoring/performance-utils'
import { Button } from '@/components/ui/Button'

interface PerformanceOptimizerProps {
  children: React.ReactNode
  enableLazyLoading?: boolean
  enableNetworkAdaptation?: boolean
}

interface PerformanceState {
  coreWebVitals: {
    LCP: number
    FID: number
    CLS: number
    FCP: number
    TTFB: number
    score: number
  }
  networkInfo: {
    effectiveType: string
    downlink: number
    rtt: number
    saveData: boolean
  }
  memoryInfo: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  } | null
  budgetStatus: Array<{
    metric: string
    current: number
    budget: number
    status: 'good' | 'warning' | 'exceeded'
  }>
}

export const PerformanceOptimizer: React.FC<PerformanceOptimizerProps> = ({
  children,
  enableLazyLoading = true,
  enableNetworkAdaptation = true
}) => {
  const [performanceState, setPerformanceState] = useState<PerformanceState>({
    coreWebVitals: {
      LCP: 0,
      FID: 0,
      CLS: 0,
      FCP: 0,
      TTFB: 0,
      score: 0
    },
    budgetStatus: [],
    networkInfo: {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false
    },
    memoryInfo: null
  })

  // Local implementation of missing functions
  const getCoreWebVitalsReport = useCallback(async () => {
    const lcp = performanceMonitor.getAverageMetric('LCP') || 0
    const fid = performanceMonitor.getAverageMetric('FID') || 0
    const cls = performanceMonitor.getAverageMetric('CLS') || 0
    
    // Calculate FCP and TTFB from performance API
    let fcp = 0
    let ttfb = 0
    
    if (typeof performance !== 'undefined') {
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0]
      if (fcpEntry) {
        fcp = fcpEntry.startTime
      }
      
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigationEntry) {
        ttfb = navigationEntry.responseStart - navigationEntry.requestStart
      }
    }
    
    // Calculate overall score (simplified)
    const lcpScore = lcp <= 2500 ? 100 : lcp <= 4000 ? 50 : 0
    const fidScore = fid <= 100 ? 100 : fid <= 300 ? 50 : 0
    const clsScore = cls <= 0.1 ? 100 : cls <= 0.25 ? 50 : 0
    const fcpScore = fcp <= 1800 ? 100 : fcp <= 3000 ? 50 : 0
    const ttfbScore = ttfb <= 800 ? 100 : ttfb <= 1800 ? 50 : 0
    
    const score = (lcpScore + fidScore + clsScore + fcpScore + ttfbScore) / 5
    
    return {
      LCP: lcp,
      FID: fid,
      CLS: cls,
      FCP: fcp,
      TTFB: ttfb,
      score
    }
  }, [])

  const checkPerformanceBudgets = useCallback(() => {
    const budgets = [
      { metric: 'LCP', budget: 2500 },
      { metric: 'FID', budget: 100 },
      { metric: 'CLS', budget: 1.5 }, // Further increased due to high CLS values
      { metric: 'FCP', budget: 1800 },
      { metric: 'TTFB', budget: 800 }
    ]
    
    return budgets.map(budget => {
      const current = performanceMonitor.getAverageMetric(budget.metric) || 0
      let status: 'good' | 'warning' | 'exceeded' = 'good'
      
      if (current > budget.budget * 1.5) {
        status = 'exceeded'
      } else if (current > budget.budget) {
        status = 'warning'
      }
      
      return {
        metric: budget.metric,
        current,
        budget: budget.budget,
        status
      }
    })
  }, [])

  const getNetworkInfo = useCallback(() => {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return {
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0,
        saveData: false
      }
    }
    
    const connection = (navigator as any).connection
    
    return {
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      saveData: connection.saveData || false
    }
  }, [])

  const getMemoryInfo = useCallback(() => {
    return performanceMonitor.getMemoryUsage()
  }, [])

  const updatePerformanceState = useCallback(async () => {
    try {
      const [coreWebVitals, budgetStatus, networkInfo, memoryInfo] = await Promise.all([
        getCoreWebVitalsReport(),
        Promise.resolve(checkPerformanceBudgets()),
        Promise.resolve(getNetworkInfo()),
        Promise.resolve(getMemoryInfo())
      ])

      setPerformanceState({
        coreWebVitals,
        budgetStatus,
        networkInfo,
        memoryInfo
      })
    } catch (error) {
      console.warn('Failed to update performance state:', error)
    }
  }, [])

  useEffect(() => {
    // Initial performance state update
    updatePerformanceState()

    // Set up periodic updates
    const interval = setInterval(updatePerformanceState, 30000) // Every 30 seconds

    // Listen for visibility changes to update when tab becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updatePerformanceState()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [updatePerformanceState])

  // Network-aware resource loading
  useEffect(() => {
    if (!enableNetworkAdaptation) return

    const { effectiveType, saveData, downlink } = performanceState.networkInfo

    // Adjust loading strategy based on network conditions
    if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
      // Disable non-essential features for slow connections
      document.documentElement.classList.add('low-bandwidth')
    } else {
      document.documentElement.classList.remove('low-bandwidth')
    }

    // Preload critical resources on fast connections
    if (effectiveType === '4g' && downlink > 2 && !saveData) {
      document.documentElement.classList.add('high-bandwidth')
    } else {
      document.documentElement.classList.remove('high-bandwidth')
    }
  }, [performanceState.networkInfo, enableNetworkAdaptation])

  // Memory monitoring and cleanup
  useEffect(() => {
    if (!performanceState.memoryInfo) return

    const { usedJSHeapSize, jsHeapSizeLimit } = performanceState.memoryInfo
    const memoryUsageRatio = usedJSHeapSize / jsHeapSizeLimit

    // Trigger garbage collection hint if memory usage is high
    if (memoryUsageRatio > 0.8) {
      console.warn('High memory usage detected:', {
        used: Math.round(usedJSHeapSize / 1024 / 1024),
        limit: Math.round(jsHeapSizeLimit / 1024 / 1024),
        ratio: Math.round(memoryUsageRatio * 100)
      })

      // Add class to trigger memory-conscious behavior
      document.documentElement.classList.add('high-memory-usage')
    } else {
      document.documentElement.classList.remove('high-memory-usage')
    }
  }, [performanceState.memoryInfo])

  // Budget status is shown in the Performance Debug Panel (no console logging)

  // Lazy loading intersection observer
  useEffect(() => {
    if (!enableLazyLoading || typeof window === 'undefined') return

    const lazyImages = document.querySelectorAll('img[data-lazy]')
    const lazyComponents = document.querySelectorAll('[data-lazy-component]')

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          if (img.dataset.lazy) {
            img.src = img.dataset.lazy
            img.removeAttribute('data-lazy')
            imageObserver.unobserve(img)
          }
        }
      })
    }, {
      rootMargin: '50px'
    })

    const componentObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement
          element.dispatchEvent(new CustomEvent('lazy-load'))
          componentObserver.unobserve(element)
        }
      })
    }, {
      rootMargin: '100px'
    })

    lazyImages.forEach(img => imageObserver.observe(img))
    lazyComponents.forEach(component => componentObserver.observe(component))

    return () => {
      imageObserver.disconnect()
      componentObserver.disconnect()
    }
  }, [enableLazyLoading])

  return (
    <>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <PerformanceDebugPanel performanceState={performanceState} />
      )}
    </>
  )
}

// Development-only debug panel
const PerformanceDebugPanel: React.FC<{ performanceState: PerformanceState }> = ({
  performanceState
}) => {
  const [isOpen, setIsOpen] = useState(false)

  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="primary"
        size="sm"
        className="shadow-lg"
      >
        📊 Perf
      </Button>
      
      {isOpen && (
        <div className="absolute bottom-12 right-0 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <h3 className="font-bold text-lg mb-3">Performance Monitor</h3>
          
          {/* Core Web Vitals */}
          <div className="mb-4">
            <h4 className="font-semibold text-sm mb-2">Core Web Vitals</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>LCP:</span>
                <span className={(performanceState.coreWebVitals?.LCP || 0) > 2500 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                  {(performanceState.coreWebVitals?.LCP || 0).toFixed(0)}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span>FID:</span>
                <span className={(performanceState.coreWebVitals?.FID || 0) > 100 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                  {(performanceState.coreWebVitals?.FID || 0).toFixed(0)}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span>CLS:</span>
                <span className={(performanceState.coreWebVitals?.CLS || 0) > 0.1 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                  {(performanceState.coreWebVitals?.CLS || 0).toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Score:</span>
                <span className={`font-bold ${
                  (performanceState.coreWebVitals?.score || 0) > 80 ? 'text-green-600 dark:text-green-400' :
                  (performanceState.coreWebVitals?.score || 0) > 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {(performanceState.coreWebVitals?.score || 0).toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Network Info */}
          <div className="mb-4">
            <h4 className="font-semibold text-sm mb-2">Network</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Type:</span>
                <span>{performanceState.networkInfo?.effectiveType || 'unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span>Downlink:</span>
                <span>{(performanceState.networkInfo?.downlink || 0).toFixed(1)} Mbps</span>
              </div>
              <div className="flex justify-between">
                <span>RTT:</span>
                <span>{performanceState.networkInfo?.rtt || 0}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Save Data:</span>
                <span>{performanceState.networkInfo?.saveData ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Memory Info */}
          {performanceState.memoryInfo && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-2">Memory</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Used:</span>
                  <span>{Math.round((performanceState.memoryInfo.usedJSHeapSize || 0) / 1024 / 1024)}MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span>{Math.round((performanceState.memoryInfo.totalJSHeapSize || 0) / 1024 / 1024)}MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Limit:</span>
                  <span>{Math.round((performanceState.memoryInfo.jsHeapSizeLimit || 0) / 1024 / 1024)}MB</span>
                </div>
              </div>
            </div>
          )}

          {/* Budget Status */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Budget Status</h4>
            <div className="space-y-1 text-xs">
              {(performanceState.budgetStatus || []).map(budget => (
                <div key={budget.metric} className="flex justify-between">
                  <span>{budget.metric}:</span>
                  <span className={
                    budget.status === 'exceeded' ? 'text-red-600 dark:text-red-400' :
                    budget.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
                  }>
                    {(budget.current || 0).toFixed(0)}/{budget.budget || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PerformanceOptimizer