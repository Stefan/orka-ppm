'use client'

import { useState, useCallback, useMemo } from 'react'

interface DocumentSection {
  id: string
  title: string
  content: string
  category: 'getting-started' | 'features' | 'troubleshooting' | 'advanced' | 'api'
  tags: string[]
  lastUpdated: Date
  popularity: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

interface SearchResult {
  document: DocumentSection
  relevanceScore: number
  matchedTerms: string[]
  snippet: string
  highlightedContent: string
}

interface SearchFilters {
  category?: DocumentSection['category']
  difficulty?: DocumentSection['difficulty']
  tags?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
}

interface UseIntelligentDocSearchReturn {
  // Search state
  results: SearchResult[]
  isSearching: boolean
  searchQuery: string
  
  // Search functions
  search: (query: string, filters?: SearchFilters) => Promise<SearchResult[]>
  clearSearch: () => void
  
  // NLP features
  getSuggestions: (partialQuery: string) => string[]
  getRelatedQueries: (query: string) => string[]
  extractIntent: (query: string) => {
    intent: 'how-to' | 'what-is' | 'troubleshoot' | 'find' | 'compare'
    entities: string[]
    confidence: number
  }
  
  // Analytics
  getPopularSearches: () => string[]
  trackSearch: (query: string, resultClicked?: string) => void
}

// Mock documentation database
const MOCK_DOCUMENTS: DocumentSection[] = [
  {
    id: 'getting-started-dashboard',
    title: 'Getting Started with Dashboard',
    content: 'The dashboard is your central hub for project management. It displays key metrics, recent activities, and provides quick access to important features. You can customize widgets by dragging and dropping them to different positions.',
    category: 'getting-started',
    tags: ['dashboard', 'widgets', 'customization', 'overview'],
    lastUpdated: new Date('2024-01-15'),
    popularity: 95,
    difficulty: 'beginner'
  },
  {
    id: 'resource-optimization',
    title: 'AI-Powered Resource Optimization',
    content: 'The AI resource optimizer analyzes your project data to identify underutilized resources and suggest optimal allocations. It uses machine learning algorithms to predict resource needs and prevent bottlenecks.',
    category: 'features',
    tags: ['ai', 'resources', 'optimization', 'machine-learning', 'allocation'],
    lastUpdated: new Date('2024-01-10'),
    popularity: 87,
    difficulty: 'intermediate'
  },
  {
    id: 'risk-management-setup',
    title: 'Setting Up Risk Management',
    content: 'Risk management helps you identify, assess, and mitigate project risks. Start by defining risk categories, setting up automated alerts, and configuring the risk matrix according to your organization\'s standards.',
    category: 'features',
    tags: ['risk', 'management', 'setup', 'alerts', 'matrix'],
    lastUpdated: new Date('2024-01-12'),
    popularity: 78,
    difficulty: 'intermediate'
  },
  {
    id: 'mobile-gestures',
    title: 'Mobile Touch Gestures',
    content: 'On mobile devices, you can use various touch gestures: swipe left/right on cards for actions, pull down to refresh lists, pinch to zoom on charts, and long press for context menus.',
    category: 'features',
    tags: ['mobile', 'gestures', 'touch', 'swipe', 'pinch', 'zoom'],
    lastUpdated: new Date('2024-01-08'),
    popularity: 65,
    difficulty: 'beginner'
  },
  {
    id: 'troubleshoot-sync-issues',
    title: 'Troubleshooting Sync Issues',
    content: 'If you\'re experiencing sync issues between devices, try these steps: 1) Check your internet connection, 2) Log out and log back in, 3) Clear browser cache, 4) Contact support if issues persist.',
    category: 'troubleshooting',
    tags: ['sync', 'troubleshooting', 'devices', 'connection', 'cache'],
    lastUpdated: new Date('2024-01-05'),
    popularity: 72,
    difficulty: 'beginner'
  },
  {
    id: 'api-authentication',
    title: 'API Authentication',
    content: 'To authenticate with the PPM API, use OAuth 2.0 with PKCE flow. Include the Bearer token in the Authorization header for all requests. Tokens expire after 1 hour and can be refreshed using the refresh token.',
    category: 'api',
    tags: ['api', 'authentication', 'oauth', 'token', 'bearer'],
    lastUpdated: new Date('2024-01-03'),
    popularity: 45,
    difficulty: 'advanced'
  },
  {
    id: 'offline-functionality',
    title: 'Working Offline',
    content: 'The application supports offline functionality through service workers and local storage. Your changes are queued and synchronized when connectivity is restored. Critical features remain available offline.',
    category: 'features',
    tags: ['offline', 'sync', 'service-worker', 'local-storage', 'pwa'],
    lastUpdated: new Date('2024-01-07'),
    popularity: 58,
    difficulty: 'intermediate'
  }
]

// Simple NLP utilities
const INTENT_PATTERNS = {
  'how-to': /^(how\s+(to|do|can)|what\s+is\s+the\s+way|steps?\s+to)/i,
  'what-is': /^(what\s+(is|are)|define|explain|meaning\s+of)/i,
  'troubleshoot': /^(fix|solve|troubleshoot|error|problem|issue|not\s+working)/i,
  'find': /^(find|locate|where\s+(is|are)|search\s+for)/i,
  'compare': /^(compare|difference|vs|versus|better)/i
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'
])

