/**
 * React hook for scroll performance monitoring and optimization
 * Implements Requirements 6.1, 1.3, 1.4
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { 
  scrollPerformanceManager, 
  ScrollPerformanceManager, 
  ScrollMetrics,
  ScrollPerformanceConfig 
} from '../lib/utils/scroll-performance'

export interface UseScrollPerformanceOptions extends Partial<ScrollPerformanceConfig> {
  elementRef?: React.RefObject<HTMLElement | null>
  onScrollStart?: () => void
  onScrollEnd?: () => void
  onScrollMetrics?: (metrics: ScrollMetrics) => void
}

export interface ScrollPerformanceHookReturn {
  scrollMetrics: ScrollMetrics[]
  performanceSummary: {
    avgSpeed: number
    maxSpeed: number
    totalEvents: number
    smoothnessScore: number
  }
  isScrolling: boolean
  scrollToTop: () => void
  scrollToBottom: () => void
  scrollToElement: (element: HTMLElement, offset?: number) => void
  clearMetrics: () => void
}

/**
 * Hook for monitoring and optimizing scroll performance
 */
export function useScrollPerformance(
  options: UseScrollPerformanceOptions = {}
): ScrollPerformanceHookReturn {
  const {
    elementRef,
    onScrollStart,
    onScrollEnd,
    onScrollMetrics,
    ...config
  } = options

  const [scrollMetrics, setScrollMetrics] = useState<ScrollMetrics[]>([])
  const [isScrolling, setIsScrolling] = useState(false)
  const managerRef = useRef<ScrollPerformanceManager | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize scroll performance manager
  useEffect(() => {
    managerRef.current = new ScrollPerformanceManager(config)
  }, [])

  // Setup scroll monitoring when element is available
  useEffect(() => {
    const element = elementRef?.current
    if (!element || !managerRef.current) return

    // Custom scroll handler with callbacks
    let scrolling = false
    
    const handleScroll = () => {
      if (!scrolling) {
        scrolling = true
        setIsScrolling(true)
        onScrollStart?.()
      }

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      // Update metrics
      const metrics = managerRef.current!.getScrollMetrics()
      setScrollMetrics([...metrics])
      
      if (metrics.length > 0) {
        const lastMetric = metrics[metrics.length - 1]
        if (lastMetric) {
          onScrollMetrics?.(lastMetric)
        }
      }

      // Set timeout to detect scroll end
      scrollTimeoutRef.current = setTimeout(() => {
        scrolling = false
        setIsScrolling(false)
        onScrollEnd?.()
      }, 150)
    }

    // Initialize monitoring
    const cleanup = managerRef.current.initializeScrollMonitoring(element)
    
    // Add our custom handler
    element.addEventListener('scroll', handleScroll, { passive: true })
    
    cleanupRef.current = () => {
      cleanup()
      element.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }

    return cleanupRef.current
  }, [elementRef?.current, onScrollStart, onScrollEnd, onScrollMetrics])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  // Scroll utility functions
  const scrollToTop = useCallback(() => {
    const element = elementRef?.current
    if (element) {
      if (typeof element.scrollTo === 'function') {
        element.scrollTo({
          top: 0,
          behavior: 'smooth'
        })
      } else {
        // Fallback for environments without scrollTo support (like JSDOM)
        element.scrollTop = 0
      }
    }
  }, [elementRef])

  const scrollToBottom = useCallback(() => {
    const element = elementRef?.current
    if (element) {
      if (typeof element.scrollTo === 'function') {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: 'smooth'
        })
      } else {
        // Fallback for environments without scrollTo support (like JSDOM)
        element.scrollTop = element.scrollHeight
      }
    }
  }, [elementRef])

  const scrollToElement = useCallback((targetElement: HTMLElement, offset = 0) => {
    const container = elementRef?.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const targetRect = targetElement.getBoundingClientRect()
    const scrollTop = container.scrollTop + targetRect.top - containerRect.top - offset

    if (typeof container.scrollTo === 'function') {
      container.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      })
    } else {
      // Fallback for environments without scrollTo support (like JSDOM)
      container.scrollTop = scrollTop
    }
  }, [elementRef])

  const clearMetrics = useCallback(() => {
    managerRef.current?.clearMetrics()
    setScrollMetrics([])
  }, [])

  // Get performance summary
  const performanceSummary = managerRef.current?.getPerformanceSummary() || {
    avgSpeed: 0,
    maxSpeed: 0,
    totalEvents: 0,
    smoothnessScore: 100
  }

  return {
    scrollMetrics,
    performanceSummary,
    isScrolling,
    scrollToTop,
    scrollToBottom,
    scrollToElement,
    clearMetrics
  }
}

