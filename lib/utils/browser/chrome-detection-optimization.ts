/**
 * Chrome Detection and Optimization Utilities
 * Implements Requirements 7.5 - Chrome browser detection and fallback strategies
 */

export interface BrowserInfo {
  isChrome: boolean
  isEdge: boolean
  isBrave: boolean
  isOpera: boolean
  isSafari: boolean
  isFirefox: boolean
  isWebkit: boolean
  version: string | undefined
  engine: 'webkit' | 'gecko' | 'blink' | 'unknown'
}

export interface ChromeOptimizationConfig {
  enableForAllWebkit?: boolean
  enableFallbacks?: boolean
  debugMode?: boolean
  performanceMonitoring?: boolean
}

/**
 * Comprehensive browser detection utility
 */
export function detectBrowser(): BrowserInfo {
  if (typeof window === 'undefined') {
    return {
      isChrome: false,
      isEdge: false,
      isBrave: false,
      isOpera: false,
      isSafari: false,
      isFirefox: false,
      isWebkit: false,
      version: undefined,
      engine: 'unknown'
    }
  }

  const userAgent = window.navigator.userAgent
  const vendor = window.navigator.vendor || ''

  // Detect specific browsers
  const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(vendor) && !(window as any).opr
  const isEdge = /Edg/.test(userAgent)
  const isBrave = (window.navigator as any).brave !== undefined
  const isOpera = /OPR/.test(userAgent) || !!(window as any).opr
  const isSafari = /Safari/.test(userAgent) && /Apple Computer/.test(vendor) && !isChrome
  const isFirefox = /Firefox/.test(userAgent)
  const isWebkit = /WebKit/.test(userAgent)

  // Determine engine
  let engine: 'webkit' | 'gecko' | 'blink' | 'unknown' = 'unknown'
  if (isChrome || isEdge || isBrave || isOpera) {
    engine = 'blink'
  } else if (isSafari) {
    engine = 'webkit'
  } else if (isFirefox) {
    engine = 'gecko'
  } else if (isWebkit) {
    engine = 'webkit'
  }

  // Extract version (simplified)
  let version: string | undefined
  const versionMatch = userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/(\d+\.\d+)/)
  if (versionMatch) {
    version = versionMatch[1]
  }

  return {
    isChrome,
    isEdge,
    isBrave,
    isOpera,
    isSafari,
    isFirefox,
    isWebkit,
    version,
    engine
  }
}

/**
 * Chrome-based browser detection (includes Chrome, Edge, Brave, Opera)
 */
export function isChromeBasedBrowser(): boolean {
  const browser = detectBrowser()
  return browser.isChrome || browser.isEdge || browser.isBrave || browser.isOpera
}

/**
 * WebKit-based browser detection (includes Chrome-based + Safari)
 */
export function isWebkitBasedBrowser(): boolean {
  const browser = detectBrowser()
  return browser.engine === 'webkit' || browser.engine === 'blink'
}

/**
 * Chrome optimization applicator with fallback strategies
 */
export class ChromeOptimizationManager {
  private config: ChromeOptimizationConfig
  private browserInfo: BrowserInfo
  private appliedOptimizations = new WeakSet<HTMLElement>()

  constructor(config: ChromeOptimizationConfig = {}) {
    this.config = {
      enableForAllWebkit: false,
      enableFallbacks: true,
      debugMode: false,
      performanceMonitoring: false,
      ...config
    }
    this.browserInfo = detectBrowser()
  }

  /**
   * Apply Chrome-specific optimizations with fallback strategies
   */
  applyOptimizations(element: HTMLElement): boolean {
    if (this.appliedOptimizations.has(element)) {
      if (this.config.debugMode) {
        console.log('Chrome optimizations already applied to element')
      }
      return true
    }

    const shouldApplyChrome = this.shouldApplyChromeOptimizations()
    const shouldApplyWebkit = this.shouldApplyWebkitOptimizations()
    const shouldApplyFallback = this.shouldApplyFallbackOptimizations()

    if (shouldApplyChrome) {
      this.applyChromeSpecificOptimizations(element)
      this.appliedOptimizations.add(element)
      return true
    } else if (shouldApplyWebkit) {
      this.applyWebkitOptimizations(element)
      this.appliedOptimizations.add(element)
      return true
    } else if (shouldApplyFallback) {
      this.applyFallbackOptimizations(element)
      this.appliedOptimizations.add(element)
      return true
    }

    if (this.config.debugMode) {
      console.log('No optimizations applied - browser not supported:', this.browserInfo)
    }
    return false
  }

  /**
   * Check if Chrome-specific optimizations should be applied
   */
  private shouldApplyChromeOptimizations(): boolean {
    return isChromeBasedBrowser()
  }

  /**
   * Check if WebKit optimizations should be applied
   */
  private shouldApplyWebkitOptimizations(): boolean {
    return !!this.config.enableForAllWebkit && isWebkitBasedBrowser()
  }

