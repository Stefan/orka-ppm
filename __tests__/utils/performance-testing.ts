/**
 * Performance Testing Utilities
 * Provides utilities for measuring and testing performance metrics
 */

import { Page } from '@playwright/test'

export interface PerformanceMetrics {
  // Core Web Vitals
  LCP: number // Largest Contentful Paint
  FID: number // First Input Delay
  CLS: number // Cumulative Layout Shift
  FCP: number // First Contentful Paint
  TTFB: number // Time to First Byte
  
  // Additional metrics
  loadTime: number
  domContentLoaded: number
  resourceCount: number
  totalResourceSize: number
  
  // Memory metrics (if available)
  memoryUsage?: {
    used: number
    total: number
    limit: number
  }
}

export interface PerformanceBudget {
  metric: keyof PerformanceMetrics
  budget: number
  warning: number
}

export interface NetworkCondition {
  name: string
  downloadThroughput: number // bytes per second
  uploadThroughput: number   // bytes per second
  latency: number           // milliseconds
}

/**
 * Performance testing utilities
 */
export class PerformanceTestUtils {
  constructor(private page: Page) {}

  /**
   * Measures comprehensive performance metrics
   */
  async measurePerformance(): Promise<PerformanceMetrics> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paint = performance.getEntriesByType('paint')
      const resources = performance.getEntriesByType('resource')
      
      // Calculate resource sizes
      const totalResourceSize = resources.reduce((total, resource) => {
        return total + (resource.transferSize || 0)
      }, 0)
      
      // Get memory usage if available
      const memoryUsage = (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      } : undefined
      
