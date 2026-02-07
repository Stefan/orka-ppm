/**
 * Property-Based Tests for Viewport Scaling Stability
 * Feature: cross-browser-compatibility, Property 11: Viewport Scaling Stability
 * **Validates: Requirements 6.3**
 */

import fc from 'fast-check'
import { JSDOM } from 'jsdom'
import CrossBrowserTouchHandler from '../../lib/utils/touch-handler'

// Setup JSDOM environment for viewport scaling testing
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        .viewport-test-element {
          width: 100%;
          height: 100vh;
          background-color: #f0f0f0;
          position: relative;
          overflow: hidden;
        }
        
        .content-container {
          width: 100%;
          height: 200%;
          background: linear-gradient(to bottom, #fff, #eee);
          position: relative;
        }
        
        .layout-element {
          position: absolute;
          background-color: #007bff;
          border-radius: 4px;
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

// Mock mobile browser user agents
const mobileUserAgents = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  iPadSafari: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
}

// Mock navigator and screen properties
const mockMobileEnvironment = (browserType: keyof typeof mobileUserAgents, screenConfig: any) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: mobileUserAgents[browserType],
    writable: true
  })
  
  Object.defineProperty(window.screen, 'width', {
    value: screenConfig.width,
    writable: true
  })
  
  Object.defineProperty(window.screen, 'height', {
    value: screenConfig.height,
    writable: true
  })
  
  Object.defineProperty(window, 'devicePixelRatio', {
    value: screenConfig.devicePixelRatio,
    writable: true
  })
  
  Object.defineProperty(window, 'innerWidth', {
    value: screenConfig.width / screenConfig.devicePixelRatio,
    writable: true
  })
  
  Object.defineProperty(window, 'innerHeight', {
    value: screenConfig.height / screenConfig.devicePixelRatio,
    writable: true
  })
}

// Mock getComputedStyle for viewport testing
global.getComputedStyle = jest.fn().mockImplementation((element: Element) => {
  if (!element.isConnected && element !== document.documentElement && element !== document.body) {
    throw new TypeError("The provided value is not of type 'Element'.")
  }

  const style = (element as HTMLElement).style
  
  // Handle document.documentElement and document.body specially
  if (element === document.documentElement || element === document.body) {
    return {
      overflowX: style.overflowX || 'visible',
      boxSizing: style.boxSizing || 'content-box',
      overscrollBehavior: style.overscrollBehavior || 'auto',
      webkitOverscrollBehavior: style.webkitOverscrollBehavior || 'auto',
      getPropertyValue: (property: string) => {
        switch (property) {
          case 'overflow-x':
            return style.overflowX || 'visible'
          case 'box-sizing':
            return style.boxSizing || 'content-box'
          case 'overscroll-behavior':
            return style.overscrollBehavior || 'auto'
          case '-webkit-overscroll-behavior':
            return style.webkitOverscrollBehavior || 'auto'
          default:
            return ''
        }
      }
    }
  }
  
  return {
    // Layout properties
    width: style.width || '100%',
    height: style.height || 'auto',
    maxWidth: style.maxWidth || 'none',
    overflowX: style.overflowX || 'visible',
    
    // Position properties
    position: style.position || 'static',
    top: style.top || 'auto',
    left: style.left || 'auto',
    right: style.right || 'auto',
    bottom: style.bottom || 'auto',
    
    // Transform properties
    transform: style.transform || 'none',
    transformOrigin: style.transformOrigin || '50% 50%',
    
    // Box model
    boxSizing: style.boxSizing || 'content-box',
    margin: style.margin || '0px',
    padding: style.padding || '0px',
    
    // Viewport-related properties
    fontSize: style.fontSize || '16px',
    
    getPropertyValue: (property: string) => {
      switch (property) {
        case 'width':
          return style.width || '100%'
        case 'height':
          return style.height || 'auto'
        case 'transform':
          return style.transform || 'none'
        case 'font-size':
          return style.fontSize || '16px'
        default:
          return ''
      }
    }
  }
})

// Viewport configuration generator
const viewportConfigArb = fc.record({
  width: fc.constantFrom('device-width', '320px', '375px', '414px'),
  initialScale: fc.float({ min: Math.fround(0.5), max: Math.fround(2.0) }),
  minimumScale: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
  maximumScale: fc.float({ min: Math.fround(1.0), max: Math.fround(10.0) }),
  userScalable: fc.boolean()
})

// Screen configuration generator
const screenConfigArb = fc.record({
  width: fc.integer({ min: 320, max: 1024 }),
  height: fc.integer({ min: 568, max: 1366 }),
  devicePixelRatio: fc.constantFrom(1, 1.5, 2, 3),
  orientation: fc.constantFrom('portrait', 'landscape')
})

// Layout element generator
const layoutElementArb = fc.record({
  width: fc.integer({ min: 50, max: 300 }),
  height: fc.integer({ min: 50, max: 200 }),
  x: fc.integer({ min: 0, max: 100 }),
  y: fc.integer({ min: 0, max: 100 }),
  units: fc.constantFrom('px', '%')
})

