/**
 * Fuzzy search utilities for intelligent search functionality
 */

import type { SearchResult, FuzzyMatchOptions } from '../types/search'

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0))

  for (let i = 0; i <= str1.length; i++) {
    matrix[0]![i] = i
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j]![0] = j
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j]![i] = Math.min(
        matrix[j]![i - 1]! + 1, // deletion
        matrix[j - 1]![i]! + 1, // insertion
        matrix[j - 1]![i - 1]! + indicator // substitution
      )
    }
  }

  return matrix[str2.length]![str1.length]!
}

/**
 * Calculate similarity score between two strings (0-1, where 1 is exact match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const distance = levenshteinDistance(longer, shorter)
  return (longer.length - distance) / longer.length
}

/**
 * Check if query matches text with fuzzy logic
 */
function fuzzyMatch(query: string, text: string, threshold: number = 0.6): boolean {
  const normalizedQuery = query.toLowerCase().trim()
  const normalizedText = text.toLowerCase().trim()
  
  // Skip empty queries
  if (!normalizedQuery) return false
  
  // Exact match
  if (normalizedText.includes(normalizedQuery)) return true
  
  // Word-by-word fuzzy matching
  const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0)
  const textWords = normalizedText.split(/\s+/).filter(word => word.length > 0)
  
  if (queryWords.length === 0 || textWords.length === 0) return false
  
  let matchedWords = 0
  
  for (const queryWord of queryWords) {
    for (const textWord of textWords) {
      if (calculateSimilarity(queryWord, textWord) >= threshold) {
        matchedWords++
        break
      }
    }
  }
  
  return matchedWords / queryWords.length >= threshold
}

/**
 * Calculate relevance score for a search result
 */
function calculateRelevanceScore(query: string, result: SearchResult): number {
  const normalizedQuery = query.toLowerCase().trim()
  
  // Skip empty queries
  if (!normalizedQuery) return 0
  
  let score = 0
  
  // Title match (highest weight)
  const titleSimilarity = calculateSimilarity(normalizedQuery, result.title.toLowerCase())
  score += titleSimilarity * 0.5
  
  // Description match
  const descriptionSimilarity = calculateSimilarity(normalizedQuery, result.description.toLowerCase())
  score += descriptionSimilarity * 0.3
  
  // Keywords match
  if (result.keywords && result.keywords.length > 0) {
    const keywordMatches = result.keywords.filter(keyword => 
      fuzzyMatch(normalizedQuery, keyword, 0.7)
    ).length
    score += (keywordMatches / result.keywords.length) * 0.2
  }
  
  // Exact substring matches get bonus
  if (result.title.toLowerCase().includes(normalizedQuery)) {
    score += 0.2
  }
  if (result.description.toLowerCase().includes(normalizedQuery)) {
    score += 0.1
  }
  
  return Math.min(score, 1.0)
}

/**
 * Perform fuzzy search on a collection of search results
 */
export function fuzzySearch(
  query: string,
  items: SearchResult[],
  options: Partial<FuzzyMatchOptions> = {}
): SearchResult[] {
  const {
    threshold = 0.3,
    includeScore = true
  } = options
  
  if (!query.trim()) return []
  
  const results = items
    .map(item => {
      const relevanceScore = calculateRelevanceScore(query, item)
      return {
        ...item,
        relevanceScore: includeScore ? relevanceScore : item.relevanceScore
      }
    })
    .filter(item => item.relevanceScore >= threshold)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
  
  return results
}

/**
 * Generate search suggestions based on query
 */
export function generateSearchSuggestions(
  query: string,
  items: SearchResult[],
  maxSuggestions: number = 5
): string[] {
  if (!query.trim()) return []
  
  const normalizedQuery = query.toLowerCase().trim()
  const suggestions = new Set<string>()
  
  // Add exact matches and partial matches
  items.forEach(item => {
    const title = item.title.toLowerCase()
    const description = item.description.toLowerCase()
    
    // Add title if it starts with query
    if (title.startsWith(normalizedQuery)) {
      suggestions.add(item.title)
    }
    
    // Add words that start with query
    const allWords = [...title.split(/\s+/), ...description.split(/\s+/)]
    allWords.forEach(word => {
      if (word.startsWith(normalizedQuery) && word.length > normalizedQuery.length) {
        suggestions.add(word)
      }
    })
    
    // Add keywords that match
    if (item.keywords) {
      item.keywords.forEach(keyword => {
        if (keyword.toLowerCase().startsWith(normalizedQuery)) {
          suggestions.add(keyword)
        }
      })
    }
  })
  
  return Array.from(suggestions).slice(0, maxSuggestions)
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Highlight matching text in search results
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text
  
  const normalizedQuery = query.toLowerCase().trim()
  const escapedQuery = escapeRegExp(normalizedQuery)
  
  try {
    const regex = new RegExp(`(${escapedQuery})`, 'gi')
    return text.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">$1</mark>')
  } catch (error) {
    // If regex still fails, return original text
    console.warn('Failed to create regex for highlighting:', error)
    return text
  }
}