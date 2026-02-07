/**
 * Property-Based Tests for Chrome Background Color Consistency
 * Feature: chrome-scroll-black-bar-fix, Property 5: Chrome Background Color Consistency
 * Validates: Requirements 5.4
 */

import fc from 'fast-check'
import { JSDOM } from 'jsdom'
import { 
  chromeScrollPerformanceManager,
  isChromeBasedBrowser,
  CHROME_SCROLL_CLASSES 
} from '../../lib/utils/chrome-scroll-performance'

// Mock Chrome browser environment
const mockChromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const mockChromeVendor = 'Google Inc.'

// Setup JSDOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  userAgent: mockChromeUserAgent
})

global.window = dom.window as any
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
global.getComputedStyle = dom.window.getComputedStyle
global.performance = { now: () => Date.now() } as any

// Mock Chrome browser detection
Object.defineProperty(window.navigator, 'userAgent', {
  value: mockChromeUserAgent,
  writable: true
})

Object.defineProperty(window.navigator, 'vendor', {
  value: mockChromeVendor,
  writable: true
})

// Layout element generator
const layoutElementArb = fc.record({
  tagName: fc.constantFrom('div', 'main', 'section', 'article'),
  className: fc.string({ minLength: 0, maxLength: 50 }),
  id: fc.string({ minLength: 0, maxLength: 20 }),
  hasChildren: fc.boolean(),
  childCount: fc.integer({ min: 0, max: 5 })
})

// Background color generator
const backgroundColorArb = fc.oneof(
  fc.constant('#ffffff'),
  fc.constant('rgb(255, 255, 255)'),
  fc.constant('white'),
  fc.constant('#f9fafb'), // gray-50
  fc.constant('#f3f4f6'), // gray-100
  fc.constant('#000000'), // black (should be prevented)
  fc.constant('#1f2937'), // gray-800 (should be prevented)
  fc.constant('transparent'),
  fc.constant('rgba(0, 0, 0, 0)')
)

// CSS property generator
const cssPropertyArb = fc.record({
  backgroundColor: backgroundColorArb,
  backgroundImage: fc.oneof(
    fc.constant('none'),
    fc.constant('linear-gradient(to bottom, #ffffff 0%, #ffffff 100%)'),
    fc.constant('linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%)')
  ),
  backgroundAttachment: fc.constantFrom('local', 'scroll', 'fixed'),
  minHeight: fc.constantFrom('100vh', '100%', 'auto'),
  contain: fc.constantFrom('layout', 'style', 'paint', 'layout style', 'layout style paint', 'none')
})

