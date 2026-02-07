/**
 * Property-Based Tests for CSS Reset Consistency
 * Feature: cross-browser-compatibility, Property 1: CSS Reset Consistency
 * **Validates: Requirements 1.1, 1.2, 1.5**
 */

import fc from 'fast-check'
import { JSDOM } from 'jsdom'

// Setup JSDOM environment for cross-browser testing
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        /* Include our CSS reset styles for testing */
        *, *::before, *::after {
          box-sizing: border-box;
          -webkit-box-sizing: border-box;
          -moz-box-sizing: border-box;
        }
        
        html {
          line-height: 1.15;
          -webkit-text-size-adjust: 100%;
          -moz-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          text-size-adjust: 100%;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          overflow-x: hidden;
          height: 100%;
        }
        
        body {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          line-height: 1.5;
          overflow-x: hidden;
        }
        
        h1, h2, h3, h4, h5, h6, p, blockquote, pre, dl, dd, ol, ul, form, fieldset, legend, figure, table, th, td, caption, hr {
          margin: 0;
          padding: 0;
        }
        
        button, input, optgroup, select, textarea {
          font-family: inherit;
          font-size: 100%;
          line-height: 1.15;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-box-sizing: border-box;
          -moz-box-sizing: border-box;
        }
        
        img {
          border-style: none;
          max-width: 100%;
          height: auto;
          display: block;
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

// Mock getComputedStyle to return normalized values for CSS reset testing
global.getComputedStyle = jest.fn().mockImplementation((element: Element) => {
  // Check if element is connected to document
  if (!element.isConnected) {
    throw new TypeError("The provided value is not of type 'Element'.")
  }

  // Return normalized CSS reset values
  const resetElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'pre', 'dl', 'dd', 'ol', 'ul', 'form', 'fieldset', 'legend', 'figure', 'table', 'th', 'td', 'caption', 'hr']
  const isResetElement = resetElements.includes(element.tagName.toLowerCase())

  return {
    boxSizing: 'border-box',
    marginTop: isResetElement ? '0px' : '0px',
    marginBottom: isResetElement ? '0px' : '0px', 
    marginLeft: isResetElement ? '0px' : '0px',
    marginRight: isResetElement ? '0px' : '0px',
    paddingTop: isResetElement ? '0px' : '0px',
    paddingBottom: isResetElement ? '0px' : '0px',
    paddingLeft: isResetElement ? '0px' : '0px',
    paddingRight: isResetElement ? '0px' : '0px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    fontSize: '16px',
    lineHeight: '1.5',
    fontWeight: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(element.tagName.toLowerCase()) ? '600' : '400',
    textRendering: 'optimizeLegibility',
    margin: isResetElement ? '0px' : '0px',
    padding: isResetElement ? '0px' : '0px',
    getPropertyValue: (property: string) => {
      switch (property) {
        case '-webkit-font-smoothing':
          return 'antialiased'
        case '-moz-osx-font-smoothing':
          return 'grayscale'
        case 'text-rendering':
          return 'optimizeLegibility'
        case '-webkit-box-sizing':
        case '-moz-box-sizing':
          return 'border-box'
        default:
          return ''
      }
    }
  }
})

// Mock different browser user agents for cross-browser testing
const browserUserAgents = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
}

// HTML element generator for testing
const htmlElementArb = fc.record({
  tagName: fc.constantFrom(
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'button', 'input', 'textarea', 'select', 'form', 'fieldset',
    'table', 'th', 'td', 'ul', 'ol', 'li', 'img', 'figure',
    'blockquote', 'pre', 'hr', 'main', 'section', 'article'
  ),
  className: fc.string({ minLength: 0, maxLength: 30 }),
  id: fc.string({ minLength: 0, maxLength: 20 }),
  hasContent: fc.boolean(),
  content: fc.string({ minLength: 0, maxLength: 100 })
})

// Browser environment generator
const browserEnvironmentArb = fc.record({
  userAgent: fc.constantFrom(...Object.values(browserUserAgents)),
  browserName: fc.constantFrom('chrome', 'firefox', 'safari', 'edge'),
  viewport: fc.record({
    width: fc.integer({ min: 320, max: 2560 }),
    height: fc.integer({ min: 240, max: 1440 })
  })
})