      return {
        // Core Web Vitals (approximated)
        LCP: 0, // Would need to be measured with web-vitals library
        FID: 0, // Would need to be measured with web-vitals library
        CLS: 0, // Would need to be measured with web-vitals library
        FCP: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        TTFB: navigation.responseStart - navigation.requestStart,
        
        // Navigation timing
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        
        // Resource metrics
        resourceCount: resources.length,
        totalResourceSize,
        
        // Memory
        memoryUsage
      }
    })
  }

  /**
   * Measures Core Web Vitals using web-vitals library
   */
  async measureCoreWebVitals(): Promise<Partial<PerformanceMetrics>> {
    try {
      // Inject web-vitals library
      await this.page.addScriptTag({
        url: 'https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js'
      })

      return await this.page.evaluate(() => {
        return new Promise((resolve) => {
          const metrics: any = {}
          let metricsReceived = 0
          const expectedMetrics = 3 // Only wait for LCP, FCP, TTFB (FID requires interaction, CLS may not fire immediately)
          let resolved = false

          const onMetric = (metric: any) => {
            if (resolved) return
            
            metrics[metric.name] = metric.value
            metricsReceived++
            
            // Resolve early if we have the key metrics
            if (metricsReceived >= expectedMetrics || 
                (metrics.LCP && metrics.FCP && metrics.TTFB)) {
              resolved = true
              resolve(metrics)
            }
          }

          // Measure all Core Web Vitals
          if (typeof (window as any).webVitals !== 'undefined') {
            const { getCLS, getFID, getFCP, getLCP, getTTFB } = (window as any).webVitals
            
            // These are the most reliable metrics
            getFCP(onMetric)
            getLCP(onMetric)
            getTTFB(onMetric)
            
            // These may not fire immediately
            getCLS(onMetric, { reportAllChanges: false })
            getFID(onMetric)
          } else {
            // If web-vitals library didn't load, resolve with empty metrics
            resolved = true
            resolve(metrics)
          }

          // Timeout after 5 seconds instead of 10
          setTimeout(() => {
            if (!resolved) {
              resolved = true
              resolve(metrics)
            }
          }, 5000)
        })
      })
    } catch (error) {
      console.warn('Failed to measure Core Web Vitals:', error)
      // Return empty metrics on error
      return {}
    }
  }

  /**
   * Tests performance under different network conditions
   */
  async testNetworkConditions(conditions: NetworkCondition[]): Promise<Record<string, PerformanceMetrics>> {
    const results: Record<string, PerformanceMetrics> = {}
    const currentUrl = this.page.url() || '/'

    for (const condition of conditions) {
      try {
        // Use Playwright's built-in network emulation instead of route interception
        const cdpSession = await this.page.context().newCDPSession(this.page)
        await cdpSession.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: condition.downloadThroughput,
          uploadThroughput: condition.uploadThroughput,
          latency: condition.latency
        })

        // Navigate to the page (use current URL or default to home)
        // Use a longer timeout for very slow networks
        const timeout = condition.name === '2G' ? 60000 : 30000
        await this.page.goto(currentUrl, { 
          waitUntil: 'domcontentloaded', // Use domcontentloaded instead of networkidle for slow networks
          timeout
        })
        
        // Wait a bit for resources to load
        await this.page.waitForTimeout(1000)
        
        const metrics = await this.measurePerformance()
        results[condition.name] = metrics

        // Disable network throttling
        await cdpSession.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: -1,
          uploadThroughput: -1,
          latency: 0
        })
        
        await cdpSession.detach()
      } catch (error) {
        console.warn(`Failed to test network condition ${condition.name}:`, error)
        // Return default metrics on error
        results[condition.name] = {
          LCP: 0,
          FID: 0,
          CLS: 0,
          FCP: 0,
          TTFB: 0,
          loadTime: 0,
          domContentLoaded: 0,
          resourceCount: 0,
          totalResourceSize: 0
        }
      }
    }

    return results
  }

  /**
   * Measures performance impact of user interactions
   */
  async measureInteractionPerformance(interaction: () => Promise<void>): Promise<{
    beforeMetrics: PerformanceMetrics
    afterMetrics: PerformanceMetrics
    interactionTime: number
  }> {
    const beforeMetrics = await this.measurePerformance()
    
    const startTime = Date.now()
    await interaction()
    const interactionTime = Date.now() - startTime
    
    // Wait for any async operations to complete
    await this.page.waitForTimeout(1000)
    
    const afterMetrics = await this.measurePerformance()

    return {
      beforeMetrics,
      afterMetrics,
      interactionTime
    }
  }

  /**
   * Tests memory leaks by performing repeated actions
   */
  async testMemoryLeaks(action: () => Promise<void>, iterations: number = 10): Promise<{
    initialMemory: number
    finalMemory: number
    memoryGrowth: number
    leakDetected: boolean
  }> {
    // Force garbage collection if available
    await this.page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc()
      }
    })

    const initialMetrics = await this.measurePerformance()
    const initialMemory = initialMetrics.memoryUsage?.used || 0

    // Perform repeated actions
    for (let i = 0; i < iterations; i++) {
      await action()
      
      // Occasional garbage collection
      if (i % 3 === 0) {
        await this.page.evaluate(() => {
          if ((window as any).gc) {
            (window as any).gc()
          }
        })
      }
    }

    // Final measurement
    await this.page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc()
      }
    })

    const finalMetrics = await this.measurePerformance()
    const finalMemory = finalMetrics.memoryUsage?.used || 0
    const memoryGrowth = finalMemory - initialMemory

    // Consider it a leak if memory grew by more than 10MB
    const leakDetected = memoryGrowth > 10 * 1024 * 1024

    return {
      initialMemory,
      finalMemory,
      memoryGrowth,
      leakDetected
    }
  }

  /**
   * Measures rendering performance
   */
  async measureRenderingPerformance(): Promise<{
    frameRate: number
    droppedFrames: number
    renderingTime: number
  }> {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        let frameCount = 0
        let droppedFrames = 0
        const startTime = performance.now()
        const duration = 5000 // 5 seconds

        const measureFrame = () => {
          frameCount++
          
          if (performance.now() - startTime < duration) {
            requestAnimationFrame(measureFrame)
          } else {
            const endTime = performance.now()
            const renderingTime = endTime - startTime
            const expectedFrames = Math.floor(renderingTime / 16.67) // 60 FPS
            const actualFrames = frameCount
            const droppedFrames = Math.max(0, expectedFrames - actualFrames)
            const frameRate = (actualFrames / renderingTime) * 1000

            resolve({
              frameRate,
              droppedFrames,
              renderingTime
            })
          }
        }

        requestAnimationFrame(measureFrame)
      })
    })
  }

  /**
   * Tests performance budgets
   */
  checkPerformanceBudgets(metrics: PerformanceMetrics, budgets: PerformanceBudget[]): {
    metric: string
    value: number
    budget: number
    warning: number
    status: 'good' | 'warning' | 'exceeded'
  }[] {
    return budgets.map(budget => {
      const value = metrics[budget.metric] as number || 0
      
      let status: 'good' | 'warning' | 'exceeded' = 'good'
      if (value > budget.budget) {
        status = 'exceeded'
      } else if (value > budget.warning) {
        status = 'warning'
      }

      return {
        metric: budget.metric,
        value,
        budget: budget.budget,
        warning: budget.warning,
        status
      }
    })
  }

  /**
   * Generates performance report
   */
  generatePerformanceReport(metrics: PerformanceMetrics, budgets: PerformanceBudget[]): {
    score: number
    metrics: PerformanceMetrics
    budgetResults: ReturnType<typeof this.checkPerformanceBudgets>
    recommendations: string[]
  } {
    const budgetResults = this.checkPerformanceBudgets(metrics, budgets)
    
    // Calculate score based on budget compliance
    const totalBudgets = budgetResults.length
    const goodBudgets = budgetResults.filter(r => r.status === 'good').length
    const score = Math.round((goodBudgets / totalBudgets) * 100)

    // Generate recommendations
    const recommendations: string[] = []
    
    budgetResults.forEach(result => {
      if (result.status === 'exceeded') {
        switch (result.metric) {
          case 'LCP':
            recommendations.push('Optimize images and reduce server response time to improve LCP')
            break
          case 'FID':
            recommendations.push('Reduce JavaScript execution time to improve FID')
            break
          case 'CLS':
            recommendations.push('Ensure proper sizing for images and ads to reduce CLS')
            break
          case 'totalResourceSize':
            recommendations.push('Optimize and compress resources to reduce total size')
            break
          case 'resourceCount':
            recommendations.push('Reduce number of HTTP requests by bundling resources')
            break
        }
      }
    })

    return {
      score,
      metrics,
      budgetResults,
      recommendations
    }
  }
}

