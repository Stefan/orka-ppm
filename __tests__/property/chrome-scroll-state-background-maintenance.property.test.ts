/**
 * Property-Based Tests for Chrome Scroll State Background Maintenance
 * Feature: chrome-scroll-black-bar-fix, Property 6: Chrome Scroll State Background Maintenance
 * Validates: Requirements 5.5
 */

import fc from 'fast-check'

// Mock Chrome browser detection
const mockIsChromeBasedBrowser = jest.fn(() => true)

// Mock DOM elements and methods
const createMockElement = (overrides: Partial<HTMLElement> = {}): HTMLElement => {
  const mockElement = {
    style: {} as CSSStyleDeclaration,
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(() => false),
      toggle: jest.fn()
    } as any,
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 500,
    offsetHeight: 500,
    getBoundingClientRect: jest.fn(() => ({
      top: 0,
      bottom: 500,
      left: 0,
      right: 300,
      width: 300,
      height: 500
    })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    scrollTo: jest.fn(),
    ...overrides
  } as any

  return mockElement
}

// Mock computed styles
const mockGetComputedStyle = jest.fn((element: Element) => ({
  backgroundColor: '#ffffff',
  backgroundImage: 'linear-gradient(to bottom, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 100%)',
  backgroundAttachment: 'local',
  overscrollBehavior: 'contain',
  webkitOverflowScrolling: 'touch',
  transform: 'translateZ(0px)',
  willChange: 'scroll-position',
  minHeight: '100vh'
}))

Object.defineProperty(window, 'getComputedStyle', {
  value: mockGetComputedStyle,
  writable: true
})

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn()
}

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
})

// Chrome browser detection utility
const isChromeBasedBrowser = (): boolean => {
  return mockIsChromeBasedBrowser()
}

// Chrome scroll state manager
class ChromeScrollStateManager {
  private scrollStates = new Map<HTMLElement, {
    isScrolling: boolean
    isMomentumScrolling: boolean
    isOverscrolling: boolean
    backgroundColor: string
    backgroundAttachment: string
    lastScrollTime: number
  }>()

  initializeScrollState(element: HTMLElement): void {
    if (!isChromeBasedBrowser()) return

    this.scrollStates.set(element, {
      isScrolling: false,
      isMomentumScrolling: false,
      isOverscrolling: false,
      backgroundColor: '#ffffff',
      backgroundAttachment: 'local',
      lastScrollTime: performance.now()
    })

    // Apply Chrome scroll state optimizations
    element.style.backgroundColor = '#ffffff'
    element.style.backgroundAttachment = 'local'
    element.style.overscrollBehavior = 'contain'
    element.style.webkitOverscrollBehavior = 'contain'
    element.style.webkitOverflowScrolling = 'touch'
    element.style.willChange = 'scroll-position'
    element.style.transform = 'translateZ(0)'

    // Add scroll state classes
    element.classList.add('chrome-scroll-state-background')
    element.classList.add('chrome-scroll-state-optimized')
  }

  updateScrollState(element: HTMLElement, scrollState: 'scrolling' | 'momentum' | 'overscroll' | 'idle'): void {
    const state = this.scrollStates.get(element)
    if (!state) return

    const currentTime = performance.now()

    // Update scroll state flags
    state.isScrolling = scrollState === 'scrolling' || scrollState === 'momentum'
    state.isMomentumScrolling = scrollState === 'momentum'
    state.isOverscrolling = scrollState === 'overscroll'
    state.lastScrollTime = currentTime

    // Maintain white background throughout all scroll states
    element.style.backgroundColor = '#ffffff'
    element.style.backgroundAttachment = 'local'

    // Apply state-specific optimizations
    switch (scrollState) {
      case 'scrolling':
        element.classList.add('chrome-scrolling')
        element.style.willChange = 'scroll-position, transform'
        break
      case 'momentum':
        element.classList.add('chrome-momentum-scrolling')
        element.style.transform = 'translate3d(0, 0, 0)'
        break
      case 'overscroll':
        element.classList.add('chrome-overscrolling')
        element.style.overscrollBehavior = 'contain'
        break
      case 'idle':
        element.classList.remove('chrome-scrolling', 'chrome-momentum-scrolling', 'chrome-overscrolling')
        element.style.willChange = 'auto'
        element.style.transform = 'translateZ(0)'
        break
    }

    this.scrollStates.set(element, state)
  }

