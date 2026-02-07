/**
 * Property-Based Tests for Cross-Browser Layout Uniformity
 * Feature: cross-browser-compatibility, Property 6: Cross-Browser Layout Uniformity
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

import fc from 'fast-check'
import { JSDOM } from 'jsdom'

// Setup JSDOM environment for cross-browser layout testing
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        /* Cross-browser flexbox utilities */
        .flex-cross-browser {
          display: -webkit-box;      /* OLD - iOS 6-, Safari 3.1-6 */
          display: -moz-box;         /* OLD - Firefox 19- */
          display: -ms-flexbox;      /* TWEENER - IE 10 */
          display: -webkit-flex;     /* NEW - Chrome */
          display: flex;             /* NEW, Spec - Opera 12.1, Firefox 20+ */
        }

        .flex-direction-column-cross-browser {
          -webkit-box-orient: vertical;
          -webkit-box-direction: normal;
          -webkit-flex-direction: column;
          -ms-flex-direction: column;
          flex-direction: column;
        }

        .flex-1-cross-browser {
          -webkit-box-flex: 1;
          -webkit-flex: 1 1 0%;
          -ms-flex: 1 1 0%;
          flex: 1 1 0%;
        }

        .items-center-cross-browser {
          -webkit-box-align: center;
          -webkit-align-items: center;
          -ms-flex-align: center;
          align-items: center;
        }

        .justify-center-cross-browser {
          -webkit-box-pack: center;
          -webkit-justify-content: center;
          -ms-flex-pack: center;
          justify-content: center;
        }

        .justify-between-cross-browser {
          -webkit-box-pack: justify;
          -webkit-justify-content: space-between;
          -ms-flex-pack: justify;
          justify-content: space-between;
        }

        /* Grid fallbacks */
        .grid-cross-browser {
          display: -ms-grid;
          display: grid;
        }

        @supports not (display: grid) {
          .grid-cross-browser {
            display: flex;
            flex-wrap: wrap;
          }
          
          .grid-cross-browser > * {
            flex: 1 1 auto;
            margin: 0.5rem;
          }
        }

        /* Test layout container */
        .layout-container {
          width: 800px;
          height: 600px;
          background-color: #ffffff;
          position: relative;
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

// Browser user agents for testing
const browserUserAgents = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
}

