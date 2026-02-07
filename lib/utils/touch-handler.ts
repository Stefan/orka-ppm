/**
 * Cross-Browser Touch Handler
 * Normalizes touch interactions across different mobile browsers
 * Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { detectBrowser, BrowserInfo } from './browser/browser-detection'

export interface TouchOptions {
  /** Prevent default browser behaviors that conflict with app functionality */
  preventDefaultScroll?: boolean
  /** Enable momentum scrolling optimizations */
  enableMomentumScrolling?: boolean
  /** Enable hardware acceleration for touch interactions */
  enableHardwareAcceleration?: boolean
  /** Normalize touch event handling across browsers */
  normalizeTouchEvents?: boolean
  /** Apply browser-specific touch optimizations */
  applyBrowserOptimizations?: boolean
  /** Enable touch feedback (haptic/visual) */
  enableTouchFeedback?: boolean
  /** Viewport scaling behavior */
  preventViewportScaling?: boolean
  /** Touch target minimum size (px) */
  minTouchTargetSize?: number
}

export interface ViewportConfig {
  /** Initial viewport scale */
  initialScale?: number
  /** Minimum viewport scale */
  minimumScale?: number
  /** Maximum viewport scale */
  maximumScale?: number
  /** Allow user scaling */
  userScalable?: boolean
  /** Viewport width */
  width?: string | number
  /** Viewport height */
  height?: string | number
}

export interface TouchEventData {
  type: string
  touches: TouchPoint[]
  changedTouches: TouchPoint[]
  targetTouches: TouchPoint[]
  timestamp: number
  preventDefault: () => void
  stopPropagation: () => void
}

export interface TouchPoint {
  identifier: number
  clientX: number
  clientY: number
  pageX: number
  pageY: number
  screenX: number
  screenY: number
  radiusX?: number
  radiusY?: number
  rotationAngle?: number
  force?: number
}

const defaultTouchOptions: Required<TouchOptions> = {
  preventDefaultScroll: true,
  enableMomentumScrolling: true,
  enableHardwareAcceleration: true,
  normalizeTouchEvents: true,
  applyBrowserOptimizations: true,
  enableTouchFeedback: true,
  preventViewportScaling: false,
  minTouchTargetSize: 44
}

const defaultViewportConfig: Required<ViewportConfig> = {
  initialScale: 1.0,
  minimumScale: 1.0,
  maximumScale: 5.0,
  userScalable: true,
  width: 'device-width',
  height: 'device-height'
}

export class CrossBrowserTouchHandler {
  private element: HTMLElement
  private options: Required<TouchOptions>
  private browser: BrowserInfo
  private touchEventListeners: Map<string, EventListener> = new Map()
  private originalStyles: Map<string, string> = new Map()
  private isInitialized: boolean = false

  constructor(element: HTMLElement, options: TouchOptions = {}) {
    this.element = element
    this.options = { ...defaultTouchOptions, ...options }
    this.browser = detectBrowser()
    
    this.initializeTouchHandling()
  }

  /**
   * Initialize cross-browser touch handling
   * Implements Requirements 6.1, 6.2, 6.4
   */
  private initializeTouchHandling(): void {
    if (this.isInitialized) return

    // Store original styles for cleanup
    this.storeOriginalStyles()

    // Apply browser-specific touch optimizations
    if (this.options.applyBrowserOptimizations) {
      this.applyBrowserSpecificOptimizations()
    }

    // Apply general touch optimizations
    this.applyGeneralTouchOptimizations()

    // Normalize touch events if enabled
    if (this.options.normalizeTouchEvents) {
      this.setupTouchEventNormalization()
    }

    // Apply hardware acceleration if enabled
    if (this.options.enableHardwareAcceleration) {
      this.enableHardwareAcceleration()
    }

    // Ensure minimum touch target size
    this.ensureMinimumTouchTargetSize()

    this.isInitialized = true
  }