/**
 * Common network conditions for testing
 */
export const NETWORK_CONDITIONS: NetworkCondition[] = [
  {
    name: 'Fast 3G',
    downloadThroughput: 1600 * 1024 / 8, // 1.6 Mbps
    uploadThroughput: 768 * 1024 / 8,    // 768 Kbps
    latency: 400
  },
  {
    name: 'Slow 3G',
    downloadThroughput: 500 * 1024 / 8,  // 500 Kbps
    uploadThroughput: 500 * 1024 / 8,    // 500 Kbps
    latency: 400
  },
  {
    name: '2G',
    downloadThroughput: 256 * 1024 / 8,  // 256 Kbps
    uploadThroughput: 256 * 1024 / 8,    // 256 Kbps
    latency: 1400
  }
]

/**
 * Default performance budgets
 */
export const DEFAULT_PERFORMANCE_BUDGETS: PerformanceBudget[] = [
  { metric: 'LCP', budget: 2500, warning: 2000 },
  { metric: 'FID', budget: 100, warning: 80 },
  { metric: 'CLS', budget: 0.1, warning: 0.05 },
  { metric: 'FCP', budget: 1800, warning: 1500 },
  { metric: 'TTFB', budget: 800, warning: 600 },
  { metric: 'loadTime', budget: 3000, warning: 2000 },
  { metric: 'resourceCount', budget: 50, warning: 40 },
  { metric: 'totalResourceSize', budget: 2000000, warning: 1500000 } // 2MB budget, 1.5MB warning
]