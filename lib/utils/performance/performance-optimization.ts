/**
 * Performance Optimization Utilities
 * Cross-browser performance optimizations for animations, transforms, and scroll
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { detectBrowser } from '../browser/browser-detection'

/**
 * Hardware acceleration configuration
 */
export interface HardwareAccelerationConfig {
  enableTransform3d: boolean
  enableWillChange: boolean
  enableContain: boolean
  enableBackfaceVisibility: boolean
}

/**
 * Scroll performance configuration
 */
export interface ScrollPerformanceConfig {
  enableSmoothScroll: boolean
  enableOverscrollBehavior: boolean
  enableTouchAction: boolean
  enableMomentumScrolling: boolean
}

/**
 * Will-change property manager
 */
export class WillChangeManager {
  private elements: Map<HTMLElement, Set<string>> = new Map()
  private cleanupTimeouts: Map<HTMLElement, NodeJS.Timeout> = new Map()
  private readonly CLEANUP_DELAY = 1000 // ms

  /**
   * Add will-change property to an element
   */
  add(element: HTMLElement, properties: string | string[]): void {
    const props = Array.isArray(properties) ? properties : [properties]
    
    if (!this.elements.has(element)) {
      this.elements.set(element, new Set())
    }

    const elementProps = this.elements.get(element)!
    props.forEach(prop => elementProps.add(prop))

    // Apply will-change
    this.applyWillChange(element, Array.from(elementProps))

    // Clear any existing cleanup timeout
    if (this.cleanupTimeouts.has(element)) {
      clearTimeout(this.cleanupTimeouts.get(element)!)
    }
  }

  /**
   * Remove will-change property from an element after a delay
   */
  remove(element: HTMLElement, properties?: string | string[]): void {
    if (!this.elements.has(element)) return

    const elementProps = this.elements.get(element)!

    if (properties) {
      const props = Array.isArray(properties) ? properties : [properties]
      props.forEach(prop => elementProps.delete(prop))
    } else {
      elementProps.clear()
    }

    // Schedule cleanup
    const timeout = setTimeout(() => {
      if (elementProps.size === 0) {
        element.style.willChange = 'auto'
        this.elements.delete(element)
        this.cleanupTimeouts.delete(element)
      } else {
        this.applyWillChange(element, Array.from(elementProps))
      }
    }, this.CLEANUP_DELAY)

    this.cleanupTimeouts.set(element, timeout)
  }

  /**
   * Apply will-change with vendor prefixes
   */
  private applyWillChange(element: HTMLElement, properties: string[]): void {
    const willChangeValue = properties.join(', ')
    element.style.willChange = willChangeValue
    
    // Add vendor prefix for Safari
    ;(element.style as any).webkitWillChange = willChangeValue
  }

  /**
   * Clear all will-change properties
   */
  clear(): void {
    this.cleanupTimeouts.forEach(timeout => clearTimeout(timeout))
    this.elements.forEach((_, element) => {
      element.style.willChange = 'auto'
    })
    this.elements.clear()
    this.cleanupTimeouts.clear()
  }
}

/**
 * Apply hardware acceleration to an element
 */
export function applyHardwareAcceleration(
  element: HTMLElement,
  config: Partial<HardwareAccelerationConfig> = {}
): void {
  const defaultConfig: HardwareAccelerationConfig = {
    enableTransform3d: true,
    enableWillChange: true,
    enableContain: true,
    enableBackfaceVisibility: true
  }

  const finalConfig = { ...defaultConfig, ...config }

  // Apply transform for hardware acceleration
  if (finalConfig.enableTransform3d) {
    element.style.transform = 'translateZ(0)'
    ;(element.style as any).webkitTransform = 'translateZ(0)'
    ;(element.style as any).mozTransform = 'translateZ(0)'
    ;(element.style as any).msTransform = 'translateZ(0)'
  }

  // Apply will-change for optimization hint
  if (finalConfig.enableWillChange) {
    element.style.willChange = 'transform'
    ;(element.style as any).webkitWillChange = 'transform'
  }

  // Apply contain for layout optimization
  if (finalConfig.enableContain) {
    element.style.contain = 'layout style paint'
  }

  // Apply backface-visibility for better performance
  if (finalConfig.enableBackfaceVisibility) {
    element.style.backfaceVisibility = 'hidden'
    ;(element.style as any).webkitBackfaceVisibility = 'hidden'
  }
}