  /**
   * Store original element styles for cleanup
   */
  private storeOriginalStyles(): void {
    const computedStyle = window.getComputedStyle(this.element)
    const stylesToStore = [
      'touchAction',
      'webkitTouchCallout',
      'webkitUserSelect',
      'webkitTapHighlightColor',
      'overscrollBehavior',
      'overscrollBehaviorX',
      'overscrollBehaviorY',
      'webkitOverflowScrolling',
      'scrollBehavior',
      'willChange',
      'transform',
      'minWidth',
      'minHeight'
    ]

    stylesToStore.forEach(property => {
      const value = computedStyle.getPropertyValue(property) || 
                   (this.element.style as any)[property] || ''
      this.originalStyles.set(property, value)
    })
  }

  /**
   * Apply browser-specific touch optimizations
   * Implements Requirements 6.1, 6.2
   */
  private applyBrowserSpecificOptimizations(): void {
    switch (this.browser.name) {
      case 'safari':
        this.applySafariTouchFixes()
        break
      case 'firefox':
        this.applyFirefoxTouchFixes()
        break
      case 'chrome':
        this.applyChromeTouchFixes()
        break
      case 'edge':
        this.applyEdgeTouchFixes()
        break
      default:
        this.applyGenericTouchFixes()
    }
  }

  /**
   * Apply Safari-specific touch optimizations
   * Implements Requirements 6.1, 6.2
   */
  private applySafariTouchFixes(): void {
    const style = this.element.style as any

    // iOS Safari momentum scrolling
    if (this.options.enableMomentumScrolling) {
      style.webkitOverflowScrolling = 'touch'
    }

    // Prevent callout menu on long press
    style.webkitTouchCallout = 'none'

    // Prevent text selection during touch
    style.webkitUserSelect = 'none'

    // Remove tap highlight
    style.webkitTapHighlightColor = 'transparent'

    // Hardware acceleration for smooth touch interactions
    if (this.options.enableHardwareAcceleration) {
      style.webkitTransform = 'translateZ(0)'
      style.webkitBackfaceVisibility = 'hidden'
    }

    // Prevent zoom on double tap for form elements
    if (this.element.tagName.toLowerCase() === 'input' || 
        this.element.tagName.toLowerCase() === 'textarea') {
      style.fontSize = Math.max(16, parseInt(style.fontSize) || 16) + 'px'
    }
  }

  /**
   * Apply Firefox-specific touch optimizations
   * Implements Requirements 6.1, 6.2
   */
  private applyFirefoxTouchFixes(): void {
    const style = this.element.style as any

    // Firefox touch action optimization
    if (this.options.preventDefaultScroll) {
      style.touchAction = 'pan-y'
    }

    // Prevent text selection
    style.mozUserSelect = 'none'

    // Overscroll behavior
    style.overscrollBehavior = 'contain'
    style.overscrollBehaviorY = 'contain'

    // Smooth scrolling
    if (this.options.enableMomentumScrolling) {
      style.scrollBehavior = 'smooth'
    }

    // Hardware acceleration
    if (this.options.enableHardwareAcceleration) {
      style.transform = 'translateZ(0)'
      style.willChange = 'scroll-position, transform'
    }
  }

  /**
   * Apply Chrome-specific touch optimizations
   * Implements Requirements 6.1, 6.2
   */
  private applyChromeTouchFixes(): void {
    const style = this.element.style as any

    // Chrome overscroll behavior
    style.overscrollBehavior = 'contain'
    style.overscrollBehaviorY = 'contain'

    // Touch action for scroll optimization
    if (this.options.preventDefaultScroll) {
      style.touchAction = 'pan-y'
    }

    // Performance optimizations
    if (this.options.enableHardwareAcceleration) {
      style.willChange = 'scroll-position, transform'
      style.transform = 'translateZ(0)'
    }

    // Remove tap highlight
    style.webkitTapHighlightColor = 'transparent'
  }

  /**
   * Apply Edge-specific touch optimizations
   * Implements Requirements 6.1, 6.2
   */
  private applyEdgeTouchFixes(): void {
    const style = this.element.style as any

    // Edge/IE touch action
    if (this.options.preventDefaultScroll) {
      style.msTouchAction = 'pan-y'
      style.touchAction = 'pan-y'
    }

    // Overscroll behavior
    style.msOverscrollBehavior = 'contain'
    style.overscrollBehavior = 'contain'

    // Scrollbar styling
    style.msOverflowStyle = '-ms-autohiding-scrollbar'

    // Hardware acceleration
    if (this.options.enableHardwareAcceleration) {
      style.transform = 'translateZ(0)'
    }
  }

