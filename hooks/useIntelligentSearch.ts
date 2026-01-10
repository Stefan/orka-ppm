import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { useAuth } from '../app/providers/SupabaseAuthProvider'
import { useDebounce } from './useDebounce'
import { fuzzySearch, generateSearchSuggestions } from '../utils/fuzzySearch'
import type { SearchResult, SearchSuggestion, SearchAnalytics } from '../types/search'
import type { NavigationItem } from '../types/navigation'

// Search data configuration
const SEARCH_DATA: SearchResult[] = [
  // Navigation items
  {
    id: 'nav-dashboards',
    title: 'Portfolio Dashboards',
    description: 'Overview of all your projects and portfolios with key metrics',
    href: '/dashboards',
    category: 'navigation',
    relevanceScore: 0,
    keywords: ['dashboard', 'portfolio', 'overview', 'projects', 'metrics', 'kpi']
  },
  {
    id: 'nav-scenarios',
    title: 'What-If Scenarios',
    description: 'Explore different project scenarios and outcomes',
    href: '/scenarios',
    category: 'navigation',
    relevanceScore: 0,
    keywords: ['scenarios', 'what-if', 'simulation', 'planning', 'outcomes']
  },
  {
    id: 'nav-resources',
    title: 'Resource Management',
    description: 'Manage team resources and allocations',
    href: '/resources',
    category: 'navigation',
    relevanceScore: 0,
    keywords: ['resources', 'team', 'allocation', 'capacity', 'utilization']
  },
  {
    id: 'nav-reports',
    title: 'AI Reports & Analytics',
    description: 'AI-powered insights and analytics',
    href: '/reports',
    category: 'navigation',
    relevanceScore: 0,
    keywords: ['reports', 'analytics', 'ai', 'insights', 'intelligence', 'data']
  },
  {
    id: 'nav-financials',
    title: 'Financial Tracking',
    description: 'Track budgets, costs, and financial performance',
    href: '/financials',
    category: 'navigation',
    relevanceScore: 0,
    keywords: ['financial', 'budget', 'cost', 'expense', 'money', 'tracking']
  },
  {
    id: 'nav-risks',
    title: 'Risk/Issue Registers',
    description: 'Manage project risks and issues',
    href: '/risks',
    category: 'navigation',
    relevanceScore: 0,
    keywords: ['risk', 'issue', 'register', 'mitigation', 'problems']
  },
  {
    id: 'nav-monte-carlo',
    title: 'Monte Carlo Analysis',
    description: 'Advanced statistical analysis and simulations',
    href: '/monte-carlo',
    category: 'navigation',
    relevanceScore: 0,
    keywords: ['monte carlo', 'simulation', 'statistics', 'probability', 'analysis']
  },
  {
    id: 'nav-changes',
    title: 'Change Management',
    description: 'Track and manage project changes',
    href: '/changes',
    category: 'navigation',
    relevanceScore: 0,
    keywords: ['change', 'management', 'tracking', 'approval', 'requests']
  },
  // Feature items
  {
    id: 'feature-create-project',
    title: 'Create New Project',
    description: 'Start a new project with templates and AI assistance',
    href: '/dashboards?action=create',
    category: 'feature',
    relevanceScore: 0,
    keywords: ['create', 'new', 'project', 'start', 'template']
  },
  {
    id: 'feature-resource-optimization',
    title: 'Resource Optimization',
    description: 'AI-powered resource allocation optimization',
    href: '/resources?tab=optimization',
    category: 'feature',
    relevanceScore: 0,
    keywords: ['optimization', 'ai', 'allocation', 'efficiency', 'smart']
  },
  {
    id: 'feature-risk-analysis',
    title: 'Risk Analysis',
    description: 'Automated risk detection and analysis',
    href: '/risks?tab=analysis',
    category: 'feature',
    relevanceScore: 0,
    keywords: ['risk', 'analysis', 'detection', 'automated', 'ai']
  },
  // Help items
  {
    id: 'help-getting-started',
    title: 'Getting Started Guide',
    description: 'Learn how to use the PPM system effectively',
    href: '/help/getting-started',
    category: 'help',
    relevanceScore: 0,
    keywords: ['help', 'guide', 'tutorial', 'getting started', 'learn']
  },
  {
    id: 'help-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Speed up your workflow with keyboard shortcuts',
    href: '/help/shortcuts',
    category: 'help',
    relevanceScore: 0,
    keywords: ['shortcuts', 'keyboard', 'hotkeys', 'speed', 'workflow']
  }
]

/**
 * Hook for intelligent search functionality with AI suggestions
 */
