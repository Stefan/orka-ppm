/**
 * Property-Based Test: Feature Detection Accuracy
 * Feature: cross-browser-compatibility, Property 8: Feature Detection Accuracy
 * Validates: Requirements 5.1, 5.3, 5.4
 */

import fc from 'fast-check'
import { detectBrowser, BrowserInfo } from '../../lib/utils/browser/browser-detection'

// Mock DOM APIs for testing
const mockWindow = {
  IntersectionObserver: undefined as any,
  fetch: undefined as any,
  CSS: {
    supports: jest.fn()
  }
}

// Mock navigator for different browsers
const createMockNavigator = (userAgent: string, vendor: string = '') => ({
  userAgent,
  vendor
})

// Browser user agent generators
const chromeUserAgentArb = fc.string().map(version => 
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 50) + 80}.0.0.0 Safari/537.36`
)

const firefoxUserAgentArb = fc.string().map(version => 
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${Math.floor(Math.random() * 30) + 88}.0) Gecko/20100101 Firefox/${Math.floor(Math.random() * 30) + 88}.0`
)

const safariUserAgentArb = fc.string().map(version => 
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${Math.floor(Math.random() * 5) + 14}.0.0 Safari/605.1.15`
)

const edgeUserAgentArb = fc.string().map(version => 
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 20) + 90}.0.0.0 Safari/537.36 Edg/${Math.floor(Math.random() * 20) + 90}.0.0.0`
)

const browserTestArb = fc.oneof(
  chromeUserAgentArb.map(ua => ({ userAgent: ua, vendor: 'Google Inc.', expectedName: 'chrome' as const })),
  firefoxUserAgentArb.map(ua => ({ userAgent: ua, vendor: '', expectedName: 'firefox' as const })),
  safariUserAgentArb.map(ua => ({ userAgent: ua, vendor: 'Apple Computer, Inc.', expectedName: 'safari' as const })),
  edgeUserAgentArb.map(ua => ({ userAgent: ua, vendor: '', expectedName: 'edge' as const }))
)

const featureTestArb = fc.record({
  intersectionObserver: fc.boolean(),
  fetch: fc.boolean(),
  flexbox: fc.boolean(),
  grid: fc.boolean(),
  customProperties: fc.boolean(),
  overscrollBehavior: fc.boolean(),
  touchAction: fc.boolean(),
  scrollBehavior: fc.boolean(),
  contain: fc.boolean(),
  willChange: fc.boolean()
})