describe('Chrome Background Color Consistency Property Tests', () => {
  let mockElement: HTMLElement
  let mockComputedStyle: any

  beforeEach(() => {
    // Create fresh mock element
    mockElement = document.createElement('div')
    document.body.appendChild(mockElement)

    // Mock computed style
    mockComputedStyle = {
      backgroundColor: 'rgb(255, 255, 255)',
      backgroundImage: 'linear-gradient(to bottom, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 100%)',
      backgroundAttachment: 'local',
      minHeight: '100vh',
      contain: 'layout style paint',
      willChange: 'scroll-position',
      transform: 'translateZ(0px)',
      overscrollBehavior: 'contain'
    }

    // Mock getComputedStyle
    global.getComputedStyle = jest.fn().mockReturnValue(mockComputedStyle)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  /**
   * Property 5: Chrome Background Color Consistency
   * For any layout element, gray or dark backgrounds should be prevented from showing through, 
   * maintaining only white backgrounds
   */
  test('Property 5: Chrome Background Color Consistency - prevents gray/dark backgrounds', () => {
    fc.assert(
      fc.property(
        layoutElementArb,
        cssPropertyArb,
        (layoutConfig, cssConfig) => {
          // Create element with layout configuration
          const element = document.createElement(layoutConfig.tagName)
          element.className = layoutConfig.className
          element.id = layoutConfig.id

          // Add children if specified
          if (layoutConfig.hasChildren) {
            for (let i = 0; i < layoutConfig.childCount; i++) {
              const child = document.createElement('div')
              child.textContent = `Child ${i}`
              element.appendChild(child)
            }
          }

          // Apply initial CSS configuration
          element.style.backgroundColor = cssConfig.backgroundColor
          element.style.backgroundImage = cssConfig.backgroundImage
          element.style.backgroundAttachment = cssConfig.backgroundAttachment
          element.style.minHeight = cssConfig.minHeight
          element.style.contain = cssConfig.contain

          // Apply Chrome optimizations
          chromeScrollPerformanceManager.applyChromeOptimizations(element)

          // Get computed style after optimizations
          const computedStyle = window.getComputedStyle(element)

          // Property: Background color should be white after Chrome optimizations
          const backgroundColor = computedStyle.backgroundColor
          const isWhiteBackground = 
            backgroundColor === 'rgb(255, 255, 255)' ||
            backgroundColor === '#ffffff' ||
            backgroundColor === 'white' ||
            backgroundColor === 'rgba(0, 0, 0, 0)' ||
            backgroundColor === 'transparent'

          // Property: Gray or dark backgrounds should be prevented
          const isGrayOrDark = 
            backgroundColor.includes('rgb(31, 41, 55)') || // gray-800
            backgroundColor.includes('rgb(17, 24, 39)') || // gray-900
            backgroundColor.includes('rgb(0, 0, 0)') || // black
            backgroundColor === '#000000' ||
            backgroundColor === '#1f2937' ||
            backgroundColor === '#111827'

          // Property: Chrome optimization classes should maintain white background
          const hasBackgroundConsistencyClass = element.classList.contains(CHROME_SCROLL_CLASSES.BACKGROUND_CONSISTENCY)
          const hasScrollStateBackgroundClass = element.classList.contains(CHROME_SCROLL_CLASSES.SCROLL_STATE_BACKGROUND)

          return isWhiteBackground && 
                 !isGrayOrDark && 
                 hasBackgroundConsistencyClass && 
                 hasScrollStateBackgroundClass
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 5: Chrome Background Color Consistency - maintains consistency across scroll states', () => {
    fc.assert(
      fc.property(
        fc.array(layoutElementArb, { minLength: 1, maxLength: 10 }),
        fc.boolean(), // isScrolling state
        fc.boolean(), // isMomentumScrolling state
        (layoutConfigs, isScrolling, isMomentumScrolling) => {
          const elements: HTMLElement[] = []

          // Create multiple elements with different configurations
          layoutConfigs.forEach((config, index) => {
            const element = document.createElement(config.tagName)
            element.className = config.className
            element.id = `${config.id}-${index}`

            // Apply Chrome optimizations
            chromeScrollPerformanceManager.applyChromeOptimizations(element)

            // Simulate scroll states
            if (isScrolling) {
              element.classList.add('chrome-scrolling')
              element.style.willChange = 'scroll-position, transform'
            }

            if (isMomentumScrolling) {
              element.classList.add('chrome-momentum-scrolling')
              element.style.transform = 'translate3d(0, 0, 0)'
            }

            elements.push(element)
          })

          // Property: All elements should maintain white background consistency
          const allHaveWhiteBackground = elements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            const backgroundColor = computedStyle.backgroundColor
            
            return backgroundColor === 'rgb(255, 255, 255)' ||
                   backgroundColor === '#ffffff' ||
                   backgroundColor === 'white' ||
                   backgroundColor === 'rgba(0, 0, 0, 0)' ||
                   backgroundColor === 'transparent'
          })

          // Property: All elements should have background consistency classes
          const allHaveConsistencyClasses = elements.every(element => {
            return element.classList.contains(CHROME_SCROLL_CLASSES.BACKGROUND_CONSISTENCY) &&
                   element.classList.contains(CHROME_SCROLL_CLASSES.SCROLL_STATE_BACKGROUND)
          })

          // Property: Background should remain consistent regardless of scroll state
          const backgroundConsistentAcrossStates = elements.every(element => {
            const style = element.style
            return style.backgroundColor === '#ffffff' ||
                   style.backgroundColor === 'rgb(255, 255, 255)' ||
                   style.backgroundColor === ''
          })

          return allHaveWhiteBackground && 
                 allHaveConsistencyClasses && 
                 backgroundConsistentAcrossStates
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 5: Chrome Background Color Consistency - prevents dark backgrounds in nested layouts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // nesting depth
        fc.array(backgroundColorArb, { minLength: 1, maxLength: 5 }), // background colors for each level
        (nestingDepth, backgroundColors) => {
          let currentElement = mockElement

          // Create nested structure
          for (let i = 0; i < nestingDepth; i++) {
            const childElement = document.createElement('div')
            childElement.className = `nested-level-${i}`
            
            // Apply background color from generator
            if (i < backgroundColors.length) {
              childElement.style.backgroundColor = backgroundColors[i]
            }

            // Apply Chrome optimizations to each level
            chromeScrollPerformanceManager.applyChromeOptimizations(childElement)

            currentElement.appendChild(childElement)
            currentElement = childElement
          }

          // Collect all nested elements
          const nestedElements: HTMLElement[] = []
          let element = mockElement.firstElementChild as HTMLElement
          while (element) {
            nestedElements.push(element)
            element = element.firstElementChild as HTMLElement
          }

          // Property: All nested elements should have white backgrounds after optimization
          const allNestedHaveWhiteBackground = nestedElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            const backgroundColor = computedStyle.backgroundColor
            
            return backgroundColor === 'rgb(255, 255, 255)' ||
                   backgroundColor === '#ffffff' ||
                   backgroundColor === 'white' ||
                   backgroundColor === 'rgba(0, 0, 0, 0)' ||
                   backgroundColor === 'transparent'
          })

          // Property: No dark or gray backgrounds should remain
          const noDarkBackgrounds = nestedElements.every(element => {
            const style = element.style
            const backgroundColor = style.backgroundColor
            
            return !backgroundColor.includes('rgb(0, 0, 0)') &&
                   !backgroundColor.includes('#000000') &&
                   !backgroundColor.includes('rgb(31, 41, 55)') &&
                   !backgroundColor.includes('#1f2937')
          })

          // Property: All elements should have Chrome background consistency classes
          const allHaveConsistencyClasses = nestedElements.every(element => {
            return element.classList.contains(CHROME_SCROLL_CLASSES.BACKGROUND_CONSISTENCY)
          })

          return allNestedHaveWhiteBackground && 
                 noDarkBackgrounds && 
                 allHaveConsistencyClasses
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 5: Chrome Background Color Consistency - handles dynamic background changes', () => {
    fc.assert(
      fc.property(
        fc.array(backgroundColorArb, { minLength: 2, maxLength: 10 }), // sequence of background changes
        fc.integer({ min: 100, max: 1000 }), // time between changes
        (backgroundSequence, timeBetweenChanges) => {
          const element = document.createElement('div')
          
          // Apply initial Chrome optimizations
          chromeScrollPerformanceManager.applyChromeOptimizations(element)

          let allChangesResultedInWhite = true

          // Apply sequence of background changes
          backgroundSequence.forEach((backgroundColor, index) => {
            // Change background color
            element.style.backgroundColor = backgroundColor

            // Re-apply Chrome optimizations (simulating dynamic updates)
            chromeScrollPerformanceManager.applyChromeOptimizations(element)

            // Check if background is now white
            const computedStyle = window.getComputedStyle(element)
            const finalBackgroundColor = computedStyle.backgroundColor

            const isWhite = 
              finalBackgroundColor === 'rgb(255, 255, 255)' ||
              finalBackgroundColor === '#ffffff' ||
              finalBackgroundColor === 'white' ||
              finalBackgroundColor === 'rgba(0, 0, 0, 0)' ||
              finalBackgroundColor === 'transparent'

            if (!isWhite) {
              allChangesResultedInWhite = false
            }
          })

          // Property: All dynamic background changes should result in white background
          // Property: Chrome optimization classes should remain applied
          const hasConsistencyClasses = 
            element.classList.contains(CHROME_SCROLL_CLASSES.BACKGROUND_CONSISTENCY) &&
            element.classList.contains(CHROME_SCROLL_CLASSES.SCROLL_STATE_BACKGROUND)

          // Property: Final background should be white
          const finalStyle = window.getComputedStyle(element)
          const finalBackgroundIsWhite = 
            finalStyle.backgroundColor === 'rgb(255, 255, 255)' ||
            finalStyle.backgroundColor === '#ffffff' ||
            finalStyle.backgroundColor === 'white' ||
            finalStyle.backgroundColor === 'rgba(0, 0, 0, 0)' ||
            finalStyle.backgroundColor === 'transparent'

          return allChangesResultedInWhite && 
                 hasConsistencyClasses && 
                 finalBackgroundIsWhite
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 5: Chrome Background Color Consistency - works with CSS custom properties', () => {
    fc.assert(
      fc.property(
        fc.record({
          customPropertyName: fc.string({ minLength: 2, maxLength: 15 })
            .filter(s => s.trim().length >= 2 && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s))
            .map(s => `--${s}`),
          customPropertyValue: backgroundColorArb,
          fallbackColor: backgroundColorArb,
          isSidebar: fc.boolean()
        }),
        (cssConfig) => {
          const element = document.createElement('div')
          
          // Configure element as sidebar or main content
          if (cssConfig.isSidebar) {
            element.classList.add('bg-gray-800')
            element.id = 'navigation'
          }
          
          // Set CSS custom property
          element.style.setProperty(cssConfig.customPropertyName, cssConfig.customPropertyValue)
          element.style.backgroundColor = `var(${cssConfig.customPropertyName}, ${cssConfig.fallbackColor})`

          // Apply Chrome optimizations
          chromeScrollPerformanceManager.applyChromeOptimizations(element)

          // Property: Chrome optimization should override custom properties with correct color
          let expectedBackgroundColors: string[]
          let hasExpectedClasses: boolean

          if (cssConfig.isSidebar) {
            // Sidebar should have gray background (accept both hex and rgb formats)
            expectedBackgroundColors = ['#1f2937', 'rgb(31, 41, 55)']
            hasExpectedClasses = element.classList.contains(CHROME_SCROLL_CLASSES.SIDEBAR_BACKGROUND_CONSISTENCY) &&
                                element.classList.contains(CHROME_SCROLL_CLASSES.SIDEBAR_SCROLL_STATE_BACKGROUND)
          } else {
            // Main content should have white background (accept both hex and rgb formats)
            expectedBackgroundColors = ['#ffffff', 'rgb(255, 255, 255)', 'white']
            hasExpectedClasses = element.classList.contains(CHROME_SCROLL_CLASSES.BACKGROUND_CONSISTENCY) &&
                                element.classList.contains(CHROME_SCROLL_CLASSES.SCROLL_STATE_BACKGROUND)
          }

          // Property: Chrome optimization should override custom properties with correct color
          const styleBackgroundIsCorrect = expectedBackgroundColors.includes(element.style.backgroundColor)

          // Property: Appropriate consistency classes should be applied
          return styleBackgroundIsCorrect && hasExpectedClasses
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 5: Chrome Background Color Consistency - maintains consistency during resize events', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          width: fc.integer({ min: 100, max: 2000 }),
          height: fc.integer({ min: 100, max: 1500 })
        }), { minLength: 2, maxLength: 5 }), // sequence of resize events
        (resizeSequence) => {
          const element = document.createElement('div')
          
          // Apply Chrome optimizations
          chromeScrollPerformanceManager.applyChromeOptimizations(element)

          let backgroundConsistentThroughResize = true

          // Simulate resize events
          resizeSequence.forEach((size, index) => {
            // Change element size
            element.style.width = `${size.width}px`
            element.style.height = `${size.height}px`

            // Trigger resize-like behavior (re-apply optimizations)
            chromeScrollPerformanceManager.applyChromeOptimizations(element)

            // Check background consistency
            const computedStyle = window.getComputedStyle(element)
            const backgroundColor = computedStyle.backgroundColor

            const isWhite = 
              backgroundColor === 'rgb(255, 255, 255)' ||
              backgroundColor === '#ffffff' ||
              backgroundColor === 'white' ||
              backgroundColor === 'rgba(0, 0, 0, 0)' ||
              backgroundColor === 'transparent'

            if (!isWhite) {
              backgroundConsistentThroughResize = false
            }
          })

          // Property: Background should remain white through all resize events
          // Property: Chrome classes should remain applied
          const hasConsistencyClasses = element.classList.contains(CHROME_SCROLL_CLASSES.BACKGROUND_CONSISTENCY)

          // Property: Final background should be white
          const finalStyle = window.getComputedStyle(element)
          const finalBackgroundIsWhite = 
            finalStyle.backgroundColor === 'rgb(255, 255, 255)' ||
            finalStyle.backgroundColor === '#ffffff' ||
            finalStyle.backgroundColor === 'white' ||
            finalStyle.backgroundColor === 'rgba(0, 0, 0, 0)' ||
            finalStyle.backgroundColor === 'transparent'

          return backgroundConsistentThroughResize && 
                 hasConsistencyClasses && 
                 finalBackgroundIsWhite
        }
      ),
      { numRuns: 100 }
    )
  })
})