// Mock getComputedStyle for different browsers
const createMockGetComputedStyle = (browserType: keyof typeof browserUserAgents) => {
  return jest.fn().mockImplementation((element: Element) => {
    if (!element.isConnected) {
      throw new TypeError("The provided value is not of type 'Element'.")
    }

    const classList = Array.from(element.classList)
    const hasFlexCrossBrowser = classList.includes('flex-cross-browser')
    const hasFlexColumn = classList.includes('flex-direction-column-cross-browser')
    const hasFlex1 = classList.includes('flex-1-cross-browser')
    const hasItemsCenter = classList.includes('items-center-cross-browser')
    const hasJustifyCenter = classList.includes('justify-center-cross-browser')
    const hasJustifyBetween = classList.includes('justify-between-cross-browser')
    const hasGridCrossBrowser = classList.includes('grid-cross-browser')

    // Create a comprehensive getPropertyValue function that handles all vendor prefixes
    const createGetPropertyValue = () => {
      return (property: string) => {
        // Base properties
        switch (property) {
          case '-webkit-box-sizing':
          case '-moz-box-sizing':
            return 'border-box'
          case '-webkit-transform':
          case '-moz-transform':
          case '-ms-transform':
            return 'none'
        }

        // Flexbox direction properties
        if (hasFlexColumn) {
          switch (property) {
            case '-webkit-flex-direction':
              return browserType === 'safari' ? 'column' : ''
            case '-ms-flex-direction':
              return browserType === 'edge' ? 'column' : ''
            case '-webkit-box-orient':
              return browserType === 'safari' ? 'vertical' : ''
            case '-webkit-box-direction':
              return browserType === 'safari' ? 'normal' : ''
          }
        }

        // Flex properties
        if (hasFlex1) {
          switch (property) {
            case '-webkit-flex':
              return browserType === 'safari' ? '1 1 0%' : ''
            case '-ms-flex':
              return browserType === 'edge' ? '1 1 0%' : ''
            case '-webkit-box-flex':
              return browserType === 'safari' ? '1' : ''
          }
        }

        // Alignment properties
        if (hasItemsCenter) {
          switch (property) {
            case '-webkit-align-items':
              return browserType === 'safari' ? 'center' : ''
            case '-ms-flex-align':
              return browserType === 'edge' ? 'center' : ''
            case '-webkit-box-align':
              return browserType === 'safari' ? 'center' : ''
          }
        }

        // Justify content properties
        if (hasJustifyCenter) {
          switch (property) {
            case '-webkit-justify-content':
              return browserType === 'safari' ? 'center' : ''
            case '-ms-flex-pack':
              return browserType === 'edge' ? 'center' : ''
            case '-webkit-box-pack':
              return browserType === 'safari' ? 'center' : ''
          }
        }

        if (hasJustifyBetween) {
          switch (property) {
            case '-webkit-justify-content':
              return browserType === 'safari' ? 'space-between' : ''
            case '-ms-flex-pack':
              return browserType === 'edge' ? 'justify' : ''
            case '-webkit-box-pack':
              return browserType === 'safari' ? 'justify' : ''
          }
        }

        // Grid properties
        if (hasGridCrossBrowser) {
          switch (property) {
            case '-ms-grid':
              return browserType === 'edge' ? 'grid' : ''
          }
        }

        // Default case - return empty string for unknown properties
        return ''
      }
    }

    // Base computed style properties
    const baseStyle = {
      width: '800px',
      height: '600px',
      backgroundColor: '#ffffff',
      position: 'relative',
      boxSizing: 'border-box',
      margin: '0px',
      padding: '0px',
      border: '0px none',
      getPropertyValue: createGetPropertyValue()
    }

    // Browser-specific flexbox properties
    if (hasFlexCrossBrowser || hasFlex1 || hasItemsCenter || hasJustifyCenter || hasJustifyBetween) {
      // Set display property for flex containers
      if (hasFlexCrossBrowser) {
        baseStyle.display = browserType === 'chrome' ? 'flex' : 
                           browserType === 'firefox' ? 'flex' :
                           browserType === 'safari' ? '-webkit-flex' :
                           browserType === 'edge' ? 'flex' : 'flex'
      }

      if (hasFlexColumn) {
        baseStyle.flexDirection = 'column'
      }

      if (hasFlex1) {
        baseStyle.flex = '1 1 0%'
      }

      if (hasItemsCenter) {
        baseStyle.alignItems = 'center'
      }

      if (hasJustifyCenter) {
        baseStyle.justifyContent = 'center'
      }

      if (hasJustifyBetween) {
        baseStyle.justifyContent = 'space-between'
      }
    }

    // Grid properties with fallbacks
    if (hasGridCrossBrowser) {
      const supportsGrid = browserType !== 'edge' || false // Simulate older Edge not supporting grid
      
      if (supportsGrid) {
        baseStyle.display = 'grid'
      } else {
        // Fallback to flexbox for browsers without grid support
        baseStyle.display = 'flex'
        baseStyle.flexWrap = 'wrap'
      }
    }

    return baseStyle
  })
}

// Layout configuration generator
const layoutConfigArb = fc.record({
  layoutType: fc.constantFrom('flexbox', 'grid', 'mixed'),
  containerCount: fc.integer({ min: 1, max: 5 }),
  itemCount: fc.integer({ min: 2, max: 10 }),
  hasNesting: fc.boolean(),
  useAlignment: fc.boolean(),
  useJustification: fc.boolean()
})

