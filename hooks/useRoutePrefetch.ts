import { useRouter } from 'next/navigation'
import { useEffect, useCallback } from 'react'

/**
 * Hook for programmatic route prefetching
 * Prefetches routes to improve navigation performance
 */
export function useRoutePrefetch() {
  const router = useRouter()

  /**
   * Prefetch a route programmatically
   * @param href - The route to prefetch
   */
  const prefetch = useCallback((href: string) => {
    try {
      router.prefetch(href)
    } catch (error) {
      console.warn(`Failed to prefetch route: ${href}`, error)
    }
  }, [router])

  /**
   * Prefetch multiple routes at once
   * @param hrefs - Array of routes to prefetch
   */
  const prefetchMultiple = useCallback((hrefs: string[]) => {
    hrefs.forEach(href => prefetch(href))
  }, [prefetch])

  return {
    prefetch,
    prefetchMultiple
  }
}

/**
 * Hook to automatically prefetch common navigation paths
 * @param paths - Array of paths to prefetch on mount
 * @param delay - Optional delay in ms before prefetching (default: 0)
 */
export function useAutoPrefetch(paths: string[], delay: number = 0) {
  const { prefetchMultiple } = useRoutePrefetch()

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => {
        prefetchMultiple(paths)
      }, delay)
      return () => clearTimeout(timer)
    } else {
      prefetchMultiple(paths)
    }
  }, [paths, delay, prefetchMultiple])
}
