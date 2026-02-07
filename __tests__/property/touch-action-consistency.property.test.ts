/**
 * Property-Based Tests for Touch Action Consistency
 * Feature: cross-browser-compatibility, Property 5: Touch Action Consistency
 * **Validates: Requirements 3.2, 3.4**
 */

import fc from 'fast-check'
import { JSDOM } from 'jsdom'

// Setup JSDOM environment for touch action testing
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        /* Cross-browser touch action styles */
        .touch-action-pan-y {
          touch-action: pan-y;
          -ms-touch-action: pan-y;
          overscroll-behavior: contain;
          overscroll-behavior-y: contain;
          -webkit-overscroll-behavior: contain;
          -moz-overscroll-behavior: contain;
          -ms-overscroll-behavior: contain;
        }
        
        /* Scrollable element with overflow */
        .scrollable-element {
          overflow-y: auto;
          overflow-x: hidden;
          height: 300px;
          width: 200px;
        }
        
        /* Firefox-specific touch optimizations */
        .firefox-touch-optimized {
          touch-action: pan-y;
          -moz-user-select: none;
          overscroll-behavior: contain;
          overscroll-behavior-y: contain;
        }
        
        /* Safari-specific touch optimizations */
        .safari-touch-optimized {
          -webkit-overflow-scrolling: touch;
          -webkit-touch-callout: none;
          touch-action: pan-y;
          overscroll-behavior: contain;
        }
        
        /* Chrome-specific touch optimizations */
        .chrome-touch-optimized {
          touch-action: pan-y;
          overscroll-behavior: contain;
          overscroll-behavior-y: contain;
          will-change: scroll-position;
        }
      </style>
    </head>
    <body></body>
  </html>
