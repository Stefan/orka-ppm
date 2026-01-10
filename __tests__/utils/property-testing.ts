/**
 * Property-Based Testing Utilities
 * Provides utilities and generators for property-based testing with fast-check
 */

import * as fc from 'fast-check'
import { ReactElement } from 'react'

/**
 * Common generators for UI testing
 */
export const generators = {
  // Viewport dimensions
  viewportWidth: fc.integer({ min: 320, max: 2560 }),
  viewportHeight: fc.integer({ min: 568, max: 1440 }),
  
  // Touch coordinates
  touchCoordinate: fc.integer({ min: 0, max: 1000 }),
  
  // Colors
  hexColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(hex => `#${hex}`),
  rgbColor: fc.record({
    r: fc.integer({ min: 0, max: 255 }),
    g: fc.integer({ min: 0, max: 255 }),
    b: fc.integer({ min: 0, max: 255 })
  }).map(({ r, g, b }) => `rgb(${r}, ${g}, ${b})`),
  
  // Text content
  shortText: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  mediumText: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0),
  longText: fc.string({ minLength: 100, max: 1000 }).filter(s => s.trim().length > 0),
  
  // HTML attributes
  htmlId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9-_]*$/.test(s)),
  className: fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-zA-Z][a-zA-Z0-9-_\s]*$/.test(s)),
  
  // URLs
  url: fc.webUrl(),
  fragment: fc.string({ minLength: 1, maxLength: 20 }).map(s => `#${s}`),
  
  // Form data
  email: fc.emailAddress(),
  phoneNumber: fc.string({ minLength: 10, maxLength: 15 }).filter(s => /^\+?[\d\s\-\(\)]+$/.test(s)),
  
  // Performance metrics
  performanceValue: fc.float({ min: 0, max: 10000, noNaN: true }),
  percentage: fc.float({ min: 0, max: 100, noNaN: true }),
  
  // Device characteristics
  devicePixelRatio: fc.constantFrom(1, 1.5, 2, 2.5, 3),
  orientation: fc.constantFrom('portrait', 'landscape'),
  
  // Accessibility
  ariaRole: fc.constantFrom(
    'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 
    'listbox', 'option', 'tab', 'tabpanel', 'dialog', 'alertdialog',
    'main', 'navigation', 'banner', 'contentinfo', 'complementary', 'search'
  ),
  
  // Touch gestures
  touchGesture: fc.constantFrom('tap', 'swipe', 'pinch', 'longpress', 'drag'),
  swipeDirection: fc.constantFrom('left', 'right', 'up', 'down'),
  
  // Network conditions
  networkSpeed: fc.constantFrom('slow-2g', '2g', '3g', '4g', '5g', 'wifi'),
  connectionType: fc.constantFrom('cellular', 'wifi', 'ethernet', 'none'),
  
  // User preferences
  theme: fc.constantFrom('light', 'dark', 'auto'),
  language: fc.constantFrom('en', 'es', 'fr', 'de', 'ja', 'zh'),
  fontSize: fc.constantFrom('small', 'medium', 'large', 'extra-large'),
  
  // AI/ML related
  confidenceScore: fc.float({ min: 0, max: 1, noNaN: true }),
  priority: fc.integer({ min: 1, max: 10 }),
  
  // Time-based
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  duration: fc.integer({ min: 0, max: 300000 }), // 0 to 5 minutes in ms
  
  // Data structures
  keyValuePair: fc.record({
    key: fc.string({ minLength: 1, maxLength: 20 }),
    value: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.float())
  }),
  
  // Component props
  buttonProps: fc.record({
    disabled: fc.boolean(),
    loading: fc.boolean(),
    variant: fc.constantFrom('primary', 'secondary', 'ghost', 'danger'),
    size: fc.constantFrom('sm', 'md', 'lg')
  }),
  
  inputProps: fc.record({
    type: fc.constantFrom('text', 'email', 'password', 'number', 'tel', 'url'),
    required: fc.boolean(),
    disabled: fc.boolean(),
    placeholder: fc.option(fc.string({ maxLength: 50 }))
  })
}

/**
 * Viewport size generator with realistic combinations
 */
