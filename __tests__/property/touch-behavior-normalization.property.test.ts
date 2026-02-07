/**
 * Property-Based Tests for Touch Behavior Normalization
 * Feature: cross-browser-compatibility, Property 10: Touch Behavior Normalization
 * **Validates: Requirements 6.1, 6.2, 6.4**
 */

import fc from 'fast-check'
import { JSDOM } from 'jsdom'
import CrossBrowserTouchHandler from '../../lib/utils/touch-handler'

// Setup JSDOM environment for touch behavior testing
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        .touch-test-element {
          width: 200px;
          height: 200px;
          background-color: #f0f0f0;
          border: 1px solid #ccc;
          position: relative;
          overflow: auto;
        }
        
        .touch-content {
          width: 100%;
          height: 400px;
          background: linear-gradient(to bottom, #fff, #eee);
        }
      </style>
    </head>
    <body></body>
  </html>
`, {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
})

global.window = dom.window as any
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement

// Mock Touch, TouchEvent, and TouchList for JSDOM compatibility
class MockTouch implements Touch {
  constructor(
    public identifier: number,
    public target: EventTarget,
    public clientX: number = 0,
    public clientY: number = 0,
    public screenX: number = 0,
    public screenY: number = 0,
    public pageX: number = 0,
    public pageY: number = 0,
    public radiusX: number = 1,
    public radiusY: number = 1,
    public rotationAngle: number = 0,
    public force: number = 1
  ) {}
}

class MockTouchList implements TouchList {
  private touches: Touch[]

  constructor(touches: Touch[] = []) {
    this.touches = touches
  }

  get length(): number {
    return this.touches.length
  }

  item(index: number): Touch | null {
    return this.touches[index] || null
  }

  [index: number]: Touch

  [Symbol.iterator](): Iterator<Touch> {
    let index = 0
    const touches = this.touches
    return {
      next(): IteratorResult<Touch> {
        if (index < touches.length) {
          return { value: touches[index++], done: false }
        }
        return { value: undefined as any, done: true }
      }
    }
  }
}

class MockTouchEvent extends Event implements TouchEvent {
  public touches: TouchList
  public targetTouches: TouchList
  public changedTouches: TouchList
  public altKey: boolean = false
  public metaKey: boolean = false
  public ctrlKey: boolean = false
  public shiftKey: boolean = false

  constructor(type: string, init?: TouchEventInit) {
    super(type, init)
    this.touches = new MockTouchList(init?.touches || [])
    this.targetTouches = new MockTouchList(init?.targetTouches || [])
    this.changedTouches = new MockTouchList(init?.changedTouches || [])
  }
}

// Add Touch, TouchEvent, and TouchList to global scope
;(global as any).Touch = MockTouch
;(global as any).TouchEvent = MockTouchEvent
;(global as any).TouchList = MockTouchList

// Add touch event properties to TouchEvent prototype for capability detection
Object.defineProperty(MockTouchEvent.prototype, 'force', {
  value: 1,
  writable: true,
  enumerable: true,
  configurable: true
})

Object.defineProperty(MockTouchEvent.prototype, 'radiusX', {
  value: 1,
  writable: true,
  enumerable: true,
  configurable: true
})

Object.defineProperty(MockTouchEvent.prototype, 'radiusY', {
  value: 1,
  writable: true,
  enumerable: true,
  configurable: true
})

Object.defineProperty(MockTouchEvent.prototype, 'rotationAngle', {
  value: 0,
  writable: true,
  enumerable: true,
  configurable: true
})

// Mock browser user agents for iOS Safari and Android Chrome
const mobileUserAgents = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  iPadSafari: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidFirefox: 'Mozilla/5.0 (Mobile; rv:120.0) Gecko/120.0 Firefox/120.0'
}

// Mock touch capabilities
const mockTouchCapabilities = {
  iosSafari: {
    maxTouchPoints: 5,
    supportsForce: true,
    supportsRadius: true,
    supportsRotation: false
  },
  androidChrome: {
    maxTouchPoints: 10,
    supportsForce: false,
    supportsRadius: true,
    supportsRotation: false
  },
  iPadSafari: {
    maxTouchPoints: 11,
    supportsForce: true,
    supportsRadius: true,
    supportsRotation: false
  },
  androidFirefox: {
    maxTouchPoints: 5,
    supportsForce: false,
    supportsRadius: false,
    supportsRotation: false
  }
}

// Mock navigator properties
const mockNavigator = (browserType: keyof typeof mobileUserAgents) => {
  const capabilities = mockTouchCapabilities[browserType]
  
  Object.defineProperty(window.navigator, 'userAgent', {
    value: mobileUserAgents[browserType],
    writable: true
  })
  
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    value: capabilities.maxTouchPoints,
    writable: true
  })
  
  Object.defineProperty(window.navigator, 'vendor', {
    value: browserType.includes('Safari') ? 'Apple Computer, Inc.' : 'Google Inc.',
    writable: true
  })
}

// Mock getComputedStyle for touch behavior testing
global.getComputedStyle = jest.fn().mockImplementation((element: Element) => {
  if (!element.isConnected) {
    throw new TypeError("The provided value is not of type 'Element'.")
  }

  const style = (element as HTMLElement).style

  return {
    // Touch action properties
    touchAction: style.touchAction || 'auto',
    
    // Overscroll behavior
    overscrollBehavior: style.overscrollBehavior || 'auto',
    overscrollBehaviorY: style.overscrollBehaviorY || 'auto',
    
    // User select
    userSelect: style.userSelect || 'auto',
    webkitUserSelect: style.webkitUserSelect || 'auto',
    mozUserSelect: style.mozUserSelect || 'auto',
    msUserSelect: style.msUserSelect || 'auto',
    
    // Transform and hardware acceleration
    transform: style.transform || 'none',
    webkitTransform: style.webkitTransform || 'none',
    willChange: style.willChange || 'auto',
    
    // iOS specific
    webkitOverflowScrolling: style.webkitOverflowScrolling || 'auto',
    webkitTouchCallout: style.webkitTouchCallout || 'default',
    webkitTapHighlightColor: style.webkitTapHighlightColor || 'rgba(0,0,0,0)',
    
    // Dimensions and positioning
    width: style.width || '200px',
    height: style.height || '200px',
    minWidth: style.minWidth || '0px',
    minHeight: style.minHeight || '0px',
    padding: style.padding || '0px',
    position: style.position || 'static',
    boxSizing: style.boxSizing || 'content-box',
    
    getPropertyValue: (property: string) => {
      switch (property) {
        case '-ms-touch-action':
          return style.msTouchAction || 'auto'
        case '-webkit-overflow-scrolling':
          return style.webkitOverflowScrolling || 'auto'
        case '-webkit-touch-callout':
          return style.webkitTouchCallout || 'default'
        case '-webkit-user-select':
          return style.webkitUserSelect || 'auto'
        case '-moz-user-select':
          return style.mozUserSelect || 'auto'
        case '-ms-user-select':
          return style.msUserSelect || 'auto'
        case '-webkit-tap-highlight-color':
          return style.webkitTapHighlightColor || 'rgba(0,0,0,0)'
        default:
          return ''
      }
    }
  }
})

// Touch options generator
const touchOptionsArb = fc.record({
  preventDefaultScroll: fc.boolean(),
  enableMomentumScrolling: fc.boolean(),
  enableHardwareAcceleration: fc.boolean(),
  normalizeTouchEvents: fc.boolean(),
  applyBrowserOptimizations: fc.boolean(),
  enableTouchFeedback: fc.boolean(),
  preventViewportScaling: fc.boolean(),
  minTouchTargetSize: fc.integer({ min: 32, max: 64 })
})

// Browser environment generator
const browserEnvironmentArb = fc.record({
  browserType: fc.constantFrom('iosSafari', 'androidChrome', 'iPadSafari', 'androidFirefox'),
  devicePixelRatio: fc.constantFrom(1, 1.5, 2, 3),
  screenWidth: fc.integer({ min: 320, max: 1024 }),
  screenHeight: fc.integer({ min: 568, max: 1366 }),
  orientation: fc.constantFrom('portrait', 'landscape')
})

describe('Touch Behavior Normalization Property Tests', () => {
  beforeEach(() => {
    // Clear document body and reset mocks
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  /**
   * Property 10: Touch Behavior Normalization
   * For any touch interaction on mobile browsers, the touch handler should apply
   * the expected optimizations when options are enabled
   */
  test('Property 10: Touch Behavior Normalization - touch optimizations are applied when enabled', () => {
    fc.assert(
      fc.property(
        touchOptionsArb,
        browserEnvironmentArb,
        (touchOptions, browserEnv) => {
          // Mock browser environment
          mockNavigator(browserEnv.browserType as keyof typeof mobileUserAgents)
          
          Object.defineProperty(window, 'devicePixelRatio', {
            value: browserEnv.devicePixelRatio,
            writable: true
          })

          // Create test element
          const element = document.createElement('div')
          element.className = 'touch-test-element'
          
          const content = document.createElement('div')
          content.className = 'touch-content'
          element.appendChild(content)
          
          document.body.appendChild(element)

          // Apply cross-browser touch handler
          const touchHandler = new CrossBrowserTouchHandler(element, touchOptions)

          // Check applied styles
          const computedStyle = window.getComputedStyle(element)
          
          // Property: Touch action should be applied when scroll prevention is enabled
          // Note: Touch action is applied in both browser-specific and general optimizations
          const touchActionCorrect = !touchOptions.preventDefaultScroll || 
            computedStyle.touchAction === 'pan-y'

          // Property: Hardware acceleration should be applied when enabled
          const hardwareAccelerationCorrect = !touchOptions.enableHardwareAcceleration ||
            (computedStyle.transform !== 'none' || 
             computedStyle.webkitTransform !== 'none' ||
             computedStyle.willChange !== 'auto')

          // Property: User select should be disabled (applied in general optimizations regardless of browser optimizations)
          const userSelectCorrect = 
            computedStyle.userSelect === 'none' ||
            computedStyle.webkitUserSelect === 'none' ||
            computedStyle.mozUserSelect === 'none'

          // Cleanup
          touchHandler.cleanup()

          return touchActionCorrect && 
                 hardwareAccelerationCorrect && 
                 userSelectCorrect
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 10: Touch Behavior Normalization - iOS Safari specific optimizations', () => {
    fc.assert(
      fc.property(
        touchOptionsArb,
        (touchOptions) => {
          // Mock iOS Safari environment
          mockNavigator('iosSafari')

          // Create test element
          const element = document.createElement('div')
          element.className = 'touch-test-element'
          document.body.appendChild(element)

          // Apply touch handler with iOS optimizations
          const touchHandler = new CrossBrowserTouchHandler(element, touchOptions)
          const computedStyle = window.getComputedStyle(element)

          // Property: iOS Safari should have momentum scrolling enabled when requested
          const momentumScrollingEnabled = !touchOptions.enableMomentumScrolling || 
            !touchOptions.applyBrowserOptimizations ||
            computedStyle.webkitOverflowScrolling === 'touch'

          // Property: iOS Safari should have touch callout disabled when browser optimizations are enabled
          const touchCalloutDisabled = !touchOptions.applyBrowserOptimizations ||
            (computedStyle.webkitTouchCallout === 'none' ||
             computedStyle.getPropertyValue('-webkit-touch-callout') === 'none')

          // Property: iOS Safari should have tap highlight removed when browser optimizations are enabled
          const tapHighlightRemoved = !touchOptions.applyBrowserOptimizations ||
            (computedStyle.webkitTapHighlightColor === 'transparent' ||
             computedStyle.getPropertyValue('-webkit-tap-highlight-color') === 'transparent')

          // Property: iOS Safari should have hardware acceleration for touch when enabled
          const hardwareAccelerationApplied = !touchOptions.enableHardwareAcceleration ||
            (computedStyle.webkitTransform !== 'none' || 
             computedStyle.transform !== 'none')

          // Property: iOS Safari should prevent text selection during touch when browser optimizations are enabled
          const textSelectionPrevented = !touchOptions.applyBrowserOptimizations ||
            (computedStyle.webkitUserSelect === 'none' ||
             computedStyle.userSelect === 'none')

          // Cleanup
          touchHandler.cleanup()

          return momentumScrollingEnabled && 
                 touchCalloutDisabled && 
                 tapHighlightRemoved && 
                 hardwareAccelerationApplied && 
                 textSelectionPrevented
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 10: Touch Behavior Normalization - Android Chrome specific optimizations', () => {
    fc.assert(
      fc.property(
        touchOptionsArb,
        (touchOptions) => {
          // Mock Android Chrome environment
          mockNavigator('androidChrome')

          // Create test element
          const element = document.createElement('div')
          element.className = 'touch-test-element'
          document.body.appendChild(element)

          // Apply touch handler with Android Chrome optimizations
          const touchHandler = new CrossBrowserTouchHandler(element, touchOptions)
          const computedStyle = window.getComputedStyle(element)

          // Property: Android Chrome should have overscroll behavior contained when browser optimizations are enabled
          const overscrollBehaviorContained = !touchOptions.applyBrowserOptimizations ||
            (computedStyle.overscrollBehavior === 'contain' ||
             computedStyle.overscrollBehaviorY === 'contain')

          // Property: Touch action should be applied when scroll prevention is enabled (applied in general optimizations too)
          const touchActionOptimized = !touchOptions.preventDefaultScroll ||
            computedStyle.touchAction === 'pan-y'

          // Property: Android Chrome should have performance optimizations when hardware acceleration is enabled
          const performanceOptimized = !touchOptions.enableHardwareAcceleration ||
            (computedStyle.willChange !== 'auto' || 
             computedStyle.transform !== 'none')

          // Property: Tap highlight should be removed when browser optimizations are enabled
          const tapHighlightRemoved = !touchOptions.applyBrowserOptimizations ||
            (computedStyle.webkitTapHighlightColor === 'transparent' ||
             computedStyle.getPropertyValue('-webkit-tap-highlight-color') === 'transparent')

          // Cleanup
          touchHandler.cleanup()

          return overscrollBehaviorContained && 
                 touchActionOptimized && 
                 performanceOptimized && 
                 tapHighlightRemoved
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 10: Touch Behavior Normalization - minimum touch target size enforcement', () => {
    fc.assert(
      fc.property(
        fc.record({
          initialWidth: fc.integer({ min: 10, max: 100 }),
          initialHeight: fc.integer({ min: 10, max: 100 }),
          minTouchTargetSize: fc.integer({ min: 32, max: 64 })
        }),
        browserEnvironmentArb,
        (elementConfig, browserEnv) => {
          // Mock mobile browser environment
          mockNavigator(browserEnv.browserType as keyof typeof mobileUserAgents)

          // Create test element with specific dimensions
          const element = document.createElement('button')
          element.style.width = `${elementConfig.initialWidth}px`
          element.style.height = `${elementConfig.initialHeight}px`
          element.style.padding = '0'
          element.style.margin = '0'
          element.style.border = 'none'
          document.body.appendChild(element)

          // Apply touch handler with minimum touch target size
          const touchHandler = new CrossBrowserTouchHandler(element, {
            minTouchTargetSize: elementConfig.minTouchTargetSize
          })

          const computedStyle = window.getComputedStyle(element)

          // Property: Element should meet minimum touch target size requirements
          const minWidthEnforced = 
            parseInt(computedStyle.minWidth) >= elementConfig.minTouchTargetSize ||
            parseInt(computedStyle.width) >= elementConfig.minTouchTargetSize ||
            elementConfig.initialWidth >= elementConfig.minTouchTargetSize

          const minHeightEnforced = 
            parseInt(computedStyle.minHeight) >= elementConfig.minTouchTargetSize ||
            parseInt(computedStyle.height) >= elementConfig.minTouchTargetSize ||
            elementConfig.initialHeight >= elementConfig.minTouchTargetSize

          // Property: Touch target should be accessible (either meets size or has padding)
          const touchTargetAccessible = minWidthEnforced && minHeightEnforced

          // Cleanup
          touchHandler.cleanup()

          return touchTargetAccessible
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 10: Touch Behavior Normalization - dynamic option updates preserve consistency', () => {
    fc.assert(
      fc.property(
        touchOptionsArb,
        touchOptionsArb,
        browserEnvironmentArb,
        (initialOptions, updatedOptions, browserEnv) => {
          // Mock browser environment
          mockNavigator(browserEnv.browserType as keyof typeof mobileUserAgents)

          // Create test element
          const element = document.createElement('div')
          element.className = 'touch-test-element'
          document.body.appendChild(element)

          // Apply initial touch handler
          const touchHandler = new CrossBrowserTouchHandler(element, initialOptions)

          // Update options
          touchHandler.updateOptions(updatedOptions)

          // Get updated computed styles
          const updatedStyle = window.getComputedStyle(element)

          // Property: Touch action should reflect updated options
          const touchActionUpdatedCorrectly = !updatedOptions.preventDefaultScroll ||
            updatedStyle.touchAction === 'pan-y'

          // Property: Hardware acceleration should reflect updated options
          const hardwareAccelerationUpdatedCorrectly = !updatedOptions.enableHardwareAcceleration ||
            (updatedStyle.transform !== 'none' || 
             updatedStyle.webkitTransform !== 'none' ||
             updatedStyle.willChange !== 'auto')

          // Property: Minimum touch target size should reflect updated options
          const minTouchTargetSizeUpdatedCorrectly = 
            parseInt(updatedStyle.minWidth) >= (updatedOptions.minTouchTargetSize || 44) ||
            parseInt(updatedStyle.minHeight) >= (updatedOptions.minTouchTargetSize || 44) ||
            parseInt(updatedStyle.width) >= (updatedOptions.minTouchTargetSize || 44) ||
            parseInt(updatedStyle.height) >= (updatedOptions.minTouchTargetSize || 44)

          // Property: Browser-specific optimizations should be consistent after update
          let browserOptimizationsConsistent = true
          if (updatedOptions.applyBrowserOptimizations) {
            if (browserEnv.browserType === 'iosSafari') {
              browserOptimizationsConsistent = 
                !updatedOptions.enableMomentumScrolling ||
                updatedStyle.webkitOverflowScrolling === 'touch' ||
                updatedStyle.getPropertyValue('-webkit-overflow-scrolling') === 'touch'
            } else if (browserEnv.browserType === 'androidChrome') {
              browserOptimizationsConsistent = 
                updatedStyle.overscrollBehavior === 'contain' ||
                updatedStyle.overscrollBehaviorY === 'contain'
            }
          }

          // Cleanup
          touchHandler.cleanup()

          return touchActionUpdatedCorrectly && 
                 hardwareAccelerationUpdatedCorrectly && 
                 minTouchTargetSizeUpdatedCorrectly && 
                 browserOptimizationsConsistent
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 10: Touch Behavior Normalization - touch support detection', () => {
    fc.assert(
      fc.property(
        browserEnvironmentArb,
        (browserEnv) => {
          // Mock browser environment
          mockNavigator(browserEnv.browserType as keyof typeof mobileUserAgents)

          // Mock touch support
          Object.defineProperty(window, 'ontouchstart', {
            value: {},
            writable: true
          })

          // Property: Touch support should be detected correctly
          const touchSupported = CrossBrowserTouchHandler.isTouchSupported()

          // Property: Touch capabilities should be available
          const element = document.createElement('div')
          document.body.appendChild(element)
          const touchHandler = new CrossBrowserTouchHandler(element)
          const capabilities = touchHandler.getTouchCapabilities()

          const capabilitiesValid = 
            typeof capabilities.maxTouchPoints === 'number' &&
            typeof capabilities.supportsForce === 'boolean' &&
            typeof capabilities.supportsRadius === 'boolean' &&
            typeof capabilities.supportsRotation === 'boolean'

          // Property: Touch-optimized classes should be generated
          const touchClasses = touchHandler.getTouchOptimizedClasses()
          const classesValid = touchClasses.includes('touch-optimized')

          // Cleanup
          touchHandler.cleanup()

          return touchSupported && capabilitiesValid && classesValid
        }
      ),
      { numRuns: 100 }
    )
  })
})