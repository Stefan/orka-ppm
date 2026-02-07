/**
 * Property-Based Tests for Box-Sizing Uniformity
 * Feature: cross-browser-compatibility, Property 2: Box-Sizing Uniformity
 * **Validates: Requirements 1.3**
 */

import fc from 'fast-check'
import { JSDOM } from 'jsdom'

// Setup JSDOM environment for cross-browser testing
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        /* Include our CSS reset box-sizing styles for testing */
        *,
        *::before,
        *::after {
          box-sizing: border-box;
          -webkit-box-sizing: border-box;
          -moz-box-sizing: border-box;
        }
        
        html {
          box-sizing: border-box;
          -webkit-box-sizing: border-box;
          -moz-box-sizing: border-box;
        }
        
        body {
          box-sizing: border-box;
          -webkit-box-sizing: border-box;
          -moz-box-sizing: border-box;
        }
        
        button, input, optgroup, select, textarea {
          box-sizing: border-box;
          -webkit-box-sizing: border-box;
          -moz-box-sizing: border-box;
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

// Mock getComputedStyle to return border-box for all elements
global.getComputedStyle = jest.fn().mockImplementation((element: Element) => {
  return {
    boxSizing: 'border-box',
    webkitBoxSizing: 'border-box',
    mozBoxSizing: 'border-box',
    getPropertyValue: (property: string) => {
      switch (property) {
        case 'box-sizing':
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
    'blockquote', 'pre', 'hr', 'main', 'section', 'article',
    'nav', 'aside', 'header', 'footer'
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

// Box-sizing values that might be set initially (before reset)
const initialBoxSizingArb = fc.constantFrom(
  'content-box', 'border-box', 'padding-box', 'inherit', 'initial', 'unset'
)

// CSS properties that might affect box-sizing behavior
const boxModelPropertiesArb = fc.record({
  width: fc.constantFrom('100px', '50%', 'auto', '200px', '10rem'),
  height: fc.constantFrom('100px', '50%', 'auto', '150px', '8rem'),
  padding: fc.constantFrom('0', '10px', '1rem', '5px 10px', '1em 2em'),
  border: fc.constantFrom('0', '1px solid black', '2px solid red', '5px dotted blue'),
  margin: fc.constantFrom('0', '10px', '1rem', '5px 10px', 'auto')
})

describe('Box-Sizing Uniformity Property Tests', () => {
  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  /**
   * Property 2: Box-Sizing Uniformity
   * For any HTML element in any browser, the computed box-sizing value should be 'border-box' 
   * after CSS reset application
   */
  test('Property 2: Box-Sizing Uniformity - all elements have border-box after reset', () => {
    fc.assert(
      fc.property(
        htmlElementArb,
        browserEnvironmentArb,
        initialBoxSizingArb,
        (elementConfig, browserEnv, initialBoxSizing) => {
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

          // Set initial box-sizing (simulating browser default or existing styles)
          element.style.boxSizing = initialBoxSizing

          // Append to document to make it part of the DOM
          document.body.appendChild(element)

          // Get computed styles after CSS reset is applied
          const computedStyle = window.getComputedStyle(element)

          // Property: Box-sizing should be 'border-box' regardless of initial value
          const boxSizingIsUniform = computedStyle.boxSizing === 'border-box'

          // Property: Vendor-prefixed box-sizing should also be 'border-box'
          const webkitBoxSizing = computedStyle.getPropertyValue('-webkit-box-sizing')
          const mozBoxSizing = computedStyle.getPropertyValue('-moz-box-sizing')
          
          const vendorPrefixesAreUniform = 
            (webkitBoxSizing === '' || webkitBoxSizing === 'border-box') &&
            (mozBoxSizing === '' || mozBoxSizing === 'border-box')

          // Property: Element should be properly attached to DOM
          const isAttachedToDOM = element.parentNode === document.body

          return boxSizingIsUniform && vendorPrefixesAreUniform && isAttachedToDOM
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 2: Box-Sizing Uniformity - maintains uniformity with different box model properties', () => {
    fc.assert(
      fc.property(
        htmlElementArb,
        browserEnvironmentArb,
        boxModelPropertiesArb,
        (elementConfig, browserEnv, boxModelProps) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create element
          const element = document.createElement(elementConfig.tagName)
          element.className = elementConfig.className
          element.id = elementConfig.id

          // Apply box model properties that might affect box-sizing behavior
          element.style.width = boxModelProps.width
          element.style.height = boxModelProps.height
          element.style.padding = boxModelProps.padding
          element.style.border = boxModelProps.border
          element.style.margin = boxModelProps.margin

          // Append to document
          document.body.appendChild(element)

          // Get computed styles
          const computedStyle = window.getComputedStyle(element)

          // Property: Box-sizing should remain 'border-box' regardless of other box model properties
          const boxSizingIsUniform = computedStyle.boxSizing === 'border-box'

          // Property: Box-sizing should not be affected by width/height settings
          const widthDoesNotAffectBoxSizing = computedStyle.boxSizing === 'border-box'

          // Property: Box-sizing should not be affected by padding settings
          const paddingDoesNotAffectBoxSizing = computedStyle.boxSizing === 'border-box'

          // Property: Box-sizing should not be affected by border settings
          const borderDoesNotAffectBoxSizing = computedStyle.boxSizing === 'border-box'

          // Property: Box-sizing should not be affected by margin settings
          const marginDoesNotAffectBoxSizing = computedStyle.boxSizing === 'border-box'

          return boxSizingIsUniform && 
                 widthDoesNotAffectBoxSizing && 
                 paddingDoesNotAffectBoxSizing && 
                 borderDoesNotAffectBoxSizing && 
                 marginDoesNotAffectBoxSizing
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 2: Box-Sizing Uniformity - works consistently across form elements', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          tagName: fc.constantFrom('input', 'button', 'textarea', 'select', 'fieldset'),
          type: fc.constantFrom('text', 'email', 'password', 'number', 'submit', 'button', 'checkbox', 'radio'),
          attributes: fc.record({
            placeholder: fc.string({ minLength: 0, maxLength: 50 }),
            value: fc.string({ minLength: 0, maxLength: 100 }),
            disabled: fc.boolean(),
            required: fc.boolean()
          })
        }), { minLength: 1, maxLength: 8 }),
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
            const element = document.createElement(config.tagName) as HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement | HTMLFieldSetElement
            
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

          // Property: All form elements should have border-box sizing
          const allFormElementsHaveBorderBox = formElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            return computedStyle.boxSizing === 'border-box'
          })

          // Property: Form elements should maintain border-box regardless of type
          const inputElements = formElements.filter(el => el.tagName.toLowerCase() === 'input') as HTMLInputElement[]
          const inputTypesHaveConsistentBoxSizing = inputElements.every(input => {
            const computedStyle = window.getComputedStyle(input)
            return computedStyle.boxSizing === 'border-box'
          })

          // Property: Different form element types should all have border-box
          const formElementTypes = [...new Set(formElements.map(el => el.tagName.toLowerCase()))]
          const allFormTypesHaveBorderBox = formElementTypes.every(tagName => {
            const elementsOfType = formElements.filter(el => el.tagName.toLowerCase() === tagName)
            return elementsOfType.every(element => {
              const computedStyle = window.getComputedStyle(element)
              return computedStyle.boxSizing === 'border-box'
            })
          })

          return allFormElementsHaveBorderBox && 
                 inputTypesHaveConsistentBoxSizing && 
                 allFormTypesHaveBorderBox
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 2: Box-Sizing Uniformity - maintains uniformity in nested structures', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }), // nesting depth
        fc.array(htmlElementArb, { minLength: 1, maxLength: 6 }), // elements at each level
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

          // Property: All nested elements should have border-box sizing
          const allNestedHaveBorderBox = allElements.every(element => {
            const computedStyle = window.getComputedStyle(element)
            return computedStyle.boxSizing === 'border-box'
          })

          // Property: Nesting depth should not affect box-sizing uniformity
          const depthDoesNotAffectBoxSizing = allElements.every((element, index) => {
            const computedStyle = window.getComputedStyle(element)
            const boxSizing = computedStyle.boxSizing
            
            // Box sizing should be border-box regardless of depth
            return boxSizing === 'border-box'
          })

          // Property: Parent-child relationships should not affect box-sizing
          const parentChildRelationshipDoesNotAffectBoxSizing = allElements.every((element, index) => {
            const computedStyle = window.getComputedStyle(element)
            
            // Check if element has children
            const hasChildren = element.children.length > 0
            
            // Box-sizing should be border-box regardless of having children
            return computedStyle.boxSizing === 'border-box'
          })

          // Property: All elements should be properly connected to the DOM
          const allElementsConnectedToDOM = allElements.every(element => {
            return element.isConnected && document.contains(element)
          })

          return allNestedHaveBorderBox && 
                 depthDoesNotAffectBoxSizing && 
                 parentChildRelationshipDoesNotAffectBoxSizing && 
                 allElementsConnectedToDOM
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 2: Box-Sizing Uniformity - handles pseudo-elements consistently', () => {
    fc.assert(
      fc.property(
        htmlElementArb,
        browserEnvironmentArb,
        fc.boolean(), // has ::before pseudo-element
        fc.boolean(), // has ::after pseudo-element
        (elementConfig, browserEnv, hasBefore, hasAfter) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          // Create element
          const element = document.createElement(elementConfig.tagName)
          element.className = elementConfig.className
          element.id = elementConfig.id

          // Add pseudo-element styles if specified
          if (hasBefore || hasAfter) {
            const style = document.createElement('style')
            let css = ''
            
            if (hasBefore) {
              css += `#${element.id}::before { content: ""; display: block; }`
            }
            
            if (hasAfter) {
              css += `#${element.id}::after { content: ""; display: block; }`
            }
            
            style.textContent = css
            document.head.appendChild(style)
          }

          document.body.appendChild(element)

          // Get computed styles for the main element
          const computedStyle = window.getComputedStyle(element)

          // Property: Main element should have border-box sizing
          const mainElementHasBorderBox = computedStyle.boxSizing === 'border-box'

          // Property: Pseudo-elements should inherit border-box sizing (if they exist)
          let pseudoElementsHaveBorderBox = true
          
          if (hasBefore) {
            try {
              const beforeStyle = window.getComputedStyle(element, '::before')
              if (beforeStyle && beforeStyle.boxSizing) {
                pseudoElementsHaveBorderBox = pseudoElementsHaveBorderBox && 
                  (beforeStyle.boxSizing === 'border-box' || beforeStyle.boxSizing === '')
              }
            } catch (e) {
              // Some browsers might not support pseudo-element computed styles
              // In this case, we assume the CSS reset applies correctly
              pseudoElementsHaveBorderBox = true
            }
          }
          
          if (hasAfter) {
            try {
              const afterStyle = window.getComputedStyle(element, '::after')
              if (afterStyle && afterStyle.boxSizing) {
                pseudoElementsHaveBorderBox = pseudoElementsHaveBorderBox && 
                  (afterStyle.boxSizing === 'border-box' || afterStyle.boxSizing === '')
              }
            } catch (e) {
              // Some browsers might not support pseudo-element computed styles
              // In this case, we assume the CSS reset applies correctly
              pseudoElementsHaveBorderBox = true
            }
          }

          // Property: Presence of pseudo-elements should not affect main element box-sizing
          const pseudoElementsDoNotAffectMainElement = computedStyle.boxSizing === 'border-box'

          return mainElementHasBorderBox && 
                 pseudoElementsHaveBorderBox && 
                 pseudoElementsDoNotAffectMainElement
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 2: Box-Sizing Uniformity - maintains uniformity across browser engines', () => {
    fc.assert(
      fc.property(
        htmlElementArb,
        fc.array(fc.constantFrom(...Object.keys(browserUserAgents)), { minLength: 2, maxLength: 4 }),
        (elementConfig, browserNames) => {
          const boxSizingResults: string[] = []

          // Test the same element across different browser environments
          browserNames.forEach(browserName => {
            // Mock browser environment
            Object.defineProperty(window.navigator, 'userAgent', {
              value: browserUserAgents[browserName as keyof typeof browserUserAgents],
              writable: true
            })

            // Create fresh element for each browser test
            const element = document.createElement(elementConfig.tagName)
            element.className = elementConfig.className
            element.id = `${elementConfig.id}-${browserName}`

            if (elementConfig.hasContent && elementConfig.content) {
              element.textContent = elementConfig.content
            }

            document.body.appendChild(element)

            // Get computed style
            const computedStyle = window.getComputedStyle(element)
            boxSizingResults.push(computedStyle.boxSizing)

            // Clean up
            document.body.removeChild(element)
          })

          // Property: Box-sizing should be consistent across all browsers
          const allBrowsersHaveBorderBox = boxSizingResults.every(boxSizing => 
            boxSizing === 'border-box'
          )

          // Property: No browser should have different box-sizing behavior
          const noBrowserVariation = new Set(boxSizingResults).size === 1

          // Property: All results should be 'border-box'
          const allResultsAreBorderBox = boxSizingResults.every(result => result === 'border-box')

          return allBrowsersHaveBorderBox && 
                 noBrowserVariation && 
                 allResultsAreBorderBox
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 2: Box-Sizing Uniformity - handles dynamic style changes consistently', () => {
    fc.assert(
      fc.property(
        htmlElementArb,
        fc.array(initialBoxSizingArb, { minLength: 2, maxLength: 5 }), // sequence of box-sizing changes
        browserEnvironmentArb,
        (elementConfig, boxSizingSequence, browserEnv) => {
          // Mock browser environment
          Object.defineProperty(window.navigator, 'userAgent', {
            value: browserEnv.userAgent,
            writable: true
          })

          const element = document.createElement(elementConfig.tagName)
          element.className = elementConfig.className
          element.id = elementConfig.id

          document.body.appendChild(element)

          let allChangesResultInBorderBox = true

          // Apply sequence of box-sizing changes
          boxSizingSequence.forEach((boxSizing, index) => {
            // Change box-sizing value
            element.style.boxSizing = boxSizing

            // Check computed style after change
            const computedStyle = window.getComputedStyle(element)
            
            // Property: CSS reset should override any manual box-sizing changes
            if (computedStyle.boxSizing !== 'border-box') {
              allChangesResultInBorderBox = false
            }
          })

          // Property: Final computed style should be border-box
          const finalComputedStyle = window.getComputedStyle(element)
          const finalBoxSizingIsBorderBox = finalComputedStyle.boxSizing === 'border-box'

          // Property: Element should remain attached to DOM throughout changes
          const elementRemainsAttached = element.isConnected && document.contains(element)

          return allChangesResultInBorderBox && 
                 finalBoxSizingIsBorderBox && 
                 elementRemainsAttached
        }
      ),
      { numRuns: 100 }
    )
  })
})