export function useIntelligentSearch() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const debouncedQuery = useDebounce(query, 300)
  
  const [searchAnalytics, setSearchAnalytics] = useLocalStorage<SearchAnalytics>(
    `search-analytics-${user?.id || 'anonymous'}`,
    {
      userId: user?.id || 'anonymous',
      recentSearches: [],
      popularSearches: [],
      searchPatterns: {
        timeOfDay: {},
        categories: {}
      },
      lastUpdated: new Date()
    }
  )

  // Search results based on debounced query
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    
    return fuzzySearch(debouncedQuery, SEARCH_DATA, {
      threshold: 0.2,
      includeScore: true
    }).slice(0, 8) // Limit to 8 results
  }, [debouncedQuery])

  // Search suggestions
  const searchSuggestions = useMemo(() => {
    const suggestions: SearchSuggestion[] = []
    
    // Recent searches
    searchAnalytics.recentSearches.slice(0, 3).forEach(recentQuery => {
      if (recentQuery.toLowerCase().includes(query.toLowerCase()) && recentQuery !== query) {
        suggestions.push({
          query: recentQuery,
          type: 'recent'
        })
      }
    })
    
    // Popular searches
    searchAnalytics.popularSearches
      .filter(popular => popular.query.toLowerCase().includes(query.toLowerCase()) && popular.query !== query)
      .slice(0, 2)
      .forEach(popular => {
        suggestions.push({
          query: popular.query,
          type: 'popular',
          frequency: popular.count
        })
      })
    
    // AI-generated suggestions
    if (query.trim()) {
      const aiSuggestions = generateSearchSuggestions(query, SEARCH_DATA, 3)
      aiSuggestions.forEach(suggestion => {
        if (!suggestions.some(s => s.query === suggestion)) {
          suggestions.push({
            query: suggestion,
            type: 'ai_suggested'
          })
        }
      })
    }
    
    return suggestions.slice(0, 5)
  }, [query, searchAnalytics])

  // Track search analytics
  const trackSearch = useCallback((searchQuery: string, resultClicked?: SearchResult) => {
    if (!searchQuery.trim()) return
    
    const now = new Date()
    const hour = now.getHours()
    
    setSearchAnalytics(prev => {
      // Update recent searches
      const recentSearches = [searchQuery, ...prev.recentSearches.filter(q => q !== searchQuery)].slice(0, 10)
      
      // Update popular searches
      const existingPopular = prev.popularSearches.find(p => p.query === searchQuery)
      let popularSearches
      if (existingPopular) {
        popularSearches = prev.popularSearches.map(p => 
          p.query === searchQuery ? { ...p, count: p.count + 1 } : p
        )
      } else {
        popularSearches = [...prev.popularSearches, { query: searchQuery, count: 1 }]
      }
      popularSearches = popularSearches.sort((a, b) => b.count - a.count).slice(0, 10)
      
      // Update search patterns
      const timeOfDay = { ...prev.searchPatterns.timeOfDay }
      timeOfDay[hour] = (timeOfDay[hour] || 0) + 1
      
      const categories = { ...prev.searchPatterns.categories }
      if (resultClicked) {
        categories[resultClicked.category] = (categories[resultClicked.category] || 0) + 1
      }
      
      return {
        ...prev,
        recentSearches,
        popularSearches,
        searchPatterns: {
          timeOfDay,
          categories
        },
        lastUpdated: now
      }
    })
  }, [setSearchAnalytics])

  // Handle search input
  const handleSearch = useCallback((newQuery: string) => {
    setQuery(newQuery)
    setSelectedIndex(-1)
    setIsOpen(newQuery.trim().length > 0)
  }, [])

  // Handle result selection
  const handleSelectResult = useCallback((result: SearchResult) => {
    trackSearch(query, result)
    setQuery('')
    setIsOpen(false)
    setSelectedIndex(-1)
    
    // Navigate to result
    window.location.href = result.href
  }, [query, trackSearch])

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: SearchSuggestion) => {
    setQuery(suggestion.query)
    trackSearch(suggestion.query)
  }, [trackSearch])

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!isOpen) return
    
    const totalItems = searchResults.length + searchSuggestions.length
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setSelectedIndex(prev => (prev + 1) % totalItems)
        break
      case 'ArrowUp':
        event.preventDefault()
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems)
        break
      case 'Enter':
        event.preventDefault()
        if (selectedIndex >= 0) {
          if (selectedIndex < searchSuggestions.length) {
            handleSelectSuggestion(searchSuggestions[selectedIndex])
          } else {
            const resultIndex = selectedIndex - searchSuggestions.length
            if (searchResults[resultIndex]) {
              handleSelectResult(searchResults[resultIndex])
            }
          }
        } else if (query.trim()) {
          trackSearch(query)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }, [isOpen, selectedIndex, searchResults, searchSuggestions, query, handleSelectResult, handleSelectSuggestion, trackSearch])

  // Close search when clicking outside
  const handleBlur = useCallback(() => {
    // Delay to allow click events to fire
    setTimeout(() => {
      setIsOpen(false)
      setSelectedIndex(-1)
    }, 150)
  }, [])

  // Get AI-powered search insights
  const getSearchInsights = useCallback(() => {
    const now = new Date()
    const currentHour = now.getHours()
    
    const insights = []
    
    // Time-based insights
    const hourlyPattern = searchAnalytics.searchPatterns.timeOfDay[currentHour] || 0
    if (hourlyPattern > 5) {
      insights.push(`You often search around ${currentHour}:00`)
    }
    
    // Category insights
    const topCategory = Object.entries(searchAnalytics.searchPatterns.categories)
      .sort(([,a], [,b]) => b - a)[0]
    if (topCategory) {
      insights.push(`You frequently search for ${topCategory[0]} items`)
    }
    
    return insights
  }, [searchAnalytics])

  return {
    query,
    searchResults,
    searchSuggestions,
    isOpen,
    selectedIndex,
    handleSearch,
    handleSelectResult,
    handleSelectSuggestion,
    handleKeyDown,
    handleBlur,
    trackSearch,
    getSearchInsights,
    setIsOpen
  }
}