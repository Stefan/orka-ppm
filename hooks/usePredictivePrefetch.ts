import { useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useRoutePrefetch } from './useRoutePrefetch'

interface NavigationPattern {
  from: string
  to: string
  count: number
  lastVisited: number
}

interface PredictiveConfig {
  enabled?: boolean
  minConfidence?: number // Minimum confidence threshold (0-1)
  maxPredictions?: number // Maximum number of routes to prefetch
  storageKey?: string
  decayFactor?: number // How much to decay old patterns (0-1)
}

const DEFAULT_CONFIG: Required<PredictiveConfig> = {
  enabled: true,
  minConfidence: 0.3,
  maxPredictions: 3,
  storageKey: 'orka-ppm-navigation-patterns',
  decayFactor: 0.95 // Decay patterns by 5% each time
}

/**
 * Hook for predictive route prefetching based on user navigation patterns
 * Tracks navigation history and prefetches likely next pages
 */
export function usePredictivePrefetch(config: PredictiveConfig = {}) {
  const pathname = usePathname()
  const { prefetchMultiple } = useRoutePrefetch()
  const previousPathRef = useRef<string | null>(null)
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  /**
   * Load navigation patterns from localStorage
   */
  const loadPatterns = useCallback((): NavigationPattern[] => {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = localStorage.getItem(mergedConfig.storageKey)
      if (!stored) return []
      
      const patterns = JSON.parse(stored) as NavigationPattern[]
      
      // Apply decay to old patterns
      const now = Date.now()
      const decayedPatterns = patterns.map(pattern => {
        const ageInDays = (now - pattern.lastVisited) / (1000 * 60 * 60 * 24)
        const decayMultiplier = Math.pow(mergedConfig.decayFactor, ageInDays)
        return {
          ...pattern,
          count: Math.max(1, pattern.count * decayMultiplier)
        }
      })
      
      return decayedPatterns
    } catch (error) {
      console.warn('Failed to load navigation patterns:', error)
      return []
    }
  }, [mergedConfig.storageKey, mergedConfig.decayFactor])

  /**
   * Save navigation patterns to localStorage
   */
  const savePatterns = useCallback((patterns: NavigationPattern[]) => {
    if (typeof window === 'undefined') return
    
    try {
      // Keep only the top 50 patterns to avoid storage bloat
      const topPatterns = patterns
        .sort((a, b) => b.count - a.count)
        .slice(0, 50)
      
      localStorage.setItem(mergedConfig.storageKey, JSON.stringify(topPatterns))
    } catch (error) {
      console.warn('Failed to save navigation patterns:', error)
    }
  }, [mergedConfig.storageKey])

  /**
   * Record a navigation event
   */
  const recordNavigation = useCallback((from: string, to: string) => {
    if (!mergedConfig.enabled || from === to) return
    
    const patterns = loadPatterns()
    const existingPattern = patterns.find(p => p.from === from && p.to === to)
    
    if (existingPattern) {
      existingPattern.count += 1
      existingPattern.lastVisited = Date.now()
    } else {
      patterns.push({
        from,
        to,
        count: 1,
        lastVisited: Date.now()
      })
    }
    
    savePatterns(patterns)
  }, [mergedConfig.enabled, loadPatterns, savePatterns])

  /**
   * Predict likely next routes based on current route
   */
  const predictNextRoutes = useCallback((currentRoute: string): string[] => {
    if (!mergedConfig.enabled) return []
    
    const patterns = loadPatterns()
    const relevantPatterns = patterns.filter(p => p.from === currentRoute)
    
    if (relevantPatterns.length === 0) return []
    
    // Calculate total count for confidence calculation
    const totalCount = relevantPatterns.reduce((sum, p) => sum + p.count, 0)
    
    // Calculate confidence for each pattern and filter by threshold
    const predictions = relevantPatterns
      .map(pattern => ({
        route: pattern.to,
        confidence: pattern.count / totalCount,
        count: pattern.count
      }))
      .filter(p => p.confidence >= mergedConfig.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, mergedConfig.maxPredictions)
      .map(p => p.route)
    
    return predictions
  }, [mergedConfig.enabled, mergedConfig.minConfidence, mergedConfig.maxPredictions, loadPatterns])

  /**
   * Prefetch predicted routes
   */
  const prefetchPredictedRoutes = useCallback(() => {
    if (!mergedConfig.enabled || !pathname) return
    
    const predictions = predictNextRoutes(pathname)
    
    if (predictions.length > 0) {
      console.log(`[Predictive Prefetch] Prefetching ${predictions.length} predicted routes:`, predictions)
      prefetchMultiple(predictions)
    }
  }, [mergedConfig.enabled, pathname, predictNextRoutes, prefetchMultiple])

  /**
   * Track navigation and record patterns
   */
  useEffect(() => {
    if (!mergedConfig.enabled || !pathname) return
    
    // Record navigation from previous path to current path
    if (previousPathRef.current && previousPathRef.current !== pathname) {
      recordNavigation(previousPathRef.current, pathname)
    }
    
    // Update previous path
    previousPathRef.current = pathname
    
    // Prefetch predicted routes after a short delay
    const timer = setTimeout(() => {
      prefetchPredictedRoutes()
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [pathname, mergedConfig.enabled, recordNavigation, prefetchPredictedRoutes])

  /**
   * Get navigation statistics for debugging
   */
  const getNavigationStats = useCallback(() => {
    const patterns = loadPatterns()
    const totalNavigations = patterns.reduce((sum, p) => sum + p.count, 0)
    const uniqueRoutes = new Set([...patterns.map(p => p.from), ...patterns.map(p => p.to)])
    
    return {
      totalPatterns: patterns.length,
      totalNavigations,
      uniqueRoutes: uniqueRoutes.size,
      topPatterns: patterns
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(p => ({
          from: p.from,
          to: p.to,
          count: Math.round(p.count),
          lastVisited: new Date(p.lastVisited).toLocaleDateString()
        }))
    }
  }, [loadPatterns])

  /**
   * Clear all navigation patterns
   */
  const clearPatterns = useCallback(() => {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(mergedConfig.storageKey)
      console.log('[Predictive Prefetch] Navigation patterns cleared')
    } catch (error) {
      console.warn('Failed to clear navigation patterns:', error)
    }
  }, [mergedConfig.storageKey])

  return {
    predictNextRoutes,
    getNavigationStats,
    clearPatterns,
    enabled: mergedConfig.enabled
  }
}

/**
 * Simple hook to enable predictive prefetching with default settings
 */
export function useSimplePredictivePrefetch(enabled: boolean = true) {
  usePredictivePrefetch({ enabled })
}
