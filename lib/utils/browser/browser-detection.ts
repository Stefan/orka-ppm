/**
 * Browser Detection and Feature Detection Utility
 * Cross-browser compatibility helper for applying browser-specific optimizations
 */

export interface BrowserInfo {
  name: 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown'
  version: number
  isMobile: boolean
  supportsFeature: (feature: string) => boolean
}

/**
 * Detect the current browser and return browser information
 */
export function detectBrowser(): BrowserInfo {
  // Server-side rendering safety
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      name: 'unknown',
      version: 0,
      isMobile: false,
      supportsFeature: () => false
    }
  }

  const userAgent = navigator.userAgent
  const vendor = navigator.vendor || ''
  
  let name: BrowserInfo['name'] = 'unknown'
  let version = 0
  
  // Chrome detection (including Chromium-based browsers)
  if (/Chrome/.test(userAgent) && /Google Inc/.test(vendor)) {
    name = 'chrome'
    version = parseInt(userAgent.match(/Chrome\/(\d+)/)?.[1] || '0')
  }
  // Firefox detection
  else if (/Firefox/.test(userAgent)) {
    name = 'firefox'
    version = parseInt(userAgent.match(/Firefox\/(\d+)/)?.[1] || '0')
  }
  // Safari detection
  else if (/Safari/.test(userAgent) && /Apple Computer/.test(vendor)) {
    name = 'safari'
    version = parseInt(userAgent.match(/Version\/(\d+)/)?.[1] || '0')
  }
  // Edge detection
  else if (/Edg/.test(userAgent)) {
    name = 'edge'
    version = parseInt(userAgent.match(/Edg\/(\d+)/)?.[1] || '0')
  }
  
  const isMobile = /Mobi|Android/i.test(userAgent)
  
  return {
    name,
    version,
    isMobile,
    supportsFeature: (feature: string) => checkFeatureSupport(feature)
  }
}

/**
 * Check if a specific feature is supported by the current browser
 */
function checkFeatureSupport(feature: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  switch (feature) {
    case 'intersectionObserver':
      return 'IntersectionObserver' in window
    case 'fetch':
      return 'fetch' in window
    case 'flexbox':
      return CSS.supports('display', 'flex')
    case 'grid':
      return CSS.supports('display', 'grid')
    case 'customProperties':
      return CSS.supports('--custom', 'property')
    case 'overscrollBehavior':
      return CSS.supports('overscroll-behavior', 'contain')
    case 'touchAction':
      return CSS.supports('touch-action', 'pan-y')
    case 'scrollBehavior':
      return CSS.supports('scroll-behavior', 'smooth')
    case 'contain':
      return CSS.supports('contain', 'layout')
    case 'willChange':
      return CSS.supports('will-change', 'transform')
    default:
      return false
  }
}

/**
 * Get browser-specific CSS classes for sidebar optimization
 */
export function getSidebarClasses(isMobile: boolean = false): string {
  const browser = detectBrowser()
  const baseClasses = ['sidebar-cross-browser', 'sidebar-layout-stable']
  
  // Add browser-specific classes
  switch (browser.name) {
    case 'firefox':
      baseClasses.push('sidebar-firefox-fix', 'firefox-sidebar-scroll-performance')
      if (isMobile) {
        baseClasses.push('firefox-mobile-sidebar-fix')
      } else {
        baseClasses.push('firefox-desktop-sidebar-fix')
      }
      break
    case 'safari':
      baseClasses.push('sidebar-safari-fix')
      break
    case 'edge':
      baseClasses.push('sidebar-edge-fix')
      break
    case 'chrome':
    default:
      // Chrome classes are already applied in the component
      break
  }
  
  return baseClasses.join(' ')
}

/**
 * Get touch-optimized classes for cross-browser compatibility
 */
export function getTouchOptimizedClasses(): string {
  const browser = detectBrowser()
  const touchClasses = ['touch-action-pan-y']
  
  // Add browser-specific touch optimizations
  switch (browser.name) {
    case 'firefox':
      touchClasses.push('firefox-touch-optimized')
      break
    case 'safari':
      touchClasses.push('safari-touch-optimized')
      break
    case 'chrome':
      touchClasses.push('chrome-touch-optimized')
      break
    case 'edge':
      touchClasses.push('edge-touch-optimized')
      break
  }
  
  return touchClasses.join(' ')
}

/**
 * Apply browser-specific inline styles for sidebar
 */
export function getSidebarStyles(): React.CSSProperties {
  const browser = detectBrowser()
  
  const baseStyles: React.CSSProperties = {
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    overscrollBehaviorY: 'contain',
    willChange: 'scroll-position, transform',
    contain: 'layout style paint',
    touchAction: 'pan-y',
    WebkitBoxSizing: 'border-box',
    boxSizing: 'border-box'
  }
  
  // Add browser-specific styles
  switch (browser.name) {
    case 'firefox':
      return {
        ...baseStyles,
        MozUserSelect: 'none',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent',
        overscrollBehavior: 'contain',
        overscrollBehaviorY: 'contain'
      } as React.CSSProperties
    case 'safari':
      return {
        ...baseStyles,
        WebkitBackfaceVisibility: 'hidden',
        WebkitTouchCallout: 'none'
      } as React.CSSProperties
    case 'edge':
      return {
        ...baseStyles,
        msOverflowStyle: '-ms-autohiding-scrollbar',
        touchAction: 'pan-y',
        overscrollBehavior: 'contain'
      } as React.CSSProperties
    default:
      return baseStyles
  }
}

/**
 * Log browser information for debugging
 */
export function logBrowserInfo(): void {
  if (typeof console !== 'undefined' && process.env.NODE_ENV === 'development') {
    const browser = detectBrowser()
    console.log('🌐 Browser Detection:', {
      name: browser.name,
      version: browser.version,
      isMobile: browser.isMobile,
      userAgent: navigator.userAgent,
      features: {
        overscrollBehavior: browser.supportsFeature('overscrollBehavior'),
        touchAction: browser.supportsFeature('touchAction'),
        scrollBehavior: browser.supportsFeature('scrollBehavior'),
        contain: browser.supportsFeature('contain'),
        willChange: browser.supportsFeature('willChange')
      }
    })
  }
}