describe('Feature Detection Accuracy Property Tests', () => {
  let originalWindow: any
  let originalNavigator: any
  let originalCSS: any

  beforeEach(() => {
    // Store original globals
    originalWindow = global.window
    originalNavigator = global.navigator
    originalCSS = global.CSS

    // Setup mock window with proper CSS.supports mock
    const mockCSSSupports = jest.fn().mockReturnValue(false)
    const mockCSS = {
      supports: mockCSSSupports
    }
    
    global.window = {
      IntersectionObserver: undefined,
      fetch: undefined,
      CSS: mockCSS
    } as any
    
    // Also set global CSS for direct access
    global.CSS = mockCSS
  })

  afterEach(() => {
    // Restore original globals
    global.window = originalWindow
    global.navigator = originalNavigator
    global.CSS = originalCSS
    jest.clearAllMocks()
  })

  /**
   * Property 8: Feature Detection Accuracy
   * For any browser API or feature, the feature detection function should correctly 
   * identify support status before attempting to use the feature
   */
  test('Property 8: Feature detection should accurately identify browser capabilities', () => {
    fc.assert(
      fc.property(
        browserTestArb,
        featureTestArb,
        (browserTest, featureSupport) => {
          // Setup mock navigator
          global.navigator = createMockNavigator(browserTest.userAgent, browserTest.vendor) as any

          // Setup mock window with fresh CSS.supports mock
          const mockCSSSupports = jest.fn()
          
          // Create a proper CSS mock object
          const mockCSS = {
            supports: mockCSSSupports
          }
          
          global.window = {
            IntersectionObserver: undefined,
            fetch: undefined,
            CSS: mockCSS
          } as any
          
          // Also set global CSS for direct access
          global.CSS = mockCSS

          // Setup mock feature support
          if (featureSupport.intersectionObserver) {
            (global.window as any).IntersectionObserver = class MockIntersectionObserver {}
          } else {
            delete (global.window as any).IntersectionObserver
          }

          if (featureSupport.fetch) {
            (global.window as any).fetch = jest.fn()
          } else {
            delete (global.window as any).fetch
          }

          // Mock CSS.supports for CSS features
          mockCSSSupports.mockImplementation((property: string, value?: string) => {
            if (property === 'display' && value === 'flex') return featureSupport.flexbox
            if (property === 'display' && value === 'grid') return featureSupport.grid
            if (property === '--custom' && value === 'property') return featureSupport.customProperties
            if (property === 'overscroll-behavior' && value === 'contain') return featureSupport.overscrollBehavior
            if (property === 'touch-action' && value === 'pan-y') return featureSupport.touchAction
            if (property === 'scroll-behavior' && value === 'smooth') return featureSupport.scrollBehavior
            if (property === 'contain' && value === 'layout') return featureSupport.contain
            if (property === 'will-change' && value === 'scroll-position') return featureSupport.willChange
            return false
          })

          // Test browser detection
          const browser = detectBrowser()

          // Verify browser detection accuracy
          expect(browser.name).toBe(browserTest.expectedName)
          expect(typeof browser.version).toBe('number')
          expect(typeof browser.isMobile).toBe('boolean')
          expect(typeof browser.supportsFeature).toBe('function')

          // Test feature detection accuracy
          expect(browser.supportsFeature('intersectionObserver')).toBe(featureSupport.intersectionObserver)
          expect(browser.supportsFeature('fetch')).toBe(featureSupport.fetch)
          expect(browser.supportsFeature('flexbox')).toBe(featureSupport.flexbox)
          expect(browser.supportsFeature('grid')).toBe(featureSupport.grid)
          expect(browser.supportsFeature('customProperties')).toBe(featureSupport.customProperties)
          expect(browser.supportsFeature('overscrollBehavior')).toBe(featureSupport.overscrollBehavior)
          expect(browser.supportsFeature('touchAction')).toBe(featureSupport.touchAction)
          expect(browser.supportsFeature('scrollBehavior')).toBe(featureSupport.scrollBehavior)
          expect(browser.supportsFeature('contain')).toBe(featureSupport.contain)
          expect(browser.supportsFeature('willChange')).toBe(featureSupport.willChange)

          // Verify unknown features return false
          expect(browser.supportsFeature('unknownFeature')).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 8: Browser detection should handle server-side rendering safely', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          // Simulate server-side rendering
          delete (global as any).window
          delete (global as any).navigator

          const browser = detectBrowser()

          // Should return safe defaults for SSR
          expect(browser.name).toBe('unknown')
          expect(browser.version).toBe(0)
          expect(browser.isMobile).toBe(false)
          expect(browser.supportsFeature('intersectionObserver')).toBe(false)
          expect(browser.supportsFeature('fetch')).toBe(false)
          expect(browser.supportsFeature('flexbox')).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 8: Feature detection should be consistent across multiple calls', () => {
    fc.assert(
      fc.property(
        browserTestArb,
        featureTestArb,
        (browserTest, featureSupport) => {
          // Setup environment
          global.navigator = createMockNavigator(browserTest.userAgent, browserTest.vendor) as any
          
          // Setup fresh window mock
          const mockCSSSupports = jest.fn()
          
          // Create a proper CSS mock object
          const mockCSS = {
            supports: mockCSSSupports
          }
          
          global.window = {
            IntersectionObserver: undefined,
            fetch: undefined,
            CSS: mockCSS
          } as any
          
          // Also set global CSS for direct access
          global.CSS = mockCSS
          
          if (featureSupport.intersectionObserver) {
            (global.window as any).IntersectionObserver = class MockIntersectionObserver {}
          }
          
          if (featureSupport.fetch) {
            (global.window as any).fetch = jest.fn()
          }

          mockCSSSupports.mockImplementation((property: string, value?: string) => {
            if (property === 'display' && value === 'flex') return featureSupport.flexbox
            if (property === 'display' && value === 'grid') return featureSupport.grid
            return false
          })

          // Multiple calls should return consistent results
          const browser1 = detectBrowser()
          const browser2 = detectBrowser()

          expect(browser1.name).toBe(browser2.name)
          expect(browser1.version).toBe(browser2.version)
          expect(browser1.isMobile).toBe(browser2.isMobile)
          
          // Feature detection should be consistent
          expect(browser1.supportsFeature('intersectionObserver')).toBe(browser2.supportsFeature('intersectionObserver'))
          expect(browser1.supportsFeature('fetch')).toBe(browser2.supportsFeature('fetch'))
          expect(browser1.supportsFeature('flexbox')).toBe(browser2.supportsFeature('flexbox'))
          expect(browser1.supportsFeature('grid')).toBe(browser2.supportsFeature('grid'))
        }
      ),
      { numRuns: 100 }
    )
  })
})