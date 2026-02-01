/**
 * Performance monitoring utilities for ORKA-PPM
 * Enhanced with Core Web Vitals tracking and performance budgets
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'

interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  type: 'navigation' | 'resource' | 'custom' | 'web-vital'
  metadata?: Record<string, unknown>
  rating?: 'good' | 'needs-improvement' | 'poor'
}

interface PerformanceBudget {
  metric: string
  budget: number
  warning: number
}

interface CoreWebVitalsThresholds {
  LCP: { good: number; poor: number }
  FID: { good: number; poor: number }
  CLS: { good: number; poor: number }
  FCP: { good: number; poor: number }
  TTFB: { good: number; poor: number }
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private observers: PerformanceObserver[] = []
  private budgets: PerformanceBudget[] = []
  private vitalsInitialized = false

  // Core Web Vitals thresholds (in milliseconds for timing metrics)
  private readonly thresholds: CoreWebVitalsThresholds = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 }
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers()
      this.initializeCoreWebVitals()
      this.setDefaultBudgets()
    }
  }

  private setDefaultBudgets() {
    this.budgets = [
      { metric: 'LCP', budget: 2500, warning: 2000 },
      { metric: 'INP', budget: 200, warning: 100 }, // INP replaces FID
      { metric: 'CLS', budget: 0.1, warning: 0.05 },
      { metric: 'FCP', budget: 1800, warning: 1500 },
      { metric: 'TTFB', budget: 800, warning: 600 },
      { metric: 'bundle_size', budget: 250000, warning: 200000 }, // 250KB
      { metric: 'page_load_time', budget: 3000, warning: 2500 }
    ]
  }

  private initializeCoreWebVitals() {
    if (this.vitalsInitialized) return
    this.vitalsInitialized = true

    // Largest Contentful Paint
    onLCP((metric) => {
      this.recordWebVital('LCP', metric.value, {
        id: metric.id,
        delta: metric.delta,
        entries: metric.entries.length
      })
    })

    // Interaction to Next Paint (replaces FID in web-vitals v3+)
    onINP((metric) => {
      this.recordWebVital('INP', metric.value, {
        id: metric.id,
        delta: metric.delta,
        entries: metric.entries.length
      })
    })

    // Cumulative Layout Shift
    onCLS((metric) => {
      this.recordWebVital('CLS', metric.value, {
        id: metric.id,
        delta: metric.delta,
        entries: metric.entries.length
      })
    })

    // First Contentful Paint
    onFCP((metric) => {
      this.recordWebVital('FCP', metric.value, {
        id: metric.id,
        delta: metric.delta,
        entries: metric.entries.length
      })
    })

    // Time to First Byte
    onTTFB((metric) => {
      this.recordWebVital('TTFB', metric.value, {
        id: metric.id,
        delta: metric.delta,
        entries: metric.entries.length
      })
    })
  }

  private recordWebVital(name: string, value: number, metadata?: Record<string, unknown>) {
    const rating = this.getRating(name, value)
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      type: 'web-vital',
      ...(metadata ? { metadata } : {}),
      rating
    }

    this.metrics.push(metric)
    this.checkBudget(name, value)

    // Send to analytics
    this.sendToAnalytics(metric)
  }

  private getRating(metricName: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = this.thresholds[metricName as keyof CoreWebVitalsThresholds]
    if (!threshold) return 'good'

    if (value <= threshold.good) return 'good'
    if (value <= threshold.poor) return 'needs-improvement'
    return 'poor'
  }

  private checkBudget(metricName: string, value: number) {
    const budget = this.budgets.find(b => b.metric === metricName)
    if (!budget) return

    if (value > budget.budget) {
      this.recordMetric(`budget_exceeded_${metricName}`, value, 'custom', { budget: budget.budget })
    } else if (value > budget.warning) {
      this.recordMetric(`budget_warning_${metricName}`, value, 'custom', { warning: budget.warning })
    }
  }

  private initializeObservers() {
    // Navigation timing
    if ('PerformanceObserver' in window) {
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            this.recordMetric('page_load_time', navEntry.loadEventEnd - navEntry.loadEventStart, 'navigation')
            this.recordMetric('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart, 'navigation')
            this.recordMetric('first_byte', navEntry.responseStart - navEntry.requestStart, 'navigation')
          }
        }
      })

      try {
        navObserver.observe({ entryTypes: ['navigation'] })
        this.observers.push(navObserver)
      } catch (e) {
        console.warn('Navigation timing not supported')
      }

      // Resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming
            this.recordMetric(
              `resource_${resourceEntry.name.split('/').pop()}`,
              resourceEntry.responseEnd - resourceEntry.requestStart,
              'resource',
              { url: resourceEntry.name, type: resourceEntry.initiatorType }
            )
          }
        }
      })

      try {
        resourceObserver.observe({ entryTypes: ['resource'] })
        this.observers.push(resourceObserver)
      } catch (e) {
        console.warn('Resource timing not supported')
      }

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('largest_contentful_paint', entry.startTime, 'navigation')
        }
      })

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.push(lcpObserver)
      } catch (e) {
        console.warn('LCP not supported')
      }

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('first_input_delay', (entry as any).processingStart - entry.startTime, 'navigation')
        }
      })

      try {
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.push(fidObserver)
      } catch (e) {
        console.warn('FID not supported')
      }
    }
  }

  recordMetric(name: string, value: number, type: PerformanceMetric['type'] = 'custom', metadata?: Record<string, unknown>) {
    const rating = type === 'web-vital' ? this.getRating(name, value) : undefined
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      type,
      ...(metadata ? { metadata } : {}),
      ...(rating ? { rating } : {})
    }

    this.metrics.push(metric)

    // Check budget for custom metrics too
    if (type === 'custom') {
      this.checkBudget(name, value)
    }

    // Send to analytics in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToAnalytics(metric)
    }
  }

  private sendToAnalytics(metric: PerformanceMetric) {
    // Send to analytics service (e.g., Google Analytics, Mixpanel)
    if (typeof window !== 'undefined' && 'gtag' in window) {
      // Google Analytics 4 event
      (window as any).gtag('event', 'performance_metric', {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_type: metric.type,
        metric_rating: metric.rating,
        custom_parameters: metric.metadata
      })
    }

    // Store in localStorage for debugging and offline analysis
    try {
      const stored = localStorage.getItem('orka_performance_metrics')
      const metrics = stored ? JSON.parse(stored) : []
      metrics.push(metric)
      
      // Keep only last 100 metrics
      if (metrics.length > 100) {
        metrics.splice(0, metrics.length - 100)
      }
      
      localStorage.setItem('orka_performance_metrics', JSON.stringify(metrics))
    } catch (e) {
      console.warn('Failed to store performance metric')
    }
  }

  // Performance budget management
  setBudget(metric: string, budget: number, warning: number) {
    const existingIndex = this.budgets.findIndex(b => b.metric === metric)
    const newBudget = { metric, budget, warning }
    
    if (existingIndex >= 0) {
      this.budgets[existingIndex] = newBudget
    } else {
      this.budgets.push(newBudget)
    }
  }

  getBudgets(): PerformanceBudget[] {
    return [...this.budgets]
  }

  getBudgetStatus(): { metric: string; current: number; budget: number; status: 'good' | 'warning' | 'exceeded' }[] {
    return this.budgets.map(budget => {
      const recentMetrics = this.metrics
        .filter(m => m.name === budget.metric)
        .slice(-5) // Last 5 measurements
      
      const current = recentMetrics.length > 0 
        ? recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length
        : 0

      let status: 'good' | 'warning' | 'exceeded' = 'good'
      if (current > budget.budget) status = 'exceeded'
      else if (current > budget.warning) status = 'warning'

      return {
        metric: budget.metric,
        current,
        budget: budget.budget,
        status
      }
    })
  }

  // Core Web Vitals specific methods
  getCoreWebVitals(): { [key: string]: PerformanceMetric | undefined } {
    const vitals = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB']
    const result: { [key: string]: PerformanceMetric | undefined } = {}
    
    vitals.forEach(vital => {
      const metrics = this.metrics.filter(m => m.name === vital && m.type === 'web-vital')
      result[vital] = metrics.length > 0 ? metrics[metrics.length - 1] : undefined
    })
    
    return result
  }

  getCoreWebVitalsScore(): number {
    const vitals = this.getCoreWebVitals()
    const scores = Object.values(vitals)
      .filter(Boolean)
      .map(metric => {
        if (!metric) return 0
        switch (metric.rating) {
          case 'good': return 100
          case 'needs-improvement': return 50
          case 'poor': return 0
          default: return 0
        }
      })
    
    return scores.length > 0 ? scores.reduce((sum: number, score) => sum + score, 0) / scores.length : 0
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  getMetricsByType(type: PerformanceMetric['type']): PerformanceMetric[] {
    return this.metrics.filter(m => m.type === type)
  }

  getAverageMetric(name: string): number {
    const metrics = this.metrics.filter(m => m.name === name)
    if (metrics.length === 0) return 0
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
  }

  clearMetrics() {
    this.metrics = []
  }

  disconnect() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Utility functions
export const measureFunction = <T extends (...args: any[]) => any>(
  fn: T,
  name?: string
): T => {
  return ((...args: Parameters<T>) => {
    const start = performance.now()
    const result = fn(...args)
    const end = performance.now()
    
    performanceMonitor.recordMetric(
      name || fn.name || 'anonymous_function',
      end - start,
      'custom'
    )
    
    return result
  }) as T
}

export const measureAsyncFunction = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name?: string
): T => {
  return (async (...args: Parameters<T>) => {
    const start = performance.now()
    const result = await fn(...args)
    const end = performance.now()
    
    performanceMonitor.recordMetric(
      name || fn.name || 'anonymous_async_function',
      end - start,
      'custom'
    )
    
    return result
  }) as T
}

// React hook for performance monitoring
export const usePerformanceMetric = (name: string) => {
  const startTime = performance.now()
  
  return {
    end: () => {
      const endTime = performance.now()
      performanceMonitor.recordMetric(name, endTime - startTime, 'custom')
    }
  }
}

// Web Vitals utilities (enhanced)
export const getCoreWebVitalsReport = async (): Promise<{
  LCP: number
  FID: number
  CLS: number
  FCP: number
  TTFB: number
  score: number
}> => {
  const vitals = performanceMonitor.getCoreWebVitals()
  
  return {
    LCP: vitals.LCP?.value || 0,
    FID: vitals.FID?.value || 0,
    CLS: vitals.CLS?.value || 0,
    FCP: vitals.FCP?.value || 0,
    TTFB: vitals.TTFB?.value || 0,
    score: performanceMonitor.getCoreWebVitalsScore()
  }
}

// Performance budget utilities
export const checkPerformanceBudgets = () => {
  return performanceMonitor.getBudgetStatus()
}

export const setPerformanceBudget = (metric: string, budget: number, warning: number) => {
  performanceMonitor.setBudget(metric, budget, warning)
}

// Code splitting utilities
export const measureChunkLoad = (chunkName: string) => {
  const start = performance.now()
  
  return {
    end: () => {
      const end = performance.now()
      performanceMonitor.recordMetric(`chunk_load_${chunkName}`, end - start, 'resource', {
        chunkName,
        loadType: 'dynamic_import'
      })
    }
  }
}

// Network-aware loading
export const getNetworkInfo = (): {
  effectiveType: string
  downlink: number
  rtt: number
  saveData: boolean
} => {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const connection = (navigator as any).connection
    return {
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      saveData: connection.saveData || false
    }
  }
  
  return {
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false
  }
}

export const shouldLoadHighQuality = (): boolean => {
  const network = getNetworkInfo()
  return network.effectiveType === '4g' && !network.saveData && network.downlink > 1.5
}

// Memory monitoring
export const getMemoryInfo = (): {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
} | null => {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const memory = (performance as any).memory
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    }
  }
  return null
}

export default performanceMonitor