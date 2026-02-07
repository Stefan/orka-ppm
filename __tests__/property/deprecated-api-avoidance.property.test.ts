/**
 * Property-Based Test: Deprecated API Avoidance
 * Feature: cross-browser-compatibility, Property 16: Deprecated API Avoidance
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */

import fc from 'fast-check'
import {
  isAPIDeprecated,
  scanCodeForDeprecatedAPIs,
  usesModernEventHandling,
  usesModernDOMManipulation,
  avoidsDeprecatedCSSProperties,
  getDeprecatedAPIsByCategory,
  supportsModernAlternatives,
  DeprecatedAPICheck
} from '../../lib/utils/deprecated-api-detector'

// Generators for code samples
const modernEventCodeArb = fc.constantFrom(
  `element.addEventListener('click', handler)`,
  `element.removeEventListener('click', handler)`,
  `const event = new Event('custom')`,
  `const event = new CustomEvent('custom', { detail: {} })`,
  `if (event.key === 'Enter') { }`,
  `event.preventDefault()`,
  `const target = event.target`
)

const deprecatedEventCodeArb = fc.constantFrom(
  `element.attachEvent('onclick', handler)`,
  `element.detachEvent('onclick', handler)`,
  `document.createEvent('MouseEvents')`,
  `event.initEvent('click', true, true)`,
  `if (event.keyCode === 13) { }`,
  `if (event.which === 13) { }`,
  `event.returnValue = false`,
  `const target = event.srcElement`
)

const modernDOMCodeArb = fc.constantFrom(
  `element.appendChild(child)`,
  `element.insertBefore(child, reference)`,
  `element.removeChild(child)`,
  `element.replaceChild(newChild, oldChild)`,
  `element.innerHTML = content`,
  `element.textContent = text`,
  `document.createElement('div')`
)

const deprecatedDOMCodeArb = fc.constantFrom(
  `document.write('<div>content</div>')`,
  `document.writeln('<p>text</p>')`,
  `document.clear()`,
  `document.captureEvents(Event.CLICK)`,
  `document.releaseEvents(Event.CLICK)`
)

const modernCSSCodeArb = fc.constantFrom(
  `display: flex;`,
  `display: grid;`,
  `transform: translateX(10px);`,
  `transition: all 0.3s ease;`,
  `box-shadow: 0 2px 4px rgba(0,0,0,0.1);`,
  `border-radius: 4px;`
)

const deprecatedCSSCodeArb = fc.constantFrom(
  `-webkit-box-reflect: below 0px;`,
  `-moz-appearance: none;`,
  `-webkit-mask-box-image: url(mask.png);`,
  `zoom: 1.5;`
)

const deprecatedAPINameArb = fc.constantFrom(
  'attachEvent',
  'detachEvent',
  'createEvent',
  'initEvent',
  'keyCode',
  'which',
  'document.write',
  'document.writeln',
  'showModalDialog',
  'execCommand'
)

const modernAPINameArb = fc.constantFrom(
  'addEventListener',
  'removeEventListener',
  'Event',
  'CustomEvent',
  'key',
  'code',
  'appendChild',
  'insertBefore',
  'dialog',
  'clipboard'
)

