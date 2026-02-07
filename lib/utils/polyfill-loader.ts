/**
 * Polyfill Loading Utility
 * Automatically loads polyfills for unsupported browser features
 */

import { detectBrowser } from './browser/browser-detection'

export interface PolyfillConfig {
  feature: string
  polyfillUrl?: string
  polyfillFunction?: () => void
  condition: () => boolean
}

export interface PolyfillLoadResult {
  feature: string
  loaded: boolean
  error?: string
  fromCache?: boolean
}

// Cache for loaded polyfills to avoid duplicate loading
const loadedPolyfills = new Set<string>()
const polyfillPromises = new Map<string, Promise<PolyfillLoadResult>>()

/**
 * Default polyfill configurations for common features
 */
export const DEFAULT_POLYFILLS: PolyfillConfig[] = [
  {
    feature: 'intersectionObserver',
    polyfillUrl: 'https://polyfill.io/v3/polyfill.min.js?features=IntersectionObserver',
    condition: () => !('IntersectionObserver' in window)
  },
  {
    feature: 'fetch',
    polyfillUrl: 'https://polyfill.io/v3/polyfill.min.js?features=fetch',
    condition: () => !('fetch' in window)
  },
  {
    feature: 'customElements',
    polyfillUrl: 'https://polyfill.io/v3/polyfill.min.js?features=CustomEvent',
    condition: () => !('customElements' in window)
  },
  {
    feature: 'promise',
    polyfillUrl: 'https://polyfill.io/v3/polyfill.min.js?features=Promise',
    condition: () => typeof Promise === 'undefined'
  },
  {
    feature: 'objectAssign',
    polyfillFunction: () => {
      if (!Object.assign) {
        Object.assign = function(target: any, ...sources: any[]) {
          if (target == null) {
            throw new TypeError('Cannot convert undefined or null to object')
          }
          const to = Object(target)
          for (let index = 0; index < sources.length; index++) {
            const nextSource = sources[index]
            if (nextSource != null) {
              for (const nextKey in nextSource) {
                if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                  to[nextKey] = nextSource[nextKey]
                }
              }
            }
          }
          return to
        }
      }
    },
    condition: () => typeof Object.assign !== 'function'
  }
]

/**
 * Validate polyfill configuration
 */
function validatePolyfillConfig(config: PolyfillConfig): string | null {
  if (!config || typeof config !== 'object') {
    return 'Config must be an object'
  }
  
  if (!config.feature || typeof config.feature !== 'string') {
    return 'Feature name must be a non-empty string'
  }
  
  // Validate feature name format (alphanumeric, underscore, dash only)
  if (!/^[a-zA-Z0-9_-]+$/.test(config.feature)) {
    return 'Feature name contains invalid characters'
  }
  
  if (config.feature.length < 2 || config.feature.length > 50) {
    return 'Feature name must be between 2 and 50 characters'
  }
  
  if (typeof config.condition !== 'function') {
    return 'Condition must be a function'
  }
  
  if (!config.polyfillUrl && !config.polyfillFunction) {
    return 'Either polyfillUrl or polyfillFunction must be provided'
  }
  
  if (config.polyfillUrl && typeof config.polyfillUrl !== 'string') {
    return 'polyfillUrl must be a string'
  }
  
  if (config.polyfillFunction && typeof config.polyfillFunction !== 'function') {
    return 'polyfillFunction must be a function'
  }
  
  return null
}

/**
 * Load a single polyfill
 */
export async function loadPolyfill(config: PolyfillConfig): Promise<PolyfillLoadResult> {
  // Validate input configuration
  const validationError = validatePolyfillConfig(config)
  if (validationError) {
    return {
      feature: config?.feature || 'unknown',
      loaded: false,
      error: `Invalid configuration: ${validationError}`
    }
  }

  // Check if already loaded
  if (loadedPolyfills.has(config.feature)) {
    return {
      feature: config.feature,
      loaded: true,
      fromCache: true
    }
  }

  // Check if already loading
  if (polyfillPromises.has(config.feature)) {
    return polyfillPromises.get(config.feature)!
  }

  // Check if polyfill is needed (with error handling)
  let conditionResult: boolean
  try {
    conditionResult = config.condition()
  } catch (error) {
    return {
      feature: config.feature,
      loaded: false,
      error: `Condition check failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  if (!conditionResult) {
    loadedPolyfills.add(config.feature)
    return {
      feature: config.feature,
      loaded: true
    }
  }

  // Create loading promise with better error handling
  const loadingPromise = (async (): Promise<PolyfillLoadResult> => {
    try {
      if (config.polyfillFunction) {
        // Execute inline polyfill function with error handling
        try {
          await Promise.resolve(config.polyfillFunction())
        } catch (funcError) {
          throw new Error(`Polyfill function execution failed: ${funcError instanceof Error ? funcError.message : String(funcError)}`)
        }
        loadedPolyfills.add(config.feature)
        return {
          feature: config.feature,
          loaded: true
        }
      } else if (config.polyfillUrl) {
        // Validate URL format
        try {
          new URL(config.polyfillUrl)
        } catch (urlError) {
          throw new Error(`Invalid polyfill URL: ${config.polyfillUrl}`)
        }
        
        // Load external polyfill script
        await loadScript(config.polyfillUrl)
        loadedPolyfills.add(config.feature)
        return {
          feature: config.feature,
          loaded: true
        }
      } else {
        throw new Error(`No polyfill method specified for feature: ${config.feature}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn(`Failed to load polyfill for ${config.feature}:`, errorMessage)
      return {
        feature: config.feature,
        loaded: false,
        error: errorMessage
      }
    } finally {
      polyfillPromises.delete(config.feature)
    }
  })()

  // Add error handler to prevent unhandled promise rejections
  loadingPromise.catch(() => {
    // Error already handled in the promise chain
    // This catch prevents unhandled promise rejection warnings
  })

  polyfillPromises.set(config.feature, loadingPromise)
  return loadingPromise
}