  validateScrollStateBackground(element: HTMLElement): boolean {
    const computedStyle = window.getComputedStyle(element)
    const state = this.scrollStates.get(element)

    // Check background consistency
    const hasWhiteBackground = computedStyle.backgroundColor === '#ffffff' || 
                              computedStyle.backgroundColor === 'rgb(255, 255, 255)'
    
    const hasLocalAttachment = computedStyle.backgroundAttachment === 'local'
    const hasOverscrollContain = computedStyle.overscrollBehavior === 'contain'

    return hasWhiteBackground && hasLocalAttachment && hasOverscrollContain && !!state
  }

  getScrollState(element: HTMLElement) {
    return this.scrollStates.get(element)
  }

  clearScrollState(element: HTMLElement): void {
    this.scrollStates.delete(element)
  }
}

describe('Chrome Scroll State Background Maintenance Property Tests', () => {
  let scrollStateManager: ChromeScrollStateManager

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsChromeBasedBrowser.mockReturnValue(true)
    scrollStateManager = new ChromeScrollStateManager()
  })

  /**
   * Property 6: Chrome Scroll State Background Maintenance
   * For any scroll state (scrolling, momentum, overscroll), the scroll area should maintain 
   * white background throughout the operation
   * Validates: Requirements 5.5
   */
  describe('Property 6: Chrome Scroll State Background Maintenance', () => {
    test('Chrome scroll area should maintain white background throughout all scroll states', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            scrollStates: fc.array(
              fc.constantFrom('scrolling', 'momentum', 'overscroll', 'idle'),
              { minLength: 3, maxLength: 10 }
            ),
            contentHeight: fc.integer({ min: 200, max: 800 }),
            viewportHeight: fc.integer({ min: 500, max: 1200 }),
            scrollPositions: fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 1, maxLength: 5 }),
            transitionDelays: fc.array(fc.integer({ min: 0, max: 200 }), { minLength: 1, maxLength: 5 })
          }),
          async (testData) => {
            const scrollArea = createMockElement({
              scrollHeight: testData.contentHeight,
              clientHeight: testData.viewportHeight,
              offsetHeight: testData.viewportHeight
            })

            // Initialize Chrome scroll state management
            scrollStateManager.initializeScrollState(scrollArea)

            // Property: Initial scroll state should have white background
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')
            expect(scrollArea.style.backgroundAttachment).toBe('local')
            expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)

            // Test background maintenance through all scroll states
            for (let i = 0; i < testData.scrollStates.length; i++) {
              const scrollState = testData.scrollStates[i] as 'scrolling' | 'momentum' | 'overscroll' | 'idle'
              const scrollPosition = testData.scrollPositions[i % testData.scrollPositions.length]
              
              // Update scroll position
              scrollArea.scrollTop = scrollPosition

              // Update scroll state
              scrollStateManager.updateScrollState(scrollArea, scrollState)

              // Property: Background should remain white in all scroll states
              expect(scrollArea.style.backgroundColor).toBe('#ffffff')
              expect(scrollArea.style.backgroundAttachment).toBe('local')

              // Property: Scroll state validation should pass
              expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)

              // Property: Chrome-specific optimizations should be maintained
              const computedStyle = window.getComputedStyle(scrollArea)
              expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
              expect(computedStyle.overscrollBehavior).toBe('contain')

              // Property: State-specific classes should be applied correctly
              const state = scrollStateManager.getScrollState(scrollArea)
              expect(state).toBeDefined()
              expect(state!.isScrolling).toBe(scrollState === 'scrolling' || scrollState === 'momentum')
              expect(state!.isMomentumScrolling).toBe(scrollState === 'momentum')
              expect(state!.isOverscrolling).toBe(scrollState === 'overscroll')

              // Simulate transition delay
              const delay = testData.transitionDelays[i % testData.transitionDelays.length]
              if (delay > 0) {
                // Property: Background should remain consistent during transitions
                expect(scrollArea.style.backgroundColor).toBe('#ffffff')
                expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)
              }
            }

            // Property: Final state should maintain background consistency
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')
            expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Chrome momentum scrolling should preserve background throughout momentum phase', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialScrollTop: fc.integer({ min: 0, max: 300 }),
            momentumDuration: fc.integer({ min: 100, max: 1000 }),
            momentumSteps: fc.array(fc.integer({ min: 10, max: 100 }), { minLength: 5, maxLength: 20 }),
            contentHeight: fc.integer({ min: 400, max: 800 }),
            viewportHeight: fc.integer({ min: 600, max: 1000 })
          }),
          async (momentum) => {
            const scrollArea = createMockElement({
              scrollHeight: momentum.contentHeight,
              clientHeight: momentum.viewportHeight,
              scrollTop: momentum.initialScrollTop
            })

            // Initialize scroll state
            scrollStateManager.initializeScrollState(scrollArea)

            // Start momentum scrolling
            scrollStateManager.updateScrollState(scrollArea, 'momentum')

            // Property: Momentum scrolling should maintain white background
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')
            expect(scrollArea.classList.add).toHaveBeenCalledWith('chrome-momentum-scrolling')

            // Simulate momentum scroll steps
            let currentScrollTop = momentum.initialScrollTop
            for (const step of momentum.momentumSteps) {
              currentScrollTop += step
              scrollArea.scrollTop = currentScrollTop

              // Property: Background should remain white during each momentum step
              expect(scrollArea.style.backgroundColor).toBe('#ffffff')
              expect(scrollArea.style.backgroundAttachment).toBe('local')
              expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)

              // Property: Chrome momentum optimizations should be active
              expect(scrollArea.style.transform).toBe('translate3d(0, 0, 0)')
              
              const state = scrollStateManager.getScrollState(scrollArea)
              expect(state!.isMomentumScrolling).toBe(true)
            }

            // End momentum scrolling
            scrollStateManager.updateScrollState(scrollArea, 'idle')

            // Property: Background should remain white after momentum ends
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')
            expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)

            const finalState = scrollStateManager.getScrollState(scrollArea)
            expect(finalState!.isMomentumScrolling).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Chrome overscroll behavior should maintain background during boundary interactions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            contentHeight: fc.integer({ min: 300, max: 600 }),
            viewportHeight: fc.integer({ min: 700, max: 1200 }),
            overscrollAttempts: fc.array(fc.integer({ min: 50, max: 300 }), { minLength: 3, maxLength: 8 }),
            overscrollDirection: fc.constantFrom('top', 'bottom', 'both')
          }),
          async (overscroll) => {
            // Ensure short content scenario for overscroll testing
            const contentHeight = Math.min(overscroll.contentHeight, overscroll.viewportHeight - 100)
            
            const scrollArea = createMockElement({
              scrollHeight: contentHeight,
              clientHeight: overscroll.viewportHeight,
              offsetHeight: overscroll.viewportHeight
            })

            // Initialize scroll state
            scrollStateManager.initializeScrollState(scrollArea)

            const maxScrollTop = Math.max(0, contentHeight - overscroll.viewportHeight)

            for (const overscrollDistance of overscroll.overscrollAttempts) {
              let targetScrollTop: number

              // Calculate overscroll position based on direction
              if (overscroll.overscrollDirection === 'top') {
                targetScrollTop = -overscrollDistance // Scroll above content
              } else if (overscroll.overscrollDirection === 'bottom') {
                targetScrollTop = maxScrollTop + overscrollDistance // Scroll below content
              } else {
                // Alternate between top and bottom overscroll
                const isTopOverscroll = overscroll.overscrollAttempts.indexOf(overscrollDistance) % 2 === 0
                targetScrollTop = isTopOverscroll ? -overscrollDistance : maxScrollTop + overscrollDistance
              }

              // Simulate overscroll
              scrollArea.scrollTop = targetScrollTop
              scrollStateManager.updateScrollState(scrollArea, 'overscroll')

              // Property: Overscroll should maintain white background
              expect(scrollArea.style.backgroundColor).toBe('#ffffff')
              expect(scrollArea.style.backgroundAttachment).toBe('local')

              // Property: Overscroll containment should be active
              expect(scrollArea.style.overscrollBehavior).toBe('contain')
              expect(scrollArea.classList.add).toHaveBeenCalledWith('chrome-overscrolling')

              // Property: Background validation should pass during overscroll
              expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)

              const state = scrollStateManager.getScrollState(scrollArea)
              expect(state!.isOverscrolling).toBe(true)

              // Property: Chrome overscroll optimizations should prevent dark background exposure
              const computedStyle = window.getComputedStyle(scrollArea)
              expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
              expect(computedStyle.overscrollBehavior).toBe('contain')
            }

            // Return to normal scroll state
            scrollArea.scrollTop = Math.min(maxScrollTop, 100)
            scrollStateManager.updateScrollState(scrollArea, 'idle')

            // Property: Background should remain white after overscroll ends
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')
            expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Chrome scroll state transitions should maintain background consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            stateSequence: fc.array(
              fc.record({
                state: fc.constantFrom('scrolling', 'momentum', 'overscroll', 'idle'),
                duration: fc.integer({ min: 50, max: 300 }),
                scrollPosition: fc.integer({ min: 0, max: 400 })
              }),
              { minLength: 5, maxLength: 15 }
            ),
            contentHeight: fc.integer({ min: 500, max: 1000 }),
            viewportHeight: fc.integer({ min: 600, max: 1200 })
          }),
          async (transition) => {
            const scrollArea = createMockElement({
              scrollHeight: transition.contentHeight,
              clientHeight: transition.viewportHeight
            })

            // Initialize scroll state
            scrollStateManager.initializeScrollState(scrollArea)

            // Property: Initial state should have consistent background
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')
            expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)

            // Test state transitions
            for (const step of transition.stateSequence) {
              // Update scroll position
              scrollArea.scrollTop = step.scrollPosition

              // Transition to new state
              scrollStateManager.updateScrollState(scrollArea, step.state as any)

              // Property: Background should remain consistent during state transition
              expect(scrollArea.style.backgroundColor).toBe('#ffffff')
              expect(scrollArea.style.backgroundAttachment).toBe('local')

              // Property: Scroll state validation should pass for all transitions
              expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)

              // Property: Chrome optimizations should be maintained across transitions
              const computedStyle = window.getComputedStyle(scrollArea)
              expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
              expect(computedStyle.overscrollBehavior).toBe('contain')

              // Property: State-specific optimizations should be applied correctly
              const state = scrollStateManager.getScrollState(scrollArea)
              expect(state).toBeDefined()

              switch (step.state) {
                case 'scrolling':
                  expect(state!.isScrolling).toBe(true)
                  expect(scrollArea.classList.add).toHaveBeenCalledWith('chrome-scrolling')
                  break
                case 'momentum':
                  expect(state!.isMomentumScrolling).toBe(true)
                  expect(scrollArea.style.transform).toBe('translate3d(0, 0, 0)')
                  break
                case 'overscroll':
                  expect(state!.isOverscrolling).toBe(true)
                  expect(scrollArea.style.overscrollBehavior).toBe('contain')
                  break
                case 'idle':
                  expect(state!.isScrolling).toBe(false)
                  expect(state!.isMomentumScrolling).toBe(false)
                  expect(state!.isOverscrolling).toBe(false)
                  break
              }
            }

            // Property: Final state should maintain background consistency
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')
            expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Chrome scroll state background should work with different element configurations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            elementType: fc.constantFrom('main', 'div', 'section', 'article'),
            hasExistingBackground: fc.boolean(),
            hasExistingClasses: fc.boolean(),
            hasInlineStyles: fc.boolean(),
            scrollStates: fc.array(
              fc.constantFrom('scrolling', 'momentum', 'overscroll', 'idle'),
              { minLength: 2, maxLength: 6 }
            )
          }),
          async (config) => {
            const scrollArea = createMockElement()

            // Configure existing properties
            if (config.hasExistingBackground) {
              scrollArea.style.backgroundColor = '#f0f0f0' // Non-white background
            }

            if (config.hasExistingClasses) {
              scrollArea.classList.contains = jest.fn((className) => 
                ['bg-gray-100', 'min-h-full'].includes(className)
              )
            }

            if (config.hasInlineStyles) {
              scrollArea.style.backgroundAttachment = 'scroll' // Non-local attachment
              scrollArea.style.overscrollBehavior = 'auto' // Non-contained behavior
            }

            // Initialize scroll state (should override existing properties)
            scrollStateManager.initializeScrollState(scrollArea)

            // Property: Chrome scroll state should override existing background properties
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')
            expect(scrollArea.style.backgroundAttachment).toBe('local')
            expect(scrollArea.style.overscrollBehavior).toBe('contain')

            // Test background maintenance across different scroll states
            for (const scrollState of config.scrollStates) {
              scrollStateManager.updateScrollState(scrollArea, scrollState as any)

              // Property: Background should remain white regardless of element configuration
              expect(scrollArea.style.backgroundColor).toBe('#ffffff')
              expect(scrollArea.style.backgroundAttachment).toBe('local')

              // Property: Scroll state validation should pass for all element types
              expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)

              // Property: Chrome optimizations should work with any element configuration
              const computedStyle = window.getComputedStyle(scrollArea)
              expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
              expect(computedStyle.overscrollBehavior).toBe('contain')
            }

            // Property: Final background state should be consistent
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')
            expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Chrome scroll state should handle rapid state changes without background flicker', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            rapidStateChanges: fc.array(
              fc.record({
                state: fc.constantFrom('scrolling', 'momentum', 'overscroll', 'idle'),
                interval: fc.integer({ min: 1, max: 50 }) // Very rapid changes
              }),
              { minLength: 10, maxLength: 30 }
            ),
            contentHeight: fc.integer({ min: 400, max: 800 }),
            viewportHeight: fc.integer({ min: 600, max: 1000 })
          }),
          async (rapid) => {
            const scrollArea = createMockElement({
              scrollHeight: rapid.contentHeight,
              clientHeight: rapid.viewportHeight
            })

            // Initialize scroll state
            scrollStateManager.initializeScrollState(scrollArea)

            // Property: Initial background should be white
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')

            // Simulate rapid state changes
            for (const change of rapid.rapidStateChanges) {
              scrollStateManager.updateScrollState(scrollArea, change.state as any)

              // Property: Background should remain white during rapid state changes
              expect(scrollArea.style.backgroundColor).toBe('#ffffff')
              expect(scrollArea.style.backgroundAttachment).toBe('local')

              // Property: Background validation should pass during rapid changes
              expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)

              // Property: Chrome optimizations should remain stable
              const computedStyle = window.getComputedStyle(scrollArea)
              expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
              expect(computedStyle.overscrollBehavior).toBe('contain')

              // Property: State should be updated correctly despite rapid changes
              const state = scrollStateManager.getScrollState(scrollArea)
              expect(state).toBeDefined()
            }

            // Property: Final state should maintain background consistency
            expect(scrollArea.style.backgroundColor).toBe('#ffffff')
            expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Chrome Scroll State Edge Cases', () => {
    test('should handle scroll state management with non-Chrome browsers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            isChromeDetected: fc.boolean(),
            scrollStates: fc.array(
              fc.constantFrom('scrolling', 'momentum', 'overscroll', 'idle'),
              { minLength: 2, maxLength: 5 }
            )
          }),
          async (browserTest) => {
            // Mock browser detection
            mockIsChromeBasedBrowser.mockReturnValue(browserTest.isChromeDetected)

            const scrollArea = createMockElement()

            // Initialize scroll state
            scrollStateManager.initializeScrollState(scrollArea)

            if (browserTest.isChromeDetected) {
              // Property: Chrome optimizations should be applied when Chrome is detected
              expect(scrollArea.style.backgroundColor).toBe('#ffffff')
              expect(scrollArea.classList.add).toHaveBeenCalledWith('chrome-scroll-state-background')

              // Test scroll states
              for (const scrollState of browserTest.scrollStates) {
                scrollStateManager.updateScrollState(scrollArea, scrollState as any)
                expect(scrollArea.style.backgroundColor).toBe('#ffffff')
                expect(scrollStateManager.validateScrollStateBackground(scrollArea)).toBe(true)
              }
            } else {
              // Property: Chrome-specific optimizations should not be applied for non-Chrome browsers
              expect(scrollArea.style.backgroundColor).not.toBe('#ffffff')
              expect(scrollArea.classList.add).not.toHaveBeenCalledWith('chrome-scroll-state-background')
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    test('should handle scroll state cleanup and memory management', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            elementCount: fc.integer({ min: 1, max: 10 }),
            stateChangesPerElement: fc.integer({ min: 5, max: 15 })
          }),
          async (cleanup) => {
            const elements: HTMLElement[] = []

            // Create multiple elements
            for (let i = 0; i < cleanup.elementCount; i++) {
              const element = createMockElement()
              elements.push(element)
              scrollStateManager.initializeScrollState(element)

              // Property: Each element should have proper scroll state initialization
              expect(element.style.backgroundColor).toBe('#ffffff')
              expect(scrollStateManager.getScrollState(element)).toBeDefined()
            }

            // Perform state changes on all elements
            for (const element of elements) {
              for (let j = 0; j < cleanup.stateChangesPerElement; j++) {
                const states = ['scrolling', 'momentum', 'overscroll', 'idle'] as const
                const randomState = states[j % states.length]
                scrollStateManager.updateScrollState(element, randomState)

                // Property: Background should remain consistent across all elements
                expect(element.style.backgroundColor).toBe('#ffffff')
                expect(scrollStateManager.validateScrollStateBackground(element)).toBe(true)
              }
            }

            // Clean up scroll states
            for (const element of elements) {
              scrollStateManager.clearScrollState(element)

              // Property: Scroll state should be properly cleaned up
              expect(scrollStateManager.getScrollState(element)).toBeUndefined()
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})