/**
 * Scroll Performance Utilities
 * Implements Requirements 6.1, 1.3, 1.4 for smooth scroll behavior and performance
 */

import { performanceMonitor } from '../monitoring/performance-utils'

export interface ScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  scrollPercentage: number
  isAtTop: boolean
  isAtBottom: boolean
  scrollDirection: 'up' | 'down' | 'none'
  scrollSpeed: number
  timestamp: number
}

export interface ScrollPerformanceConfig {
  throttleMs: number
  enableMetrics: boolean
  enableOptimizations: boolean
  debugMode: boolean
}

class ScrollPerformanceManager {
  private scrollMetrics: ScrollMetrics[] = []
  private lastScrollTop = 0
  private lastScrollTime = 0
  private rafId: number | null = null
  private config: ScrollPerformanceConfig

  constructor(config: Partial<ScrollPerformanceConfig> = {}) {
    this.config = {
      throttleMs: 16, // 60fps
      enableMetrics: true,
      enableOptimizations: true,
      debugMode: false,
      ...config
    }
  }

  /**
   * Initialize scroll performance monitoring for an element
   */
  initializeScrollMonitoring(element: HTMLElement): () => void {
    let isScrolling = false
    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true
        this.onScrollStart(element)
      }

      // Clear existing timeout
      clearTimeout(scrollTimeout)

      // Throttled scroll handling
      if (this.rafId) {
        cancelAnimationFrame(this.rafId)
      }

      this.rafId = requestAnimationFrame(() => {
        this.handleScrollEvent(element)
      })