/**
 * Remove hardware acceleration from an element
 */
export function removeHardwareAcceleration(element: HTMLElement): void {
  element.style.transform = ''
  ;(element.style as any).webkitTransform = ''
  ;(element.style as any).mozTransform = ''
  ;(element.style as any).msTransform = ''
  element.style.willChange = 'auto'
  ;(element.style as any).webkitWillChange = 'auto'
  element.style.contain = ''
  element.style.backfaceVisibility = ''
  ;(element.style as any).webkitBackfaceVisibility = ''
}

/**
 * Apply browser-specific scroll performance optimizations
 */
export function applyScrollPerformanceOptimization(
  element: HTMLElement,
  config: Partial<ScrollPerformanceConfig> = {}
): void {
  const browser = detectBrowser()
  
  const defaultConfig: ScrollPerformanceConfig = {
    enableSmoothScroll: true,
    enableOverscrollBehavior: true,
    enableTouchAction: true,
    enableMomentumScrolling: true
  }

  const finalConfig = { ...defaultConfig, ...config }

  // Base scroll optimizations
  element.style.willChange = 'scroll-position'
  ;(element.style as any).webkitWillChange = 'scroll-position'
  element.style.transform = 'translateZ(0)'
  ;(element.style as any).webkitTransform = 'translateZ(0)'
  ;(element.style as any).mozTransform = 'translateZ(0)'

  // Smooth scroll
  if (finalConfig.enableSmoothScroll) {
    element.style.scrollBehavior = 'smooth'
    ;(element.style as any).webkitScrollBehavior = 'smooth'
    ;(element.style as any).mozScrollBehavior = 'smooth'
  }

  // Overscroll behavior
  if (finalConfig.enableOverscrollBehavior) {
    element.style.overscrollBehavior = 'contain'
    element.style.overscrollBehaviorY = 'contain'
    ;(element.style as any).webkitOverscrollBehavior = 'contain'
    ;(element.style as any).mozOverscrollBehavior = 'contain'
  }

  // Touch action
  if (finalConfig.enableTouchAction) {
    element.style.touchAction = 'pan-y'
    ;(element.style as any).msTouchAction = 'pan-y'
  }

  // Apply browser-specific optimizations
  switch (browser.name) {
    case 'firefox':
      applyFirefoxScrollOptimizations(element, finalConfig)
      break
    case 'safari':
      applySafariScrollOptimizations(element, finalConfig)
      break
    case 'chrome':
      applyChromeScrollOptimizations(element, finalConfig)
      break
    case 'edge':
      applyEdgeScrollOptimizations(element, finalConfig)
      break
  }
}

/**
 * Apply Firefox-specific scroll optimizations
 */
function applyFirefoxScrollOptimizations(
  element: HTMLElement,
  config: ScrollPerformanceConfig
): void {
  // Firefox scrollbar styling
  element.style.scrollbarWidth = 'thin'
  element.style.scrollbarColor = 'rgba(155, 155, 155, 0.5) transparent'
  
  // Firefox user select
  ;(element.style as any).mozUserSelect = 'none'
  
  // Firefox overscroll behavior
  if (config.enableOverscrollBehavior) {
    ;(element.style as any).mozOverscrollBehavior = 'contain'
  }
}

/**
 * Apply Safari-specific scroll optimizations
 */
function applySafariScrollOptimizations(
  element: HTMLElement,
  config: ScrollPerformanceConfig
): void {
  // Safari momentum scrolling
  if (config.enableMomentumScrolling) {
    ;(element.style as any).webkitOverflowScrolling = 'touch'
  }
  
  // Safari backface visibility
  ;(element.style as any).webkitBackfaceVisibility = 'hidden'
  
  // Safari touch callout
  ;(element.style as any).webkitTouchCallout = 'none'
}

/**
 * Apply Chrome-specific scroll optimizations
 */
function applyChromeScrollOptimizations(
  element: HTMLElement,
  config: ScrollPerformanceConfig
): void {
  // Chrome contain property for better performance
  element.style.contain = 'layout style paint'
  
  // Chrome overscroll behavior
  if (config.enableOverscrollBehavior) {
    element.style.overscrollBehavior = 'contain'
    element.style.overscrollBehaviorY = 'contain'
  }
}