/**
 * Hook for global scroll performance monitoring
 */
export function useGlobalScrollPerformance() {
  const [metrics, setMetrics] = useState<ScrollMetrics[]>([])
  const [performanceSummary, setPerformanceSummary] = useState({
    avgSpeed: 0,
    maxSpeed: 0,
    totalEvents: 0,
    smoothnessScore: 100
  })

  useEffect(() => {
    const updateMetrics = () => {
      const currentMetrics = scrollPerformanceManager.getScrollMetrics()
      const summary = scrollPerformanceManager.getPerformanceSummary()
      
      setMetrics([...currentMetrics])
      setPerformanceSummary(summary)
    }

    // Update metrics periodically
    const interval = setInterval(updateMetrics, 1000)
    
    // Initial update
    updateMetrics()

    return () => clearInterval(interval)
  }, [])

  return {
    metrics,
    performanceSummary,
    clearMetrics: () => {
      scrollPerformanceManager.clearMetrics()
      setMetrics([])
      setPerformanceSummary({
        avgSpeed: 0,
        maxSpeed: 0,
        totalEvents: 0,
        smoothnessScore: 100
      })
    }
  }
}

/**
 * Hook for scroll-based lazy loading
 */
export function useScrollLazyLoading<T extends HTMLElement>(
  threshold = 100,
  onEnterView?: () => void
) {
  const elementRef = useRef<T>(null)
  const [isInView, setIsInView] = useState(false)
  const [hasBeenInView, setHasBeenInView] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const inView = entry.isIntersecting
          setIsInView(inView)
          
          if (inView && !hasBeenInView) {
            setHasBeenInView(true)
            onEnterView?.()
          }
        })
      },
      {
        rootMargin: `${threshold}px`,
        threshold: 0.1
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [threshold, onEnterView, hasBeenInView])

  return {
    elementRef,
    isInView,
    hasBeenInView
  }
}

/**
 * Hook for scroll position tracking
 */
export function useScrollPosition(elementRef?: React.RefObject<HTMLElement>) {
  const [scrollPosition, setScrollPosition] = useState({
    x: 0,
    y: 0,
    percentage: 0,
    isAtTop: true,
    isAtBottom: false
  })

  useEffect(() => {
    const element = elementRef?.current || window

    const handleScroll = () => {
      let scrollTop: number
      let scrollLeft: number
      let scrollHeight: number
      let clientHeight: number

      if (element === window) {
        scrollTop = window.pageYOffset || document.documentElement.scrollTop
        scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
        scrollHeight = document.documentElement.scrollHeight
        clientHeight = window.innerHeight
      } else {
        const el = element as HTMLElement
        scrollTop = el.scrollTop
        scrollLeft = el.scrollLeft
        scrollHeight = el.scrollHeight
        clientHeight = el.clientHeight
      }

      const percentage = scrollHeight > clientHeight 
        ? (scrollTop / (scrollHeight - clientHeight)) * 100 
        : 0

      setScrollPosition({
        x: scrollLeft,
        y: scrollTop,
        percentage,
        isAtTop: scrollTop <= 5,
        isAtBottom: scrollTop >= (scrollHeight - clientHeight - 5)
      })
    }

    const target = element === window ? window : element as HTMLElement
    target.addEventListener('scroll', handleScroll, { passive: true })
    
    // Initial position
    handleScroll()

    return () => {
      target.removeEventListener('scroll', handleScroll)
    }
  }, [elementRef])

  return scrollPosition
}