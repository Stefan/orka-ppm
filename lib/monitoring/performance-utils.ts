/**
 * Performance utilities for monitoring and optimization
 */

import { logger } from './logger'

interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
}

interface ResourceTiming {
  name: string
  duration: number
  size?: number
  type: string
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private observers: PerformanceObserver[] = []

  constructor() {
    if (typeof window !== 'undefined' && typeof PerformanceObserver !== 'undefined') {
      this.initializeObservers()
    }
  }

  private initializeObservers() {
    // Only initialize if we have the required APIs
    if (typeof PerformanceObserver === 'undefined') {
      return
    }

    // Core Web Vitals Observer
    this.observeCoreWebVitals()
    
    // Resource timing observer
    this.observeResourceTiming()
    
    // Long task observer
    this.observeLongTasks()
  }

  private observeCoreWebVitals() {
    // LCP Observer
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number }
      
      this.recordMetric('LCP', lastEntry.startTime, this.getLCPRating(lastEntry.startTime))
    })

    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
      this.observers.push(lcpObserver)
    } catch (e) {
      logger.warn('LCP observer not supported')
    }

    // FID Observer
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry: any) => {
        this.recordMetric('FID', entry.processingStart - entry.startTime, this.getFIDRating(entry.processingStart - entry.startTime))
      })
    })

    try {
      fidObserver.observe({ entryTypes: ['first-input'] })
      this.observers.push(fidObserver)
    } catch (e) {
      logger.warn('FID observer not supported')
    }

    // CLS Observer
    let clsValue = 0
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
        }
      })
      
      this.recordMetric('CLS', clsValue, this.getCLSRating(clsValue))
    })

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] })
      this.observers.push(clsObserver)
    } catch (e) {
      logger.warn('CLS observer not supported')
    }
  }

  private observeResourceTiming() {
    const resourceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry: any) => {
        const resource: ResourceTiming = {
          name: entry.name,
          duration: entry.duration,
          size: entry.transferSize,
          type: this.getResourceType(entry.name)
        }

        // Log slow resources
        if (resource.duration > 1000) {
          logger.warn('Slow resource detected', resource)
        }
      })
    })

    try {
      resourceObserver.observe({ entryTypes: ['resource'] })
      this.observers.push(resourceObserver)
    } catch (e) {
      logger.warn('Resource timing observer not supported')
    }
  }

  private observeLongTasks() {
    const longTaskObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        logger.warn('Long task detected', {
          duration: entry.duration,
          startTime: entry.startTime,
          name: entry.name
        })
      })
    })

    try {
      longTaskObserver.observe({ entryTypes: ['longtask'] })
      this.observers.push(longTaskObserver)
    } catch (e) {
      logger.warn('Long task observer not supported')
    }
  }

  private recordMetric(name: string, value: number, rating: 'good' | 'needs-improvement' | 'poor') {
    const metric: PerformanceMetric = {
      name,
      value,
      rating,
      timestamp: Date.now()
    }

    this.metrics.push(metric)
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }

    logger.debug(`Performance metric: ${name}`, metric)

    // Alert on poor performance
    if (rating === 'poor') {
      logger.warn(`Poor performance detected: ${name}`, metric)
    }
  }

  private getLCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 2500) return 'good'
    if (value <= 4000) return 'needs-improvement'
    return 'poor'
  }

  private getFIDRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 100) return 'good'
    if (value <= 300) return 'needs-improvement'
    return 'poor'
  }

  private getCLSRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 0.1) return 'good'
    if (value <= 0.25) return 'needs-improvement'
    return 'poor'
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script'
    if (url.includes('.css')) return 'stylesheet'
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image'
    if (url.includes('.woff') || url.includes('.ttf')) return 'font'
    return 'other'
  }

  // Public methods
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.name === name)
  }

  getAverageMetric(name: string): number | null {
    const metrics = this.getMetricsByName(name)
    if (metrics.length === 0) return null
    
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0)
    return sum / metrics.length
  }

  clearMetrics() {
    this.metrics = []
  }

  disconnect() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }

  // Utility methods for manual performance tracking
  mark(name: string) {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name)
    }
  }

  measure(name: string, startMark: string, endMark?: string) {
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        performance.measure(name, startMark, endMark)
        const measure = performance.getEntriesByName(name, 'measure')[0]
        if (measure) {
          logger.debug(`Performance measure: ${name}`, {
            duration: measure.duration,
            startTime: measure.startTime
          })
        }
      } catch (e) {
        logger.warn(`Failed to measure ${name}:`, e)
      }
    }
  }

  // Memory usage monitoring
  getMemoryUsage() {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
      }
    }
    return null
  }

  // Bundle size analysis
  analyzeResourceSizes() {
    if (typeof performance === 'undefined') return null

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const analysis = {
      totalSize: 0,
      scripts: { count: 0, size: 0 },
      stylesheets: { count: 0, size: 0 },
      images: { count: 0, size: 0 },
      fonts: { count: 0, size: 0 },
      other: { count: 0, size: 0 }
    }

    resources.forEach(resource => {
      const size = resource.transferSize || 0
      const type = this.getResourceType(resource.name)
      
      analysis.totalSize += size
      
      switch (type) {
        case 'script':
          analysis.scripts.count++
          analysis.scripts.size += size
          break
        case 'stylesheet':
          analysis.stylesheets.count++
          analysis.stylesheets.size += size
          break
        case 'image':
          analysis.images.count++
          analysis.images.size += size
          break
        case 'font':
          analysis.fonts.count++
          analysis.fonts.size += size
          break
        default:
          analysis.other.count++
          analysis.other.size += size
      }
    })

    return analysis
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Utility functions
export const markPerformance = (name: string) => performanceMonitor.mark(name)
export const measurePerformance = (name: string, startMark: string, endMark?: string) => 
  performanceMonitor.measure(name, startMark, endMark)

export default performanceMonitor