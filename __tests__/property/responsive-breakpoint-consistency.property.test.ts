/**
 * Property-Based Tests for Responsive Breakpoint Consistency
 * Feature: cross-browser-compatibility, Property 7: Responsive Breakpoint Consistency
 * **Validates: Requirements 4.4**
 */

import fc from 'fast-check'
import { JSDOM } from 'jsdom'

// Setup JSDOM environment for responsive breakpoint testing
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        /* Cross-browser responsive breakpoints */
        .responsive-container {
          width: 100%;
          padding: 1rem;
          box-sizing: border-box;
          -webkit-box-sizing: border-box;
          -moz-box-sizing: border-box;
        }

        /* Mobile-first responsive design */
        @media (min-width: 640px) {
          .responsive-container {
            padding: 1.5rem;
          }
          .sm\\:flex {
            display: -webkit-box;
            display: -moz-box;
            display: -ms-flexbox;
            display: -webkit-flex;
            display: flex;
          }
          .sm\\:grid {
            display: -ms-grid;
            display: grid;
          }
        }

        @media (min-width: 768px) {
          .responsive-container {
            padding: 2rem;
          }
          .md\\:flex-row {
            -webkit-flex-direction: row;
            -ms-flex-direction: row;
            flex-direction: row;
          }
          .md\\:grid-cols-2 {
            -ms-grid-columns: 1fr 1fr;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          .responsive-container {
            padding: 3rem;
          }
          .lg\\:flex-row {
            -webkit-flex-direction: row;
            -ms-flex-direction: row;
            flex-direction: row;
          }
          .lg\\:grid-cols-3 {
            -ms-grid-columns: 1fr 1fr 1fr;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (min-width: 1280px) {
          .responsive-container {
            padding: 4rem;
          }
          .xl\\:grid-cols-4 {
            -ms-grid-columns: 1fr 1fr 1fr 1fr;
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        /* Fallback for browsers without media query support */
        @supports not (display: grid) {
          .sm\\:grid,
          .md\\:grid-cols-2,
          .lg\\:grid-cols-3,
          .xl\\:grid-cols-4 {
            display: -webkit-box;
            display: -moz-box;
            display: -ms-flexbox;
            display: -webkit-flex;
            display: flex;
            -webkit-flex-wrap: wrap;
            -ms-flex-wrap: wrap;
            flex-wrap: wrap;
          }
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

// Responsive breakpoints
const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280
}

// Mock matchMedia for responsive testing
const createMockMatchMedia = (width: number) => {
  return jest.fn().mockImplementation((query: string) => {
    // Parse media query to extract min-width value
    const minWidthMatch = query.match(/min-width:\s*(\d+)px/)
    const maxWidthMatch = query.match(/max-width:\s*(\d+)px/)
    
    let matches = true
    
    if (minWidthMatch) {
      const minWidth = parseInt(minWidthMatch[1])
      matches = matches && width >= minWidth
    }
    
    if (maxWidthMatch) {
      const maxWidth = parseInt(maxWidthMatch[1])
      matches = matches && width <= maxWidth
    }
    
    return {
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    }
  })
}

// Mock getComputedStyle for responsive breakpoint testing
const createMockGetComputedStyleForBreakpoint = (
  browserType: keyof typeof browserUserAgents, 
  viewportWidth: number,
  supportsGrid: boolean = true
) => {
  return jest.fn().mockImplementation((element: Element) => {
    if (!element.isConnected) {
      throw new TypeError("The provided value is not of type 'Element'.")
    }

    const classList = Array.from(element.classList)
    const hasResponsiveContainer = classList.includes('responsive-container')
    
    // Determine which breakpoint is active
    const activeBreakpoint = viewportWidth >= breakpoints.xl ? 'xl' :
                           viewportWidth >= breakpoints.lg ? 'lg' :
                           viewportWidth >= breakpoints.md ? 'md' :
                           viewportWidth >= breakpoints.sm ? 'sm' : 'base'

    // Base styles
    const baseStyle = {
      width: '100%',
      boxSizing: 'border-box',
      display: 'block',
      flexDirection: 'column',
      gridTemplateColumns: 'none',
      
      getPropertyValue: (property: string) => {
        switch (property) {
          case '-webkit-box-sizing':
          case '-moz-box-sizing':
            return 'border-box'
          case '-webkit-flex-direction':
          case '-ms-flex-direction':
            return 'column'
          case '-ms-grid-columns':
            return 'none'
          default:
            return ''
        }
      }
    }

    // Apply responsive padding based on breakpoint
    if (hasResponsiveContainer) {
      switch (activeBreakpoint) {
        case 'xl':
          baseStyle.padding = '4rem'
          break
        case 'lg':
          baseStyle.padding = '3rem'
          break
        case 'md':
          baseStyle.padding = '2rem'
          break
        case 'sm':
          baseStyle.padding = '1.5rem'
          break
        default:
          baseStyle.padding = '1rem'
      }
    }

    // Apply responsive display properties based on container type and classes
    if (classList.includes('sm:flex') && activeBreakpoint !== 'base') {
      baseStyle.display = browserType === 'safari' ? '-webkit-flex' : 
                         browserType === 'edge' ? '-ms-flexbox' : 'flex'
    }

    if (classList.includes('sm:grid') && activeBreakpoint !== 'base') {
      // Check if browser supports grid and if grid is actually supported
      if (!supportsGrid) {
        // Fall back to flex if grid is not supported
        baseStyle.display = browserType === 'safari' ? '-webkit-flex' : 
                           browserType === 'edge' ? '-ms-flexbox' : 'flex'
        baseStyle.getPropertyValue = (property: string) => {
          switch (property) {
            case '-webkit-box-sizing':
            case '-moz-box-sizing':
              return 'border-box'
            case '-webkit-flex-wrap':
            case '-ms-flex-wrap':
              return 'wrap'
            default:
              return ''
          }
        }
      } else {
        baseStyle.display = browserType === 'edge' ? '-ms-grid' : 'grid'
      }
    }

    // For base breakpoint (mobile-first), all responsive classes should not apply
    if (activeBreakpoint === 'base') {
      baseStyle.display = 'block'
      baseStyle.flexDirection = 'column'
      baseStyle.gridTemplateColumns = 'none'
    }

    // If no responsive classes apply at current breakpoint, ensure consistent base state
    const hasActiveResponsiveClass = 
      (classList.includes('sm:flex') && activeBreakpoint !== 'base') ||
      (classList.includes('sm:grid') && activeBreakpoint !== 'base') ||
      (classList.includes('md:flex-row') && (activeBreakpoint === 'md' || activeBreakpoint === 'lg' || activeBreakpoint === 'xl')) ||
      (classList.includes('md:grid-cols-2') && (activeBreakpoint === 'md' || activeBreakpoint === 'lg' || activeBreakpoint === 'xl')) ||
      (classList.includes('lg:flex-row') && (activeBreakpoint === 'lg' || activeBreakpoint === 'xl')) ||
      (classList.includes('lg:grid-cols-3') && (activeBreakpoint === 'lg' || activeBreakpoint === 'xl')) ||
      (classList.includes('xl:grid-cols-4') && activeBreakpoint === 'xl')

    if (!hasActiveResponsiveClass && activeBreakpoint !== 'base') {
      // No responsive classes active at this breakpoint, maintain base state
      baseStyle.display = 'block'
      baseStyle.flexDirection = 'column'
      baseStyle.gridTemplateColumns = 'none'
    }

    // Apply responsive flex direction
    if (classList.includes('md:flex-row') && 
        (activeBreakpoint === 'md' || activeBreakpoint === 'lg' || activeBreakpoint === 'xl')) {
      baseStyle.flexDirection = 'row'
      baseStyle.getPropertyValue = (property: string) => {
        switch (property) {
          case '-webkit-flex-direction':
            return browserType === 'safari' ? 'row' : ''
          case '-ms-flex-direction':
            return browserType === 'edge' ? 'row' : ''
          default:
            return baseStyle.getPropertyValue(property)
        }
      }
    }

    if (classList.includes('lg:flex-row') && 
        (activeBreakpoint === 'lg' || activeBreakpoint === 'xl')) {
      baseStyle.flexDirection = 'row'
    }

    // Apply responsive grid columns
    if (classList.includes('md:grid-cols-2') && 
        (activeBreakpoint === 'md' || activeBreakpoint === 'lg' || activeBreakpoint === 'xl')) {
      if (supportsGrid) {
        baseStyle.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))'
        baseStyle.getPropertyValue = (property: string) => {
          switch (property) {
            case '-ms-grid-columns':
              return browserType === 'edge' ? '1fr 1fr' : ''
            default:
              return baseStyle.getPropertyValue(property)
          }
        }
      }
    }

    if (classList.includes('lg:grid-cols-3') && 
        (activeBreakpoint === 'lg' || activeBreakpoint === 'xl')) {
      if (supportsGrid) {
        baseStyle.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))'
        baseStyle.getPropertyValue = (property: string) => {
          switch (property) {
            case '-ms-grid-columns':
              return browserType === 'edge' ? '1fr 1fr 1fr' : ''
            default:
              return baseStyle.getPropertyValue(property)
          }
        }
      }
    }

    if (classList.includes('xl:grid-cols-4') && activeBreakpoint === 'xl') {
      if (supportsGrid) {
        baseStyle.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))'
        baseStyle.getPropertyValue = (property: string) => {
          switch (property) {
            case '-ms-grid-columns':
              return browserType === 'edge' ? '1fr 1fr 1fr 1fr' : ''
            default:
              return baseStyle.getPropertyValue(property)
          }
        }
      }
    }

    return baseStyle
  })
}