export const viewportGenerator = fc.oneof(
  // Mobile devices
  fc.record({
    width: fc.integer({ min: 320, max: 428 }),
    height: fc.integer({ min: 568, max: 926 }),
    type: fc.constant('mobile' as const)
  }),
  // Tablets
  fc.record({
    width: fc.integer({ min: 768, max: 1024 }),
    height: fc.integer({ min: 1024, max: 1366 }),
    type: fc.constant('tablet' as const)
  }),
  // Desktop
  fc.record({
    width: fc.integer({ min: 1024, max: 2560 }),
    height: fc.integer({ min: 768, max: 1440 }),
    type: fc.constant('desktop' as const)
  })
)

/**
 * Touch event generator
 */
export const touchEventGenerator = fc.record({
  type: fc.constantFrom('touchstart', 'touchmove', 'touchend', 'touchcancel'),
  touches: fc.array(
    fc.record({
      clientX: generators.touchCoordinate,
      clientY: generators.touchCoordinate,
      identifier: fc.integer({ min: 0, max: 9 })
    }),
    { minLength: 1, maxLength: 3 }
  ),
  timestamp: fc.integer({ min: 0, max: Date.now() })
})

/**
 * User interaction generator
 */
export const userInteractionGenerator = fc.record({
  type: fc.constantFrom('click', 'touch', 'keyboard', 'scroll', 'resize'),
  target: generators.htmlId,
  timestamp: generators.timestamp,
  metadata: fc.option(fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean())))
})

/**
 * Performance metrics generator
 */
export const performanceMetricsGenerator = fc.record({
  LCP: fc.float({ min: 0, max: 10000 }), // Largest Contentful Paint
  FID: fc.float({ min: 0, max: 1000 }),  // First Input Delay
  CLS: fc.float({ min: 0, max: 1 }),     // Cumulative Layout Shift
  FCP: fc.float({ min: 0, max: 5000 }),  // First Contentful Paint
  TTFB: fc.float({ min: 0, max: 3000 })  // Time to First Byte
})

/**
 * AI recommendation generator
 */
export const aiRecommendationGenerator = fc.record({
  id: generators.htmlId,
  type: fc.constantFrom('navigation', 'optimization', 'risk-mitigation', 'resource-allocation'),
  confidence: generators.confidenceScore,
  priority: generators.priority,
  description: generators.mediumText,
  metadata: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.float()))
})

/**
 * Responsive component state generator
 */
export const responsiveStateGenerator = fc.record({
  viewport: viewportGenerator,
  orientation: generators.orientation,
  devicePixelRatio: generators.devicePixelRatio,
  theme: generators.theme,
  fontSize: generators.fontSize,
  reducedMotion: fc.boolean(),
  highContrast: fc.boolean()
})

/**
 * Form validation generator
 */
export const formValidationGenerator = fc.record({
  field: fc.string({ minLength: 1, maxLength: 20 }),
  value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  rules: fc.array(
    fc.record({
      type: fc.constantFrom('required', 'minLength', 'maxLength', 'pattern', 'email', 'url'),
      value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
      message: generators.shortText
    }),
    { minLength: 1, maxLength: 5 }
  )
})

/**
 * Accessibility state generator
 */
export const accessibilityStateGenerator = fc.record({
  screenReader: fc.boolean(),
  keyboardOnly: fc.boolean(),
  highContrast: fc.boolean(),
  reducedMotion: fc.boolean(),
  fontSize: generators.fontSize,
  colorBlindness: fc.constantFrom('none', 'protanopia', 'deuteranopia', 'tritanopia')
})

/**
 * Network condition generator
 */
export const networkConditionGenerator = fc.record({
  speed: generators.networkSpeed,
  type: generators.connectionType,
  latency: fc.integer({ min: 0, max: 2000 }),
  bandwidth: fc.integer({ min: 56, max: 1000000 }), // kbps
  offline: fc.boolean()
})

/**
 * Property test configuration
 */
export interface PropertyTestConfig {
  numRuns?: number
  timeout?: number
  seed?: number
  path?: string
  examples?: any[]
}

/**
 * Default property test configuration
 */
