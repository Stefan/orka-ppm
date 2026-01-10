/**
 * Test Configuration
 * Central configuration for all testing utilities and frameworks
 */

import { PropertyTestConfig } from '../utils/property-testing'
import { AccessibilityTestOptions } from '../utils/accessibility-testing'
import { ViewportSize } from '../utils/responsive-testing'

/**
 * Property-based testing configuration
 */
export const PROPERTY_TEST_CONFIG: PropertyTestConfig = {
  numRuns: 100,
  timeout: 10000, // 10 seconds for complex tests
  seed: undefined // Use random seed by default
}

/**
 * Fast property testing configuration for CI/development
 */
export const FAST_PROPERTY_TEST_CONFIG: PropertyTestConfig = {
  numRuns: 25,
  timeout: 5000,
  seed: undefined
}

/**
 * Comprehensive property testing configuration for thorough testing
 */
export const COMPREHENSIVE_PROPERTY_TEST_CONFIG: PropertyTestConfig = {
  numRuns: 500,
  timeout: 30000,
  seed: undefined
}

/**
 * Accessibility testing configuration
 */
export const ACCESSIBILITY_TEST_CONFIG: AccessibilityTestOptions = {
  rules: {
    // Core WCAG 2.1 AA rules
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-order-semantics': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'button-name': { enabled: true },
    'link-name': { enabled: true },
    'image-alt': { enabled: true },
    'label': { enabled: true },
    'landmark-one-main': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
    'skip-link': { enabled: true },
    'tabindex': { enabled: true },
    'valid-lang': { enabled: true },
    
    // Mobile-specific accessibility rules
    'target-size': { enabled: true },
    'touch-target': { enabled: true },
    'orientation': { enabled: true },
    
    // Additional WCAG 2.1 rules
    'autocomplete-valid': { enabled: true },
    'focus-order-semantics': { enabled: true },
    'scrollable-region-focusable': { enabled: true }
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
}

/**
 * Responsive testing viewport configurations
 */
export const TEST_VIEWPORTS: Record<string, ViewportSize> = {
  // Mobile devices
  iphoneSE: { width: 375, height: 667, name: 'iPhone SE' },
  iphone12: { width: 390, height: 844, name: 'iPhone 12' },
  iphone12Pro: { width: 390, height: 844, name: 'iPhone 12 Pro' },
  iphone12ProMax: { width: 428, height: 926, name: 'iPhone 12 Pro Max' },
  pixel5: { width: 393, height: 851, name: 'Google Pixel 5' },
  galaxyS21: { width: 384, height: 854, name: 'Samsung Galaxy S21' },
  
  // Tablets
  ipadMini: { width: 768, height: 1024, name: 'iPad Mini' },
  ipad: { width: 820, height: 1180, name: 'iPad' },
  ipadPro: { width: 1024, height: 1366, name: 'iPad Pro' },
  surfacePro: { width: 912, height: 1368, name: 'Surface Pro 7' },
  
  // Desktop
  laptop: { width: 1366, height: 768, name: 'Laptop' },
  desktop: { width: 1920, height: 1080, name: 'Desktop' },
  desktopLarge: { width: 2560, height: 1440, name: 'Large Desktop' },
  ultrawide: { width: 3440, height: 1440, name: 'Ultrawide Monitor' }
}

/**
 * Performance testing thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals thresholds (Google recommendations)
  LCP: {
    good: 2500,      // <= 2.5s
    needsImprovement: 4000, // 2.5s - 4s
    poor: Infinity   // > 4s
  },
  FID: {
    good: 100,       // <= 100ms
    needsImprovement: 300,  // 100ms - 300ms
    poor: Infinity   // > 300ms
  },
  CLS: {
    good: 0.1,       // <= 0.1
    needsImprovement: 0.25, // 0.1 - 0.25
    poor: Infinity   // > 0.25
  },
  FCP: {
    good: 1800,      // <= 1.8s
    needsImprovement: 3000, // 1.8s - 3s
    poor: Infinity   // > 3s
  },
  TTFB: {
    good: 800,       // <= 800ms
    needsImprovement: 1800, // 800ms - 1.8s
    poor: Infinity   // > 1.8s
  }
}

/**
 * Touch interaction testing configuration
 */
export const TOUCH_TEST_CONFIG = {
  // Minimum touch target size (WCAG 2.1 AA)
  minTouchTargetSize: 44, // pixels
  
  // Touch gesture thresholds
  swipeThreshold: 50,     // minimum distance for swipe recognition
  longPressThreshold: 500, // milliseconds
  tapThreshold: 200,      // milliseconds
  
  // Multi-touch configuration
  maxTouches: 10,         // maximum simultaneous touches to test
  
  // Touch precision
  touchRadius: 10         // pixels
}

/**
 * AI testing configuration
 */
export const AI_TEST_CONFIG = {
  // Confidence score thresholds
  minConfidenceScore: 0.7,
  highConfidenceScore: 0.9,
  
  // Recommendation testing
  maxRecommendations: 10,
  minRecommendations: 1,
  
  // Learning rate testing
  learningRateThreshold: 0.05,
  
  // Performance thresholds for AI operations
  maxProcessingTime: 5000, // milliseconds
  maxMemoryUsage: 100 * 1024 * 1024 // 100MB
}

/**
 * Network condition testing scenarios
 */
export const NETWORK_CONDITIONS = {
  offline: {
    speed: 'offline' as const,
    latency: Infinity,
    bandwidth: 0
  },
  slow2g: {
    speed: 'slow-2g' as const,
    latency: 2000,
    bandwidth: 56
  },
  '2g': {
    speed: '2g' as const,
    latency: 1400,
    bandwidth: 256
  },
  '3g': {
    speed: '3g' as const,
    latency: 400,
    bandwidth: 1600
  },
  '4g': {
    speed: '4g' as const,
    latency: 100,
    bandwidth: 10000
  },
  '5g': {
    speed: '5g' as const,
    latency: 20,
    bandwidth: 100000
  },
  wifi: {
    speed: 'wifi' as const,
    latency: 10,
    bandwidth: 50000
  }
}

/**
 * Test environment configuration
 */
export const TEST_ENV_CONFIG = {
  // Timeouts
  defaultTimeout: 5000,
  longTimeout: 30000,
  shortTimeout: 1000,
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000,
  
  // Parallel execution
  maxWorkers: 4,
  
  // Memory limits
  maxMemoryUsage: 512 * 1024 * 1024, // 512MB
  
  // File size limits
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // Screenshot configuration
  screenshotOnFailure: true,
  screenshotQuality: 80
}

/**
 * Feature flags for testing
 */
export const TEST_FEATURE_FLAGS = {
  enableVisualRegression: process.env.ENABLE_VISUAL_REGRESSION === 'true',
  enablePerformanceTesting: process.env.ENABLE_PERFORMANCE_TESTING === 'true',
  enableAccessibilityTesting: process.env.ENABLE_A11Y_TESTING !== 'false', // enabled by default
  enablePropertyTesting: process.env.ENABLE_PROPERTY_TESTING !== 'false', // enabled by default
  enableCrossBrowserTesting: process.env.ENABLE_CROSS_BROWSER_TESTING === 'true',
  enableMobileTesting: process.env.ENABLE_MOBILE_TESTING !== 'false', // enabled by default
  
  // CI/CD specific flags
  isCI: process.env.CI === 'true',
  isCoverage: process.env.COVERAGE === 'true',
  
  // Debug flags
  debugMode: process.env.DEBUG_TESTS === 'true',
  verboseLogging: process.env.VERBOSE_TESTS === 'true'
}

/**
 * Get test configuration based on environment
 */
export function getTestConfig() {
  const isCI = TEST_FEATURE_FLAGS.isCI
  const isCoverage = TEST_FEATURE_FLAGS.isCoverage
  
  return {
    propertyTesting: isCI ? FAST_PROPERTY_TEST_CONFIG : PROPERTY_TEST_CONFIG,
    accessibility: ACCESSIBILITY_TEST_CONFIG,
    performance: PERFORMANCE_THRESHOLDS,
    touch: TOUCH_TEST_CONFIG,
    ai: AI_TEST_CONFIG,
    network: NETWORK_CONDITIONS,
    environment: {
      ...TEST_ENV_CONFIG,
      maxWorkers: isCI ? 2 : TEST_ENV_CONFIG.maxWorkers,
      screenshotOnFailure: !isCI && TEST_ENV_CONFIG.screenshotOnFailure
    },
    features: TEST_FEATURE_FLAGS
  }
}

/**
 * Test suite configuration for different types of tests
 */
export const TEST_SUITES = {
  unit: {
    pattern: '**/*.test.{ts,tsx}',
    timeout: TEST_ENV_CONFIG.defaultTimeout,
    coverage: true
  },
  property: {
    pattern: '**/*.property.test.{ts,tsx}',
    timeout: TEST_ENV_CONFIG.longTimeout,
    coverage: false
  },
  integration: {
    pattern: '**/*.integration.test.{ts,tsx}',
    timeout: TEST_ENV_CONFIG.longTimeout,
    coverage: true
  },
  e2e: {
    pattern: '**/*.e2e.test.{ts,tsx}',
    timeout: TEST_ENV_CONFIG.longTimeout,
    coverage: false
  },
  accessibility: {
    pattern: '**/*.a11y.test.{ts,tsx}',
    timeout: TEST_ENV_CONFIG.defaultTimeout,
    coverage: false
  },
  performance: {
    pattern: '**/*.perf.test.{ts,tsx}',
    timeout: TEST_ENV_CONFIG.longTimeout,
    coverage: false
  }
}

export default getTestConfig()