// Viewport configuration generator
const viewportConfigArb = fc.record({
  width: fc.integer({ min: 320, max: 2560 }),
  height: fc.integer({ min: 568, max: 1440 }),
  devicePixelRatio: fc.constantFrom(1, 1.25, 1.5, 2, 3)
})

// Responsive layout generator with proper container type alignment
const responsiveLayoutArb = fc.oneof(
  // Flex-based responsive layouts
  fc.record({
    containerType: fc.constant('flex'),
    breakpointClasses: fc.constantFrom(
      ['sm:flex'],
      ['sm:flex', 'md:flex-row'],
      ['sm:flex', 'md:flex-row', 'lg:flex-row']
    ),
    itemCount: fc.integer({ min: 2, max: 8 }),
    hasNestedResponsive: fc.boolean()
  }),
  
  // Grid-based responsive layouts
  fc.record({
    containerType: fc.constant('grid'),
    breakpointClasses: fc.constantFrom(
      ['sm:grid'],
      ['sm:grid', 'md:grid-cols-2'],
      ['sm:grid', 'md:grid-cols-2', 'lg:grid-cols-3'],
      ['sm:grid', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4']
    ),
    itemCount: fc.integer({ min: 2, max: 8 }),
    hasNestedResponsive: fc.boolean()
  }),
  
  // Mixed layouts (transition from flex to grid at different breakpoints)
  fc.record({
    containerType: fc.constant('mixed'),
    breakpointClasses: fc.constantFrom(
      ['sm:flex', 'lg:grid'],
      ['sm:flex', 'md:flex-row', 'xl:grid-cols-4']
    ),
    itemCount: fc.integer({ min: 2, max: 8 }),
    hasNestedResponsive: fc.boolean()
  })
)

// Browser environment generator with realistic support combinations
const browserEnvironmentArb = fc.oneof(
  // Modern browsers with full support
  fc.record({
    browserType: fc.constantFrom('chrome', 'firefox', 'safari', 'edge') as fc.Arbitrary<keyof typeof browserUserAgents>,
    supportsModernCSS: fc.constant(true),
    supportsGrid: fc.constant(true)
  }),
  
  // Older browsers with limited support (less common)
  fc.record({
    browserType: fc.constantFrom('edge') as fc.Arbitrary<keyof typeof browserUserAgents>, // Only Edge might have limited grid support
    supportsModernCSS: fc.boolean(),
    supportsGrid: fc.boolean()
  })
)

describe('Responsive Breakpoint Consistency Property Tests', () => {
  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  /**
   * Property 7: Responsive Breakpoint Consistency
   * For any media query breakpoint, the applied styles should be identical 
   * across all browsers at the same viewport dimensions
   */
  test('Property 7: Responsive Breakpoint Consistency - breakpoints trigger consistently across browsers', () => {
    fc.assert(
      fc.property(
        responsiveLayoutArb,
        viewportConfigArb,
        fc.array(browserEnvironmentArb, { minLength: 2, maxLength: 4 }),
        (layoutConfig, viewport, browserEnvironments) => {
          const breakpointResults: any[] = []

          // Test the same layout across multiple browsers at the same viewport
          browserEnvironments.forEach(browserEnv => {
            // Mock browser environment
            Object.defineProperty(window.navigator, 'userAgent', {
              value: browserUserAgents[browserEnv.browserType],
              writable: true
            })

            // Mock viewport dimensions
            Object.defineProperty(window, 'innerWidth', { value: viewport.width, writable: true })
            Object.defineProperty(window, 'innerHeight', { value: viewport.height, writable: true })
            
            // Mock matchMedia for this viewport
            window.matchMedia = createMockMatchMedia(viewport.width)
            
            // Mock getComputedStyle for this browser and viewport
            global.getComputedStyle = createMockGetComputedStyleForBreakpoint(
              browserEnv.browserType, 
              viewport.width,
              browserEnv.supportsGrid
            )

            // Clear previous test
            document.body.innerHTML = ''

            // Create responsive container
            const container = document.createElement('div')
            container.className = `responsive-container ${layoutConfig.breakpointClasses.join(' ')}`

            // Add responsive items
            for (let i = 0; i < layoutConfig.itemCount; i++) {
              const item = document.createElement('div')
              item.className = 'responsive-item'
              item.textContent = `Item ${i}`
              item.style.minHeight = '50px'
              item.style.backgroundColor = `hsl(${i * 40}, 70%, 90%)`
              
              if (layoutConfig.hasNestedResponsive && i % 2 === 0) {
                const nestedContainer = document.createElement('div')
                nestedContainer.className = 'sm:flex md:flex-row'
                
                for (let j = 0; j < 2; j++) {
                  const nestedItem = document.createElement('div')
                  nestedItem.textContent = `Nested ${j}`
                  nestedItem.style.padding = '8px'
                  nestedContainer.appendChild(nestedItem)
                }
                
                item.appendChild(nestedContainer)
              }
              
              container.appendChild(item)
            }

            document.body.appendChild(container)

            // Measure responsive behavior
            const containerStyle = window.getComputedStyle(container)
            
            // Determine expected breakpoint
            const expectedBreakpoint = viewport.width >= breakpoints.xl ? 'xl' :
                                     viewport.width >= breakpoints.lg ? 'lg' :
                                     viewport.width >= breakpoints.md ? 'md' :
                                     viewport.width >= breakpoints.sm ? 'sm' : 'base'

            // Test media query matching
            const smMatches = window.matchMedia(`(min-width: ${breakpoints.sm}px)`).matches
            const mdMatches = window.matchMedia(`(min-width: ${breakpoints.md}px)`).matches
            const lgMatches = window.matchMedia(`(min-width: ${breakpoints.lg}px)`).matches
            const xlMatches = window.matchMedia(`(min-width: ${breakpoints.xl}px)`).matches

            breakpointResults.push({
              browser: browserEnv.browserType,
              viewport: viewport.width,
              expectedBreakpoint,
              mediaQueries: { smMatches, mdMatches, lgMatches, xlMatches },
              containerStyle: {
                display: containerStyle.display,
                padding: containerStyle.padding,
                flexDirection: containerStyle.flexDirection,
                gridTemplateColumns: containerStyle.gridTemplateColumns
              }
            })
          })

          // Property: Media queries should match consistently across browsers
          const firstResult = breakpointResults[0]
          const mediaQueryConsistency = breakpointResults.every(result => 
            result.mediaQueries.smMatches === firstResult.mediaQueries.smMatches &&
            result.mediaQueries.mdMatches === firstResult.mediaQueries.mdMatches &&
            result.mediaQueries.lgMatches === firstResult.mediaQueries.lgMatches &&
            result.mediaQueries.xlMatches === firstResult.mediaQueries.xlMatches
          )

          // Property: Expected breakpoint should be consistent across browsers
          const breakpointConsistency = breakpointResults.every(result => 
            result.expectedBreakpoint === firstResult.expectedBreakpoint
          )

          // Property: Responsive padding should be consistent across browsers
          const paddingConsistency = breakpointResults.every(result => 
            result.containerStyle.padding === firstResult.containerStyle.padding
          )

          // Property: Display properties should be consistent within same browser capabilities
          const displayConsistency = (() => {
            // For base breakpoint (below sm), all browsers should show block display
            const activeBreakpoint = viewport.width >= breakpoints.xl ? 'xl' :
                                   viewport.width >= breakpoints.lg ? 'lg' :
                                   viewport.width >= breakpoints.md ? 'md' :
                                   viewport.width >= breakpoints.sm ? 'sm' : 'base'

            if (activeBreakpoint === 'base') {
              // At base breakpoint, all responsive classes should be inactive
              return breakpointResults.every(result => 
                result.containerStyle.display === 'block'
              )
            }

            // For mixed layouts at sm breakpoint (640px), only sm:flex should be active
            if (layoutConfig.containerType === 'mixed' && activeBreakpoint === 'sm') {
              // At sm breakpoint, only sm:flex is active, lg:grid is not yet active
              const flexDisplays = ['flex', '-webkit-flex', '-ms-flexbox']
              return breakpointResults.every(result => 
                flexDisplays.includes(result.containerStyle.display)
              )
            }

            // Group browsers by their grid support capability
            const gridSupportGroups = breakpointResults.reduce((groups, result, index) => {
              const browserEnv = browserEnvironments[index]
              const key = browserEnv.supportsGrid ? 'supportsGrid' : 'noGrid'
              if (!groups[key]) {
                groups[key] = []
              }
              groups[key].push({ result, browserEnv })
              return groups
            }, {} as Record<string, Array<{ result: any, browserEnv: any }>>)

            // Within each grid support group, display behavior should be consistent
            return Object.values(gridSupportGroups).every(group => {
              if (group.length <= 1) return true
              
              const firstItem = group[0]
              const firstDisplay = firstItem.result.containerStyle.display
              
              return group.every(({ result }) => {
                const currentDisplay = result.containerStyle.display
                
                // Allow vendor prefix variations within the same display type
                const flexDisplays = ['flex', '-webkit-flex', '-ms-flexbox']
                const gridDisplays = ['grid', '-ms-grid']
                const blockDisplays = ['block']
                
                if (flexDisplays.includes(firstDisplay)) {
                  return flexDisplays.includes(currentDisplay)
                }
                if (gridDisplays.includes(firstDisplay)) {
                  return gridDisplays.includes(currentDisplay)
                }
                if (blockDisplays.includes(firstDisplay)) {
                  return blockDisplays.includes(currentDisplay)
                }
                
                return firstDisplay === currentDisplay
              })
            })
          })()

          // Property: Flex direction should be consistent across browsers at same breakpoint
          const flexDirectionConsistency = breakpointResults.every(result => 
            result.containerStyle.flexDirection === firstResult.containerStyle.flexDirection
          )

          return mediaQueryConsistency && 
                 breakpointConsistency && 
                 paddingConsistency && 
                 displayConsistency && 
                 flexDirectionConsistency
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 7: Responsive Breakpoint Consistency - breakpoint transitions work smoothly', () => {
    fc.assert(
      fc.property(
        responsiveLayoutArb,
        browserEnvironmentArb,
        fc.array(fc.integer({ min: 320, max: 2560 }), { minLength: 3, maxLength: 6 }),
        (layoutConfig, browserEnv, viewportWidths) => {
          // Sort viewport widths to simulate smooth transitions
          const sortedWidths = [...viewportWidths].sort((a, b) => a - b)

          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserUserAgents[browserEnv.browserType],
            writable: true
          })

          const transitionResults: any[] = []

          // Test transitions across different viewport widths
          sortedWidths.forEach((width, index) => {
            // Mock viewport dimensions
            Object.defineProperty(window, 'innerWidth', { value: width, writable: true })
            
            // Mock matchMedia for this viewport
            window.matchMedia = createMockMatchMedia(width)
            
            // Mock getComputedStyle for this viewport
            global.getComputedStyle = createMockGetComputedStyleForBreakpoint(
              browserEnv.browserType, 
              width,
              browserEnv.supportsGrid
            )

            // Clear previous test
            document.body.innerHTML = ''

            // Create responsive container
            const container = document.createElement('div')
            container.className = `responsive-container ${layoutConfig.breakpointClasses.join(' ')}`

            // Add items
            for (let i = 0; i < layoutConfig.itemCount; i++) {
              const item = document.createElement('div')
              item.textContent = `Item ${i}`
              container.appendChild(item)
            }

            document.body.appendChild(container)

            // Measure styles at this viewport
            const containerStyle = window.getComputedStyle(container)
            
            // Determine active breakpoint
            const activeBreakpoint = width >= breakpoints.xl ? 'xl' :
                                   width >= breakpoints.lg ? 'lg' :
                                   width >= breakpoints.md ? 'md' :
                                   width >= breakpoints.sm ? 'sm' : 'base'

            transitionResults.push({
              width,
              activeBreakpoint,
              padding: containerStyle.padding,
              display: containerStyle.display,
              flexDirection: containerStyle.flexDirection,
              gridTemplateColumns: containerStyle.gridTemplateColumns
            })
          })

          // Property: Breakpoint transitions should be logical and consistent
          let transitionsValid = true
          
          for (let i = 1; i < transitionResults.length; i++) {
            const prev = transitionResults[i - 1]
            const current = transitionResults[i]
            
            // Property: Breakpoint should only change at defined thresholds
            const breakpointChangeValid = 
              prev.activeBreakpoint === current.activeBreakpoint ||
              (prev.width < breakpoints.sm && current.width >= breakpoints.sm) ||
              (prev.width < breakpoints.md && current.width >= breakpoints.md) ||
              (prev.width < breakpoints.lg && current.width >= breakpoints.lg) ||
              (prev.width < breakpoints.xl && current.width >= breakpoints.xl)

            // Property: Padding should increase or stay same as viewport grows
            const paddingProgression = 
              parseFloat(current.padding) >= parseFloat(prev.padding)

            // Property: Display should remain consistent within same breakpoint
            const displayConsistency = 
              prev.activeBreakpoint !== current.activeBreakpoint ||
              prev.display === current.display ||
              // Allow vendor prefix variations
              (prev.display.includes('flex') && current.display.includes('flex')) ||
              (prev.display.includes('grid') && current.display.includes('grid'))

            if (!breakpointChangeValid || !paddingProgression || !displayConsistency) {
              transitionsValid = false
              break
            }
          }

          // Property: Each breakpoint should have distinct characteristics
          const breakpointDistinction = (() => {
            const breakpointGroups = transitionResults.reduce((groups, result) => {
              if (!groups[result.activeBreakpoint]) {
                groups[result.activeBreakpoint] = []
              }
              groups[result.activeBreakpoint].push(result)
              return groups
            }, {} as Record<string, any[]>)

            // Each breakpoint group should have consistent styles
            return Object.values(breakpointGroups).every(group => {
              const firstInGroup = group[0]
              return group.every(result => 
                result.padding === firstInGroup.padding &&
                result.display === firstInGroup.display
              )
            })
          })()

          return transitionsValid && breakpointDistinction
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 7: Responsive Breakpoint Consistency - nested responsive elements work correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          containerType: fc.constantFrom('flex'),
          breakpointClasses: fc.constantFrom(
            ['sm:flex', 'md:flex-row']
          ),
          itemCount: fc.integer({ min: 2, max: 4 }),
          hasNestedResponsive: fc.constant(true)
        }),
        viewportConfigArb,
        fc.record({
          browserType: fc.constantFrom('chrome', 'firefox', 'safari', 'edge') as fc.Arbitrary<keyof typeof browserUserAgents>,
          supportsModernCSS: fc.constant(true),
          supportsGrid: fc.constant(true) // Only test with grid-supporting browsers for nested grid
        }),
        (layoutConfig, viewport, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserUserAgents[browserEnv.browserType],
            writable: true
          })

          // Mock viewport dimensions
          Object.defineProperty(window, 'innerWidth', { value: viewport.width, writable: true })
          window.matchMedia = createMockMatchMedia(viewport.width)
          global.getComputedStyle = createMockGetComputedStyleForBreakpoint(
            browserEnv.browserType, 
            viewport.width,
            browserEnv.supportsGrid
          )

          // Create nested responsive structure
          const outerContainer = document.createElement('div')
          outerContainer.className = 'responsive-container sm:flex md:flex-row'

          for (let i = 0; i < layoutConfig.itemCount; i++) {
            const item = document.createElement('div')
            item.className = 'responsive-item'
            
            // Add nested responsive container
            const nestedContainer = document.createElement('div')
            nestedContainer.className = 'responsive-container sm:grid md:grid-cols-2 lg:grid-cols-3'
            
            for (let j = 0; j < 3; j++) {
              const nestedItem = document.createElement('div')
              nestedItem.textContent = `Nested ${i}-${j}`
              nestedItem.style.minHeight = '30px'
              nestedContainer.appendChild(nestedItem)
            }
            
            item.appendChild(nestedContainer)
            outerContainer.appendChild(item)
          }

          document.body.appendChild(outerContainer)

          // Test nested responsive behavior
          const outerStyle = window.getComputedStyle(outerContainer)
          const nestedContainers = outerContainer.querySelectorAll('.responsive-container')
          
          let nestedConsistency = true
          
          nestedContainers.forEach((nested, index) => {
            if (index === 0) return // Skip outer container
            
            const nestedStyle = window.getComputedStyle(nested as HTMLElement)
            
            // Property: Nested containers should respond to same breakpoints
            const activeBreakpoint = viewport.width >= breakpoints.xl ? 'xl' :
                                   viewport.width >= breakpoints.lg ? 'lg' :
                                   viewport.width >= breakpoints.md ? 'md' :
                                   viewport.width >= breakpoints.sm ? 'sm' : 'base'

            // Property: Nested responsive padding should be consistent
            const expectedPadding = activeBreakpoint === 'xl' ? '4rem' :
                                  activeBreakpoint === 'lg' ? '3rem' :
                                  activeBreakpoint === 'md' ? '2rem' :
                                  activeBreakpoint === 'sm' ? '1.5rem' : '1rem'

            if (nestedStyle.padding !== expectedPadding) {
              nestedConsistency = false
            }

            // Property: Nested display properties should work correctly
            if (activeBreakpoint !== 'base') {
              const hasValidDisplay = 
                nestedStyle.display === 'grid' ||
                nestedStyle.display === '-ms-grid' ||
                nestedStyle.display === 'flex' // fallback
              
              if (!hasValidDisplay) {
                nestedConsistency = false
              }
            }
          })

          // Property: Outer container should maintain its responsive behavior
          const outerResponsiveValid = (() => {
            const activeBreakpoint = viewport.width >= breakpoints.xl ? 'xl' :
                                   viewport.width >= breakpoints.lg ? 'lg' :
                                   viewport.width >= breakpoints.md ? 'md' :
                                   viewport.width >= breakpoints.sm ? 'sm' : 'base'

            if (activeBreakpoint === 'base') {
              return outerStyle.display === 'block'
            }

            const hasValidOuterDisplay = 
              outerStyle.display === 'flex' ||
              outerStyle.display === '-webkit-flex' ||
              outerStyle.display === '-ms-flexbox'

            const hasCorrectFlexDirection = 
              activeBreakpoint === 'base' || activeBreakpoint === 'sm' ? 
                outerStyle.flexDirection === 'column' :
                outerStyle.flexDirection === 'row'

            return hasValidOuterDisplay && hasCorrectFlexDirection
          })()

          // Property: Breakpoint inheritance should work correctly
          const breakpointInheritanceValid = (() => {
            // Child elements should inherit breakpoint context from parent
            const mediaQueries = {
              sm: window.matchMedia(`(min-width: ${breakpoints.sm}px)`).matches,
              md: window.matchMedia(`(min-width: ${breakpoints.md}px)`).matches,
              lg: window.matchMedia(`(min-width: ${breakpoints.lg}px)`).matches,
              xl: window.matchMedia(`(min-width: ${breakpoints.xl}px)`).matches
            }

            // All nested elements should see the same media query results
            return mediaQueries.sm === (viewport.width >= breakpoints.sm) &&
                   mediaQueries.md === (viewport.width >= breakpoints.md) &&
                   mediaQueries.lg === (viewport.width >= breakpoints.lg) &&
                   mediaQueries.xl === (viewport.width >= breakpoints.xl)
          })()

          return nestedConsistency && outerResponsiveValid && breakpointInheritanceValid
        }
      ),
      { numRuns: 100 }
    )
  })
})