  /**
   * Check if fallback optimizations should be applied
   */
  private shouldApplyFallbackOptimizations(): boolean {
    return !!this.config.enableFallbacks && !this.browserInfo.isChrome
  }

  /**
   * Apply Chrome-specific scroll optimizations
   */
  private applyChromeSpecificOptimizations(element: HTMLElement): void {
    // Chrome-specific webkit properties
    ;(element.style as any).webkitOverflowScrolling = 'touch'
    ;(element.style as any).webkitOverscrollBehavior = 'contain'
    ;(element.style as any).webkitOverscrollBehaviorY = 'contain'
    ;(element.style as any).webkitTransform = 'translateZ(0)'
    ;(element.style as any).webkitBackfaceVisibility = 'hidden'
    ;(element.style as any).webkitWillChange = 'scroll-position'
    ;(element.style as any).webkitBackgroundAttachment = 'local'

    // Standard properties
    element.style.overscrollBehavior = 'contain'
    ;(element.style as any).overscrollBehaviorY = 'contain'
    element.style.transform = 'translateZ(0)'
    element.style.backfaceVisibility = 'hidden'
    element.style.willChange = 'scroll-position'
    element.style.backgroundAttachment = 'local'
    ;(element.style as any).contain = 'layout style paint'

    // Background optimization
    element.style.backgroundColor = '#ffffff'
    element.style.backgroundImage = 'linear-gradient(to bottom, #ffffff 0%, #ffffff 100%)'
    element.style.minHeight = '100vh'

    // Chrome optimization classes
    element.classList.add(
      'chrome-scroll-optimized',
      'chrome-background-coverage',
      'chrome-overscroll-contained',
      'chrome-hardware-accelerated'
    )

    if (this.config.debugMode) {
      console.log('Applied Chrome-specific optimizations to element:', element)
    }
  }

  /**
   * Apply WebKit optimizations (for Safari and other WebKit browsers)
   */
  private applyWebkitOptimizations(element: HTMLElement): void {
    // WebKit-compatible properties
    ;(element.style as any).webkitOverflowScrolling = 'touch'
    ;(element.style as any).webkitTransform = 'translateZ(0)'
    ;(element.style as any).webkitBackfaceVisibility = 'hidden'
    ;(element.style as any).webkitBackgroundAttachment = 'local'

    // Standard properties
    element.style.transform = 'translateZ(0)'
    element.style.backfaceVisibility = 'hidden'
    element.style.backgroundAttachment = 'local'
    element.style.backgroundColor = '#ffffff'
    element.style.minHeight = '100vh'

    // WebKit optimization classes
    element.classList.add(
      'webkit-scroll-optimized',
      'webkit-background-coverage',
      'webkit-hardware-accelerated'
    )

    if (this.config.debugMode) {
      console.log('Applied WebKit optimizations to element:', element)
    }
  }

  /**
   * Apply fallback optimizations for non-WebKit browsers
   */
  private applyFallbackOptimizations(element: HTMLElement): void {
    // Basic cross-browser properties
    element.style.backgroundColor = '#ffffff'
    element.style.backgroundAttachment = 'scroll' // More compatible than 'local'
    element.style.minHeight = '100vh'

    // Firefox-specific optimizations
    if (this.browserInfo.isFirefox) {
      ;(element.style as any).scrollBehavior = 'smooth'
      element.classList.add('firefox-scroll-optimized')
    }

    // General fallback classes
    element.classList.add(
      'fallback-scroll-optimized',
      'fallback-background-coverage'
    )

    if (this.config.debugMode) {
      console.log('Applied fallback optimizations to element:', element, 'Browser:', this.browserInfo.engine)
    }
  }

  /**
   * Remove optimizations from an element
   */
  removeOptimizations(element: HTMLElement): void {
    // Remove Chrome-specific properties
    ;(element.style as any).webkitOverflowScrolling = ''
    ;(element.style as any).webkitOverscrollBehavior = ''
    ;(element.style as any).webkitOverscrollBehaviorY = ''
    ;(element.style as any).webkitTransform = ''
    ;(element.style as any).webkitBackfaceVisibility = ''
    ;(element.style as any).webkitWillChange = ''
    ;(element.style as any).webkitBackgroundAttachment = ''

    // Remove standard properties
    element.style.overscrollBehavior = ''
    ;(element.style as any).overscrollBehaviorY = ''
    element.style.transform = ''
    element.style.backfaceVisibility = ''
    element.style.willChange = ''
    element.style.backgroundAttachment = ''
    ;(element.style as any).contain = ''
    element.style.backgroundColor = ''
    element.style.backgroundImage = ''
    element.style.minHeight = ''
    ;(element.style as any).scrollBehavior = ''

    // Remove optimization classes
    const classesToRemove = [
      'chrome-scroll-optimized',
      'chrome-background-coverage',
      'chrome-overscroll-contained',
      'chrome-hardware-accelerated',
      'webkit-scroll-optimized',
      'webkit-background-coverage',
      'webkit-hardware-accelerated',
      'firefox-scroll-optimized',
      'fallback-scroll-optimized',
      'fallback-background-coverage'
    ]

    classesToRemove.forEach(className => {
      element.classList.remove(className)
    })

    this.appliedOptimizations.delete(element)

    if (this.config.debugMode) {
      console.log('Removed optimizations from element:', element)
    }
  }