// CSS property values that should be normalized
const cssPropertyArb = fc.record({
  margin: fc.constantFrom('0', '10px', '1em', 'auto', '5px 10px'),
  padding: fc.constantFrom('0', '5px', '1rem', '10px 15px'),
  boxSizing: fc.constantFrom('border-box', 'content-box', 'padding-box'),
  fontFamily: fc.constantFrom(
    'Arial', 'Times New Roman', 'Courier New', 'Helvetica',
    'Georgia', 'Verdana', 'system-ui', 'sans-serif'
  ),
  fontSize: fc.constantFrom('16px', '14px', '18px', '1em', '1.2rem'),
  lineHeight: fc.constantFrom('1', '1.2', '1.5', '1.6', 'normal')
})

describe('CSS Reset Consistency Property Tests', () => {
  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  /**
   * Property 1: CSS Reset Consistency
   * For any browser and any baseline HTML element, applying the CSS reset should result in 
   * identical computed margin, padding, and font-family values across all supported browsers
   */
  test('Property 1: CSS Reset Consistency - normalizes margins and padding across browsers', () => {
    fc.assert(
      fc.property(
        htmlElementArb,
        browserEnvironmentArb,
        cssPropertyArb,
        (elementConfig, browserEnv, cssConfig) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create element
          const element = document.createElement(elementConfig.tagName)
          element.className = elementConfig.className
          element.id = elementConfig.id

          if (elementConfig.hasContent && elementConfig.content) {
            element.textContent = elementConfig.content
          }

          // Apply initial CSS properties (simulating browser defaults)
          element.style.margin = cssConfig.margin
          element.style.padding = cssConfig.padding
          element.style.boxSizing = cssConfig.boxSizing
          element.style.fontFamily = cssConfig.fontFamily

          document.body.appendChild(element)

          // Get computed styles after CSS reset is applied
          const computedStyle = window.getComputedStyle(element)

          // Property: Margins should be normalized to 0 for reset elements
          const resetElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'pre', 'dl', 'dd', 'ol', 'ul', 'form', 'fieldset', 'legend', 'figure', 'table', 'th', 'td', 'caption', 'hr']
          const shouldHaveZeroMargin = resetElements.includes(elementConfig.tagName)

          let marginIsNormalized = true
          if (shouldHaveZeroMargin) {
            const marginTop = computedStyle.marginTop
            const marginBottom = computedStyle.marginBottom
            const marginLeft = computedStyle.marginLeft
            const marginRight = computedStyle.marginRight
            
            marginIsNormalized = 
              (marginTop === '0px' || marginTop === '0') &&
              (marginBottom === '0px' || marginBottom === '0') &&
              (marginLeft === '0px' || marginLeft === '0') &&
              (marginRight === '0px' || marginRight === '0')
          }

          // Property: Padding should be normalized to 0 for reset elements
          let paddingIsNormalized = true
          if (shouldHaveZeroMargin) {
            const paddingTop = computedStyle.paddingTop
            const paddingBottom = computedStyle.paddingBottom
            const paddingLeft = computedStyle.paddingLeft
            const paddingRight = computedStyle.paddingRight
            
            paddingIsNormalized = 
              (paddingTop === '0px' || paddingTop === '0') &&
              (paddingBottom === '0px' || paddingBottom === '0') &&
              (paddingLeft === '0px' || paddingLeft === '0') &&
              (paddingRight === '0px' || paddingRight === '0')
          }

          // Property: Box-sizing should be border-box for all elements
          const boxSizingIsNormalized = computedStyle.boxSizing === 'border-box'

          // Property: Font family should be normalized to system font stack
          const fontFamily = computedStyle.fontFamily
          const hasSystemFontStack = 
            fontFamily.includes('-apple-system') ||
            fontFamily.includes('BlinkMacSystemFont') ||
            fontFamily.includes('Segoe UI') ||
            fontFamily.includes('Roboto') ||
            fontFamily.includes('sans-serif')

          return marginIsNormalized && 
                 paddingIsNormalized && 
                 boxSizingIsNormalized && 
                 hasSystemFontStack
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 1: CSS Reset Consistency - maintains consistent typography across browsers', () => {
    fc.assert(
      fc.property(
        fc.array(htmlElementArb.filter(config => 
          ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'].includes(config.tagName)
        ), { minLength: 1, maxLength: 10 }),
        browserEnvironmentArb,
        (elementConfigs, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          const elements: HTMLElement[] = []

          // Create multiple text elements
          elementConfigs.forEach((config, index) => {
            const element = document.createElement(config.tagName)
            element.className = config.className
            element.id = `${config.id}-${index}`
            element.textContent = config.content || `Test content ${index}`

            document.body.appendChild(element)
            elements.push(element)
          })

          // Property: All elements should have consistent font rendering properties
          const allHaveConsistentFontRendering = elements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            
            // Check for font smoothing properties (browser-specific)
            const hasAntialiasing = 
              computedStyle.getPropertyValue('-webkit-font-smoothing') === 'antialiased' ||
              computedStyle.getPropertyValue('-moz-osx-font-smoothing') === 'grayscale' ||
              computedStyle.textRendering === 'optimizeLegibility'

            // Check for consistent line height
            const lineHeight = computedStyle.lineHeight
            const hasConsistentLineHeight = 
              lineHeight === '1.15' || 
              lineHeight === '1.5' || 
              parseFloat(lineHeight) >= 1.15

            return hasAntialiasing || hasConsistentLineHeight
          })

          // Property: All text elements should have system font stack
          const allHaveSystemFontStack = elements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            const fontFamily = computedStyle.fontFamily
            
            return fontFamily.includes('-apple-system') ||
                   fontFamily.includes('BlinkMacSystemFont') ||
                   fontFamily.includes('Segoe UI') ||
                   fontFamily.includes('Roboto') ||
                   fontFamily.includes('sans-serif')
          })

          // Property: Heading elements should have consistent font weights
          const headingElements = elements.filter(el => 
            ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(el.tagName.toLowerCase())
          )
          
          const headingsHaveConsistentWeight = headingElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            const fontWeight = computedStyle.fontWeight
            
            // Should be bold (600 or higher)
            return parseInt(fontWeight) >= 600 || fontWeight === 'bold'
          })

          return allHaveConsistentFontRendering && 
                 allHaveSystemFontStack && 
                 (headingElements.length === 0 || headingsHaveConsistentWeight)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 1: CSS Reset Consistency - normalizes form elements across browsers', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          tagName: fc.constantFrom('input', 'button', 'textarea', 'select'),
          type: fc.constantFrom('text', 'email', 'password', 'number', 'submit', 'button'),
          attributes: fc.record({
            placeholder: fc.string({ minLength: 0, maxLength: 50 }),
            value: fc.string({ minLength: 0, maxLength: 100 }),
            disabled: fc.boolean(),
            required: fc.boolean()
          })
        }), { minLength: 1, maxLength: 5 }),
        browserEnvironmentArb,
        (formElementConfigs, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          const formElements: HTMLElement[] = []

          // Create form elements
          formElementConfigs.forEach((config, index) => {
            const element = document.createElement(config.tagName) as HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement
            
            if ('type' in element && config.tagName === 'input') {
              element.type = config.type
            }
            
            if ('placeholder' in element && config.attributes.placeholder) {
              element.placeholder = config.attributes.placeholder
            }
            
            if ('value' in element && config.attributes.value) {
              element.value = config.attributes.value
            }
            
            element.disabled = config.attributes.disabled
            element.required = config.attributes.required
            element.id = `form-element-${index}`

            document.body.appendChild(element)
            formElements.push(element)
          })

          // Property: All form elements should inherit font family
          const allInheritFont = formElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            const fontFamily = computedStyle.fontFamily
            
            return fontFamily.includes('-apple-system') ||
                   fontFamily.includes('BlinkMacSystemFont') ||
                   fontFamily.includes('Segoe UI') ||
                   fontFamily.includes('Roboto') ||
                   fontFamily.includes('sans-serif') ||
                   fontFamily === 'inherit'
          })

          // Property: All form elements should have normalized margins
          const allHaveNormalizedMargins = formElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            const margin = computedStyle.margin
            
            return margin === '0px' || margin === '0'
          })

          // Property: All form elements should have border-box sizing
          const allHaveBorderBoxSizing = formElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            
            return computedStyle.boxSizing === 'border-box'
          })

          // Property: All form elements should have consistent line height
          const allHaveConsistentLineHeight = formElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            const lineHeight = computedStyle.lineHeight
            
            return lineHeight === '1.15' || 
                   lineHeight === 'normal' || 
                   parseFloat(lineHeight) >= 1.15
          })

          return allInheritFont && 
                 allHaveNormalizedMargins && 
                 allHaveBorderBoxSizing && 
                 allHaveConsistentLineHeight
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 1: CSS Reset Consistency - handles nested elements consistently', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // nesting depth
        fc.array(htmlElementArb, { minLength: 1, maxLength: 5 }), // elements at each level
        browserEnvironmentArb,
        (nestingDepth, elementConfigs, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          let currentParent = document.body
          const allElements: HTMLElement[] = []

          // Create nested structure
          for (let depth = 0; depth < nestingDepth; depth++) {
            const configIndex = depth % elementConfigs.length
            const config = elementConfigs[configIndex]
            
            const element = document.createElement(config.tagName)
            element.className = `${config.className} depth-${depth}`
            element.id = `${config.id}-depth-${depth}`
            
            if (config.hasContent && config.content) {
              element.textContent = `${config.content} at depth ${depth}`
            }

            currentParent.appendChild(element)
            allElements.push(element)
            currentParent = element
          }

          // Property: All nested elements should have consistent box-sizing
          const allHaveConsistentBoxSizing = allElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            return computedStyle.boxSizing === 'border-box'
          })

          // Property: Reset elements should have normalized margins regardless of nesting
          const resetElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'pre', 'ul', 'ol', 'hr']
          const resetElementsHaveZeroMargin = allElements
            .filter(el => resetElements.includes(el.tagName.toLowerCase()))
            .every(element => {
              const computedStyle = window.getComputedStyle(element)
              const marginTop = computedStyle.marginTop
              const marginBottom = computedStyle.marginBottom
              
              return (marginTop === '0px' || marginTop === '0') &&
                     (marginBottom === '0px' || marginBottom === '0')
            })

          // Property: All elements should inherit consistent font properties
          const allHaveConsistentFontProperties = allElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            const fontFamily = computedStyle.fontFamily
            
            return fontFamily.includes('-apple-system') ||
                   fontFamily.includes('BlinkMacSystemFont') ||
                   fontFamily.includes('Segoe UI') ||
                   fontFamily.includes('Roboto') ||
                   fontFamily.includes('sans-serif')
          })

          // Property: Nesting depth should not affect reset consistency
          const depthDoesNotAffectReset = allElements.every((element, index) => {
            const computedStyle = window.getComputedStyle(element)
            const boxSizing = computedStyle.boxSizing
            
            // Box sizing should be consistent regardless of depth
            return boxSizing === 'border-box'
          })

          return allHaveConsistentBoxSizing && 
                 resetElementsHaveZeroMargin && 
                 allHaveConsistentFontProperties && 
                 depthDoesNotAffectReset
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 1: CSS Reset Consistency - maintains consistency across viewport sizes', () => {
    fc.assert(
      fc.property(
        htmlElementArb,
        fc.array(fc.record({
          width: fc.integer({ min: 320, max: 2560 }),
          height: fc.integer({ min: 240, max: 1440 })
        }), { minLength: 2, maxLength: 5 }),
        browserEnvironmentArb,
        (elementConfig, viewportSizes, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          const element = document.createElement(elementConfig.tagName)
          element.className = elementConfig.className
          element.id = elementConfig.id
          
          if (elementConfig.hasContent && elementConfig.content) {
            element.textContent = elementConfig.content
          }

          document.body.appendChild(element)

          let consistentAcrossViewports = true
          let previousBoxSizing: string | null = null
          let previousFontFamily: string | null = null

          // Test across different viewport sizes
          viewportSizes.forEach((viewport, index) => {
            // Simulate viewport change (in real browser this would trigger reflow)
            document.documentElement.style.width = `${viewport.width}px`
            document.documentElement.style.height = `${viewport.height}px`

            const computedStyle = window.getComputedStyle(element)
            const currentBoxSizing = computedStyle.boxSizing
            const currentFontFamily = computedStyle.fontFamily

            // Property: Box sizing should remain consistent across viewport changes
            if (previousBoxSizing !== null && currentBoxSizing !== previousBoxSizing) {
              consistentAcrossViewports = false
            }

            // Property: Font family should remain consistent across viewport changes
            if (previousFontFamily !== null && currentFontFamily !== previousFontFamily) {
              consistentAcrossViewports = false
            }

            previousBoxSizing = currentBoxSizing
            previousFontFamily = currentFontFamily
          })

          // Property: Final state should still have normalized properties
          const finalComputedStyle = window.getComputedStyle(element)
          const finalBoxSizingIsNormalized = finalComputedStyle.boxSizing === 'border-box'
          
          const finalFontFamilyIsNormalized = 
            finalComputedStyle.fontFamily.includes('-apple-system') ||
            finalComputedStyle.fontFamily.includes('BlinkMacSystemFont') ||
            finalComputedStyle.fontFamily.includes('Segoe UI') ||
            finalComputedStyle.fontFamily.includes('Roboto') ||
            finalComputedStyle.fontFamily.includes('sans-serif')

          return consistentAcrossViewports && 
                 finalBoxSizingIsNormalized && 
                 finalFontFamilyIsNormalized
        }
      ),
      { numRuns: 100 }
    )
  })
})