/**
 * Load multiple polyfills
 */
export async function loadPolyfills(configs: PolyfillConfig[]): Promise<PolyfillLoadResult[]> {
  if (!Array.isArray(configs)) {
    return [{
      feature: 'unknown',
      loaded: false,
      error: 'Configs must be an array'
    }]
  }
  
  if (configs.length === 0) {
    return []
  }
  
  // Use Promise.allSettled to handle individual failures gracefully
  const results = await Promise.allSettled(configs.map(config => loadPolyfill(config)))
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        feature: configs[index]?.feature || 'unknown',
        loaded: false,
        error: `Promise rejected: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
      }
    }
  })
}

/**
 * Load polyfills based on browser detection
 */
export async function loadPolyfillsForBrowser(): Promise<PolyfillLoadResult[]> {
  try {
    const browser = detectBrowser()
    const neededPolyfills: PolyfillConfig[] = []

    // Add polyfills based on browser capabilities with error handling
    for (const polyfill of DEFAULT_POLYFILLS) {
      try {
        if (polyfill.condition()) {
          neededPolyfills.push(polyfill)
        }
      } catch (error) {
        console.warn(`Error checking condition for ${polyfill.feature}:`, error)
        // Continue with other polyfills
      }
    }

    // Browser-specific polyfills with error handling
    try {
      if (browser.name === 'firefox' && browser.version < 88) {
        neededPolyfills.push({
          feature: 'scrollBehavior',
          polyfillFunction: () => {
            // Simple scroll behavior polyfill for older Firefox
            if (typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('scroll-behavior', 'smooth')) {
              const style = document.createElement('style')
              style.textContent = `
                html { scroll-behavior: smooth; }
                * { scroll-behavior: smooth; }
              `
              document.head.appendChild(style)
            }
          },
          condition: () => typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('scroll-behavior', 'smooth')
        })
      }

      if (browser.name === 'safari' && browser.version < 14) {
        neededPolyfills.push({
          feature: 'overscrollBehavior',
          polyfillFunction: () => {
            // Simple overscroll behavior polyfill for older Safari
            const style = document.createElement('style')
            style.textContent = `
              body { overscroll-behavior: contain; }
              .sidebar { overscroll-behavior-y: contain; }
            `
            document.head.appendChild(style)
          },
          condition: () => typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('overscroll-behavior', 'contain')
        })
      }
    } catch (error) {
      console.warn('Error adding browser-specific polyfills:', error)
    }

    return loadPolyfills(neededPolyfills)
  } catch (error) {
    console.error('Error in loadPolyfillsForBrowser:', error)
    return [{
      feature: 'browserDetection',
      loaded: false,
      error: `Browser detection failed: ${error instanceof Error ? error.message : String(error)}`
    }]
  }
}

/**
 * Load a script dynamically
 */
function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Validate URL
      new URL(url)
      
      // Check if script is already loaded
      const existingScript = document.querySelector(`script[src="${url}"]`)
      if (existingScript) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = url
      script.async = true
      
      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error(`Script loading timeout: ${url}`))
      }, 10000) // 10 second timeout
      
      script.onload = () => {
        clearTimeout(timeout)
        resolve()
      }
      
      script.onerror = () => {
        clearTimeout(timeout)
        reject(new Error(`Failed to load script: ${url}`))
      }
      
      document.head.appendChild(script)
    } catch (error) {
      reject(new Error(`Invalid script URL: ${url}`))
    }
  })
}

/**
 * Check if a polyfill is loaded
 */
export function isPolyfillLoaded(feature: string): boolean {
  return loadedPolyfills.has(feature)
}

/**
 * Get all loaded polyfills
 */
export function getLoadedPolyfills(): string[] {
  return Array.from(loadedPolyfills)
}

/**
 * Clear polyfill cache (for testing)
 */
export function clearPolyfillCache(): void {
  loadedPolyfills.clear()
  polyfillPromises.clear()
}

/**
 * XMLHttpRequest fallback for fetch
 */
export function createFetchPolyfill(): void {
  if (!('fetch' in window) && typeof Promise !== 'undefined') {
    (window as any).fetch = function(url: string, options: any = {}) {
      return new Promise((resolve, reject) => {
        try {
          // Validate URL
          new URL(url)
          
          const xhr = new XMLHttpRequest()
          xhr.open(options.method || 'GET', url)
          
          // Set headers
          if (options.headers && typeof options.headers === 'object') {
            Object.keys(options.headers).forEach(key => {
              if (typeof options.headers[key] === 'string') {
                xhr.setRequestHeader(key, options.headers[key])
              }
            })
          }
          
          // Set timeout
          xhr.timeout = options.timeout || 10000
          
          xhr.onload = () => {
            resolve({
              ok: xhr.status >= 200 && xhr.status < 300,
              status: xhr.status,
              statusText: xhr.statusText,
              text: () => Promise.resolve(xhr.responseText),
              json: () => {
                try {
                  return Promise.resolve(JSON.parse(xhr.responseText))
                } catch (parseError) {
                  return Promise.reject(new Error('Invalid JSON response'))
                }
              }
            })
          }
          
          xhr.onerror = () => reject(new Error('Network error'))
          xhr.ontimeout = () => reject(new Error('Request timeout'))
          
          xhr.send(options.body)
        } catch (error) {
          reject(new Error(`Invalid fetch request: ${error instanceof Error ? error.message : String(error)}`))
        }
      })
    }
  }
}