  /**
   * Apply generic touch optimizations for unknown browsers
   * Implements Requirements 6.1, 6.2
   */
  private applyGenericTouchFixes(): void {
    const style = this.element.style

    // Standard touch action
    if (this.options.preventDefaultScroll) {
      style.touchAction = 'pan-y'
    }

    // Standard overscroll behavior
    style.overscrollBehavior = 'contain'

    // Basic hardware acceleration
    if (this.options.enableHardwareAcceleration) {
      style.transform = 'translateZ(0)'
    }

    // Prevent text selection
    style.userSelect = 'none'
  }

  /**
   * Apply general touch optimizations that work across all browsers
   * Implements Requirements 6.2, 6.4
   */
  private applyGeneralTouchOptimizations(): void {
    const style = this.element.style

    // Consistent box-sizing
    style.boxSizing = 'border-box'

    // Apply touch action for scroll prevention regardless of browser optimizations
    if (this.options.preventDefaultScroll) {
      style.touchAction = 'pan-y'
    }

    // Prevent text selection during touch interactions
    const anyStyle = style as any
    style.userSelect = 'none'
    anyStyle.webkitUserSelect = 'none'
    anyStyle.mozUserSelect = 'none'
    anyStyle.msUserSelect = 'none'

    // Optimize for touch interactions
    style.cursor = 'pointer'

    // Ensure element is positioned for transform optimizations
    if (style.position === '' || style.position === 'static') {
      style.position = 'relative'
    }
  }

  /**
   * Enable hardware acceleration for smooth touch interactions
   * Implements Requirements 6.2, 6.4
   */
  private enableHardwareAcceleration(): void {
    const style = this.element.style
    const anyStyle = style as any

    // Cross-browser hardware acceleration
    style.transform = style.transform || 'translateZ(0)'
    anyStyle.webkitTransform = anyStyle.webkitTransform || 'translateZ(0)'
    anyStyle.mozTransform = anyStyle.mozTransform || 'translateZ(0)'
    anyStyle.msTransform = anyStyle.msTransform || 'translateZ(0)'

    // Will-change for performance optimization
    style.willChange = 'transform'
    anyStyle.webkitWillChange = 'transform'

    // Backface visibility for smoother animations
    anyStyle.webkitBackfaceVisibility = 'hidden'
    style.backfaceVisibility = 'hidden'

    // Contain for better performance
    style.contain = 'layout style paint'
  }

  /**
   * Ensure minimum touch target size for accessibility
   * Implements Requirements 6.4
   */
  private ensureMinimumTouchTargetSize(): void {
    const style = this.element.style
    const computedStyle = window.getComputedStyle(this.element)
    
    const currentWidth = parseInt(computedStyle.width) || 0
    const currentHeight = parseInt(computedStyle.height) || 0

    // Ensure minimum touch target size
    if (currentWidth < this.options.minTouchTargetSize) {
      style.minWidth = `${this.options.minTouchTargetSize}px`
    }

    if (currentHeight < this.options.minTouchTargetSize) {
      style.minHeight = `${this.options.minTouchTargetSize}px`
    }

    // Add padding if element is too small
    const currentPadding = parseInt(computedStyle.padding) || 0
    if (currentWidth + currentPadding * 2 < this.options.minTouchTargetSize ||
        currentHeight + currentPadding * 2 < this.options.minTouchTargetSize) {
      const additionalPadding = Math.max(0, 
        (this.options.minTouchTargetSize - Math.max(currentWidth, currentHeight)) / 2
      )
      style.padding = `${currentPadding + additionalPadding}px`
    }
  }