export function useIntelligentDocSearch(): UseIntelligentDocSearchReturn {
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  // Extract keywords from text
  const extractKeywords = useCallback((text: string): string[] => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS.has(word))
  }, [])

  // Calculate relevance score using TF-IDF-like approach
  const calculateRelevance = useCallback((query: string, document: DocumentSection): number => {
    const queryTerms = extractKeywords(query)
    const docTerms = extractKeywords(`${document.title} ${document.content} ${document.tags.join(' ')}`)
    
    if (queryTerms.length === 0) return 0

    let score = 0
    const matchedTerms: string[] = []

    queryTerms.forEach(term => {
      // Exact matches in title get highest score
      if (document.title.toLowerCase().includes(term)) {
        score += 10
        matchedTerms.push(term)
      }
      
      // Matches in tags get high score
      if (document.tags.some(tag => tag.toLowerCase().includes(term))) {
        score += 8
        matchedTerms.push(term)
      }
      
      // Matches in content get medium score
      const contentMatches = (document.content.toLowerCase().match(new RegExp(term, 'g')) || []).length
      score += contentMatches * 2
      if (contentMatches > 0) {
        matchedTerms.push(term)
      }
    })

    // Boost score based on document popularity
    score *= (1 + document.popularity / 100)

    // Penalty for very long documents (prefer concise answers)
    if (document.content.length > 1000) {
      score *= 0.9
    }

    return score
  }, [extractKeywords])

  // Generate snippet with highlighted terms
  const generateSnippet = useCallback((query: string, document: DocumentSection): { snippet: string; highlighted: string } => {
    const queryTerms = extractKeywords(query)
    const content = document.content
    
    // Find the best sentence that contains query terms
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    let bestSentence = sentences[0] || content.substring(0, 150)
    let maxMatches = 0

    sentences.forEach(sentence => {
      const matches = queryTerms.filter(term => 
        sentence.toLowerCase().includes(term.toLowerCase())
      ).length
      
      if (matches > maxMatches) {
        maxMatches = matches
        bestSentence = sentence
      }
    })

    // Truncate if too long
    let snippet = bestSentence.trim()
    if (snippet.length > 200) {
      snippet = snippet.substring(0, 197) + '...'
    }

    // Highlight query terms
    let highlighted = snippet
    queryTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi')
      highlighted = highlighted.replace(regex, '<mark>$1</mark>')
    })

    return { snippet, highlighted }
  }, [extractKeywords])

  // Extract intent from query using simple pattern matching
  const extractIntent = useCallback((query: string) => {
    const entities = extractKeywords(query)
    
    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
      if (pattern.test(query)) {
        return {
          intent: intent as any,
          entities,
          confidence: 0.8
        }
      }
    }

    return {
      intent: 'find' as const,
      entities,
      confidence: 0.6
    }
  }, [extractKeywords])

  // Main search function
  const search = useCallback(async (query: string, filters?: SearchFilters): Promise<SearchResult[]> => {
    setIsSearching(true)
    setSearchQuery(query)

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300))

      let filteredDocs = MOCK_DOCUMENTS

      // Apply filters
      if (filters?.category) {
        filteredDocs = filteredDocs.filter(doc => doc.category === filters.category)
      }
      
      if (filters?.difficulty) {
        filteredDocs = filteredDocs.filter(doc => doc.difficulty === filters.difficulty)
      }
      
      if (filters?.tags && filters.tags.length > 0) {
        filteredDocs = filteredDocs.filter(doc => 
          filters.tags!.some(tag => doc.tags.includes(tag))
        )
      }

      // Calculate relevance and generate results
      const searchResults: SearchResult[] = filteredDocs
        .map(doc => {
          const relevanceScore = calculateRelevance(query, doc)
          const { snippet, highlighted } = generateSnippet(query, doc)
          const matchedTerms = extractKeywords(query).filter(term =>
            doc.title.toLowerCase().includes(term) ||
            doc.content.toLowerCase().includes(term) ||
            doc.tags.some(tag => tag.toLowerCase().includes(term))
          )

          return {
            document: doc,
            relevanceScore,
            matchedTerms,
            snippet,
            highlightedContent: highlighted
          }
        })
        .filter(result => result.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10) // Limit to top 10 results

      setResults(searchResults)
      return searchResults
    } finally {
      setIsSearching(false)
    }
  }, [calculateRelevance, generateSnippet, extractKeywords])

  // Get search suggestions based on partial query
  const getSuggestions = useCallback((partialQuery: string): string[] => {
    if (partialQuery.length < 2) return []

    const suggestions = new Set<string>()
    
    // Add suggestions from document titles and tags
    MOCK_DOCUMENTS.forEach(doc => {
      if (doc.title.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.add(doc.title)
      }
      
      doc.tags.forEach(tag => {
        if (tag.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(`How to use ${tag}`)
          suggestions.add(`${tag} documentation`)
        }
      })
    })

    // Add common query patterns
    const commonPatterns = [
      `How to ${partialQuery}`,
      `What is ${partialQuery}`,
      `${partialQuery} troubleshooting`,
      `${partialQuery} setup guide`
    ]

    commonPatterns.forEach(pattern => {
      if (pattern.toLowerCase() !== partialQuery.toLowerCase()) {
        suggestions.add(pattern)
      }
    })

    return Array.from(suggestions).slice(0, 5)
  }, [])

  // Get related queries based on current query
  const getRelatedQueries = useCallback((query: string): string[] => {
    const intent = extractIntent(query)
    const entities = intent.entities

    const related: string[] = []

    // Generate related queries based on entities
    entities.forEach(entity => {
      if (entity !== query.toLowerCase()) {
        related.push(`How to ${entity}`)
        related.push(`${entity} best practices`)
        related.push(`${entity} troubleshooting`)
      }
    })

    // Add category-based suggestions
    const queryLower = query.toLowerCase()
    if (queryLower.includes('dashboard')) {
      related.push('Customize dashboard widgets', 'Dashboard performance tips')
    }
    if (queryLower.includes('mobile')) {
      related.push('Mobile gestures guide', 'Offline functionality')
    }
    if (queryLower.includes('api')) {
      related.push('API authentication', 'API rate limits')
    }

    return related.slice(0, 4)
  }, [extractIntent])

  // Clear search results
  const clearSearch = useCallback(() => {
    setResults([])
    setSearchQuery('')
  }, [])

  // Track search for analytics
  const trackSearch = useCallback((query: string, resultClicked?: string) => {
    setSearchHistory(prev => {
      const updated = [query, ...prev.filter(q => q !== query)].slice(0, 10)
      return updated
    })
    
    // In a real app, this would send analytics data
    console.log('Search tracked:', { query, resultClicked })
  }, [])

  // Get popular searches
  const getPopularSearches = useCallback((): string[] => {
    // In a real app, this would come from analytics
    return [
      'How to customize dashboard',
      'Resource optimization guide',
      'Mobile gestures',
      'Sync troubleshooting',
      'API authentication'
    ]
  }, [])

  return {
    // Search state
    results,
    isSearching,
    searchQuery,
    
    // Search functions
    search,
    clearSearch,
    
    // NLP features
    getSuggestions,
    getRelatedQueries,
    extractIntent,
    
    // Analytics
    getPopularSearches,
    trackSearch
  }
}

export default useIntelligentDocSearch