describe('Deprecated API Avoidance Property Tests', () => {
  /**
   * Property 16: Deprecated API Avoidance
   * For any browser API usage in the codebase, the API should not be marked 
   * as deprecated in current MDN documentation
   */
  
  test('Property 16: Deprecated APIs should be correctly identified', () => {
    fc.assert(
      fc.property(
        deprecatedAPINameArb,
        (apiName) => {
          const result = isAPIDeprecated(apiName)
          
          // All deprecated APIs should be flagged
          expect(result.isDeprecated).toBe(true)
          expect(result.api).toBe(apiName)
          expect(result.category).toBeDefined()
          
          // Should provide modern alternative
          if (result.modernAlternative) {
            expect(typeof result.modernAlternative).toBe('string')
            expect(result.modernAlternative.length).toBeGreaterThan(0)
          }
          
          // Should provide reason
          expect(result.reason).toBeDefined()
          expect(typeof result.reason).toBe('string')
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: Modern APIs should not be flagged as deprecated', () => {
    fc.assert(
      fc.property(
        modernAPINameArb,
        (apiName) => {
          const result = isAPIDeprecated(apiName)
          
          // Modern APIs should not be flagged as deprecated
          expect(result.isDeprecated).toBe(false)
          expect(result.api).toBe(apiName)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: Code with deprecated event handling should be detected', () => {
    fc.assert(
      fc.property(
        deprecatedEventCodeArb,
        (code) => {
          const deprecatedAPIs = scanCodeForDeprecatedAPIs(code)
          const usesModern = usesModernEventHandling(code)
          
          // Should detect deprecated APIs
          expect(deprecatedAPIs.length).toBeGreaterThan(0)
          
          // Should flag as not using modern patterns
          expect(usesModern).toBe(false)
          
          // All detected APIs should be in event category
          deprecatedAPIs.forEach(api => {
            expect(['event', 'other']).toContain(api.category)
            expect(api.isDeprecated).toBe(true)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: Code with modern event handling should pass validation', () => {
    fc.assert(
      fc.property(
        modernEventCodeArb,
        (code) => {
          const usesModern = usesModernEventHandling(code)
          
          // Should validate as using modern patterns
          expect(usesModern).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: Code with deprecated DOM manipulation should be detected', () => {
    fc.assert(
      fc.property(
        deprecatedDOMCodeArb,
        (code) => {
          const deprecatedAPIs = scanCodeForDeprecatedAPIs(code)
          const usesModern = usesModernDOMManipulation(code)
          
          // Should detect deprecated APIs
          expect(deprecatedAPIs.length).toBeGreaterThan(0)
          
          // Should flag as not using modern patterns
          expect(usesModern).toBe(false)
          
          // All detected APIs should be in dom category
          deprecatedAPIs.forEach(api => {
            expect(['dom', 'other']).toContain(api.category)
            expect(api.isDeprecated).toBe(true)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: Code with modern DOM manipulation should pass validation', () => {
    fc.assert(
      fc.property(
        modernDOMCodeArb,
        (code) => {
          const usesModern = usesModernDOMManipulation(code)
          
          // Should validate as using modern patterns
          expect(usesModern).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: CSS with deprecated properties should be detected', () => {
    fc.assert(
      fc.property(
        deprecatedCSSCodeArb,
        (cssCode) => {
          const avoidsDeprecated = avoidsDeprecatedCSSProperties(cssCode)
          
          // Should flag deprecated CSS properties
          expect(avoidsDeprecated).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: CSS with modern properties should pass validation', () => {
    fc.assert(
      fc.property(
        modernCSSCodeArb,
        (cssCode) => {
          const avoidsDeprecated = avoidsDeprecatedCSSProperties(cssCode)
          
          // Should validate modern CSS properties
          expect(avoidsDeprecated).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: All deprecated API categories should be accessible', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('event', 'dom', 'css', 'storage', 'other'),
        (category) => {
          const apis = getDeprecatedAPIsByCategory(category as any)
          
          // Should return array of APIs
          expect(Array.isArray(apis)).toBe(true)
          
          // Each API should be a string
          apis.forEach(api => {
            expect(typeof api).toBe('string')
            expect(api.length).toBeGreaterThan(0)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: Modern alternative support detection should be consistent', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const support1 = supportsModernAlternatives()
          const support2 = supportsModernAlternatives()
          
          // Multiple calls should return consistent results
          expect(support1.addEventListener).toBe(support2.addEventListener)
          expect(support1.customEvent).toBe(support2.customEvent)
          expect(support1.clipboardAPI).toBe(support2.clipboardAPI)
          expect(support1.dialogElement).toBe(support2.dialogElement)
          
          // All values should be boolean
          expect(typeof support1.addEventListener).toBe('boolean')
          expect(typeof support1.customEvent).toBe('boolean')
          expect(typeof support1.clipboardAPI).toBe('boolean')
          expect(typeof support1.dialogElement).toBe('boolean')
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: Mixed code should detect all deprecated APIs', () => {
    fc.assert(
      fc.property(
        fc.tuple(deprecatedEventCodeArb, deprecatedDOMCodeArb),
        ([eventCode, domCode]) => {
          const mixedCode = `${eventCode}\n${domCode}`
          const deprecatedAPIs = scanCodeForDeprecatedAPIs(mixedCode)
          
          // Should detect multiple deprecated APIs
          expect(deprecatedAPIs.length).toBeGreaterThan(0)
          
          // All detected APIs should be deprecated
          deprecatedAPIs.forEach(api => {
            expect(api.isDeprecated).toBe(true)
            expect(api.category).toBeDefined()
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: Empty or whitespace code should not flag any deprecated APIs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\n\n', '\t\t'),
        (code) => {
          const deprecatedAPIs = scanCodeForDeprecatedAPIs(code)
          const usesModernEvents = usesModernEventHandling(code)
          const usesModernDOM = usesModernDOMManipulation(code)
          
          // Empty code should not contain deprecated APIs
          expect(deprecatedAPIs.length).toBe(0)
          
          // Empty code should pass modern validation
          expect(usesModernEvents).toBe(true)
          expect(usesModernDOM).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 16: Case-insensitive API detection should work correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'attachEvent',
          'ATTACHEVENT',
          'AttachEvent',
          'aTtAcHeVeNt'
        ),
        (apiName) => {
          const result = isAPIDeprecated(apiName)
          
          // Should detect regardless of case
          expect(result.isDeprecated).toBe(true)
          expect(result.category).toBe('event')
        }
      ),
      { numRuns: 100 }
    )
  })
})