export const defaultPropertyConfig: PropertyTestConfig = {
  numRuns: 100,
  timeout: 5000
}

/**
 * Helper function to run property tests with consistent configuration
 */
export function runPropertyTest<T>(
  property: fc.Property<T>,
  config: PropertyTestConfig = defaultPropertyConfig
): void {
  fc.assert(property, {
    numRuns: config.numRuns,
    timeout: config.timeout,
    seed: config.seed,
    path: config.path,
    examples: config.examples
  })
}

/**
 * Helper to create property tests for React components
 */
export function createComponentPropertyTest<P>(
  component: (props: P) => ReactElement,
  propsGenerator: fc.Arbitrary<P>,
  testFn: (props: P, element: HTMLElement) => void | Promise<void>,
  config: PropertyTestConfig = defaultPropertyConfig
) {
  return fc.property(propsGenerator, async (props) => {
    const { render } = await import('@testing-library/react')
    const { container, unmount } = render(component(props))
    
    try {
      await testFn(props, container)
    } finally {
      unmount()
    }
  })
}

/**
 * Helper to create responsive property tests
 */
export function createResponsivePropertyTest<P>(
  component: (props: P) => ReactElement,
  propsGenerator: fc.Arbitrary<P>,
  testFn: (props: P, element: HTMLElement, viewport: any) => void | Promise<void>,
  config: PropertyTestConfig = defaultPropertyConfig
) {
  return fc.property(
    fc.record({
      props: propsGenerator,
      viewport: viewportGenerator
    }),
    async ({ props, viewport }) => {
      const { render } = await import('@testing-library/react')
      const { setViewportSize } = await import('./responsive-testing')
      
      // Set viewport size
      setViewportSize(viewport.width, viewport.height)
      
      const { container, unmount } = render(component(props))
      
      try {
        await testFn(props, container, viewport)
      } finally {
        unmount()
      }
    }
  )
}

/**
 * Helper to create accessibility property tests
 */
export function createAccessibilityPropertyTest<P>(
  component: (props: P) => ReactElement,
  propsGenerator: fc.Arbitrary<P>,
  testFn: (props: P, element: HTMLElement, a11yState: any) => void | Promise<void>,
  config: PropertyTestConfig = defaultPropertyConfig
) {
  return fc.property(
    fc.record({
      props: propsGenerator,
      a11yState: accessibilityStateGenerator
    }),
    async ({ props, a11yState }) => {
      const { render } = await import('@testing-library/react')
      
      // Mock accessibility preferences
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('prefers-reduced-motion') ? a11yState.reducedMotion :
                   query.includes('prefers-contrast') ? a11yState.highContrast : false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }))
      })
      
      const { container, unmount } = render(component(props))
      
      try {
        await testFn(props, container, a11yState)
      } finally {
        unmount()
      }
    }
  )
}

/**
 * Performance property test helper
 */
export function createPerformancePropertyTest<P>(
  component: (props: P) => ReactElement,
  propsGenerator: fc.Arbitrary<P>,
  testFn: (props: P, element: HTMLElement, metrics: any) => void | Promise<void>,
  config: PropertyTestConfig = defaultPropertyConfig
) {
  return fc.property(
    fc.record({
      props: propsGenerator,
      metrics: performanceMetricsGenerator,
      network: networkConditionGenerator
    }),
    async ({ props, metrics, network }) => {
      const { render } = await import('@testing-library/react')
      
      // Mock performance APIs
      const mockPerformance = {
        now: jest.fn(() => Date.now()),
        mark: jest.fn(),
        measure: jest.fn(),
        getEntriesByType: jest.fn(() => []),
        getEntriesByName: jest.fn(() => [])
      }
      
      Object.defineProperty(global, 'performance', {
        value: mockPerformance,
        writable: true
      })
      
      // Mock network conditions
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: network.speed,
          type: network.type,
          downlink: network.bandwidth / 1000,
          rtt: network.latency
        },
        writable: true
      })
      
      const { container, unmount } = render(component(props))
      
      try {
        await testFn(props, container, { ...metrics, network })
      } finally {
        unmount()
      }
    }
  )
}