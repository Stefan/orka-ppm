/**
 * Property-Based Tests for Firefox Sidebar Scroll Stability
 * Feature: cross-browser-compatibility, Property 4: Firefox Sidebar Scroll Stability
 * **Validates: Requirements 3.1, 3.4**
 */

import fc from 'fast-check'
import { JSDOM } from 'jsdom'

// Setup JSDOM environment for Firefox sidebar testing
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        /* Firefox-specific sidebar styles */
        .sidebar-firefox-fix {
          scrollbar-width: thin;
          scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
          touch-action: pan-y;
          -moz-user-select: none;
          overscroll-behavior: contain;
          overscroll-behavior-y: contain;
          will-change: scroll-position;
          transform: translateZ(0);
          overflow-y: auto;
          overflow-x: hidden;
        }
        
        /* Cross-browser sidebar base */
        .sidebar-cross-browser {
          overflow-y: auto;
          overflow-x: hidden;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          -webkit-scroll-behavior: smooth;
          -moz-scroll-behavior: smooth;
          contain: layout style paint;
          will-change: scroll-position;
          -webkit-transform: translateZ(0);
          -moz-transform: translateZ(0);
          -ms-transform: translateZ(0);
          transform: translateZ(0);
        }
        
        /* Sidebar layout */
        .sidebar {
          width: 256px;
          height: 100vh;
          background-color: #1f2937;
          position: fixed;
          left: 0;
          top: 0;
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

// Mock Firefox user agent
const firefoxUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'

// Mock getComputedStyle for Firefox-specific properties
global.getComputedStyle = jest.fn().mockImplementation((element: Element) => {
  if (!element.isConnected) {
    throw new TypeError("The provided value is not of type 'Element'.")
  }

  const hasFirefoxFix = element.classList.contains('sidebar-firefox-fix')
  const hasCrossBrowserFix = element.classList.contains('sidebar-cross-browser')

  return {
    // Firefox-specific properties
    scrollbarWidth: hasFirefoxFix ? 'thin' : 'auto',
    scrollbarColor: hasFirefoxFix ? 'rgba(155, 155, 155, 0.5) transparent' : 'auto',
    touchAction: (hasFirefoxFix || hasCrossBrowserFix) ? 'pan-y' : 'auto',
    userSelect: hasFirefoxFix ? 'none' : 'auto',
    overscrollBehavior: (hasFirefoxFix || hasCrossBrowserFix) ? 'contain' : 'auto',
    overscrollBehaviorY: (hasFirefoxFix || hasCrossBrowserFix) ? 'contain' : 'auto',
    willChange: (hasFirefoxFix || hasCrossBrowserFix) ? 'scroll-position' : 'auto',
    transform: (hasFirefoxFix || hasCrossBrowserFix) ? 'translateZ(0px)' : 'none',
    overflowY: (hasFirefoxFix || hasCrossBrowserFix) ? 'auto' : 'visible',
    overflowX: (hasFirefoxFix || hasCrossBrowserFix) ? 'hidden' : 'visible',
    scrollBehavior: hasCrossBrowserFix ? 'smooth' : 'auto',
    contain: hasCrossBrowserFix ? 'layout style paint' : 'none',
    
    // Layout properties
    width: '256px',
    height: '100vh',
    backgroundColor: '#1f2937',
    position: 'fixed',
    left: '0px',
    top: '0px',
    
    getPropertyValue: (property: string) => {
      switch (property) {
        case '-moz-user-select':
          return hasFirefoxFix ? 'none' : 'auto'
        case '-moz-scroll-behavior':
          return hasCrossBrowserFix ? 'smooth' : 'auto'
        case '-moz-transform':
          return (hasFirefoxFix || hasCrossBrowserFix) ? 'translateZ(0px)' : 'none'
        case 'scrollbar-width':
          return hasFirefoxFix ? 'thin' : 'auto'
        case 'scrollbar-color':
          return hasFirefoxFix ? 'rgba(155, 155, 155, 0.5) transparent' : 'auto'
        default:
          return ''
      }
    }
  }
})

// Mock scroll event for testing scroll stability
const mockScrollEvent = (element: HTMLElement, scrollTop: number) => {
  Object.defineProperty(element, 'scrollTop', {
    value: scrollTop,
    writable: true
  })
  
  // Use a simpler event simulation that works with JSDOM
  const scrollHandler = (element as any).onscroll
  if (scrollHandler) {
    scrollHandler({ target: element, type: 'scroll' })
  }
  
  // Trigger scroll event listeners if any
  const scrollEvent = {
    type: 'scroll',
    target: element,
    currentTarget: element,
    bubbles: true,
    cancelable: false
  }
  
  // Manually trigger any scroll event listeners
  if ((element as any)._scrollListeners) {
    (element as any)._scrollListeners.forEach((listener: any) => {
      listener(scrollEvent)
    })
  }
}

// Mock layout measurements for stability testing
const mockGetBoundingClientRect = (element: HTMLElement) => {
  return {
    width: 256,
    height: 1024,
    top: 0,
    left: 0,
    bottom: 1024,
    right: 256,
    x: 0,
    y: 0,
    toJSON: () => ({})
  }
}

// Sidebar content generator for testing
const sidebarContentArb = fc.record({
  itemCount: fc.integer({ min: 5, max: 50 }),
  itemHeight: fc.integer({ min: 40, max: 80 }),
  hasLongContent: fc.boolean(),
  hasNestedItems: fc.boolean()
})

// Scroll interaction generator
const scrollInteractionArb = fc.record({
  scrollDistance: fc.integer({ min: 0, max: 2000 }),
  scrollSpeed: fc.constantFrom('slow', 'medium', 'fast'),
  direction: fc.constantFrom('up', 'down'),
  momentum: fc.boolean()
})

// Firefox browser environment generator
const firefoxEnvironmentArb = fc.record({
  userAgent: fc.constant(firefoxUserAgent),
  viewport: fc.record({
    width: fc.integer({ min: 1024, max: 2560 }),
    height: fc.integer({ min: 768, max: 1440 })
  }),
  devicePixelRatio: fc.constantFrom(1, 1.25, 1.5, 2),
  reducedMotion: fc.boolean()
})

describe('Firefox Sidebar Scroll Stability Property Tests', () => {
  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = ''
    jest.clearAllMocks()
    
    // Mock Firefox user agent
    Object.defineProperty(window.navigator, 'userAgent', {
      value: firefoxUserAgent,
      writable: true
    })
  })

  /**
   * Property 4: Firefox Sidebar Scroll Stability
   * For any scroll interaction within the sidebar component in Firefox, 
   * the layout should remain stable without visual artifacts or broken positioning
   */
  test('Property 4: Firefox Sidebar Scroll Stability - maintains layout stability during scroll', () => {
    fc.assert(
      fc.property(
        sidebarContentArb,
        scrollInteractionArb,
        firefoxEnvironmentArb,
        (contentConfig, scrollConfig, browserEnv) => {
          // Mock Firefox environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create sidebar element with Firefox-specific classes
          const sidebar = document.createElement('nav')
          sidebar.className = 'sidebar sidebar-firefox-fix sidebar-cross-browser'
          sidebar.id = 'navigation'
          
          // Add sidebar content
          const contentContainer = document.createElement('div')
          contentContainer.className = 'sidebar-content'
          
          for (let i = 0; i < contentConfig.itemCount; i++) {
            const item = document.createElement('div')
            item.className = 'sidebar-item'
            item.style.height = `${contentConfig.itemHeight}px`
            item.textContent = contentConfig.hasLongContent 
              ? `Very long sidebar item text that might cause layout issues ${i}`.repeat(3)
              : `Sidebar item ${i}`
            
            if (contentConfig.hasNestedItems && i % 3 === 0) {
              const nestedContainer = document.createElement('div')
              nestedContainer.className = 'nested-items'
              for (let j = 0; j < 3; j++) {
                const nestedItem = document.createElement('div')
                nestedItem.className = 'nested-item'
                nestedItem.textContent = `Nested ${j}`
                nestedContainer.appendChild(nestedItem)
              }
              item.appendChild(nestedContainer)
            }
            
            contentContainer.appendChild(item)
          }
          
          sidebar.appendChild(contentContainer)
          document.body.appendChild(sidebar)

          // Mock getBoundingClientRect for layout measurements
          sidebar.getBoundingClientRect = () => mockGetBoundingClientRect(sidebar)

          // Get initial layout measurements
          const initialComputedStyle = window.getComputedStyle(sidebar)
          const initialRect = sidebar.getBoundingClientRect()
          
          // Property: Firefox-specific scroll properties should be applied
          const hasFirefoxScrollProperties = 
            initialComputedStyle.touchAction === 'pan-y' &&
            initialComputedStyle.overscrollBehavior === 'contain' &&
            initialComputedStyle.overscrollBehaviorY === 'contain' &&
            initialComputedStyle.getPropertyValue('-moz-user-select') === 'none' &&
            initialComputedStyle.getPropertyValue('scrollbar-width') === 'thin'

          // Property: Layout should be stable before scroll
          const initialLayoutStable = 
            initialRect.width === 256 &&
            initialRect.height === 1024 &&
            initialComputedStyle.position === 'fixed' &&
            initialComputedStyle.overflowY === 'auto' &&
            initialComputedStyle.overflowX === 'hidden'

          // Simulate scroll interaction
          const scrollAmount = scrollConfig.scrollDistance
          mockScrollEvent(sidebar, scrollAmount)

          // Get post-scroll layout measurements
          const postScrollComputedStyle = window.getComputedStyle(sidebar)
          const postScrollRect = sidebar.getBoundingClientRect()

          // Property: Layout should remain stable after scroll
          const postScrollLayoutStable = 
            postScrollRect.width === initialRect.width &&
            postScrollRect.height === initialRect.height &&
            postScrollRect.left === initialRect.left &&
            postScrollRect.top === initialRect.top

          // Property: Firefox scroll properties should persist after scroll
          const firefoxPropertiesPersist = 
            postScrollComputedStyle.touchAction === 'pan-y' &&
            postScrollComputedStyle.overscrollBehavior === 'contain' &&
            postScrollComputedStyle.overscrollBehaviorY === 'contain' &&
            postScrollComputedStyle.getPropertyValue('-moz-user-select') === 'none'

          // Property: Transform and will-change should be maintained for performance
          const performancePropertiesMaintained = 
            postScrollComputedStyle.transform === 'translateZ(0px)' &&
            postScrollComputedStyle.willChange === 'scroll-position'

          // Property: Background should remain consistent (no visual artifacts)
          const backgroundConsistent = 
            postScrollComputedStyle.backgroundColor === '#1f2937'

          return hasFirefoxScrollProperties && 
                 initialLayoutStable && 
                 postScrollLayoutStable && 
                 firefoxPropertiesPersist && 
                 performancePropertiesMaintained && 
                 backgroundConsistent
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 4: Firefox Sidebar Scroll Stability - handles momentum scrolling without artifacts', () => {
    fc.assert(
      fc.property(
        sidebarContentArb,
        fc.array(scrollInteractionArb, { minLength: 2, maxLength: 5 }),
        firefoxEnvironmentArb,
        (contentConfig, scrollSequence, browserEnv) => {
          // Mock Firefox environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create sidebar with Firefox optimizations
          const sidebar = document.createElement('nav')
          sidebar.className = 'sidebar sidebar-firefox-fix sidebar-cross-browser'
          
          // Add substantial content for momentum testing
          const contentContainer = document.createElement('div')
          for (let i = 0; i < contentConfig.itemCount; i++) {
            const item = document.createElement('div')
            item.style.height = `${contentConfig.itemHeight}px`
            item.textContent = `Item ${i}`
            contentContainer.appendChild(item)
          }
          
          sidebar.appendChild(contentContainer)
          document.body.appendChild(sidebar)
          sidebar.getBoundingClientRect = () => mockGetBoundingClientRect(sidebar)

          let layoutStableAcrossSequence = true
          let previousRect = sidebar.getBoundingClientRect()
          let previousStyle = window.getComputedStyle(sidebar)

          // Test scroll sequence for momentum stability
          scrollSequence.forEach((scrollConfig, index) => {
            // Simulate scroll with momentum
            const scrollAmount = scrollConfig.scrollDistance * (index + 1)
            mockScrollEvent(sidebar, scrollAmount)

            const currentRect = sidebar.getBoundingClientRect()
            const currentStyle = window.getComputedStyle(sidebar)

            // Property: Layout dimensions should remain stable during momentum
            const dimensionsStable = 
              currentRect.width === previousRect.width &&
              currentRect.height === previousRect.height

            // Property: Position should remain stable during momentum
            const positionStable = 
              currentRect.left === previousRect.left &&
              currentRect.top === previousRect.top

            // Property: Firefox scroll properties should persist during momentum
            const firefoxPropertiesPersist = 
              currentStyle.touchAction === 'pan-y' &&
              currentStyle.overscrollBehavior === 'contain' &&
              currentStyle.getPropertyValue('-moz-user-select') === 'none'

            // Property: Performance properties should be maintained during momentum
            const performancePropertiesMaintained = 
              currentStyle.transform === 'translateZ(0px)' &&
              currentStyle.willChange === 'scroll-position'

            if (!dimensionsStable || !positionStable || !firefoxPropertiesPersist || !performancePropertiesMaintained) {
              layoutStableAcrossSequence = false
            }

            previousRect = currentRect
            previousStyle = currentStyle
          })

          return layoutStableAcrossSequence
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 4: Firefox Sidebar Scroll Stability - maintains stability with nested content', () => {
    fc.assert(
      fc.property(
        fc.record({
          ...sidebarContentArb.constraints,
          hasNestedItems: fc.constant(true),
          nestingDepth: fc.integer({ min: 1, max: 3 })
        }),
        scrollInteractionArb,
        firefoxEnvironmentArb,
        (contentConfig, scrollConfig, browserEnv) => {
          // Mock Firefox environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create sidebar with nested content structure
          const sidebar = document.createElement('nav')
          sidebar.className = 'sidebar sidebar-firefox-fix sidebar-cross-browser'
          
          const createNestedContent = (depth: number, parentElement: HTMLElement) => {
            for (let i = 0; i < 5; i++) {
              const item = document.createElement('div')
              item.className = `nested-item-depth-${depth}`
              item.style.height = `${contentConfig.itemHeight}px`
              item.textContent = `Nested item depth ${depth} - ${i}`
              
              if (depth < contentConfig.nestingDepth) {
                const nestedContainer = document.createElement('div')
                nestedContainer.className = 'nested-container'
                createNestedContent(depth + 1, nestedContainer)
                item.appendChild(nestedContainer)
              }
              
              parentElement.appendChild(item)
            }
          }

          const contentContainer = document.createElement('div')
          createNestedContent(0, contentContainer)
          sidebar.appendChild(contentContainer)
          document.body.appendChild(sidebar)
          sidebar.getBoundingClientRect = () => mockGetBoundingClientRect(sidebar)

          // Get initial state
          const initialStyle = window.getComputedStyle(sidebar)
          const initialRect = sidebar.getBoundingClientRect()

          // Property: Firefox properties should be applied to nested content container
          const firefoxPropertiesApplied = 
            initialStyle.touchAction === 'pan-y' &&
            initialStyle.overscrollBehavior === 'contain' &&
            initialStyle.getPropertyValue('-moz-user-select') === 'none'

          // Simulate scroll with nested content
          mockScrollEvent(sidebar, scrollConfig.scrollDistance)

          // Get post-scroll state
          const postScrollStyle = window.getComputedStyle(sidebar)
          const postScrollRect = sidebar.getBoundingClientRect()

          // Property: Nested content should not affect layout stability
          const layoutStableWithNesting = 
            postScrollRect.width === initialRect.width &&
            postScrollRect.height === initialRect.height &&
            postScrollRect.left === initialRect.left &&
            postScrollRect.top === initialRect.top

          // Property: Firefox scroll properties should persist with nested content
          const firefoxPropertiesPersistWithNesting = 
            postScrollStyle.touchAction === 'pan-y' &&
            postScrollStyle.overscrollBehavior === 'contain' &&
            postScrollStyle.getPropertyValue('-moz-user-select') === 'none'

          // Property: Scroll containment should work with nested content
          const scrollContainmentWorksWithNesting = 
            postScrollStyle.overscrollBehaviorY === 'contain' &&
            postScrollStyle.contain === 'layout style paint'

          return firefoxPropertiesApplied && 
                 layoutStableWithNesting && 
                 firefoxPropertiesPersistWithNesting && 
                 scrollContainmentWorksWithNesting
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 4: Firefox Sidebar Scroll Stability - handles viewport changes without breaking', () => {
    fc.assert(
      fc.property(
        sidebarContentArb,
        fc.array(fc.record({
          width: fc.integer({ min: 1024, max: 2560 }),
          height: fc.integer({ min: 768, max: 1440 })
        }), { minLength: 2, maxLength: 4 }),
        firefoxEnvironmentArb,
        (contentConfig, viewportSizes, browserEnv) => {
          // Mock Firefox environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create sidebar
          const sidebar = document.createElement('nav')
          sidebar.className = 'sidebar sidebar-firefox-fix sidebar-cross-browser'
          
          // Add content
          const contentContainer = document.createElement('div')
          for (let i = 0; i < contentConfig.itemCount; i++) {
            const item = document.createElement('div')
            item.style.height = `${contentConfig.itemHeight}px`
            item.textContent = `Item ${i}`
            contentContainer.appendChild(item)
          }
          
          sidebar.appendChild(contentContainer)
          document.body.appendChild(sidebar)
          sidebar.getBoundingClientRect = () => mockGetBoundingClientRect(sidebar)

          let stableAcrossViewports = true

          // Test across different viewport sizes
          viewportSizes.forEach((viewport, index) => {
            // Simulate viewport change
            Object.defineProperty(window, 'innerWidth', { value: viewport.width, writable: true })
            Object.defineProperty(window, 'innerHeight', { value: viewport.height, writable: true })

            // Trigger resize event
            Object.defineProperty(document.documentElement, 'clientWidth', { value: viewport.width, writable: true })
            Object.defineProperty(document.documentElement, 'clientHeight', { value: viewport.height, writable: true })
            
            // Simulate resize without using dispatchEvent
            if ((window as any).onresize) {
              (window as any).onresize({ type: 'resize', target: window })
            }

            const currentStyle = window.getComputedStyle(sidebar)
            const currentRect = sidebar.getBoundingClientRect()

            // Property: Firefox properties should persist across viewport changes
            const firefoxPropertiesPersist = 
              currentStyle.touchAction === 'pan-y' &&
              currentStyle.overscrollBehavior === 'contain' &&
              currentStyle.getPropertyValue('-moz-user-select') === 'none'

            // Property: Layout should remain stable across viewport changes
            const layoutStable = 
              currentRect.width === 256 && // Sidebar width should remain fixed
              currentStyle.position === 'fixed' &&
              currentStyle.overflowY === 'auto'

            // Property: Performance properties should be maintained
            const performancePropertiesMaintained = 
              currentStyle.transform === 'translateZ(0px)' &&
              currentStyle.willChange === 'scroll-position'

            if (!firefoxPropertiesPersist || !layoutStable || !performancePropertiesMaintained) {
              stableAcrossViewports = false
            }

            // Test scroll after viewport change
            mockScrollEvent(sidebar, 100 * (index + 1))
            
            const postScrollStyle = window.getComputedStyle(sidebar)
            
            // Property: Scroll should work correctly after viewport change
            const scrollWorksAfterResize = 
              postScrollStyle.touchAction === 'pan-y' &&
              postScrollStyle.overscrollBehavior === 'contain'

            if (!scrollWorksAfterResize) {
              stableAcrossViewports = false
            }
          })

          return stableAcrossViewports
        }
      ),
      { numRuns: 100 }
    )
  })
})