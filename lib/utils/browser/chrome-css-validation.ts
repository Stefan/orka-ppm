/**
 * Chrome-specific CSS Property Validation Utilities
 * Implements Requirements 1.4, 1.5, 2.1, 2.5, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 6.4
 * Task 8: Add Chrome-specific CSS property validation
 */

export interface ChromeCSSValidationResult {
  isValid: boolean
  property: string
  expectedValue: string | string[]
  actualValue: string | null
  isSupported: boolean
  hasWebkitPrefix: boolean
  hasFallback: boolean
}

export interface ChromeCSSValidationReport {
  element: HTMLElement
  overallValid: boolean
  validationResults: ChromeCSSValidationResult[]
  missingProperties: string[]
  unsupportedProperties: string[]
  recommendations: string[]
}

export interface ChromeCSSPropertyConfig {
  property: string
  expectedValues: string | string[]
  webkitProperty?: string
  fallbackProperty?: string
  required: boolean
  description: string
  requirements: string[]
}

/**
 * Chrome-specific CSS properties configuration
 * Based on requirements from the design document
 */
export const CHROME_CSS_PROPERTIES: ChromeCSSPropertyConfig[] = [
  // Requirement 1.4: overscroll-behavior: contain
  {
    property: 'overscrollBehavior',
    expectedValues: 'contain',
    webkitProperty: 'webkitOverscrollBehavior',
    required: true,
    description: 'Prevents scroll boundary artifacts',
    requirements: ['1.4']
  },
  
  // Requirement 1.5: -webkit-overflow-scrolling: touch
  {
    property: 'webkitOverflowScrolling',
    expectedValues: 'touch',
    required: true,
    description: 'Enables smooth Chrome scroll behavior',
    requirements: ['1.5']
  },
  
  // Requirement 2.1: min-height: 100vh
  {
    property: 'minHeight',
    expectedValues: ['100vh', '100%'],
    required: true,
    description: 'Ensures viewport height coverage',
    requirements: ['2.1']
  },
  
  // Requirement 2.5: background-attachment: local
  {
    property: 'backgroundAttachment',
    expectedValues: 'local',
    webkitProperty: 'webkitBackgroundAttachment',
    required: true,
    description: 'Ensures background moves with scroll',
    requirements: ['2.5']
  },
  
  // Requirement 3.4: -webkit-box-sizing: border-box
  {
    property: 'boxSizing',
    expectedValues: 'border-box',
    webkitProperty: 'webkitBoxSizing',
    required: true,
    description: 'Consistent Chrome rendering',
    requirements: ['3.4']
  },
  
  // Requirement 3.5: -webkit-transform: translateZ(0)
  {
    property: 'transform',
    expectedValues: ['translateZ(0)', 'translateZ(0px)', 'translate3d(0, 0, 0)', 'translate3d(0px, 0px, 0px)'],
    webkitProperty: 'webkitTransform',
    required: true,
    description: 'Hardware acceleration for Chrome',
    requirements: ['3.5']
  },
  
  // Requirement 4.1: -webkit-overflow-scrolling: touch (duplicate check for main content)
  {
    property: 'webkitOverflowScrolling',
    expectedValues: 'touch',
    required: true,
    description: 'Momentum scrolling for Chrome',
    requirements: ['4.1']
  },
  
  // Requirement 4.2: -webkit-overscroll-behavior: contain
  {
    property: 'webkitOverscrollBehavior',
    expectedValues: 'contain',
    fallbackProperty: 'overscrollBehavior',
    required: true,
    description: 'Prevents bounce effects in Chrome',
    requirements: ['4.2']
  },
  
  // Requirement 4.3: -webkit-background-size: cover
  {
    property: 'backgroundSize',
    expectedValues: 'cover',
    webkitProperty: 'webkitBackgroundSize',
    required: false,
    description: 'Consistent background coverage',
    requirements: ['4.3']
  },
  
  // Requirement 4.4: -webkit-transform prefixes
  {
    property: 'webkitTransform',
    expectedValues: ['translateZ(0)', 'translateZ(0px)', 'translate3d(0, 0, 0)', 'translate3d(0px, 0px, 0px)'],
    fallbackProperty: 'transform',
    required: true,
    description: 'Chrome transform compatibility',
    requirements: ['4.4']
  },
  
  // Requirement 4.5: will-change: transform (valid CSS property)
  {
    property: 'willChange',
    expectedValues: ['transform', 'transform, opacity', 'auto'],
    webkitProperty: 'webkitWillChange',
    required: true,
    description: 'Chrome scroll optimization with valid will-change values',
    requirements: ['4.5']
  },
  
  // Requirement 5.2: min-height: 100vh (content container)
  {
    property: 'minHeight',
    expectedValues: ['100vh', '100%'],
    required: true,
    description: 'Full height coverage for short content',
    requirements: ['5.2']
  },
  
  // Requirement 6.4: contain: layout style paint
  {
    property: 'contain',
    expectedValues: ['layout style paint', 'layout', 'style', 'paint'],
    required: false,
    description: 'Chrome layout optimization',
    requirements: ['6.4']
  }
]