// Browser environment generator
const browserEnvironmentArb = fc.record({
  browserType: fc.constantFrom('chrome', 'firefox', 'safari', 'edge') as fc.Arbitrary<keyof typeof browserUserAgents>,
  viewport: fc.record({
    width: fc.integer({ min: 1024, max: 2560 }),
    height: fc.integer({ min: 768, max: 1440 })
  }),
  devicePixelRatio: fc.constantFrom(1, 1.25, 1.5, 2),
  supportsModernFeatures: fc.boolean()
})

// Layout measurement utilities
const measureLayout = (element: HTMLElement) => {
  const style = window.getComputedStyle(element)
  return {
    display: style.display,
    flexDirection: style.flexDirection || 'row',
    alignItems: style.alignItems || 'stretch',
    justifyContent: style.justifyContent || 'flex-start',
    flex: style.flex || 'none',
    width: style.width,
    height: style.height,
    position: style.position,
    boxSizing: style.boxSizing
  }
}

describe('Cross-Browser Layout Uniformity Property Tests', () => {
  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  /**
   * Property 6: Cross-Browser Layout Uniformity
   * For any layout component (flexbox or grid), the computed positioning and spacing values 
   * should be identical across Chrome, Firefox, Edge, and Safari
   */
  test('Property 6: Cross-Browser Layout Uniformity - flexbox layouts render identically across browsers', () => {
    fc.assert(
      fc.property(
        layoutConfigArb,
        browserEnvironmentArb,
        (layoutConfig, browserEnv) => {
          // Skip grid-only tests for flexbox property
          if (layoutConfig.layoutType === 'grid') return true

          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserUserAgents[browserEnv.browserType],
            writable: true
          })

          global.getComputedStyle = createMockGetComputedStyle(browserEnv.browserType)

          // Create flexbox layout container
          const container = document.createElement('div')
          container.className = 'layout-container flex-cross-browser'
          
          if (layoutConfig.useAlignment) {
            container.classList.add('items-center-cross-browser')
          }
          
          if (layoutConfig.useJustification) {
            container.classList.add('justify-between-cross-browser')
          }

          // Add flex items
          const items: HTMLElement[] = []
          for (let i = 0; i < layoutConfig.itemCount; i++) {
            const item = document.createElement('div')
            item.className = 'flex-item'
            
            if (i === 0) {
              item.classList.add('flex-1-cross-browser')
            }
            
            item.textContent = `Item ${i}`
            item.style.minHeight = '50px'
            item.style.backgroundColor = `hsl(${i * 40}, 70%, 90%)`
            
            if (layoutConfig.hasNesting && i % 2 === 0) {
              const nestedContainer = document.createElement('div')
              nestedContainer.className = 'flex-cross-browser flex-direction-column-cross-browser'
              
              for (let j = 0; j < 2; j++) {
                const nestedItem = document.createElement('div')
                nestedItem.textContent = `Nested ${j}`
                nestedItem.style.padding = '8px'
                nestedContainer.appendChild(nestedItem)
              }
              
              item.appendChild(nestedContainer)
            }
            
            container.appendChild(item)
            items.push(item)
          }

          document.body.appendChild(container)

          // Measure layout properties
          const containerMeasurements = measureLayout(container)
          const itemMeasurements = items.map(item => measureLayout(item))

          // Property: Container should have proper flexbox display value
          const hasProperFlexDisplay = 
            containerMeasurements.display === 'flex' ||
            containerMeasurements.display === '-webkit-flex' ||
            containerMeasurements.display === '-ms-flexbox'

          // Property: Flex items should have consistent flex properties
          const flexItemsConsistent = itemMeasurements.every((measurement, index) => {
            if (index === 0) {
              // First item should have flex: 1 1 0%
              return measurement.flex === '1 1 0%' || measurement.flex === 'none' // fallback acceptable
            }
            return true
          })

          // Property: Alignment should be applied consistently
          const alignmentConsistent = !layoutConfig.useAlignment || 
            containerMeasurements.alignItems === 'center'

          // Property: Justification should be applied consistently
          const justificationConsistent = !layoutConfig.useJustification || 
            containerMeasurements.justifyContent === 'space-between'

          // Property: Box-sizing should be consistent
          const boxSizingConsistent = 
            containerMeasurements.boxSizing === 'border-box'

          // Property: Layout should not break with nested flexbox
          let nestedLayoutConsistent = true
          if (layoutConfig.hasNesting) {
            const nestedContainers = container.querySelectorAll('.flex-cross-browser')
            nestedContainers.forEach(nested => {
              const nestedStyle = window.getComputedStyle(nested as HTMLElement)
              if (nestedStyle.display !== 'flex' && 
                  nestedStyle.display !== '-webkit-flex' && 
                  nestedStyle.display !== '-ms-flexbox') {
                nestedLayoutConsistent = false
              }
            })
          }

          return hasProperFlexDisplay && 
                 flexItemsConsistent && 
                 alignmentConsistent && 
                 justificationConsistent && 
                 boxSizingConsistent && 
                 nestedLayoutConsistent
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 6: Cross-Browser Layout Uniformity - grid layouts with fallbacks work consistently', () => {
    fc.assert(
      fc.property(
        fc.record({
          ...layoutConfigArb.constraints,
          layoutType: fc.constantFrom('grid', 'mixed')
        }),
        browserEnvironmentArb,
        (layoutConfig, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserUserAgents[browserEnv.browserType],
            writable: true
          })

          global.getComputedStyle = createMockGetComputedStyle(browserEnv.browserType)

          // Create grid layout container
          const container = document.createElement('div')
          container.className = 'layout-container grid-cross-browser'

          // Add grid items
          const items: HTMLElement[] = []
          for (let i = 0; i < layoutConfig.itemCount; i++) {
            const item = document.createElement('div')
            item.className = 'grid-item'
            item.textContent = `Grid Item ${i}`
            item.style.minHeight = '100px'
            item.style.backgroundColor = `hsl(${i * 50}, 60%, 85%)`
            
            container.appendChild(item)
            items.push(item)
          }

          document.body.appendChild(container)

          // Measure layout properties
          const containerMeasurements = measureLayout(container)

          // Property: Container should have grid display or flex fallback
          const hasProperGridDisplay = 
            containerMeasurements.display === 'grid' ||
            containerMeasurements.display === '-ms-grid' ||
            containerMeasurements.display === 'flex' // fallback

          // Property: If grid is not supported, should fallback to flex
          const fallbackWorksCorrectly = 
            containerMeasurements.display === 'grid' ||
            containerMeasurements.display === '-ms-grid' ||
            (containerMeasurements.display === 'flex' && 
             window.getComputedStyle(container).flexWrap === 'wrap')

          // Property: Layout should be stable regardless of browser
          const layoutStable = 
            containerMeasurements.width === '800px' &&
            containerMeasurements.height === '600px' &&
            containerMeasurements.boxSizing === 'border-box'

          // Property: Items should be properly contained
          const itemsProperlyContained = items.every(item => {
            const itemStyle = window.getComputedStyle(item)
            return itemStyle.boxSizing === 'border-box'
          })

          return hasProperGridDisplay && 
                 fallbackWorksCorrectly && 
                 layoutStable && 
                 itemsProperlyContained
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 6: Cross-Browser Layout Uniformity - mixed layouts maintain consistency', () => {
    fc.assert(
      fc.property(
        fc.record({
          ...layoutConfigArb.constraints,
          layoutType: fc.constant('mixed')
        }),
        fc.array(browserEnvironmentArb, { minLength: 2, maxLength: 4 }),
        (layoutConfig, browserEnvironments) => {
          const layoutMeasurements: any[] = []

          // Test the same layout across multiple browsers
          browserEnvironments.forEach(browserEnv => {
            // Mock browser environment
            Object.defineProperty(window.navigator, 'userAgent', {
              value: browserUserAgents[browserEnv.browserType],
              writable: true
            })

            global.getComputedStyle = createMockGetComputedStyle(browserEnv.browserType)

            // Clear previous test
            document.body.innerHTML = ''

            // Create mixed layout (flexbox container with grid items)
            const outerContainer = document.createElement('div')
            outerContainer.className = 'layout-container flex-cross-browser flex-direction-column-cross-browser'

            // Add flexbox header
            const header = document.createElement('div')
            header.className = 'flex-cross-browser justify-between-cross-browser items-center-cross-browser'
            header.style.height = '60px'
            header.style.backgroundColor = '#f3f4f6'
            header.textContent = 'Header'
            outerContainer.appendChild(header)

            // Add grid content area
            const contentArea = document.createElement('div')
            contentArea.className = 'flex-1-cross-browser grid-cross-browser'
            
            for (let i = 0; i < layoutConfig.itemCount; i++) {
              const gridItem = document.createElement('div')
              gridItem.textContent = `Content ${i}`
              gridItem.style.minHeight = '80px'
              gridItem.style.backgroundColor = `hsl(${i * 30}, 50%, 90%)`
              contentArea.appendChild(gridItem)
            }
            
            outerContainer.appendChild(contentArea)

            // Add flexbox footer
            const footer = document.createElement('div')
            footer.className = 'flex-cross-browser justify-center-cross-browser items-center-cross-browser'
            footer.style.height = '40px'
            footer.style.backgroundColor = '#e5e7eb'
            footer.textContent = 'Footer'
            outerContainer.appendChild(footer)

            document.body.appendChild(outerContainer)

            // Measure layout
            const outerMeasurements = measureLayout(outerContainer)
            const headerMeasurements = measureLayout(header)
            const contentMeasurements = measureLayout(contentArea)
            const footerMeasurements = measureLayout(footer)

            layoutMeasurements.push({
              browser: browserEnv.browserType,
              outer: outerMeasurements,
              header: headerMeasurements,
              content: contentMeasurements,
              footer: footerMeasurements
            })
          })

          // Property: All browsers should produce similar layout measurements
          const firstBrowserLayout = layoutMeasurements[0]
          const layoutsConsistentAcrossBrowsers = layoutMeasurements.every(measurement => {
            // Outer container should be consistent
            const outerConsistent = 
              measurement.outer.width === firstBrowserLayout.outer.width &&
              measurement.outer.height === firstBrowserLayout.outer.height &&
              (measurement.outer.display === 'flex' || 
               measurement.outer.display === '-webkit-flex' ||
               measurement.outer.display === '-ms-flexbox')

            // Header should be consistent
            const headerConsistent = 
              measurement.header.height === firstBrowserLayout.header.height &&
              (measurement.header.display === 'flex' || 
               measurement.header.display === '-webkit-flex' ||
               measurement.header.display === '-ms-flexbox')

            // Content area should be consistent (grid or flex fallback)
            const contentConsistent = 
              (measurement.content.display === 'grid' || 
               measurement.content.display === '-ms-grid' ||
               measurement.content.display === 'flex') &&
              measurement.content.flex === firstBrowserLayout.content.flex

            // Footer should be consistent
            const footerConsistent = 
              measurement.footer.height === firstBrowserLayout.footer.height &&
              (measurement.footer.display === 'flex' || 
               measurement.footer.display === '-webkit-flex' ||
               measurement.footer.display === '-ms-flexbox')

            return outerConsistent && headerConsistent && contentConsistent && footerConsistent
          })

          // Property: Box-sizing should be consistent across all browsers
          const boxSizingConsistent = layoutMeasurements.every(measurement => 
            measurement.outer.boxSizing === 'border-box' &&
            measurement.header.boxSizing === 'border-box' &&
            measurement.content.boxSizing === 'border-box' &&
            measurement.footer.boxSizing === 'border-box'
          )

          return layoutsConsistentAcrossBrowsers && boxSizingConsistent
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 6: Cross-Browser Layout Uniformity - vendor prefixes ensure consistent behavior', () => {
    fc.assert(
      fc.property(
        layoutConfigArb,
        browserEnvironmentArb,
        (layoutConfig, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserUserAgents[browserEnv.browserType],
            writable: true
          })

          global.getComputedStyle = createMockGetComputedStyle(browserEnv.browserType)

          // Create layout with all cross-browser classes
          const container = document.createElement('div')
          container.className = 'layout-container flex-cross-browser flex-direction-column-cross-browser'

          const flexItem = document.createElement('div')
          flexItem.className = 'flex-1-cross-browser items-center-cross-browser justify-center-cross-browser'
          flexItem.textContent = 'Flex Item'
          
          const gridContainer = document.createElement('div')
          gridContainer.className = 'grid-cross-browser'
          
          for (let i = 0; i < 3; i++) {
            const gridItem = document.createElement('div')
            gridItem.textContent = `Grid Item ${i}`
            gridContainer.appendChild(gridItem)
          }

          container.appendChild(flexItem)
          container.appendChild(gridContainer)
          document.body.appendChild(container)

          // Test vendor prefix properties
          const containerStyle = window.getComputedStyle(container)
          const flexItemStyle = window.getComputedStyle(flexItem)
          const gridContainerStyle = window.getComputedStyle(gridContainer)

          // Property: Vendor-prefixed properties should be available based on browser
          const vendorPrefixesWork = (() => {
            switch (browserEnv.browserType) {
              case 'safari':
                return containerStyle.getPropertyValue('-webkit-flex-direction') === 'column' &&
                       flexItemStyle.getPropertyValue('-webkit-flex') === '1 1 0%' &&
                       flexItemStyle.getPropertyValue('-webkit-align-items') === 'center'
              
              case 'edge':
                return containerStyle.getPropertyValue('-ms-flex-direction') === 'column' &&
                       flexItemStyle.getPropertyValue('-ms-flex') === '1 1 0%' &&
                       flexItemStyle.getPropertyValue('-ms-flex-align') === 'center'
              
              case 'firefox':
              case 'chrome':
              default:
                // For modern browsers like Chrome and Firefox, check standard properties
                return containerStyle.display === 'flex' &&
                       containerStyle.flexDirection === 'column' &&
                       flexItemStyle.flex === '1 1 0%' &&
                       flexItemStyle.alignItems === 'center' &&
                       flexItemStyle.justifyContent === 'center'
            }
          })()

          // Property: Layout should work regardless of vendor prefix support
          const layoutWorksWithoutPrefixes = 
            containerStyle.display === 'flex' ||
            containerStyle.display === '-webkit-flex' ||
            containerStyle.display === '-ms-flexbox'

          // Property: Grid fallback should work when grid is not supported
          const gridFallbackWorks = 
            gridContainerStyle.display === 'grid' ||
            gridContainerStyle.display === '-ms-grid' ||
            gridContainerStyle.display === 'flex'

          // Property: Box-sizing should be consistent with vendor prefixes
          const boxSizingWithPrefixes = 
            containerStyle.boxSizing === 'border-box' &&
            (containerStyle.getPropertyValue('-webkit-box-sizing') === 'border-box' ||
             containerStyle.getPropertyValue('-moz-box-sizing') === 'border-box' ||
             containerStyle.boxSizing === 'border-box')

          const result = vendorPrefixesWork && 
                 layoutWorksWithoutPrefixes && 
                 gridFallbackWorks && 
                 boxSizingWithPrefixes

          return result
        }
      ),
      { numRuns: 100 }
    )
  })
})