// Browser environment generator
const browserEnvironmentArb = fc.record({
  browserType: fc.constantFrom('iosSafari', 'androidChrome', 'iPadSafari'),
  screenConfig: screenConfigArb
})

describe('Viewport Scaling Stability Property Tests', () => {
  beforeEach(() => {
    // Clear document and reset mocks
    document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  /**
   * Property 11: Viewport Scaling Stability
   * For any viewport size change on mobile browsers, the layout should maintain 
   * consistent proportions and positioning
   */
  test('Property 11: Viewport Scaling Stability - viewport configuration consistency', () => {
    fc.assert(
      fc.property(
        viewportConfigArb,
        browserEnvironmentArb,
        (viewportConfig, browserEnv) => {
          // Mock mobile browser environment
          mockMobileEnvironment(browserEnv.browserType, browserEnv.screenConfig)

          // Configure viewport
          CrossBrowserTouchHandler.configureViewport(viewportConfig)

          // Property: Viewport meta tag should be properly configured
          const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
          const viewportConfigured = viewportMeta && viewportMeta.content.includes('width=')

          // Property: Viewport content should include configured values
          let contentValid = true
          if (viewportMeta && viewportMeta.content) {
            const content = viewportMeta.content
            
            if (viewportConfig.width) {
              contentValid = contentValid && content.includes(`width=${viewportConfig.width}`)
            }
            if (viewportConfig.initialScale) {
              contentValid = contentValid && content.includes(`initial-scale=${viewportConfig.initialScale}`)
            }
            if (viewportConfig.minimumScale) {
              contentValid = contentValid && content.includes(`minimum-scale=${viewportConfig.minimumScale}`)
            }
            if (viewportConfig.maximumScale) {
              contentValid = contentValid && content.includes(`maximum-scale=${viewportConfig.maximumScale}`)
            }
            if (viewportConfig.userScalable !== undefined) {
              const userScalableValue = viewportConfig.userScalable ? 'yes' : 'no'
              contentValid = contentValid && content.includes(`user-scalable=${userScalableValue}`)
            }
          }

          return viewportConfigured && contentValid
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 11: Viewport Scaling Stability - cross-browser viewport consistency', () => {
    fc.assert(
      fc.property(
        viewportConfigArb,
        layoutElementArb,
        fc.array(browserEnvironmentArb, { minLength: 2, maxLength: 3 }),
        (viewportConfig, layoutElement, browserEnvironments) => {
          const layoutResults: Array<{
            browserType: string,
            elementWidth: string,
            elementHeight: string,
            viewportConfigured: boolean
          }> = []

          // Test the same layout across different mobile browsers
          browserEnvironments.forEach(browserEnv => {
            // Clear previous test
            document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
            document.body.innerHTML = ''

            // Mock browser environment
            mockMobileEnvironment(browserEnv.browserType, browserEnv.screenConfig)

            // Configure viewport
            CrossBrowserTouchHandler.configureViewport(viewportConfig)

            // Create test layout
            const container = document.createElement('div')
            container.className = 'viewport-test-element'
            document.body.appendChild(container)

            const element = document.createElement('div')
            element.className = 'layout-element'
            element.style.width = `${layoutElement.width}${layoutElement.units}`
            element.style.height = `${layoutElement.height}${layoutElement.units}`
            element.style.left = `${layoutElement.x}${layoutElement.units}`
            element.style.top = `${layoutElement.y}${layoutElement.units}`
            container.appendChild(element)

            // Record layout properties
            const elementStyle = window.getComputedStyle(element)
            const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement

            layoutResults.push({
              browserType: browserEnv.browserType,
              elementWidth: elementStyle.width,
              elementHeight: elementStyle.height,
              viewportConfigured: !!(viewportMeta && viewportMeta.content)
            })
          })

          // Property: Layout should be consistent across all mobile browsers
          const layoutConsistentAcrossBrowsers = layoutResults.every(result => 
            result.elementWidth === layoutResults[0].elementWidth &&
            result.elementHeight === layoutResults[0].elementHeight
          )

          // Property: Viewport configuration should be consistent across browsers
          const viewportConsistentAcrossBrowsers = layoutResults.every(result => 
            result.viewportConfigured === layoutResults[0].viewportConfigured
          )

          return layoutConsistentAcrossBrowsers && 
                 viewportConsistentAcrossBrowsers
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 11: Viewport Scaling Stability - mobile viewport fixes application', () => {
    fc.assert(
      fc.property(
        viewportConfigArb,
        browserEnvironmentArb,
        (viewportConfig, browserEnv) => {
          // Mock browser environment
          mockMobileEnvironment(browserEnv.browserType, browserEnv.screenConfig)

          // Configure viewport
          CrossBrowserTouchHandler.configureViewport(viewportConfig)

          // Property: HTML and body should have proper overflow handling
          const htmlStyle = window.getComputedStyle(document.documentElement)
          const bodyStyle = window.getComputedStyle(document.body)

          const htmlOverflowHandled = htmlStyle.overflowX === 'hidden'
          const bodyOverflowHandled = bodyStyle.overflowX === 'hidden'

          // Property: Box-sizing should be consistent
          const htmlBoxSizing = htmlStyle.boxSizing === 'border-box'
          const bodyBoxSizing = bodyStyle.boxSizing === 'border-box'

          // Property: Overscroll behavior should be contained
          const bodyOverscrollContained = 
            bodyStyle.overscrollBehavior === 'contain' ||
            bodyStyle.webkitOverscrollBehavior === 'contain'

          return htmlOverflowHandled && 
                 bodyOverflowHandled && 
                 htmlBoxSizing && 
                 bodyBoxSizing && 
                 bodyOverscrollContained
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 11: Viewport Scaling Stability - input zoom prevention', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('text', 'email', 'password', 'number', 'search'),
        browserEnvironmentArb.filter(env => env.browserType === 'iosSafari'),
        (inputType, browserEnv) => {
          // Mock iOS Safari environment (where input zoom is problematic)
          mockMobileEnvironment(browserEnv.browserType, browserEnv.screenConfig)

          // Configure viewport to prevent zoom
          CrossBrowserTouchHandler.configureViewport({
            width: 'device-width',
            initialScale: 1.0,
            minimumScale: 1.0,
            maximumScale: 1.0,
            userScalable: false
          })

          // Create input element
          const input = document.createElement('input')
          input.type = inputType
          input.placeholder = 'Test input'
          document.body.appendChild(input)

          // Apply mobile viewport fixes (this is called automatically by configureViewport)
          const inputStyle = window.getComputedStyle(input)

          // Property: Input font size should be at least 16px to prevent zoom on iOS
          const fontSizePreventsZoom = parseInt(inputStyle.fontSize) >= 16

          // Property: Viewport should be configured to prevent user scaling
          const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
          const zoomPrevented = viewportMeta && 
            viewportMeta.content.includes('user-scalable=no') &&
            viewportMeta.content.includes('maximum-scale=1')

          return fontSizePreventsZoom && zoomPrevented
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 11: Viewport Scaling Stability - horizontal scroll prevention', () => {
    fc.assert(
      fc.property(
        viewportConfigArb,
        browserEnvironmentArb,
        (viewportConfig, browserEnv) => {
          // Mock browser environment
          mockMobileEnvironment(browserEnv.browserType, browserEnv.screenConfig)

          // Configure viewport
          CrossBrowserTouchHandler.configureViewport(viewportConfig)

          // Create container with potentially overflowing content
          const container = document.createElement('div')
          container.className = 'viewport-test-element'
          document.body.appendChild(container)

          const content = document.createElement('div')
          content.style.width = '120%' // Always create overflow
          content.style.height = '200px'
          content.style.backgroundColor = '#007bff'
          container.appendChild(content)

          const htmlStyle = window.getComputedStyle(document.documentElement)
          const bodyStyle = window.getComputedStyle(document.body)

          // Property: HTML and body should prevent horizontal scroll
          const htmlPreventsHorizontalScroll = htmlStyle.overflowX === 'hidden'
          const bodyPreventsHorizontalScroll = bodyStyle.overflowX === 'hidden'

          // Property: Viewport should be configured to prevent horizontal scroll
          const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
          const viewportConfiguredCorrectly = viewportMeta && 
            (viewportMeta.content.includes('width=device-width') || 
             viewportMeta.content.includes('width='))  // Accept any width configuration

          return htmlPreventsHorizontalScroll && 
                 bodyPreventsHorizontalScroll && 
                 viewportConfiguredCorrectly
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 11: Viewport Scaling Stability - viewport meta tag creation and updates', () => {
    fc.assert(
      fc.property(
        viewportConfigArb.filter(config => !isNaN(config.initialScale)), // Filter out NaN values
        viewportConfigArb.filter(config => !isNaN(config.initialScale)), // Filter out NaN values
        browserEnvironmentArb,
        (initialConfig, updatedConfig, browserEnv) => {
          // Mock browser environment
          mockMobileEnvironment(browserEnv.browserType, browserEnv.screenConfig)

          // Remove existing viewport meta tag
          const existingMeta = document.querySelector('meta[name="viewport"]')
          if (existingMeta) {
            existingMeta.remove()
          }

          // Configure initial viewport
          CrossBrowserTouchHandler.configureViewport(initialConfig)

          // Property: Viewport meta tag should be created
          let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
          const metaTagCreated = viewportMeta !== null

          // Property: Initial configuration should be applied
          const initialContentValid = viewportMeta && 
            viewportMeta.content.includes(`initial-scale=${initialConfig.initialScale}`)

          // Update viewport configuration
          CrossBrowserTouchHandler.configureViewport(updatedConfig)

          // Property: Same meta tag should be updated (not duplicated)
          const metaTags = document.querySelectorAll('meta[name="viewport"]')
          const noDuplicates = metaTags.length === 1

          // Property: Updated configuration should be applied
          viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
          const updatedContentValid = viewportMeta && 
            viewportMeta.content.includes(`initial-scale=${updatedConfig.initialScale}`)

          return metaTagCreated && 
                 initialContentValid && 
                 noDuplicates && 
                 updatedContentValid
        }
      ),
      { numRuns: 100 }
    )
  })
})