      // Set timeout to detect scroll end
      scrollTimeout = setTimeout(() => {
        isScrolling = false
        this.onScrollEnd(element)
      }, 150)
    }

    // Add scroll listener
    element.addEventListener('scroll', handleScroll, { passive: true })

    // Apply scroll optimizations
    if (this.config.enableOptimizations) {
      this.applyScrollOptimizations(element)
    }

    // Return cleanup function
    return () => {
      element.removeEventListener('scroll', handleScroll)
      if (this.rafId) {
        cancelAnimationFrame(this.rafId)
      }
      clearTimeout(scrollTimeout)
    }
  }

  /**
   * Handle individual scroll events
   */
  private handleScrollEvent(element: HTMLElement) {
    const now = performance.now()
    const scrollTop = element.scrollTop
    const scrollHeight = element.scrollHeight
    const clientHeight = element.clientHeight

    // Calculate scroll metrics
    const scrollPercentage = scrollHeight > clientHeight 
      ? (scrollTop / (scrollHeight - clientHeight)) * 100 
      : 0

    const isAtTop = scrollTop <= 5
    const isAtBottom = scrollTop >= (scrollHeight - clientHeight - 5)

    // Calculate scroll direction and speed
    const scrollDelta = scrollTop - this.lastScrollTop
    const timeDelta = now - this.lastScrollTime

    let scrollDirection: 'up' | 'down' | 'none' = 'none'
    if (Math.abs(scrollDelta) > 1) {
      scrollDirection = scrollDelta > 0 ? 'down' : 'up'
    }

    const scrollSpeed = timeDelta > 0 ? Math.abs(scrollDelta) / timeDelta : 0

    const metrics: ScrollMetrics = {
      scrollTop,
      scrollHeight,
      clientHeight,
      scrollPercentage,
      isAtTop,
      isAtBottom,
      scrollDirection,
      scrollSpeed,
      timestamp: now
    }

    // Store metrics
    if (this.config.enableMetrics) {
      this.recordScrollMetrics(metrics)
    }

    // Update tracking variables
    this.lastScrollTop = scrollTop
    this.lastScrollTime = now

    // Debug logging
    if (this.config.debugMode) {
      console.log('Scroll metrics:', metrics)
    }

    // Performance monitoring
    if (scrollSpeed > 10) { // Fast scrolling detected
      performanceMonitor.mark('fast-scroll-start')
    }
  }

  /**
   * Handle scroll start event
   */
  private onScrollStart(element: HTMLElement) {
    performanceMonitor.mark('scroll-start')
    
    if (this.config.debugMode) {
      console.log('Scroll started')
    }

    // Apply scroll-specific optimizations
    element.style.willChange = 'scroll-position'
    
    // Disable non-essential animations during scroll
    document.documentElement.classList.add('scrolling')
  }

  /**
   * Handle scroll end event
   */
  private onScrollEnd(element: HTMLElement) {
    performanceMonitor.mark('scroll-end')
    performanceMonitor.measure('scroll-duration', 'scroll-start', 'scroll-end')
    
    if (this.config.debugMode) {
      console.log('Scroll ended')
    }

    // Remove scroll optimizations
    element.style.willChange = 'auto'
    
    // Re-enable animations
    document.documentElement.classList.remove('scrolling')

    // Log scroll performance metrics
    this.logScrollPerformance()
  }

  /**
   * Apply scroll performance optimizations to element
   */
  private applyScrollOptimizations(element: HTMLElement) {
    // Hardware acceleration
    element.style.transform = 'translateZ(0)'
    
    // Optimize scroll behavior
    element.style.scrollBehavior = 'smooth'
    element.style.overscrollBehavior = 'contain'
    
    // iOS momentum scrolling
    ;(element.style as any).webkitOverflowScrolling = 'touch'
    
    // Prevent horizontal scroll
    element.style.overflowX = 'hidden'
    
    // Optimize for frequent repaints
    element.style.contain = 'layout style paint'
    
    // Add CSS classes for additional optimizations
    element.classList.add('scrollable-container', 'scroll-boundary-fix')
  }

  /**
   * Record scroll metrics for analysis
   */
  private recordScrollMetrics(metrics: ScrollMetrics) {
    this.scrollMetrics.push(metrics)
    
    // Keep only last 100 metrics
    if (this.scrollMetrics.length > 100) {
      this.scrollMetrics = this.scrollMetrics.slice(-100)
    }

    // Log performance metric
    if (metrics.scrollSpeed > 5 && this.config.debugMode) {
      console.log('Fast scroll detected:', metrics.scrollSpeed)
    }
  }

  /**
   * Log scroll performance summary
   */
  private logScrollPerformance() {
    if (this.scrollMetrics.length === 0) return

    const recentMetrics = this.scrollMetrics.slice(-10)
    const avgSpeed = recentMetrics.reduce((sum, m) => sum + m.scrollSpeed, 0) / recentMetrics.length
    const maxSpeed = Math.max(...recentMetrics.map(m => m.scrollSpeed))

    if (this.config.debugMode) {
      console.log('Scroll performance summary:', { avgSpeed, maxSpeed })
    }

    if (this.config.debugMode) {
      console.log('Scroll performance summary:', {
        avgSpeed: avgSpeed.toFixed(2),
        maxSpeed: maxSpeed.toFixed(2),
        totalEvents: this.scrollMetrics.length
      })
    }
  }

  /**
   * Get current scroll metrics
   */
  getScrollMetrics(): ScrollMetrics[] {
    return [...this.scrollMetrics]
  }

  /**
   * Get scroll performance summary
   */
  getPerformanceSummary() {
    if (this.scrollMetrics.length === 0) {
      return {
        avgSpeed: 0,
        maxSpeed: 0,
        totalEvents: 0,
        smoothnessScore: 100
      }
    }

    const avgSpeed = this.scrollMetrics.reduce((sum, m) => sum + m.scrollSpeed, 0) / this.scrollMetrics.length
    const maxSpeed = Math.max(...this.scrollMetrics.map(m => m.scrollSpeed))
    
    // Calculate smoothness score (0-100, higher is better)
    const speedVariance = this.calculateSpeedVariance()
    const smoothnessScore = Math.max(0, 100 - (speedVariance * 10))

    return {
      avgSpeed: Number(avgSpeed.toFixed(2)),
      maxSpeed: Number(maxSpeed.toFixed(2)),
      totalEvents: this.scrollMetrics.length,
      smoothnessScore: Number(smoothnessScore.toFixed(1))
    }
  }

  /**
   * Calculate scroll speed variance for smoothness assessment
   */
  private calculateSpeedVariance(): number {
    if (this.scrollMetrics.length < 2) return 0

    const speeds = this.scrollMetrics.map(m => m.scrollSpeed)
    const avgSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
    const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - avgSpeed, 2), 0) / speeds.length
    
    return Math.sqrt(variance)
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.scrollMetrics = []
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ScrollPerformanceConfig>) {
    this.config = { ...this.config, ...newConfig }
  }
}

// Utility functions for scroll behavior
export const scrollToTop = (element: HTMLElement, smooth = true) => {
  element.scrollTo({
    top: 0,
    behavior: smooth ? 'smooth' : 'auto'
  })
}

export const scrollToBottom = (element: HTMLElement, smooth = true) => {
  element.scrollTo({
    top: element.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  })
}

export const scrollToElement = (
  container: HTMLElement, 
  targetElement: HTMLElement, 
  offset = 0, 
  smooth = true
) => {
  const containerRect = container.getBoundingClientRect()
  const targetRect = targetElement.getBoundingClientRect()
  const scrollTop = container.scrollTop + targetRect.top - containerRect.top - offset

  container.scrollTo({
    top: scrollTop,
    behavior: smooth ? 'smooth' : 'auto'
  })
}

export const isElementInView = (container: HTMLElement, element: HTMLElement): boolean => {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()

  return (
    elementRect.top >= containerRect.top &&
    elementRect.bottom <= containerRect.bottom
  )
}

// Export singleton instance
export const scrollPerformanceManager = new ScrollPerformanceManager()

// Export class for custom instances
export { ScrollPerformanceManager }