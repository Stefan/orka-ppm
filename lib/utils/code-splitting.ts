/**
 * Code splitting utilities for optimal performance
 */

import React from 'react'
import { measureChunkLoad, getNetworkInfo } from './performance'

interface LazyComponentOptions {
  fallback?: React.ComponentType
  retryCount?: number
  retryDelay?: number
  preload?: boolean
}

interface ChunkLoadOptions {
  priority?: 'high' | 'medium' | 'low'
  networkAware?: boolean
  timeout?: number
}

// Dynamic import wrapper with performance monitoring
export const loadChunk = async <T = any>(
  importFn: () => Promise<T>,
  chunkName: string,
  options: ChunkLoadOptions = {}
): Promise<T> => {
  const { priority = 'medium', networkAware = true, timeout = 10000 } = options
  
  // Check network conditions if network-aware loading is enabled
  if (networkAware) {
    const network = getNetworkInfo()
    
    // Delay loading on slow connections for low priority chunks
    if (priority === 'low' && (network.effectiveType === 'slow-2g' || network.effectiveType === '2g')) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Skip loading on save-data mode for non-critical chunks
    if (network.saveData && priority === 'low') {
      throw new Error(`Chunk loading skipped due to save-data mode: ${chunkName}`)
    }
  }

  const measurement = measureChunkLoad(chunkName)
  
  try {
    // Add timeout to prevent hanging imports
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Chunk load timeout: ${chunkName}`)), timeout)
    })
    
    const result = await Promise.race([importFn(), timeoutPromise])
    measurement.end()
    
    return result
  } catch (error) {
    measurement.end()
    console.error(`Failed to load chunk: ${chunkName}`, error)
    throw error
  }
}

// React lazy component wrapper with retry logic
export const createLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  chunkName: string,
  options: LazyComponentOptions = {}
): React.LazyExoticComponent<T> => {
  const { retryCount = 3, retryDelay = 1000 } = options
  
  const retryImport = async (attempt = 1): Promise<{ default: T }> => {
    try {
      return await loadChunk(importFn, chunkName, { priority: 'medium' })
    } catch (error) {
      if (attempt < retryCount) {
        console.warn(`Retry loading chunk ${chunkName} (attempt ${attempt + 1}/${retryCount})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        return retryImport(attempt + 1)
      }
      throw error
    }
  }
  
  return React.lazy(() => retryImport())
}

// Preload chunks for better performance
export const preloadChunk = (
  importFn: () => Promise<any>,
  chunkName: string,
  condition: () => boolean = () => true
): void => {
  if (!condition()) return
  
  // Use requestIdleCallback if available, otherwise setTimeout
  const schedulePreload = (callback: () => void) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout: 5000 })
    } else {
      setTimeout(callback, 100)
    }
  }
  
  schedulePreload(() => {
    loadChunk(importFn, `preload_${chunkName}`, { priority: 'low' })
      .then(() => {
        console.log(`✅ Preloaded chunk: ${chunkName}`)
      })
      .catch(() => {
        console.warn(`❌ Failed to preload chunk: ${chunkName}`)
      })
  })
}

// Route-based code splitting helper
export const createRouteComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  routeName: string
) => {
  return createLazyComponent(importFn, `route_${routeName}`, {
    retryCount: 2,
    retryDelay: 500
  })
}

// Feature-based code splitting helper
export const createFeatureComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  featureName: string,
  isEnabled: () => boolean = () => true
) => {
  if (!isEnabled()) {
    // Return a placeholder component if feature is disabled
    return React.lazy(() => Promise.resolve({
      default: (() => null) as unknown as T
    }))
  }
  
  return createLazyComponent(importFn, `feature_${featureName}`, {
    retryCount: 1,
    retryDelay: 1000
  })
}

// Bundle splitting utilities
export const splitVendorChunks = () => {
  // This would be used in webpack/next.js config
  return {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
        priority: 10
      },
      common: {
        name: 'common',
        minChunks: 2,
        chunks: 'all',
        priority: 5,
        reuseExistingChunk: true
      },
      react: {
        test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
        name: 'react',
        chunks: 'all',
        priority: 20
      },
      charts: {
        test: /[\\/]node_modules[\\/](recharts|d3)[\\/]/,
        name: 'charts',
        chunks: 'all',
        priority: 15
      }
    }
  }
}

// Critical resource preloading
export const preloadCriticalResources = () => {
  if (typeof window === 'undefined') return
  
  const network = getNetworkInfo()
  
  // Only preload on fast connections
  if (network.effectiveType === '4g' && !network.saveData) {
    // Preload critical fonts
    const fontLink = document.createElement('link')
    fontLink.rel = 'preload'
    fontLink.href = '/fonts/inter-var.woff2'
    fontLink.as = 'font'
    fontLink.type = 'font/woff2'
    fontLink.crossOrigin = 'anonymous'
    document.head.appendChild(fontLink)
    
    // Preload critical images
    const heroImage = new Image()
    heroImage.src = '/images/hero-bg.webp'
    
    // Preload critical API endpoints
    if ('fetch' in window) {
      fetch('/api/user/profile', { method: 'HEAD' }).catch(() => {})
      fetch('/api/projects/recent', { method: 'HEAD' }).catch(() => {})
    }
  }
}

// Lazy loading utilities
export const createIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver | null => {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null
  }
  
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  })
}

export const lazyLoadImages = () => {
  const imageObserver = createIntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement
        const src = img.dataset.src
        const srcset = img.dataset.srcset
        
        if (src) {
          img.src = src
          img.removeAttribute('data-src')
        }
        
        if (srcset) {
          img.srcset = srcset
          img.removeAttribute('data-srcset')
        }
        
        img.classList.remove('lazy')
        img.classList.add('loaded')
        imageObserver?.unobserve(img)
      }
    })
  })
  
  if (imageObserver) {
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img)
    })
  }
}

// Performance-aware component loading
export const shouldLoadComponent = (priority: 'high' | 'medium' | 'low' = 'medium'): boolean => {
  if (typeof window === 'undefined') return true
  
  const network = getNetworkInfo()
  
  // Always load high priority components
  if (priority === 'high') return true
  
  // Skip low priority components on slow connections or save-data mode
  if (priority === 'low') {
    if (network.saveData || network.effectiveType === 'slow-2g' || network.effectiveType === '2g') {
      return false
    }
  }
  
  // Check device memory if available
  if ('deviceMemory' in navigator) {
    const deviceMemory = (navigator as any).deviceMemory
    if (deviceMemory < 2 && priority === 'low') {
      return false
    }
  }
  
  return true
}

export default {
  loadChunk,
  createLazyComponent,
  preloadChunk,
  createRouteComponent,
  createFeatureComponent,
  preloadCriticalResources,
  lazyLoadImages,
  shouldLoadComponent
}