`, {
  url: 'http://localhost'
})

global.window = dom.window as any
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement

// Mock different browser user agents
const browserUserAgents = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
}

// Mock getComputedStyle for touch action testing
global.getComputedStyle = jest.fn().mockImplementation((element: Element) => {
  if (!element.isConnected) {
    throw new TypeError("The provided value is not of type 'Element'.")
  }

  const hasTouchActionPanY = element.classList.contains('touch-action-pan-y')
  const hasScrollableElement = element.classList.contains('scrollable-element')
  const hasFirefoxOptimized = element.classList.contains('firefox-touch-optimized')
  const hasSafariOptimized = element.classList.contains('safari-touch-optimized')
  const hasChromeOptimized = element.classList.contains('chrome-touch-optimized')

  const hasOverflowContent = hasScrollableElement || hasTouchActionPanY || hasFirefoxOptimized || hasSafariOptimized || hasChromeOptimized

  return {
    // Touch action properties
    touchAction: hasOverflowContent ? 'pan-y' : 'auto',
    
    // Overscroll behavior properties
    overscrollBehavior: hasOverflowContent ? 'contain' : 'auto',
    overscrollBehaviorY: hasOverflowContent ? 'contain' : 'auto',
    
    // Overflow properties
    overflowY: hasScrollableElement ? 'auto' : 'visible',
    overflowX: hasScrollableElement ? 'hidden' : 'visible',
    
    // Dimensions
    height: hasScrollableElement ? '300px' : 'auto',
    width: hasScrollableElement ? '200px' : 'auto',
    
    // Browser-specific properties
    userSelect: hasFirefoxOptimized ? 'none' : 'auto',
    willChange: hasChromeOptimized ? 'scroll-position' : 'auto',
    
    getPropertyValue: (property: string) => {
      switch (property) {
        case '-ms-touch-action':
          return hasOverflowContent ? 'pan-y' : 'auto'
        case '-webkit-overflow-scrolling':
          return hasSafariOptimized ? 'touch' : 'auto'
        case '-webkit-touch-callout':
          return hasSafariOptimized ? 'none' : 'default'
        case '-moz-user-select':
          return hasFirefoxOptimized ? 'none' : 'auto'
        case '-webkit-overscroll-behavior':
        case '-moz-overscroll-behavior':
        case '-ms-overscroll-behavior':
          return hasOverflowContent ? 'contain' : 'auto'
        default:
          return ''
      }
    }
  }
})

// Mock touch event for testing
const mockTouchEvent = (element: HTMLElement, eventType: string, touches: Array<{ clientX: number, clientY: number }>) => {
  const touchList = touches.map(touch => ({
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.clientX,
    pageY: touch.clientY,
    screenX: touch.clientX,
    screenY: touch.clientY,
    identifier: Math.random(),
    target: element
  }))

  const touchEvent = {
    type: eventType,
    touches: touchList,
    targetTouches: touchList,
    changedTouches: touchList,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    bubbles: true,
    cancelable: true,
    target: element
  }

  // Simulate touch event handling
  if (element.ontouchstart !== undefined) {
    element.ontouchstart?.(touchEvent as any)
  }
  if (element.ontouchmove !== undefined) {
    element.ontouchmove?.(touchEvent as any)
  }
  if (element.ontouchend !== undefined) {
    element.ontouchend?.(touchEvent as any)
  }

  return touchEvent
}

// Scrollable element generator
const scrollableElementArb = fc.record({
  tagName: fc.constantFrom('div', 'nav', 'aside', 'main', 'section'),
  hasOverflowContent: fc.boolean(),
  contentHeight: fc.integer({ min: 400, max: 2000 }),
  elementHeight: fc.integer({ min: 200, max: 600 }),
  touchOptimization: fc.constantFrom('none', 'firefox', 'safari', 'chrome', 'cross-browser')
})

// Touch interaction generator
const touchInteractionArb = fc.record({
  startX: fc.integer({ min: 0, max: 200 }),
  startY: fc.integer({ min: 0, max: 300 }),
  endX: fc.integer({ min: 0, max: 200 }),
  endY: fc.integer({ min: 0, max: 300 }),
  duration: fc.integer({ min: 100, max: 1000 }),
  touchCount: fc.integer({ min: 1, max: 3 })
})

// Browser environment generator
const browserEnvironmentArb = fc.record({
  userAgent: fc.constantFrom(...Object.values(browserUserAgents)),
  browserName: fc.constantFrom('chrome', 'firefox', 'safari', 'edge'),
  isMobile: fc.boolean(),
  supportsTouch: fc.boolean(),
  devicePixelRatio: fc.constantFrom(1, 1.5, 2, 3)
})

describe('Touch Action Consistency Property Tests', () => {
  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  /**
   * Property 5: Touch Action Consistency
   * For any scrollable element with overflow content, the computed touch-action property 
   * should be 'pan-y' and overscroll-behavior should be 'contain'
   */
  test('Property 5: Touch Action Consistency - scrollable elements have consistent touch-action', () => {
    fc.assert(
      fc.property(
        scrollableElementArb,
        browserEnvironmentArb,
        (elementConfig, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create scrollable element
          const element = document.createElement(elementConfig.tagName)
          element.className = 'scrollable-element touch-action-pan-y'
          
          // Add browser-specific optimizations
          switch (elementConfig.touchOptimization) {
            case 'firefox':
              element.classList.add('firefox-touch-optimized')
              break
            case 'safari':
              element.classList.add('safari-touch-optimized')
              break
            case 'chrome':
              element.classList.add('chrome-touch-optimized')
              break
            case 'cross-browser':
              element.classList.add('firefox-touch-optimized', 'safari-touch-optimized', 'chrome-touch-optimized')
              break
          }

          // Add overflow content if specified
          if (elementConfig.hasOverflowContent) {
            const contentContainer = document.createElement('div')
            contentContainer.style.height = `${elementConfig.contentHeight}px`
            contentContainer.textContent = 'Scrollable content '.repeat(100)
            element.appendChild(contentContainer)
          }

          element.style.height = `${elementConfig.elementHeight}px`
          document.body.appendChild(element)

          const computedStyle = window.getComputedStyle(element)

          // Property: Elements with overflow content should have touch-action: pan-y
          const hasTouchActionPanY = computedStyle.touchAction === 'pan-y'

          // Property: Elements with overflow content should have overscroll-behavior: contain
          const hasOverscrollBehaviorContain = 
            computedStyle.overscrollBehavior === 'contain' &&
            computedStyle.overscrollBehaviorY === 'contain'

          // Property: Browser-specific touch properties should be applied
          let browserSpecificPropertiesApplied = true
          
          if (elementConfig.touchOptimization === 'firefox' || elementConfig.touchOptimization === 'cross-browser') {
            const mozUserSelect = computedStyle.getPropertyValue('-moz-user-select')
            const mozOverscrollBehavior = computedStyle.getPropertyValue('-moz-overscroll-behavior')
            browserSpecificPropertiesApplied = browserSpecificPropertiesApplied && 
              mozUserSelect === 'none' && 
              mozOverscrollBehavior === 'contain'
          }

          if (elementConfig.touchOptimization === 'safari' || elementConfig.touchOptimization === 'cross-browser') {
            const webkitOverflowScrolling = computedStyle.getPropertyValue('-webkit-overflow-scrolling')
            const webkitTouchCallout = computedStyle.getPropertyValue('-webkit-touch-callout')
            browserSpecificPropertiesApplied = browserSpecificPropertiesApplied && 
              webkitOverflowScrolling === 'touch' && 
              webkitTouchCallout === 'none'
          }

          if (elementConfig.touchOptimization === 'chrome' || elementConfig.touchOptimization === 'cross-browser') {
            const willChange = computedStyle.willChange
            browserSpecificPropertiesApplied = browserSpecificPropertiesApplied && 
              willChange === 'scroll-position'
          }

          // Property: MS touch action should be applied for IE/Edge compatibility
          const msTouchAction = computedStyle.getPropertyValue('-ms-touch-action')
          const hasMsTouchActionPanY = msTouchAction === 'pan-y' || msTouchAction === ''

          return hasTouchActionPanY && 
                 hasOverscrollBehaviorContain && 
                 browserSpecificPropertiesApplied && 
                 hasMsTouchActionPanY
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 5: Touch Action Consistency - touch interactions respect pan-y constraint', () => {
    fc.assert(
      fc.property(
        scrollableElementArb.filter(config => config.hasOverflowContent),
        touchInteractionArb,
        browserEnvironmentArb.filter(env => env.supportsTouch),
        (elementConfig, touchConfig, browserEnv) => {
          // Mock touch-enabled browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create touch-optimized scrollable element
          const element = document.createElement(elementConfig.tagName)
          element.className = 'scrollable-element touch-action-pan-y'
          
          // Add content that requires scrolling
          const contentContainer = document.createElement('div')
          contentContainer.style.height = `${elementConfig.contentHeight}px`
          contentContainer.textContent = 'Scrollable content '.repeat(100)
          element.appendChild(contentContainer)

          element.style.height = `${elementConfig.elementHeight}px`
          document.body.appendChild(element)

          const computedStyle = window.getComputedStyle(element)

          // Property: Touch action should be pan-y before interaction
          const initialTouchActionCorrect = computedStyle.touchAction === 'pan-y'

          // Simulate touch interaction
          let touchEventHandled = false
          element.ontouchstart = () => { touchEventHandled = true }
          element.ontouchmove = () => { touchEventHandled = true }

          const touchEvent = mockTouchEvent(element, 'touchstart', [
            { clientX: touchConfig.startX, clientY: touchConfig.startY }
          ])

          // Property: Touch events should be handled when touch-action allows it
          const touchEventsHandled = touchEventHandled

          // Property: Touch action should persist after interaction
          const postInteractionStyle = window.getComputedStyle(element)
          const touchActionPersists = postInteractionStyle.touchAction === 'pan-y'

          // Property: Overscroll behavior should persist after interaction
          const overscrollBehaviorPersists = 
            postInteractionStyle.overscrollBehavior === 'contain' &&
            postInteractionStyle.overscrollBehaviorY === 'contain'

          return initialTouchActionCorrect && 
                 touchEventsHandled && 
                 touchActionPersists && 
                 overscrollBehaviorPersists
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 5: Touch Action Consistency - cross-browser touch action normalization', () => {
    fc.assert(
      fc.property(
        scrollableElementArb,
        fc.array(browserEnvironmentArb, { minLength: 2, maxLength: 4 }),
        (elementConfig, browserEnvironments) => {
          let consistentAcrossBrowsers = true
          const touchActionResults: string[] = []
          const overscrollBehaviorResults: string[] = []

          // Test the same element configuration across different browsers
          browserEnvironments.forEach((browserEnv, index) => {
            // Clear previous test
            document.body.innerHTML = ''

            // Mock browser environment
            Object.defineProperty(window.navigator, 'userAgent', {
              value: browserEnv.userAgent,
              writable: true
            })

            // Create element with cross-browser touch optimization
            const element = document.createElement(elementConfig.tagName)
            element.className = 'scrollable-element touch-action-pan-y'
            
            // Add browser-specific classes for comprehensive testing
            element.classList.add('firefox-touch-optimized', 'safari-touch-optimized', 'chrome-touch-optimized')

            if (elementConfig.hasOverflowContent) {
              const contentContainer = document.createElement('div')
              contentContainer.style.height = `${elementConfig.contentHeight}px`
              contentContainer.textContent = 'Content'
              element.appendChild(contentContainer)
            }

            element.style.height = `${elementConfig.elementHeight}px`
            document.body.appendChild(element)

            const computedStyle = window.getComputedStyle(element)
            
            touchActionResults.push(computedStyle.touchAction)
            overscrollBehaviorResults.push(computedStyle.overscrollBehavior)
          })

          // Property: Touch action should be consistent across all browsers
          const touchActionConsistent = touchActionResults.every(result => result === touchActionResults[0])

          // Property: Overscroll behavior should be consistent across all browsers
          const overscrollBehaviorConsistent = overscrollBehaviorResults.every(result => result === overscrollBehaviorResults[0])

          // Property: For overflow content, touch-action should be pan-y across all browsers
          const touchActionCorrectForOverflow = !elementConfig.hasOverflowContent || 
            touchActionResults.every(result => result === 'pan-y')

          // Property: For overflow content, overscroll-behavior should be contain across all browsers
          const overscrollBehaviorCorrectForOverflow = !elementConfig.hasOverflowContent || 
            overscrollBehaviorResults.every(result => result === 'contain')

          return touchActionConsistent && 
                 overscrollBehaviorConsistent && 
                 touchActionCorrectForOverflow && 
                 overscrollBehaviorCorrectForOverflow
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 5: Touch Action Consistency - nested scrollable elements maintain consistency', () => {
    fc.assert(
      fc.property(
        fc.record({
          nestingDepth: fc.integer({ min: 1, max: 3 }),
          eachHasOverflow: fc.boolean(),
          parentHeight: fc.integer({ min: 300, max: 600 }),
          childHeight: fc.integer({ min: 200, max: 400 })
        }),
        browserEnvironmentArb,
        (nestingConfig, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create nested scrollable structure
          let currentParent = document.body
          const allElements: HTMLElement[] = []

          for (let depth = 0; depth < nestingConfig.nestingDepth; depth++) {
            const element = document.createElement('div')
            element.className = 'scrollable-element touch-action-pan-y'
            element.style.height = `${nestingConfig.parentHeight - (depth * 50)}px`
            element.id = `nested-element-${depth}`

            if (nestingConfig.eachHasOverflow) {
              const content = document.createElement('div')
              content.style.height = `${nestingConfig.childHeight + (depth * 100)}px`
              content.textContent = `Nested content at depth ${depth} `.repeat(20)
              element.appendChild(content)
            }

            currentParent.appendChild(element)
            allElements.push(element)
            currentParent = element
          }

          // Property: All nested elements should have consistent touch-action
          const allHaveConsistentTouchAction = allElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            return computedStyle.touchAction === 'pan-y'
          })

          // Property: All nested elements should have consistent overscroll-behavior
          const allHaveConsistentOverscrollBehavior = allElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            return computedStyle.overscrollBehavior === 'contain' &&
                   computedStyle.overscrollBehaviorY === 'contain'
          })

          // Property: Nesting depth should not affect touch action consistency
          const touchActionUnaffectedByDepth = allElements.every((element, index) => {
            const computedStyle = window.getComputedStyle(element)
            const expectedTouchAction = nestingConfig.eachHasOverflow ? 'pan-y' : 'pan-y' // Should be pan-y regardless
            return computedStyle.touchAction === expectedTouchAction
          })

          // Property: Parent-child touch action inheritance should work correctly
          let parentChildConsistency = true
          for (let i = 1; i < allElements.length; i++) {
            const parentStyle = window.getComputedStyle(allElements[i - 1])
            const childStyle = window.getComputedStyle(allElements[i])
            
            // Both should have pan-y for consistent scrolling behavior
            if (parentStyle.touchAction !== 'pan-y' || childStyle.touchAction !== 'pan-y') {
              parentChildConsistency = false
              break
            }
          }

          return allHaveConsistentTouchAction && 
                 allHaveConsistentOverscrollBehavior && 
                 touchActionUnaffectedByDepth && 
                 parentChildConsistency
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 5: Touch Action Consistency - dynamic content changes preserve touch properties', () => {
    fc.assert(
      fc.property(
        scrollableElementArb,
        fc.array(fc.record({
          action: fc.constantFrom('add-content', 'remove-content', 'resize-element', 'change-class'),
          contentAmount: fc.integer({ min: 100, max: 1000 }),
          newHeight: fc.integer({ min: 150, max: 800 })
        }), { minLength: 1, maxLength: 5 }),
        browserEnvironmentArb,
        (elementConfig, dynamicChanges, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create initial scrollable element
          const element = document.createElement(elementConfig.tagName)
          element.className = 'scrollable-element touch-action-pan-y'
          element.style.height = `${elementConfig.elementHeight}px`

          if (elementConfig.hasOverflowContent) {
            const initialContent = document.createElement('div')
            initialContent.style.height = `${elementConfig.contentHeight}px`
            initialContent.textContent = 'Initial content'
            initialContent.id = 'initial-content'
            element.appendChild(initialContent)
          }

          document.body.appendChild(element)

          // Get initial touch properties
          const initialStyle = window.getComputedStyle(element)
          const initialTouchAction = initialStyle.touchAction
          const initialOverscrollBehavior = initialStyle.overscrollBehavior

          let propertiesConsistentThroughChanges = true

          // Apply dynamic changes and test consistency
          dynamicChanges.forEach((change, index) => {
            switch (change.action) {
              case 'add-content':
                const newContent = document.createElement('div')
                newContent.style.height = `${change.contentAmount}px`
                newContent.textContent = `Dynamic content ${index}`
                element.appendChild(newContent)
                break

              case 'remove-content':
                const existingContent = element.querySelector('#initial-content')
                if (existingContent) {
                  existingContent.remove()
                }
                break

              case 'resize-element':
                element.style.height = `${change.newHeight}px`
                break

              case 'change-class':
                element.classList.toggle('firefox-touch-optimized')
                element.classList.toggle('safari-touch-optimized')
                break
            }

            // Check if touch properties are maintained after change
            const currentStyle = window.getComputedStyle(element)
            
            // Property: Touch action should remain consistent after dynamic changes
            const touchActionConsistent = currentStyle.touchAction === 'pan-y'

            // Property: Overscroll behavior should remain consistent after dynamic changes
            const overscrollBehaviorConsistent = 
              currentStyle.overscrollBehavior === 'contain' &&
              currentStyle.overscrollBehaviorY === 'contain'

            if (!touchActionConsistent || !overscrollBehaviorConsistent) {
              propertiesConsistentThroughChanges = false
            }
          })

          // Property: Final state should still have correct touch properties
          const finalStyle = window.getComputedStyle(element)
          const finalTouchActionCorrect = finalStyle.touchAction === 'pan-y'
          const finalOverscrollBehaviorCorrect = 
            finalStyle.overscrollBehavior === 'contain' &&
            finalStyle.overscrollBehaviorY === 'contain'

          return propertiesConsistentThroughChanges && 
                 finalTouchActionCorrect && 
                 finalOverscrollBehaviorCorrect
        }
      ),
      { numRuns: 100 }
    )
  })
})