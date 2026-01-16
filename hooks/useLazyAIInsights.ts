/**
 * Hook for lazy loading AI insights with caching
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface AIInsight {
  id: string
  insight_type: string
  category: string
  title: string
  content: string
  confidence_score: number
  priority: string
  validated: boolean
  generated_at: string
}

export interface UseLazyAIInsightsOptions {
  reportId: string
  category?: string
  autoLoad?: boolean
  cacheEnabled?: boolean
  cacheTTL?: number
  onError?: (error: Error) => void
}

export interface UseLazyAIInsightsReturn {
  insights: AIInsight[]
  isLoading: boolean
  error: Error | null
  load: () => Promise<void>
  reload: () => Promise<void>
  clearCache: () => void
  fromCache: boolean
}

interface InsightsCache {
  data: AIInsight[]
  timestamp: number
  ttl: number
}

// Global cache for insights
const insightsCache = new Map<string, InsightsCache>()

export function useLazyAIInsights(
  options: UseLazyAIInsightsOptions
): UseLazyAIInsightsReturn {
  const {
    reportId,
    category,
    autoLoad = false,
    cacheEnabled = true,
    cacheTTL = 3 * 60 * 1000, // 3 minutes
    onError
  } = options

  const [insights, setInsights] = useState<AIInsight[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [fromCache, setFromCache] = useState(false)
  
  const loadedRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Generate cache key
  const getCacheKey = useCallback(() => {
    return `insights:${reportId}${category ? `:${category}` : ''}`
  }, [reportId, category])

  // Check cache
  const getCachedInsights = useCallback((): AIInsight[] | null => {
    if (!cacheEnabled) return null

    const cacheKey = getCacheKey()
    const cached = insightsCache.get(cacheKey)

    if (cached) {
      const isExpired = Date.now() - cached.timestamp > cached.ttl
      if (!isExpired) {
        return cached.data
      }
      // Remove expired cache
      insightsCache.delete(cacheKey)
    }

    return null
  }, [cacheEnabled, getCacheKey])

  // Set cache
  const setCachedInsights = useCallback((data: AIInsight[]) => {
    if (!cacheEnabled) return

    const cacheKey = getCacheKey()
    insightsCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: cacheTTL
    })
  }, [cacheEnabled, getCacheKey, cacheTTL])

  // Clear cache
  const clearCache = useCallback(() => {
    const cacheKey = getCacheKey()
    insightsCache.delete(cacheKey)
    setFromCache(false)
  }, [getCacheKey])

  // Load insights
  const load = useCallback(async () => {
    if (isLoading || loadedRef.current) return

    // Check cache first
    const cachedData = getCachedInsights()
    if (cachedData) {
      setInsights(cachedData)
      setFromCache(true)
      loadedRef.current = true
      return
    }

    setIsLoading(true)
    setError(null)
    setFromCache(false)

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const startTime = performance.now()

    try {
      // Build query params
      const params = new URLSearchParams()
      if (category) {
        params.append('categories', category)
      }

      const query = params.toString() ? `?${params.toString()}` : ''
      const url = `/api/reports/pmr/${reportId}/insights${query}`

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`Failed to load insights: ${response.statusText}`)
      }

      const data = await response.json()
      const loadTime = performance.now() - startTime

      setInsights(data)
      setCachedInsights(data)
      loadedRef.current = true

      // Log performance
      console.debug(
        `[LazyLoad] AI Insights loaded in ${loadTime.toFixed(0)}ms`,
        { reportId, category, count: data.length, cached: false }
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return
      }

      const error = err instanceof Error ? err : new Error('Failed to load insights')
      setError(error)

      if (onError) {
        onError(error)
      }

      console.error('[LazyLoad] Failed to load AI insights:', err)
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [
    isLoading,
    reportId,
    category,
    getCachedInsights,
    setCachedInsights,
    onError
  ])

  // Reload (bypass cache)
  const reload = useCallback(async () => {
    clearCache()
    loadedRef.current = false
    await load()
  }, [clearCache, load])

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && !loadedRef.current) {
      load()
    }
  }, [autoLoad, load])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    insights,
    isLoading,
    error,
    load,
    reload,
    clearCache,
    fromCache
  }
}

export default useLazyAIInsights
