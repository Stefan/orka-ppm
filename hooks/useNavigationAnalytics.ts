import { useState, useEffect, useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { useAuth } from '../app/providers/SupabaseAuthProvider'
import type { 
  NavigationItem, 
  UserNavigationPattern, 
  AINavigationSuggestion, 
  NavigationAnalytics 
} from '../types/navigation'

/**
 * Hook for tracking and analyzing user navigation patterns
 */
export function useNavigationAnalytics() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useLocalStorage<NavigationAnalytics | null>(
    `navigation-analytics-${user?.id || 'anonymous'}`,
    null
  )
  const [suggestions, setSuggestions] = useState<AINavigationSuggestion[]>([])

  // Track navigation item usage
  const trackNavigation = useCallback((itemId: string, timeSpent: number = 0) => {
    if (!user?.id) return

    const now = new Date()
    const currentHour = now.getHours()
    const currentDay = now.getDay()

    setAnalytics(prev => {
      const existingPatterns = prev?.patterns || []
      const existingPatternIndex = existingPatterns.findIndex(p => p.itemId === itemId)

      let updatedPatterns: UserNavigationPattern[]

      if (existingPatternIndex >= 0) {
        // Update existing pattern
        updatedPatterns = [...existingPatterns]
        updatedPatterns[existingPatternIndex] = {
          ...updatedPatterns[existingPatternIndex],
          visitCount: updatedPatterns[existingPatternIndex].visitCount + 1,
          lastVisited: now,
          timeSpent: updatedPatterns[existingPatternIndex].timeSpent + timeSpent,
          contextualUsage: {
            timeOfDay: currentHour,
            dayOfWeek: currentDay,
            sessionDuration: timeSpent
          }
        }
      } else {
        // Create new pattern
        const newPattern: UserNavigationPattern = {
          userId: user.id,
          itemId,
          visitCount: 1,
          lastVisited: now,
          timeSpent,
          contextualUsage: {
            timeOfDay: currentHour,
            dayOfWeek: currentDay,
            sessionDuration: timeSpent
          }
        }
        updatedPatterns = [...existingPatterns, newPattern]
      }

      return {
        userId: user.id,
        patterns: updatedPatterns,
        suggestions: prev?.suggestions || [],
        lastUpdated: now
      }
    })
  }, [user?.id, setAnalytics])

  // Generate AI suggestions based on patterns
  const generateSuggestions = useCallback((
    patterns: UserNavigationPattern[],
    navigationItems: NavigationItem[]
  ): AINavigationSuggestion[] => {
    if (!patterns.length) return []

    const suggestions: AINavigationSuggestion[] = []
    const now = new Date()
    const currentHour = now.getHours()
    const currentDay = now.getDay()

    // Sort patterns by usage frequency
    const sortedPatterns = [...patterns].sort((a, b) => b.visitCount - a.visitCount)

    // Frequent use suggestions
    sortedPatterns.slice(0, 3).forEach(pattern => {
      const item = navigationItems.find(item => item.id === pattern.itemId)
      if (item && pattern.visitCount >= 5) {
        suggestions.push({
          itemId: pattern.itemId,
          confidence: Math.min(0.9, pattern.visitCount / 20),
          reason: 'frequent_use',
          message: `You frequently use ${item.label}`
        })
      }
    })

    // Time-based suggestions
    patterns.forEach(pattern => {
      const item = navigationItems.find(item => item.id === pattern.itemId)
      if (item && Math.abs(pattern.contextualUsage.timeOfDay - currentHour) <= 1) {
        suggestions.push({
          itemId: pattern.itemId,
          confidence: 0.7,
          reason: 'time_pattern',
          message: `You usually access ${item.label} around this time`
        })
      }
    })

    // Role-based suggestions (simplified AI logic)
    navigationItems.forEach(item => {
      if (item.category === 'admin' && user?.email?.includes('admin')) {
        suggestions.push({
          itemId: item.id,
          confidence: 0.6,
          reason: 'role_based',
          message: `${item.label} is recommended for your role`
        })
      }
    })

    // Remove duplicates and sort by confidence
    const uniqueSuggestions = suggestions
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => s.itemId === suggestion.itemId)
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3) // Limit to top 3 suggestions

    return uniqueSuggestions
  }, [user?.email])

  // Update suggestions when analytics change
  useEffect(() => {
    if (analytics?.patterns) {
      // This would normally call an AI service, but for now we'll use local logic
      const newSuggestions = generateSuggestions(analytics.patterns, [])
      setSuggestions(newSuggestions)
    }
  }, [analytics, generateSuggestions])

  // Get usage frequency for a navigation item
  const getUsageFrequency = useCallback((itemId: string): number => {
    if (!analytics?.patterns) return 0
    const pattern = analytics.patterns.find(p => p.itemId === itemId)
    return pattern?.visitCount || 0
  }, [analytics])

  // Get AI suggestions for current context
  const getContextualSuggestions = useCallback((navigationItems: NavigationItem[]): AINavigationSuggestion[] => {
    if (!analytics?.patterns) return []
    return generateSuggestions(analytics.patterns, navigationItems)
  }, [analytics, generateSuggestions])

  return {
    trackNavigation,
    getUsageFrequency,
    getContextualSuggestions,
    suggestions,
    analytics
  }
}