/**
 * Chrome CSS Property Validator
 */
export class ChromeCSSValidator {
  private supportCache = new Map<string, boolean>()

  /**
   * Validate all Chrome-specific CSS properties on an element
   */
  validateElement(element: HTMLElement): ChromeCSSValidationReport {
    const computedStyle = window.getComputedStyle(element)
    const validationResults: ChromeCSSValidationResult[] = []
    const missingProperties: string[] = []
    const unsupportedProperties: string[] = []
    const recommendations: string[] = []

    // Validate each Chrome CSS property
    for (const config of CHROME_CSS_PROPERTIES) {
      const result = this.validateProperty(computedStyle, config)
      validationResults.push(result)

      if (!result.isValid && config.required) {
        missingProperties.push(config.property)
      }

      if (!result.isSupported) {
        unsupportedProperties.push(config.property)
      }

      // Generate recommendations
      if (!result.isValid) {
        recommendations.push(this.generateRecommendation(config, result))
      }
    }

    const overallValid = validationResults.every(r => r.isValid || !this.isPropertyRequired(r.property))

    return {
      element,
      overallValid,
      validationResults,
      missingProperties,
      unsupportedProperties,
      recommendations
    }
  }

  /**
   * Validate a specific CSS property
   */
  validateProperty(
    computedStyle: CSSStyleDeclaration, 
    config: ChromeCSSPropertyConfig
  ): ChromeCSSValidationResult {
    const { property, expectedValues, webkitProperty, fallbackProperty } = config
    
    // Get actual value from computed style
    const actualValue = this.getPropertyValue(computedStyle, property)
    const webkitValue = webkitProperty ? this.getPropertyValue(computedStyle, webkitProperty) : null
    const fallbackValue = fallbackProperty ? this.getPropertyValue(computedStyle, fallbackProperty) : null

    // Check if property is supported
    const isSupported = this.isPropertySupported(property)
    const hasWebkitPrefix = webkitProperty ? this.isPropertySupported(webkitProperty) : false
    const hasFallback = fallbackProperty ? this.isPropertySupported(fallbackProperty) : false

    // Normalize expected values to array
    const expectedArray = Array.isArray(expectedValues) ? expectedValues : [expectedValues]

    // Check if actual value matches expected values
    let isValid = false
    
    // Check main property
    if (actualValue && expectedArray.some(expected => this.valuesMatch(actualValue, expected))) {
      isValid = true
    }
    
    // Check webkit property if main property is not valid
    if (!isValid && webkitValue && expectedArray.some(expected => this.valuesMatch(webkitValue, expected))) {
      isValid = true
    }
    
    // Check fallback property if others are not valid
    if (!isValid && fallbackValue && expectedArray.some(expected => this.valuesMatch(fallbackValue, expected))) {
      isValid = true
    }

    return {
      isValid,
      property,
      expectedValue: expectedValues,
      actualValue: actualValue || webkitValue || fallbackValue,
      isSupported,
      hasWebkitPrefix,
      hasFallback
    }
  }

  /**
   * Validate overscroll-behavior: contain property
   * Requirement 1.4
   */
  validateOverscrollBehavior(element: HTMLElement): ChromeCSSValidationResult {
    const computedStyle = window.getComputedStyle(element)
    const overscrollBehavior = computedStyle.overscrollBehavior || (computedStyle as any).webkitOverscrollBehavior
    
    return {
      isValid: overscrollBehavior === 'contain',
      property: 'overscrollBehavior',
      expectedValue: 'contain',
      actualValue: overscrollBehavior,
      isSupported: this.isPropertySupported('overscrollBehavior'),
      hasWebkitPrefix: this.isPropertySupported('webkitOverscrollBehavior'),
      hasFallback: false
    }
  }

  /**
   * Validate webkit-overflow-scrolling: touch property
   * Requirement 1.5
   */
  validateWebkitOverflowScrolling(element: HTMLElement): ChromeCSSValidationResult {
    const computedStyle = window.getComputedStyle(element)
    const webkitOverflowScrolling = (computedStyle as any).webkitOverflowScrolling
    
    return {
      isValid: webkitOverflowScrolling === 'touch',
      property: 'webkitOverflowScrolling',
      expectedValue: 'touch',
      actualValue: webkitOverflowScrolling,
      isSupported: this.isPropertySupported('webkitOverflowScrolling'),
      hasWebkitPrefix: true,
      hasFallback: false
    }
  }