  /**
   * Get browser information
   */
  getBrowserInfo(): BrowserInfo {
    return { ...this.browserInfo }
  }

  /**
   * Check if optimizations are supported
   */
  isOptimizationSupported(): boolean {
    return this.shouldApplyChromeOptimizations() || 
           this.shouldApplyWebkitOptimizations() || 
           this.shouldApplyFallbackOptimizations()
  }

  /**
   * Get optimization strategy for current browser
   */
  getOptimizationStrategy(): 'chrome' | 'webkit' | 'fallback' | 'none' {
    if (this.shouldApplyChromeOptimizations()) return 'chrome'
    if (this.shouldApplyWebkitOptimizations()) return 'webkit'
    if (this.shouldApplyFallbackOptimizations()) return 'fallback'
    return 'none'
  }
}

/**
 * Global Chrome optimization manager instance
 */
export const chromeOptimizationManager = new ChromeOptimizationManager({
  enableForAllWebkit: true,
  enableFallbacks: true,
  debugMode: false,
  performanceMonitoring: true
})

/**
 * Convenience function to apply Chrome optimizations to an element
 */
export function applyBrowserOptimizations(
  element: HTMLElement, 
  config?: ChromeOptimizationConfig
): boolean {
  if (config) {
    const manager = new ChromeOptimizationManager(config)
    return manager.applyOptimizations(element)
  }
  return chromeOptimizationManager.applyOptimizations(element)
}

/**
 * Convenience function to apply optimizations to multiple elements
 */
export function applyOptimizationsToElements(
  elements: HTMLElement[], 
  config?: ChromeOptimizationConfig
): number {
  let successCount = 0
  const manager = config ? new ChromeOptimizationManager(config) : chromeOptimizationManager

  elements.forEach(element => {
    if (manager.applyOptimizations(element)) {
      successCount++
    }
  })

  return successCount
}

/**
 * Convenience function to remove optimizations from an element
 */
export function removeBrowserOptimizations(element: HTMLElement): void {
  chromeOptimizationManager.removeOptimizations(element)
}

/**
 * Feature detection utilities
 */
export const featureDetection = {
  /**
   * Check if CSS overscroll-behavior is supported
   */
  supportsOverscrollBehavior(): boolean {
    if (typeof window === 'undefined') return false
    const testElement = document.createElement('div')
    return 'overscrollBehavior' in testElement.style || 
           'webkitOverscrollBehavior' in (testElement.style as any)
  },

  /**
   * Check if CSS will-change is supported
   */
  supportsWillChange(): boolean {
    if (typeof window === 'undefined') return false
    const testElement = document.createElement('div')
    return 'willChange' in testElement.style
  },

  /**
   * Check if CSS contain is supported
   */
  supportsContain(): boolean {
    if (typeof window === 'undefined') return false
    const testElement = document.createElement('div')
    return 'contain' in (testElement.style as any)
  },

  /**
   * Check if webkit overflow scrolling is supported
   */
  supportsWebkitOverflowScrolling(): boolean {
    if (typeof window === 'undefined') return false
    const testElement = document.createElement('div')
    return 'webkitOverflowScrolling' in (testElement.style as any)
  },

  /**
   * Get supported optimization features
   */
  getSupportedFeatures() {
    return {
      overscrollBehavior: this.supportsOverscrollBehavior(),
      willChange: this.supportsWillChange(),
      contain: this.supportsContain(),
      webkitOverflowScrolling: this.supportsWebkitOverflowScrolling()
    }
  }
}

/**
 * Browser-specific CSS class names
 */
export const BROWSER_CLASSES = {
  CHROME: {
    SCROLL_OPTIMIZED: 'chrome-scroll-optimized',
    BACKGROUND_COVERAGE: 'chrome-background-coverage',
    OVERSCROLL_CONTAINED: 'chrome-overscroll-contained',
    HARDWARE_ACCELERATED: 'chrome-hardware-accelerated'
  },
  WEBKIT: {
    SCROLL_OPTIMIZED: 'webkit-scroll-optimized',
    BACKGROUND_COVERAGE: 'webkit-background-coverage',
    HARDWARE_ACCELERATED: 'webkit-hardware-accelerated'
  },
  FIREFOX: {
    SCROLL_OPTIMIZED: 'firefox-scroll-optimized'
  },
  FALLBACK: {
    SCROLL_OPTIMIZED: 'fallback-scroll-optimized',
    BACKGROUND_COVERAGE: 'fallback-background-coverage'
  }
} as const

/**
 * Export browser detection functions for backward compatibility
 */
export { isChromeBasedBrowser as isChrome }
export { isWebkitBasedBrowser as isWebkit }