  /**
   * Set up touch event normalization across browsers
   * Implements Requirements 6.1, 6.2
   */
  private setupTouchEventNormalization(): void {
    const normalizedTouchStart = this.createNormalizedTouchHandler('touchstart')
    const normalizedTouchMove = this.createNormalizedTouchHandler('touchmove')
    const normalizedTouchEnd = this.createNormalizedTouchHandler('touchend')
    const normalizedTouchCancel = this.createNormalizedTouchHandler('touchcancel')

    this.touchEventListeners.set('touchstart', normalizedTouchStart)
    this.touchEventListeners.set('touchmove', normalizedTouchMove)
    this.touchEventListeners.set('touchend', normalizedTouchEnd)
    this.touchEventListeners.set('touchcancel', normalizedTouchCancel)

    // Add event listeners with appropriate options
    this.element.addEventListener('touchstart', normalizedTouchStart, { 
      passive: !this.options.preventDefaultScroll 
    })
    this.element.addEventListener('touchmove', normalizedTouchMove, { 
      passive: !this.options.preventDefaultScroll 
    })
    this.element.addEventListener('touchend', normalizedTouchEnd, { 
      passive: true 
    })
    this.element.addEventListener('touchcancel', normalizedTouchCancel, { 
      passive: true 
    })
  }

  /**
   * Create normalized touch event handler
   * Implements Requirements 6.1, 6.2
   */
  private createNormalizedTouchHandler(eventType: string): EventListener {
    return (event: Event) => {
      const touchEvent = event as TouchEvent

      // Prevent default behavior if configured
      if (this.options.preventDefaultScroll && 
          (eventType === 'touchstart' || eventType === 'touchmove')) {
        touchEvent.preventDefault()
      }

      // Create normalized touch event data
      const normalizedEvent: TouchEventData = {
        type: eventType,
        touches: this.normalizeTouchList(touchEvent.touches),
        changedTouches: this.normalizeTouchList(touchEvent.changedTouches),
        targetTouches: this.normalizeTouchList(touchEvent.targetTouches),
        timestamp: Date.now(),
        preventDefault: () => touchEvent.preventDefault(),
        stopPropagation: () => touchEvent.stopPropagation()
      }

      // Dispatch normalized event
      const customEvent = new CustomEvent(`normalized${eventType}`, {
        detail: normalizedEvent,
        bubbles: true,
        cancelable: true
      })

      this.element.dispatchEvent(customEvent)
    }
  }

  /**
   * Normalize TouchList to consistent TouchPoint array
   * Implements Requirements 6.1
   */
  private normalizeTouchList(touchList: TouchList): TouchPoint[] {
    // Handle JSDOM limitations where TouchList might be undefined or not iterable
    if (!touchList || typeof touchList[Symbol.iterator] !== 'function') {
      return []
    }
    
    try {
      return Array.from(touchList).map(touch => ({
        identifier: touch.identifier,
        clientX: touch.clientX,
        clientY: touch.clientY,
        pageX: touch.pageX,
        pageY: touch.pageY,
        screenX: touch.screenX,
        screenY: touch.screenY,
        radiusX: touch.radiusX || 0,
        radiusY: touch.radiusY || 0,
        rotationAngle: touch.rotationAngle || 0,
        force: touch.force || 1.0
      }))
    } catch (error) {
      // Fallback for environments where TouchList is not properly implemented
      return []
    }
  }

  /**
   * Configure viewport for consistent mobile behavior
   * Implements Requirements 6.3
   */
  public static configureViewport(config: ViewportConfig = {}): void {
    const viewportConfig = { ...defaultViewportConfig, ...config }
    
    // Find or create viewport meta tag
    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta')
      viewportMeta.name = 'viewport'
      document.head.appendChild(viewportMeta)
    }

    // Build viewport content string
    const contentParts: string[] = []
    
    if (viewportConfig.width) {
      contentParts.push(`width=${viewportConfig.width}`)
    }
    if (viewportConfig.height) {
      contentParts.push(`height=${viewportConfig.height}`)
    }
    if (viewportConfig.initialScale) {
      contentParts.push(`initial-scale=${viewportConfig.initialScale}`)
    }
    if (viewportConfig.minimumScale) {
      contentParts.push(`minimum-scale=${viewportConfig.minimumScale}`)
    }
    if (viewportConfig.maximumScale) {
      contentParts.push(`maximum-scale=${viewportConfig.maximumScale}`)
    }
    if (viewportConfig.userScalable !== undefined) {
      contentParts.push(`user-scalable=${viewportConfig.userScalable ? 'yes' : 'no'}`)
    }

