/**
 * Search types for intelligent search functionality
 */

import React from 'react'

export interface SearchResult {
  id: string
  title: string
  description: string
  href: string
  category: 'navigation' | 'feature' | 'content' | 'help'
  relevanceScore: number
  icon?: React.ComponentType<{ className?: string }>
  keywords?: string[]
}

export interface SearchSuggestion {
  query: string
  type: 'recent' | 'popular' | 'ai_suggested'
  frequency?: number
  lastUsed?: Date
}

export interface SearchAnalytics {
  userId: string
  recentSearches: string[]
  popularSearches: { query: string; count: number }[]
  searchPatterns: {
    timeOfDay: Record<string, number>
    categories: Record<string, number>
  }
  lastUpdated: Date
}

export interface FuzzyMatchOptions {
  threshold: number
  includeScore: boolean
  keys: string[]
}