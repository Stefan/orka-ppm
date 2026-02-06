/**
 * Progressive Enhancement Utility
 * Provides feature detection, fallbacks, and graceful degradation for cross-browser compatibility
 */

import { detectBrowser } from './browser-detection'

export interface FeatureSupport {
  css: {
    grid: boolean
    flexbox: boolean
    customProperties: boolean
    transforms: boolean
    transitions: boolean
    animations: boolean
    backdropFilter: boolean
    clipPath: boolean
    objectFit: boolean
  }
  js: {
    intersectionObserver: boolean
    resizeObserver: boolean
    mutationObserver: boolean
    fetch: boolean
    promises: boolean
    asyncAwait: boolean
    modules: boolean
    webWorkers: boolean
  }
}

/**
 * Detect all feature support for the current browser
 */
export function detectFeatureSupport(): FeatureSupport {
  if (typeof window === 'undefined') {
    // Server-side rendering - assume modern features
    return getDefaultFeatureSupport()
  }

  return {
    css: {
      grid: checkCSSSupport('display', 'grid'),
      flexbox: checkCSSSupport('display', 'flex'),
      customProperties: checkCSSSupport('--custom', 'property'),
      transforms: checkCSSSupport('transform', 'translateX(0)'),
      transitions: checkCSSSupport('transition', 'all 0.3s'),
      animations: checkCSSSupport('animation', 'none'),
      backdropFilter: checkCSSSupport('backdrop-filter', 'blur(10px)'),
      clipPath: checkCSSSupport('clip-path', 'circle(50%)'),
      objectFit: checkCSSSupport('object-fit', 'cover')
    },
    js: {
      intersectionObserver: 'IntersectionObserver' in window,
      resizeObserver: 'ResizeObserver' in window,
      mutationObserver: 'MutationObserver' in window,
      fetch: 'fetch' in window,
      promises: 'Promise' in window,
      asyncAwait: checkAsyncAwaitSupport(),
      modules: 'noModule' in document.createElement('script'),
      webWorkers: 'Worker' in window
    }
  }
}

/**
 * Check if a CSS property/value pair is supported
 */
function checkCSSSupport(property: string, value: string): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return false
  }
  return CSS.supports(property, value)
}

/**
 * Check if async/await is supported (without eval)
 */
function checkAsyncAwaitSupport(): boolean {
  try {
    return typeof Promise !== 'undefined' && typeof (async () => {}) === 'function'
  } catch {
    return false
  }
}

/**
 * Get default feature support (for SSR)
 */
function getDefaultFeatureSupport(): FeatureSupport {
  return {
    css: {
      grid: true,
      flexbox: true,
      customProperties: true,
      transforms: true,
      transitions: true,
      animations: true,
      backdropFilter: true,
      clipPath: true,
      objectFit: true
    },
    js: {
      intersectionObserver: true,
      resizeObserver: true,
      mutationObserver: true,
      fetch: true,
      promises: true,
      asyncAwait: true,
      modules: true,
      webWorkers: true
    }
  }
}

/**
 * Get CSS classes for progressive enhancement
 */
export function getProgressiveEnhancementClasses(): string {
  const features = detectFeatureSupport()
  const classes: string[] = []

  // Add feature support classes
  if (features.css.grid) {
    classes.push('supports-grid')
  } else {
    classes.push('no-grid', 'fallback-flexbox')
  }

  if (features.css.flexbox) {
    classes.push('supports-flexbox')
  } else {
    classes.push('no-flexbox', 'fallback-float')
  }

  if (features.css.customProperties) {
    classes.push('supports-css-vars')
  } else {
    classes.push('no-css-vars')
  }

  if (features.css.transforms) {
    classes.push('supports-transforms')
  } else {
    classes.push('no-transforms')
  }

  if (features.css.animations) {
    classes.push('supports-animations')
  } else {
    classes.push('no-animations', 'static-fallback')
  }

  return classes.join(' ')
}

/**
 * Apply progressive enhancement classes to document
 */