    viewportMeta.content = contentParts.join(', ')

    // Apply additional mobile viewport fixes
    CrossBrowserTouchHandler.applyMobileViewportFixes()
  }

  /**
   * Apply mobile viewport fixes for consistent scaling behavior
   * Implements Requirements 6.3
   */
  public static applyMobileViewportFixes(): void {
    // Prevent zoom on input focus (iOS Safari)
    const inputs = document.querySelectorAll('input, textarea, select')
    inputs.forEach(input => {
      const element = input as HTMLElement
      const currentFontSize = parseInt(window.getComputedStyle(element).fontSize) || 16
      if (currentFontSize < 16) {
        element.style.fontSize = '16px'
      }
    })

    // Prevent horizontal scroll
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'

    // Apply consistent box-sizing
    document.documentElement.style.boxSizing = 'border-box'
    document.body.style.boxSizing = 'border-box'

    // Prevent bounce scrolling on iOS
    document.body.style.overscrollBehavior = 'contain'
    ;(document.body.style as any).webkitOverscrollBehavior = 'contain'
  }

  /**
   * Get touch-optimized CSS classes for the current browser
   * Implements Requirements 6.1, 6.2
   */
  public getTouchOptimizedClasses(): string {
    const classes = ['touch-optimized']
    
    // Add browser-specific classes
    switch (this.browser.name) {
      case 'safari':
        classes.push('touch-safari', 'ios-momentum-scroll')
        break
      case 'firefox':
        classes.push('touch-firefox', 'firefox-touch-action')
        break
      case 'chrome':
        classes.push('touch-chrome', 'chrome-overscroll')
        break
      case 'edge':
        classes.push('touch-edge', 'edge-touch-action')
        break
    }

    // Add mobile-specific classes
    if (this.browser.isMobile) {
      classes.push('touch-mobile', 'mobile-optimized')
    }

    return classes.join(' ')
  }

  /**
   * Update touch options dynamically
   * Implements Requirements 6.1, 6.2, 6.4
   */
  public updateOptions(newOptions: Partial<TouchOptions>): void {
    this.options = { ...this.options, ...newOptions }
    
    // Re-apply optimizations with new options
    if (this.isInitialized) {
      this.cleanup()
      this.initializeTouchHandling()
    }
  }

  /**
   * Clean up touch handler and restore original styles
   */
  public cleanup(): void {
    // Remove event listeners
    this.touchEventListeners.forEach((listener, eventType) => {
      this.element.removeEventListener(eventType, listener)
    })
    this.touchEventListeners.clear()

    // Restore original styles
    this.originalStyles.forEach((value, property) => {
      if (value) {
        (this.element.style as any)[property] = value
      } else {
        (this.element.style as any)[property] = ''
      }
    })

    this.isInitialized = false
  }

  /**
   * Check if touch is supported
   */
  public static isTouchSupported(): boolean {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           (navigator as any).msMaxTouchPoints > 0
  }

  /**
   * Get browser-specific touch capabilities
   */
  public getTouchCapabilities(): {
    maxTouchPoints: number
    supportsForce: boolean
    supportsRadius: boolean
    supportsRotation: boolean
  } {
    // Check if TouchEvent exists before accessing prototype
    const hasTouchEvent = typeof TouchEvent !== 'undefined'
    
    return {
      maxTouchPoints: navigator.maxTouchPoints || (navigator as any).msMaxTouchPoints || 1,
      supportsForce: hasTouchEvent && 'force' in TouchEvent.prototype,
      supportsRadius: hasTouchEvent && 'radiusX' in TouchEvent.prototype,
      supportsRotation: hasTouchEvent && 'rotationAngle' in TouchEvent.prototype
    }
  }
}

export default CrossBrowserTouchHandler