  /**
   * Validate background-attachment: local property
   * Requirement 2.5
   */
  validateBackgroundAttachment(element: HTMLElement): ChromeCSSValidationResult {
    const computedStyle = window.getComputedStyle(element)
    const backgroundAttachment = computedStyle.backgroundAttachment || (computedStyle as any).webkitBackgroundAttachment
    
    return {
      isValid: backgroundAttachment === 'local',
      property: 'backgroundAttachment',
      expectedValue: 'local',
      actualValue: backgroundAttachment,
      isSupported: this.isPropertySupported('backgroundAttachment'),
      hasWebkitPrefix: this.isPropertySupported('webkitBackgroundAttachment'),
      hasFallback: false
    }
  }

  /**
   * Validate min-height: 100vh property
   * Requirements 2.1, 5.2
   */
  validateMinHeight(element: HTMLElement): ChromeCSSValidationResult {
    const computedStyle = window.getComputedStyle(element)
    const minHeight = computedStyle.minHeight
    
    const isValid: boolean = minHeight === '100vh' || minHeight === '100%' || 
                   (!!minHeight && minHeight.includes('100vh')) ||
                   (!!minHeight && minHeight.includes('100%'))
    
    return {
      isValid,
      property: 'minHeight',
      expectedValue: ['100vh', '100%'],
      actualValue: minHeight,
      isSupported: this.isPropertySupported('minHeight'),
      hasWebkitPrefix: false,
      hasFallback: false
    }
  }

  /**
   * Validate webkit-transform property
   * Requirements 3.5, 4.4
   */
  validateWebkitTransform(element: HTMLElement): ChromeCSSValidationResult {
    const computedStyle = window.getComputedStyle(element)
    const webkitTransform = (computedStyle as any).webkitTransform || computedStyle.transform
    
    const expectedTransforms = [
      'translateZ(0)', 'translateZ(0px)', 
      'translate3d(0, 0, 0)', 'translate3d(0px, 0px, 0px)',
      'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)'
    ]
    
    const isValid = expectedTransforms.some(expected => 
      webkitTransform && (webkitTransform.includes(expected) || webkitTransform === expected)
    )
    
    return {
      isValid,
      property: 'webkitTransform',
      expectedValue: expectedTransforms,
      actualValue: webkitTransform,
      isSupported: this.isPropertySupported('webkitTransform'),
      hasWebkitPrefix: true,
      hasFallback: this.isPropertySupported('transform')
    }
  }

  /**
   * Validate will-change property
   * Requirement 4.5
   */
  validateWillChange(element: HTMLElement): ChromeCSSValidationResult {
    const computedStyle = window.getComputedStyle(element)
    const willChange = computedStyle.willChange || (computedStyle as any).webkitWillChange
    
    const expectedValues = ['scroll-position', 'scroll-position, transform', 'auto']
    const isValid = expectedValues.includes(willChange)
    
    return {
      isValid,
      property: 'willChange',
      expectedValue: expectedValues,
      actualValue: willChange,
      isSupported: this.isPropertySupported('willChange'),
      hasWebkitPrefix: this.isPropertySupported('webkitWillChange'),
      hasFallback: false
    }
  }

  /**
   * Check if a CSS property is supported
   */
  private isPropertySupported(property: string): boolean {
    if (this.supportCache.has(property)) {
      return this.supportCache.get(property)!
    }

    if (typeof window === 'undefined') {
      this.supportCache.set(property, false)
      return false
    }

    const testElement = document.createElement('div')
    const isSupported = property in testElement.style

    this.supportCache.set(property, isSupported)
    return isSupported
  }

  /**
   * Get property value from computed style
   */
  private getPropertyValue(computedStyle: CSSStyleDeclaration, property: string): string | null {
    try {
      const value = (computedStyle as any)[property]
      return value || null
    } catch {
      return null
    }
  }

  /**
   * Check if two CSS values match (with normalization)
   */
  private valuesMatch(actual: string, expected: string): boolean {
    if (actual === expected) return true
    
    // Normalize values for comparison
    const normalizeValue = (value: string) => {
      return value
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/px/g, '')
        .trim()
    }
    
