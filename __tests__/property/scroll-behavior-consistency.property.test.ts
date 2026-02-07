/**
 * Property-Based Tests for Scroll Behavior Consistency
 * Feature: dashboard-layout-fix, Property 6: Scroll Behavior Consistency
 * Validates: Requirements 1.3, 1.4, 6.1
 */

import fc from 'fast-check'
import { 
  ScrollPerformanceManager, 
  scrollToTop, 
  scrollToBottom, 
  scrollToElement,
  isElementInView,
  scrollPerformanceManager 
} from '../../lib/utils/scroll-performance'

// Mock performance API for testing
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => [])
}

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
})

Object.defineProperty(global, 'requestAnimationFrame', {
  value: jest.fn((cb) => setTimeout(cb, 16)),
  writable: true
})

Object.defineProperty(global, 'cancelAnimationFrame', {
  value: jest.fn(),
  writable: true
})

// Mock performance monitor
jest.mock('../../lib/monitoring/performance-utils', () => ({
  performanceMonitor: {
    mark: jest.fn(),
    measure: jest.fn(),
    recordMetric: jest.fn()
  }
}))

describe('Scroll Behavior Consistency Property Tests', () => {
  let mockElement: HTMLElement
  let manager: ScrollPerformanceManager

  beforeEach(() => {
    jest.clearAllMocks()
    
    manager = new ScrollPerformanceManager({
      enableMetrics: true,
      enableOptimizations: true,
      debugMode: false
    })

    // Create comprehensive mock element
    mockElement = {
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 500,
      style: {} as CSSStyleDeclaration,
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(() => false)
      } as any,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      scrollTo: jest.fn(),
      getBoundingClientRect: jest.fn(() => ({
        top: 0,
        bottom: 500,
        left: 0,
        right: 300,
        width: 300,
        height: 500
      }))
    } as any

    // Mock document for scroll optimizations
    Object.defineProperty(document, 'documentElement', {
      value: {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      },
      writable: true
    })
  })

  afterEach(() => {
    manager.clearMetrics()
  })

  /**
   * Property 6: Scroll Behavior Consistency
   * For any content that exceeds viewport height, scrolling should be smooth and maintain 
   * white background without showing parent container backgrounds
   */
  describe('Property 6: Scroll Behavior Consistency', () => {
    test('scroll performance optimizations should be applied consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            scrollHeight: fc.integer({ min: 500, max: 10000 }),
            clientHeight: fc.integer({ min: 200, max: 800 }),
            enableOptimizations: fc.boolean(),
            enableMetrics: fc.boolean()
          }),
          async (config) => {
            // Set up element dimensions
            mockElement.scrollHeight = config.scrollHeight
            mockElement.clientHeight = config.clientHeight

            // Create manager with test configuration
            const testManager = new ScrollPerformanceManager({
              enableOptimizations: config.enableOptimizations,
              enableMetrics: config.enableMetrics
            })

            // Initialize scroll monitoring
            const cleanup = testManager.initializeScrollMonitoring(mockElement)

            // Property: Scroll listener should always be attached
            expect(mockElement.addEventListener).toHaveBeenCalledWith(
              'scroll',
              expect.any(Function),
              { passive: true }
            )

            // Property: When optimizations are enabled, CSS optimizations should be applied
            if (config.enableOptimizations) {
              expect(mockElement.style.transform).toBe('translateZ(0)')
              expect(mockElement.style.scrollBehavior).toBe('smooth')
              expect(mockElement.style.overscrollBehavior).toBe('contain')
              expect(mockElement.style.webkitOverflowScrolling).toBe('touch')
              expect(mockElement.style.overflowX).toBe('hidden')
              expect(mockElement.style.contain).toBe('layout style paint')
              expect(mockElement.classList.add).toHaveBeenCalledWith('scrollable-container', 'scroll-boundary-fix')
            }

            // Property: Cleanup function should be provided
            expect(typeof cleanup).toBe('function')

            // Test cleanup
            cleanup()
            expect(mockElement.removeEventListener).toHaveBeenCalledWith(
              'scroll',
              expect.any(Function)
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    test('scroll metrics should be calculated consistently across different content sizes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            scrollHeight: fc.integer({ min: 500, max: 5000 }),
            clientHeight: fc.integer({ min: 200, max: 800 }),
            scrollPositions: fc.array(fc.integer({ min: 0, max: 4500 }), { minLength: 1, maxLength: 10 })
          }),
          async (testData) => {
            // Ensure scroll positions are valid for the content
            const maxScrollTop = Math.max(0, testData.scrollHeight - testData.clientHeight)
            const validScrollPositions = testData.scrollPositions.map(pos => 
              Math.min(pos, maxScrollTop)
            )

            mockElement.scrollHeight = testData.scrollHeight
            mockElement.clientHeight = testData.clientHeight

            const testManager = new ScrollPerformanceManager({
              enableMetrics: true,
              enableOptimizations: true
            })

            // Capture the scroll handler when addEventListener is called
            let scrollHandler: ((event: Event) => void) | null = null
            mockElement.addEventListener = jest.fn((event, handler) => {
              if (event === 'scroll') {
                scrollHandler = handler as (event: Event) => void
              }
            })

            testManager.initializeScrollMonitoring(mockElement)

            // Simulate scroll events at different positions
            for (const scrollTop of validScrollPositions) {
              mockElement.scrollTop = scrollTop

              // Call the scroll handler directly if it was registered
              if (scrollHandler) {
                scrollHandler(new Event('scroll'))
              }

              // Allow RAF to process
              await new Promise(resolve => setTimeout(resolve, 20))
            }

            const metrics = testManager.getScrollMetrics()
            const summary = testManager.getPerformanceSummary()

            // Property: Metrics should be recorded for each scroll event
            if (validScrollPositions.length > 0) {
              expect(metrics.length).toBeGreaterThan(0)
            }

            // Property: Scroll percentage should be calculated correctly
            metrics.forEach(metric => {
              expect(metric.scrollPercentage).toBeGreaterThanOrEqual(0)
              expect(metric.scrollPercentage).toBeLessThanOrEqual(100)

              // Property: Boundary detection should be accurate
              if (metric.scrollTop <= 5) {
                expect(metric.isAtTop).toBe(true)
              }
              if (metric.scrollTop >= maxScrollTop - 5) {
                expect(metric.isAtBottom).toBe(true)
              }

              // Property: Scroll metrics should have valid timestamps
              expect(metric.timestamp).toBeGreaterThan(0)
              expect(metric.scrollHeight).toBe(testData.scrollHeight)
              expect(metric.clientHeight).toBe(testData.clientHeight)
            })

            // Property: Performance summary should be within valid ranges
            expect(summary.avgSpeed).toBeGreaterThanOrEqual(0)
            expect(summary.maxSpeed).toBeGreaterThanOrEqual(0)
            expect(summary.smoothnessScore).toBeGreaterThanOrEqual(0)
            expect(summary.smoothnessScore).toBeLessThanOrEqual(100)
            expect(summary.totalEvents).toBe(metrics.length)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('scroll utility functions should behave consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            scrollHeight: fc.integer({ min: 500, max: 3000 }),
            clientHeight: fc.integer({ min: 200, max: 600 }),
            smooth: fc.boolean()
          }),
          async (config) => {
            mockElement.scrollHeight = config.scrollHeight
            mockElement.clientHeight = config.clientHeight

            // Property: scrollToTop should always scroll to position 0
            scrollToTop(mockElement, config.smooth)
            expect(mockElement.scrollTo).toHaveBeenCalledWith({
              top: 0,
              behavior: config.smooth ? 'smooth' : 'auto'
            })

            // Reset mock
            jest.clearAllMocks()

            // Property: scrollToBottom should scroll to maximum scroll position
            scrollToBottom(mockElement, config.smooth)
            expect(mockElement.scrollTo).toHaveBeenCalledWith({
              top: config.scrollHeight,
              behavior: config.smooth ? 'smooth' : 'auto'
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    test('element visibility detection should be accurate', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            containerTop: fc.integer({ min: 0, max: 100 }),
            containerBottom: fc.integer({ min: 400, max: 600 }),
            elementTop: fc.integer({ min: -100, max: 700 }),
            elementBottom: fc.integer({ min: 0, max: 800 })
          }),
          async (bounds) => {
            // Ensure element bottom is after element top
            const elementTop = bounds.elementTop
            const elementBottom = Math.max(bounds.elementBottom, elementTop + 10)

            const container = {
              getBoundingClientRect: () => ({
                top: bounds.containerTop,
                bottom: bounds.containerBottom,
                left: 0,
                right: 300,
                width: 300,
                height: bounds.containerBottom - bounds.containerTop
              })
            } as HTMLElement

            const element = {
              getBoundingClientRect: () => ({
                top: elementTop,
                bottom: elementBottom,
                left: 0,
                right: 300,
                width: 300,
                height: elementBottom - elementTop
              })
            } as HTMLElement

            const isVisible = isElementInView(container, element)

            // Property: Element should be visible if it's completely within container bounds
            const expectedVisible = (
              elementTop >= bounds.containerTop && 
              elementBottom <= bounds.containerBottom
            )

            expect(isVisible).toBe(expectedVisible)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('scroll direction detection should be consistent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.integer({ min: 0, max: 2000 }), 
            { minLength: 2, maxLength: 10 }
          ),
          async (scrollPositions) => {
            mockElement.scrollHeight = 3000
            mockElement.clientHeight = 500

            const testManager = new ScrollPerformanceManager({
              enableMetrics: true,
              throttleMs: 0 // No throttling for testing
            })

            // Capture the scroll handler when addEventListener is called
            let scrollHandler: ((event: Event) => void) | null = null
            mockElement.addEventListener = jest.fn((event, handler) => {
              if (event === 'scroll') {
                scrollHandler = handler as (event: Event) => void
              }
            })

            testManager.initializeScrollMonitoring(mockElement)

            // Simulate scroll sequence
            for (let i = 0; i < scrollPositions.length; i++) {
              mockElement.scrollTop = scrollPositions[i]
              
              // Call the scroll handler directly if it was registered
              if (scrollHandler) {
                scrollHandler(new Event('scroll'))
              }
              
              // Small delay to ensure proper sequencing
              await new Promise(resolve => setTimeout(resolve, 10))
            }

            const metrics = testManager.getScrollMetrics()

            // Property: Scroll direction should be calculated correctly
            for (let i = 1; i < metrics.length; i++) {
              const currentMetric = metrics[i]
              const previousMetric = metrics[i - 1]
              
              const scrollDelta = currentMetric.scrollTop - previousMetric.scrollTop

              if (Math.abs(scrollDelta) > 1) {
                const expectedDirection = scrollDelta > 0 ? 'down' : 'up'
                expect(currentMetric.scrollDirection).toBe(expectedDirection)
              } else {
                expect(currentMetric.scrollDirection).toBe('none')
              }
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    test('scroll performance should maintain consistency under various conditions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            contentLength: fc.constantFrom('short', 'medium', 'long', 'very-long'),
            scrollPattern: fc.constantFrom('smooth', 'rapid', 'mixed'),
            deviceType: fc.constantFrom('mobile', 'tablet', 'desktop')
          }),
          async (scenario) => {
            // Configure element based on scenario
            const contentSizes = {
              'short': { scrollHeight: 800, clientHeight: 600 },
              'medium': { scrollHeight: 2000, clientHeight: 500 },
              'long': { scrollHeight: 5000, clientHeight: 400 },
              'very-long': { scrollHeight: 10000, clientHeight: 300 }
            }

            const { scrollHeight, clientHeight } = contentSizes[scenario.contentLength]
            mockElement.scrollHeight = scrollHeight
            mockElement.clientHeight = clientHeight

            const testManager = new ScrollPerformanceManager({
              enableMetrics: true,
              enableOptimizations: true
            })

            // Capture the scroll handler when addEventListener is called
            let scrollHandler: ((event: Event) => void) | null = null
            mockElement.addEventListener = jest.fn((event, handler) => {
              if (event === 'scroll') {
                scrollHandler = handler as (event: Event) => void
              }
            })

            const cleanup = testManager.initializeScrollMonitoring(mockElement)

            // Generate scroll pattern based on scenario
            const maxScroll = Math.max(0, scrollHeight - clientHeight)
            let scrollPositions: number[] = []

            switch (scenario.scrollPattern) {
              case 'smooth':
                scrollPositions = Array.from({ length: 5 }, (_, i) => (i / 4) * maxScroll)
                break
              case 'rapid':
                scrollPositions = [0, maxScroll * 0.8, maxScroll * 0.2, maxScroll]
                break
              case 'mixed':
                scrollPositions = [0, maxScroll * 0.1, maxScroll * 0.9, maxScroll * 0.3, maxScroll]
                break
            }

            // Simulate scroll events
            for (const scrollTop of scrollPositions) {
              mockElement.scrollTop = scrollTop
              
              // Call the scroll handler directly if it was registered
              if (scrollHandler) {
                scrollHandler(new Event('scroll'))
              }
              await new Promise(resolve => setTimeout(resolve, 16))
            }

            const summary = testManager.getPerformanceSummary()

            // Property: Performance should be measurable regardless of content length
            expect(summary.totalEvents).toBeGreaterThan(0)
            expect(summary.smoothnessScore).toBeGreaterThanOrEqual(0)
            expect(summary.smoothnessScore).toBeLessThanOrEqual(100)

            // Property: Average speed should be reasonable
            expect(summary.avgSpeed).toBeGreaterThanOrEqual(0)
            expect(summary.maxSpeed).toBeGreaterThanOrEqual(summary.avgSpeed)

            // Property: Scroll optimizations should be applied consistently
            expect(mockElement.style.scrollBehavior).toBe('smooth')
            expect(mockElement.classList.add).toHaveBeenCalledWith('scrollable-container', 'scroll-boundary-fix')

            cleanup()
          }
        ),
        { numRuns: 50 }
      )
    })

    test('background consistency should be maintained during scroll', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            hasWhiteBackground: fc.boolean(),
            hasScrollBoundaryFix: fc.boolean(),
            contentHeight: fc.integer({ min: 1000, max: 5000 })
          }),
          async (config) => {
            // Mock element with background-related classes
            const element = document.createElement('main')
            
            if (config.hasWhiteBackground) {
              element.classList.add('bg-white', 'min-h-screen')
            }
            
            if (config.hasScrollBoundaryFix) {
              element.classList.add('scroll-boundary-fix')
            }

            // Set up scroll properties
            Object.defineProperty(element, 'scrollHeight', { value: config.contentHeight })
            Object.defineProperty(element, 'clientHeight', { value: 500 })
            Object.defineProperty(element, 'scrollTop', { value: 0, writable: true })

            const testManager = new ScrollPerformanceManager({
              enableOptimizations: true
            })

            testManager.initializeScrollMonitoring(element)

            // Property: White background classes should be preserved
            if (config.hasWhiteBackground) {
              expect(element.classList.contains('bg-white')).toBe(true)
              expect(element.classList.contains('min-h-screen')).toBe(true)
            }

            // Property: Scroll boundary fix should be applied
            expect(element.classList.contains('scroll-boundary-fix')).toBe(true)

            // Property: Scroll optimizations should not interfere with background
            expect(element.style.overscrollBehavior).toBe('contain')
            expect(element.style.scrollBehavior).toBe('smooth')

            // Simulate scroll to test boundary behavior
            element.scrollTop = config.contentHeight - 500 // Scroll to bottom
            const scrollEvent = new Event('scroll')
            element.dispatchEvent(scrollEvent)

            // Property: Background-related classes should remain intact after scroll
            if (config.hasWhiteBackground) {
              expect(element.classList.contains('bg-white')).toBe(true)
              expect(element.classList.contains('min-h-screen')).toBe(true)
            }
            expect(element.classList.contains('scroll-boundary-fix')).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Scroll Performance Edge Cases', () => {
    test('should handle edge cases gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            scrollHeight: fc.integer({ min: 0, max: 100 }), // Very small or zero height
            clientHeight: fc.integer({ min: 0, max: 100 }),
            scrollTop: fc.integer({ min: -50, max: 150 }) // Potentially invalid scroll positions
          }),
          async (edgeCase) => {
            mockElement.scrollHeight = edgeCase.scrollHeight
            mockElement.clientHeight = edgeCase.clientHeight
            mockElement.scrollTop = Math.max(0, Math.min(edgeCase.scrollTop, 
              Math.max(0, edgeCase.scrollHeight - edgeCase.clientHeight)))

            const testManager = new ScrollPerformanceManager({
              enableMetrics: true,
              enableOptimizations: true
            })

            // Property: Manager should handle edge cases without errors
            expect(() => {
              const cleanup = testManager.initializeScrollMonitoring(mockElement)
              cleanup()
            }).not.toThrow()

            // Property: Metrics should be valid even for edge cases
            const summary = testManager.getPerformanceSummary()
            expect(summary.avgSpeed).toBeGreaterThanOrEqual(0)
            expect(summary.maxSpeed).toBeGreaterThanOrEqual(0)
            expect(summary.smoothnessScore).toBeGreaterThanOrEqual(0)
            expect(summary.smoothnessScore).toBeLessThanOrEqual(100)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})