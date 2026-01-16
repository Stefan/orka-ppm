/**
 * Resource Preloader Utility
 * 
 * Provides utilities for preloading critical resources to improve performance:
 * - Fonts
 * - Images
 * - Scripts
 * - Stylesheets
 * - API data
 */

export type ResourceType = 'font' | 'image' | 'script' | 'style' | 'fetch'

export interface PreloadOptions {
  /**
   * Resource URL to preload
   */
  href: string
  
  /**
   * Resource type
   */
  as: ResourceType
  
  /**
   * MIME type (optional, but recommended for fonts and images)
   */
  type?: string
  
  /**
   * Crossorigin attribute for fonts and external resources
   */
  crossOrigin?: 'anonymous' | 'use-credentials'
  
  /**
   * Media query for conditional loading
   */
  media?: string
}

/**
 * Preload a resource by injecting a <link rel="preload"> tag
 */
export function preloadResource(options: PreloadOptions): void {
  // Check if resource is already preloaded
  const existing = document.querySelector(
    `link[rel="preload"][href="${options.href}"]`
  )
  
  if (existing) {
    return
  }
  
  const link = document.createElement('link')
  link.rel = 'preload'
  link.href = options.href
  link.as = options.as
  
  if (options.type) {
    link.type = options.type
  }
  
  if (options.crossOrigin) {
    link.crossOrigin = options.crossOrigin
  }
  
  if (options.media) {
    link.media = options.media
  }
  
  document.head.appendChild(link)
}

/**
 * Preload a font file
 */
export function preloadFont(href: string, type: string = 'font/woff2'): void {
  preloadResource({
    href,
    as: 'font',
    type,
    crossOrigin: 'anonymous'
  })
}

/**
 * Preload an image
 */
export function preloadImage(href: string, type?: string): void {
  preloadResource({
    href,
    as: 'image',
    type
  })
}

/**
 * Preload a script
 */
export function preloadScript(href: string): void {
  preloadResource({
    href,
    as: 'script'
  })
}

/**
 * Preload a stylesheet
 */
export function preloadStylesheet(href: string): void {
  preloadResource({
    href,
    as: 'style'
  })
}

/**
 * Prefetch API data for faster navigation
 */
export function prefetchData(url: string): void {
  preloadResource({
    href: url,
    as: 'fetch',
    crossOrigin: 'anonymous'
  })
}

/**
 * Preload critical resources for a specific page
 */
export function preloadPageResources(page: 'dashboard' | 'resources' | 'risks' | 'scenarios'): void {
  switch (page) {
    case 'dashboard':
      // Preload dashboard-specific resources
      prefetchData('/api/dashboard/quick-stats')
      prefetchData('/api/dashboard/kpis')
      break
      
    case 'resources':
      // Preload resources page data
      prefetchData('/api/resources')
      break
      
    case 'risks':
      // Preload risks page data
      prefetchData('/api/risks')
      break
      
    case 'scenarios':
      // Preload scenarios page data
      prefetchData('/api/scenarios')
      break
  }
}

/**
 * Preconnect to external domains for faster resource loading
 */
export function preconnectDomain(domain: string, crossOrigin: boolean = false): void {
  // Check if already preconnected
  const existing = document.querySelector(
    `link[rel="preconnect"][href="${domain}"]`
  )
  
  if (existing) {
    return
  }
  
  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = domain
  
  if (crossOrigin) {
    link.crossOrigin = 'anonymous'
  }
  
  document.head.appendChild(link)
}

/**
 * DNS prefetch for external domains
 */
export function dnsPrefetch(domain: string): void {
  // Check if already prefetched
  const existing = document.querySelector(
    `link[rel="dns-prefetch"][href="${domain}"]`
  )
  
  if (existing) {
    return
  }
  
  const link = document.createElement('link')
  link.rel = 'dns-prefetch'
  link.href = domain
  
  document.head.appendChild(link)
}

/**
 * Preload critical resources on app initialization
 */
export function initializeResourcePreloading(): void {
  // Preconnect to API server
  preconnectDomain('https://orka-ppm.onrender.com', true)
  
  // DNS prefetch for external services
  dnsPrefetch('https://xceyrfvxooiplbmwavlb.supabase.co')
  
  // Preload critical icons
  preloadImage('/icon.svg', 'image/svg+xml')
  
  // Note: Fonts are handled by Next.js next/font/google automatically
  // Note: CSS and JS are handled by Next.js code splitting automatically
}

/**
 * Hook for preloading resources in React components
 */
export function useResourcePreloader() {
  return {
    preloadFont,
    preloadImage,
    preloadScript,
    preloadStylesheet,
    prefetchData,
    preloadPageResources,
    preconnectDomain,
    dnsPrefetch
  }
}