/**
 * Apply Edge-specific scroll optimizations
 */
function applyEdgeScrollOptimizations(
  element: HTMLElement,
  config: ScrollPerformanceConfig
): void {
  // Edge scrollbar styling
  ;(element.style as any).msOverflowStyle = '-ms-autohiding-scrollbar'
  
  // Edge touch action
  if (config.enableTouchAction) {
    ;(element.style as any).msTouchAction = 'pan-y'
  }
  
  // Edge overscroll behavior
  if (config.enableOverscrollBehavior) {
    element.style.overscrollBehavior = 'contain'
  }
}

/**
 * Remove scroll performance optimizations
 */
export function removeScrollPerformanceOptimization(element: HTMLElement): void {
  element.style.willChange = 'auto'
  ;(element.style as any).webkitWillChange = 'auto'
  element.style.transform = ''
  ;(element.style as any).webkitTransform = ''
  ;(element.style as any).mozTransform = ''
  element.style.scrollBehavior = ''
  ;(element.style as any).webkitScrollBehavior = ''
  ;(element.style as any).mozScrollBehavior = ''
  element.style.overscrollBehavior = ''
  element.style.overscrollBehaviorY = ''
  ;(element.style as any).webkitOverscrollBehavior = ''
  ;(element.style as any).mozOverscrollBehavior = ''
  element.style.touchAction = ''
  ;(element.style as any).msTouchAction = ''
  element.style.contain = ''
  element.style.scrollbarWidth = ''
  element.style.scrollbarColor = ''
  ;(element.style as any).mozUserSelect = ''
  ;(element.style as any).webkitOverflowScrolling = ''
  ;(element.style as any).webkitBackfaceVisibility = ''
  ;(element.style as any).webkitTouchCallout = ''
  ;(element.style as any).msOverflowStyle = ''
}

/**
 * Get hardware acceleration CSS classes
 */
export function getHardwareAccelerationClasses(): string {
  return 'hw-accelerate transform-gpu'
}

/**
 * Get scroll performance CSS classes based on browser
 */
export function getScrollPerformanceClasses(): string {
  const browser = detectBrowser()
  const baseClasses = ['scroll-optimized']
  
  switch (browser.name) {
    case 'firefox':
      baseClasses.push('firefox-scroll-optimized')
      break
    case 'safari':
      baseClasses.push('safari-scroll-optimized')
      break
    case 'chrome':
      baseClasses.push('chrome-scroll-optimized')
      break
    case 'edge':
      baseClasses.push('edge-scroll-optimized')
      break
  }
  
  return baseClasses.join(' ')
}

/**
 * Apply animation performance optimization
 */
export function applyAnimationPerformanceOptimization(element: HTMLElement): void {
  // Use transform and opacity for best performance
  element.style.willChange = 'transform, opacity'
  ;(element.style as any).webkitWillChange = 'transform, opacity'
  
  // Hardware acceleration
  element.style.transform = 'translateZ(0)'
  ;(element.style as any).webkitTransform = 'translateZ(0)'
  ;(element.style as any).mozTransform = 'translateZ(0)'
  
  // Backface visibility
  element.style.backfaceVisibility = 'hidden'
  ;(element.style as any).webkitBackfaceVisibility = 'hidden'
}

/**
 * Create a performance-optimized element wrapper
 */
export function createOptimizedElement(
  tagName: string,
  options: {
    hardwareAcceleration?: boolean
    scrollOptimization?: boolean
    animationOptimization?: boolean
  } = {}
): HTMLElement {
  const element = document.createElement(tagName)
  
  if (options.hardwareAcceleration) {
    applyHardwareAcceleration(element)
  }
  
  if (options.scrollOptimization) {
    applyScrollPerformanceOptimization(element)
  }
  
  if (options.animationOptimization) {
    applyAnimationPerformanceOptimization(element)
  }
  
  return element
}

/**
 * Global will-change manager instance
 */
export const willChangeManager = new WillChangeManager()

/**
 * Cleanup function for performance optimizations
 */
export function cleanupPerformanceOptimizations(): void {
  willChangeManager.clear()
}
