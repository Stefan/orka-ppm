/**
 * Performance utilities and monitoring
 */

import { performanceMonitor } from './monitoring/performance-utils'

// Core Web Vitals reporting
export async function getCoreWebVitalsReport() {
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
}

// Performance budget checking
export function checkPerformanceBudgets() {
  const budgets = [
    { metric: 'LCP', budget: 2500 },
    { metric: 'FID', budget: 100 },
    { metric: 'CLS', budget: 0.1 },
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
}

// Network information
export function getNetworkInfo() {
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
}

// Memory information
export function getMemoryInfo() {
  return performanceMonitor.getMemoryUsage()
}

// Network-aware loading
export function shouldLoadHighQuality(): boolean {
  const networkInfo = getNetworkInfo()
  
  // Don't load high quality on slow connections or when save data is enabled
  if (networkInfo.saveData || 
      networkInfo.effectiveType === 'slow-2g' || 
      networkInfo.effectiveType === '2g') {
    return false
  }
  
  // Load high quality on fast connections
  return networkInfo.effectiveType === '4g' && networkInfo.downlink > 2
}

// Progressive loading utilities
export function createProgressiveLoader() {
  return {
    loadImage: (src: string, lowQualitySrc?: string) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        
        img.onload = () => resolve(img)
        img.onerror = reject
        
        // Load low quality first if available and on slow connection
        if (lowQualitySrc && !shouldLoadHighQuality()) {
          img.src = lowQualitySrc
        } else {
          img.src = src
        }
      })
    },
    
    loadScript: (src: string) => {
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = src
        script.onload = () => resolve()
        script.onerror = reject
        document.head.appendChild(script)
      })
    },
    
    loadCSS: (href: string) => {
      return new Promise<void>((resolve, reject) => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        link.onload = () => resolve()
        link.onerror = reject
        document.head.appendChild(link)
      })
    }
  }
}

// Re-export from performance monitor
export { performanceMonitor } from './monitoring/performance-utils'
export { markPerformance, measurePerformance } from './monitoring/performance-utils'