export function applyProgressiveEnhancementClasses(): void {
  if (typeof document === 'undefined') return

  const classes = getProgressiveEnhancementClasses()
  const classArray = classes.split(' ')
  
  classArray.forEach(className => {
    document.documentElement.classList.add(className)
  })
}

/**
 * Get layout fallback strategy based on feature support
 */
export function getLayoutFallback(preferredLayout: 'grid' | 'flexbox'): 'grid' | 'flexbox' | 'float' {
  const features = detectFeatureSupport()

  if (preferredLayout === 'grid') {
    if (features.css.grid) return 'grid'
    if (features.css.flexbox) return 'flexbox'
    return 'float'
  }

  if (preferredLayout === 'flexbox') {
    if (features.css.flexbox) return 'flexbox'
    return 'float'
  }

  return 'float'
}

/**
 * Get animation fallback strategy
 */
export function getAnimationFallback(animationType: 'css' | 'js'): 'css' | 'js' | 'static' {
  const features = detectFeatureSupport()

  if (animationType === 'css') {
    if (features.css.animations && features.css.transitions) return 'css'
    return 'static'
  }

  if (animationType === 'js') {
    if (features.js.promises) return 'js'
    return 'static'
  }

  return 'static'
}

/**
 * Load polyfills for unsupported features
 */
export async function loadPolyfills(): Promise<void> {
  // Modern browsers (Chrome 80+, Firefox 78+, Safari 13+, Edge 80+) support all these features
  // Polyfills are no longer needed for our target browsers
  const features = detectFeatureSupport()
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Feature support check:', {
      intersectionObserver: features.js.intersectionObserver,
      fetch: features.js.fetch,
      promises: features.js.promises
    })
  }
  
  // All modern browsers support these features, so we don't need to load polyfills
  return Promise.resolve()
}

/**
 * Get inline styles for progressive enhancement
 */
export function getProgressiveEnhancementStyles(element: 'container' | 'grid' | 'flexbox'): React.CSSProperties {
  const features = detectFeatureSupport()

  switch (element) {
    case 'container':
      return {
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        padding: features.css.customProperties ? undefined : '1rem'
      }

    case 'grid':
      if (features.css.grid) {
        return {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem'
        }
      } else if (features.css.flexbox) {
        return {
          display: 'flex',
          flexWrap: 'wrap',
          margin: '-0.5rem'
        }
      } else {
        return {
          display: 'block'
        }
      }

    case 'flexbox':
      if (features.css.flexbox) {
        return {
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }
      } else {
        return {
          display: 'block'
        }
      }

    default:
      return {}
  }
}

/**
 * Check if feature is supported and log warning if not
 */
export function requireFeature(feature: keyof FeatureSupport['css'] | keyof FeatureSupport['js'], category: 'css' | 'js'): boolean {
  const features = detectFeatureSupport()
  const isSupported = category === 'css' 
    ? features.css[feature as keyof FeatureSupport['css']]
    : features.js[feature as keyof FeatureSupport['js']]

  if (!isSupported && process.env.NODE_ENV === 'development') {
    console.warn(`⚠️ Feature not supported: ${category}.${feature}`)
  }

  return isSupported
}

/**
 * Get fallback value for CSS custom properties
 */
export function getCSSVariableFallback(variable: string, fallback: string): string {
  const features = detectFeatureSupport()
  
  if (features.css.customProperties) {
    return `var(${variable}, ${fallback})`
  }
  
  return fallback
}

/**
 * Initialize progressive enhancement on page load
 */
export function initializeProgressiveEnhancement(): void {
  if (typeof window === 'undefined') return

  // Apply feature detection classes
  applyProgressiveEnhancementClasses()

  // Load polyfills
  loadPolyfills().catch(error => {
    console.error('Failed to load polyfills:', error)
  })

  // Log feature support in development
  if (process.env.NODE_ENV === 'development') {
    const features = detectFeatureSupport()
    const browser = detectBrowser()
    
    console.log('🎨 Progressive Enhancement Initialized:', {
      browser: `${browser.name} ${browser.version}`,
      cssSupport: features.css,
      jsSupport: features.js
    })
  }
}