    return normalizeValue(actual) === normalizeValue(expected)
  }

  /**
   * Check if a property is required
   */
  private isPropertyRequired(property: string): boolean {
    const config = CHROME_CSS_PROPERTIES.find(p => p.property === property)
    return config?.required ?? false
  }

  /**
   * Generate recommendation for invalid property
   */
  private generateRecommendation(config: ChromeCSSPropertyConfig, result: ChromeCSSValidationResult): string {
    const { property, webkitProperty, fallbackProperty, expectedValues } = config
    const expectedStr = Array.isArray(expectedValues) ? expectedValues.join(' or ') : expectedValues

    if (!result.isSupported && !result.hasWebkitPrefix) {
      return `Property '${property}' is not supported. Consider using a fallback or polyfill.`
    }

    if (!result.isValid) {
      let recommendation = `Set '${property}' to '${expectedStr}'.`
      
      if (webkitProperty) {
        recommendation += ` Also set '${webkitProperty}' for Chrome compatibility.`
      }
      
      if (fallbackProperty) {
        recommendation += ` Use '${fallbackProperty}' as fallback.`
      }
      
      return recommendation
    }

    return `Property '${property}' is valid.`
  }

  /**
   * Get validation summary for multiple elements
   */
  validateElements(elements: HTMLElement[]): ChromeCSSValidationReport[] {
    return elements.map(element => this.validateElement(element))
  }

  /**
   * Check if element has all required Chrome optimizations
   */
  hasRequiredChromeOptimizations(element: HTMLElement): boolean {
    const report = this.validateElement(element)
    return report.overallValid && report.missingProperties.length === 0
  }

  /**
   * Get missing Chrome optimizations for an element
   */
  getMissingOptimizations(element: HTMLElement): string[] {
    const report = this.validateElement(element)
    return report.missingProperties
  }

  /**
   * Apply missing Chrome optimizations to an element
   */
  applyMissingOptimizations(element: HTMLElement): void {
    const report = this.validateElement(element)
    
    for (const result of report.validationResults) {
      if (!result.isValid) {
        const config = CHROME_CSS_PROPERTIES.find(p => p.property === result.property)
        if (config) {
          this.applyPropertyOptimization(element, config)
        }
      }
    }
  }

  /**
   * Apply a specific property optimization
   */
  private applyPropertyOptimization(element: HTMLElement, config: ChromeCSSPropertyConfig): void {
    const { property, expectedValues, webkitProperty } = config
    const value = Array.isArray(expectedValues) ? expectedValues[0] : expectedValues

    // Apply main property
    try {
      (element.style as any)[property] = value
    } catch {
      // Property not supported
    }

    // Apply webkit property if available
    if (webkitProperty) {
      try {
        (element.style as any)[webkitProperty] = value
      } catch {
        // Webkit property not supported
      }
    }
  }
}

/**
 * Global Chrome CSS validator instance
 */
export const chromeCSSValidator = new ChromeCSSValidator()

/**
 * Convenience function to validate an element's Chrome CSS properties
 */
export function validateChromeCSS(element: HTMLElement): ChromeCSSValidationReport {
  return chromeCSSValidator.validateElement(element)
}

/**
 * Convenience function to check if element has required Chrome optimizations
 */
export function hasRequiredChromeOptimizations(element: HTMLElement): boolean {
  return chromeCSSValidator.hasRequiredChromeOptimizations(element)
}

/**
 * Convenience function to apply missing Chrome optimizations
 */
export function applyMissingChromeOptimizations(element: HTMLElement): void {
  chromeCSSValidator.applyMissingOptimizations(element)
}

/**
 * Validate Chrome CSS properties for fallback behavior
 */
export function validateChromeFallbacks(element: HTMLElement): {
  hasWebkitFallbacks: boolean
  hasStandardFallbacks: boolean
  missingFallbacks: string[]
} {
  const report = chromeCSSValidator.validateElement(element)
  const webkitProperties = report.validationResults.filter(r => r.hasWebkitPrefix)
  const standardProperties = report.validationResults.filter(r => r.hasFallback)
  const missingFallbacks: string[] = []

  // Check for missing webkit fallbacks
  for (const result of report.validationResults) {
    const config = CHROME_CSS_PROPERTIES.find(p => p.property === result.property)
    if (config?.webkitProperty && !result.hasWebkitPrefix) {
      missingFallbacks.push(config.webkitProperty)
    }
  }

  return {
    hasWebkitFallbacks: webkitProperties.length > 0,
    hasStandardFallbacks: standardProperties.length > 0,
    missingFallbacks
  }
}

/**
 * Chrome CSS property validation constants
 */
export const CHROME_CSS_VALIDATION = {
  REQUIRED_PROPERTIES: CHROME_CSS_PROPERTIES.filter(p => p.required).map(p => p.property),
  WEBKIT_PROPERTIES: CHROME_CSS_PROPERTIES.filter(p => p.webkitProperty).map(p => p.webkitProperty!),
  FALLBACK_PROPERTIES: CHROME_CSS_PROPERTIES.filter(p => p.fallbackProperty).map(p => p.fallbackProperty!),
  ALL_PROPERTIES: CHROME_CSS_PROPERTIES.map(p => p.property)
} as const