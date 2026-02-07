/**
 * Property-Based Test: Progressive Enhancement Fallbacks
 * Feature: cross-browser-compatibility, Property 17: Progressive Enhancement Fallbacks
 * 
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 * 
 * Property: For any advanced CSS or JavaScript feature, functional fallbacks 
 * should be available when the feature is unsupported
 */

import fc from 'fast-check'
import {
  detectFeatureSupport,
  getLayoutFallback,
  getAnimationFallback,
  getProgressiveEnhancementClasses,
  getProgressiveEnhancementStyles,
  getCSSVariableFallback
} from '@/lib/utils/progressive-enhancement'

describe('Property 17: Progressive Enhancement Fallbacks', () => {
  // Property 1: Layout fallback always returns a valid layout method
  test('for any preferred layout, a valid fallback layout method is returned', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('grid' as const, 'flexbox' as const),
        (preferredLayout) => {
          const fallback = getLayoutFallback(preferredLayout)
          
          // Fallback must be one of the valid layout methods
          expect(['grid', 'flexbox', 'float']).toContain(fallback)
          
          // If preferred layout is grid, fallback should be grid, flexbox, or float
          if (preferredLayout === 'grid') {
            expect(['grid', 'flexbox', 'float']).toContain(fallback)
          }
          
          // If preferred layout is flexbox, fallback should be flexbox or float
          if (preferredLayout === 'flexbox') {
            expect(['flexbox', 'float']).toContain(fallback)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 2: Animation fallback always returns a valid animation method
  test('for any animation type, a valid fallback animation method is returned', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('css' as const, 'js' as const),
        (animationType) => {
          const fallback = getAnimationFallback(animationType)
          
          // Fallback must be one of the valid animation methods
          expect(['css', 'js', 'static']).toContain(fallback)
          
          // Fallback should never be more advanced than the requested type
          if (animationType === 'css') {
            expect(['css', 'static']).toContain(fallback)
          }
          
          if (animationType === 'js') {
            expect(['js', 'static']).toContain(fallback)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 3: Progressive enhancement classes are always valid CSS class names
  test('for any browser, progressive enhancement classes are valid CSS identifiers', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No input needed, uses actual browser
        () => {
          const classes = getProgressiveEnhancementClasses()
          
          // Classes should be a non-empty string
          expect(typeof classes).toBe('string')
          expect(classes.length).toBeGreaterThan(0)
          
          // Each class should be a valid CSS identifier
          const classArray = classes.split(' ')
          classArray.forEach(className => {
            expect(className).toMatch(/^[a-z][a-z0-9-]*$/)
          })
          
          // Should contain at least one feature support class
          const hasFeatureClass = classArray.some(c => 
            c.startsWith('supports-') || c.startsWith('no-')
          )
          expect(hasFeatureClass).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 4: Progressive enhancement styles always return valid React CSS properties
  test('for any element type, progressive enhancement styles are valid React CSS properties', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('container' as const, 'grid' as const, 'flexbox' as const),
        (elementType) => {
          const styles = getProgressiveEnhancementStyles(elementType)
          
          // Styles should be an object
          expect(typeof styles).toBe('object')
          expect(styles).not.toBeNull()
          
          // All style properties should have valid values
          Object.entries(styles).forEach(([key, value]) => {
            expect(key).toBeTruthy()
            expect(value).toBeDefined()
            
            // Values should be strings or numbers
            expect(['string', 'number', 'undefined']).toContain(typeof value)
          })
          
          // Container should have width and margin
          if (elementType === 'container') {
            expect(styles).toHaveProperty('width')
            expect(styles).toHaveProperty('margin')
          }
          
          // Grid and flexbox should have display property
          if (elementType === 'grid' || elementType === 'flexbox') {
            expect(styles).toHaveProperty('display')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 5: CSS variable fallback always returns a valid CSS value
  test('for any CSS variable and fallback, a valid CSS value is returned', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => `--${s}`),
        fc.string({ minLength: 1, maxLength: 50 }),
        (variable, fallback) => {
          const result = getCSSVariableFallback(variable, fallback)
          
          // Result should be a non-empty string
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(0)
          
          // Result should either be the fallback or a var() expression
          const isVarExpression = result.startsWith('var(') && result.endsWith(')')
          const isFallback = result === fallback
          
          expect(isVarExpression || isFallback).toBe(true)
          
          // If it's a var expression, it should contain the variable name
          if (isVarExpression) {
            expect(result).toContain(variable)
            expect(result).toContain(fallback)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 6: Feature detection always returns a complete FeatureSupport object
  test('for any browser, feature detection returns all required feature flags', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No input needed, uses actual browser
        () => {
          const features = detectFeatureSupport()
          
          // Should have css and js properties
          expect(features).toHaveProperty('css')
          expect(features).toHaveProperty('js')
          
          // CSS features should have all required properties
          const cssFeatures = ['grid', 'flexbox', 'customProperties', 'transforms', 
                               'transitions', 'animations', 'backdropFilter', 'clipPath', 'objectFit']
          cssFeatures.forEach(feature => {
            expect(features.css).toHaveProperty(feature)
            expect(typeof features.css[feature as keyof typeof features.css]).toBe('boolean')
          })
          
          // JS features should have all required properties
          const jsFeatures = ['intersectionObserver', 'resizeObserver', 'mutationObserver',
                             'fetch', 'promises', 'asyncAwait', 'modules', 'webWorkers']
          jsFeatures.forEach(feature => {
            expect(features.js).toHaveProperty(feature)
            expect(typeof features.js[feature as keyof typeof features.js]).toBe('boolean')
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 7: Fallback hierarchy is consistent (grid -> flexbox -> float)
  test('for grid layout, fallback hierarchy is always grid -> flexbox -> float', () => {
    fc.assert(
      fc.property(
        fc.constant('grid' as const),
        (preferredLayout) => {
          const fallback = getLayoutFallback(preferredLayout)
          
          // Fallback must follow the hierarchy
          expect(['grid', 'flexbox', 'float']).toContain(fallback)
          
          // If grid is not supported, should fall back to flexbox or float
          // If flexbox is not supported, should fall back to float
          const features = detectFeatureSupport()
          
          if (features.css.grid) {
            expect(fallback).toBe('grid')
          } else if (features.css.flexbox) {
            expect(fallback).toBe('flexbox')
          } else {
            expect(fallback).toBe('float')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 8: Animation fallback degrades gracefully
  test('for any animation type, fallback degrades to static when features unavailable', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('css' as const, 'js' as const),
        (animationType) => {
          const fallback = getAnimationFallback(animationType)
          const features = detectFeatureSupport()
          
          // If CSS animations are supported and requested, should return css
          if (animationType === 'css' && features.css.animations && features.css.transitions) {
            expect(fallback).toBe('css')
          }
          
          // If JS animations are supported and requested, should return js
          if (animationType === 'js' && features.js.promises) {
            expect(fallback).toBe('js')
          }
          
          // If features are not supported, should fall back to static
          if (animationType === 'css' && (!features.css.animations || !features.css.transitions)) {
            expect(fallback).toBe('static')
          }
          
          if (animationType === 'js' && !features.js.promises) {
            expect(fallback).toBe('static')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 9: Progressive enhancement classes reflect actual feature support
  test('for any browser, progressive enhancement classes accurately reflect feature support', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const classes = getProgressiveEnhancementClasses()
          const features = detectFeatureSupport()
          const classArray = classes.split(' ')
          
          // If grid is supported, should have 'supports-grid' class
          if (features.css.grid) {
            expect(classArray).toContain('supports-grid')
            expect(classArray).not.toContain('no-grid')
          } else {
            expect(classArray).toContain('no-grid')
            expect(classArray).not.toContain('supports-grid')
          }
          
          // If flexbox is supported, should have 'supports-flexbox' class
          if (features.css.flexbox) {
            expect(classArray).toContain('supports-flexbox')
            expect(classArray).not.toContain('no-flexbox')
          } else {
            expect(classArray).toContain('no-flexbox')
            expect(classArray).not.toContain('supports-flexbox')
          }
          
          // If animations are supported, should have 'supports-animations' class
          if (features.css.animations) {
            expect(classArray).toContain('supports-animations')
            expect(classArray).not.toContain('no-animations')
          } else {
            expect(classArray).toContain('no-animations')
            expect(classArray).not.toContain('supports-animations')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 10: Fallback styles maintain core functionality
  test('for any element type, fallback styles maintain essential layout properties', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('container' as const, 'grid' as const, 'flexbox' as const),
        (elementType) => {
          const styles = getProgressiveEnhancementStyles(elementType)
          
          // All elements should have a display property or equivalent
          if (elementType === 'grid' || elementType === 'flexbox') {
            expect(styles).toHaveProperty('display')
            expect(styles.display).toBeTruthy()
          }
          
          // Container should maintain width constraints
          if (elementType === 'container') {
            expect(styles).toHaveProperty('width')
            expect(styles.width).toBe('100%')
          }
          
          // Styles should not be empty
          expect(Object.keys(styles).length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
