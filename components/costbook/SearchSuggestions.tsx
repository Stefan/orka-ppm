'use client'

import React from 'react'
import { Search, Sparkles, TrendingUp, AlertTriangle, Filter, ArrowUpDown } from 'lucide-react'
import { exampleQueries } from '@/lib/nl-query-parser'

export interface Suggestion {
  query: string
  description: string
}

export interface SearchSuggestionsProps {
  /** List of suggestions to display */
  suggestions: Suggestion[]
  /** Called when a suggestion is selected */
  onSelect: (query: string) => void
  /** Currently selected index (for keyboard navigation) */
  selectedIndex?: number
  /** Current search query (for highlighting) */
  query?: string
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  'data-testid'?: string
}

/**
 * Get icon for suggestion based on query content
 */
function getSuggestionIcon(query: string): React.ReactNode {
  const lower = query.toLowerCase()
  
  if (lower.includes('budget') || lower.includes('variance')) {
    return <TrendingUp className="w-4 h-4" />
  }
  if (lower.includes('risk') || lower.includes('critical') || lower.includes('health')) {
    return <AlertTriangle className="w-4 h-4" />
  }
  if (lower.includes('status') || lower.includes('vendor') || lower.includes('currency')) {
    return <Filter className="w-4 h-4" />
  }
  if (lower.includes('sort') || lower.includes('order')) {
    return <ArrowUpDown className="w-4 h-4" />
  }
  return <Search className="w-4 h-4" />
}

/**
 * Highlight matching text in a string
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  
  const lower = text.toLowerCase()
  const queryLower = query.toLowerCase()
  const index = lower.indexOf(queryLower)
  
  if (index === -1) return text
  
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-yellow-100 text-yellow-900 rounded px-0.5">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  )
}

/**
 * Search suggestions dropdown component
 */
export function SearchSuggestions({
  suggestions,
  onSelect,
  selectedIndex = -1,
  query = '',
  className = '',
  'data-testid': testId = 'search-suggestions'
}: SearchSuggestionsProps) {
  if (suggestions.length === 0) return null
  
  return (
    <div
      className={`
        absolute z-50 mt-1 w-full
        bg-white border border-gray-200 rounded-lg shadow-lg
        max-h-[300px] overflow-y-auto
        ${className}
      `}
      role="listbox"
      data-testid={testId}
    >
      {/* AI-powered header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Sparkles className="w-3 h-3 text-purple-500" />
          <span>AI-powered suggestions</span>
        </div>
      </div>
      
      {/* Suggestions list */}
      <ul className="py-1">
        {suggestions.map((suggestion, index) => (
          <li key={suggestion.query}>
            <button
              onClick={() => onSelect(suggestion.query)}
              className={`
                w-full px-3 py-2 flex items-start gap-3 text-left
                transition-colors
                ${index === selectedIndex
                  ? 'bg-blue-50 text-blue-900'
                  : 'hover:bg-gray-50 text-gray-700'
                }
              `}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <span className={`
                mt-0.5
                ${index === selectedIndex ? 'text-blue-500' : 'text-gray-400'}
              `}>
                {getSuggestionIcon(suggestion.query)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {highlightMatch(suggestion.query, query)}
                </div>
                <div className={`
                  text-xs truncate
                  ${index === selectedIndex ? 'text-blue-600' : 'text-gray-500'}
                `}>
                  {suggestion.description}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      
      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>↑↓ to navigate</span>
          <span>Enter to select</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Empty state component when no results match
 */
export interface NoResultsProps {
  /** The search query that returned no results */
  query: string
  /** Called when a suggestion is selected */
  onSuggestionSelect?: (query: string) => void
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  'data-testid'?: string
}

export function NoResults({
  query,
  onSuggestionSelect,
  className = '',
  'data-testid': testId = 'no-results'
}: NoResultsProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center
        py-12 px-6 text-center
        ${className}
      `}
      data-testid={testId}
    >
      <div className="w-16 h-16 mb-4 flex items-center justify-center bg-gray-100 rounded-full">
        <Search className="w-8 h-8 text-gray-400" />
      </div>
      
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No results found
      </h3>
      
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        No projects match "{query}". Try a different search or use one of the suggestions below.
      </p>
      
      {/* Example queries */}
      <div className="w-full max-w-md">
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
          Try these searches
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {exampleQueries.slice(0, 6).map((example) => (
            <button
              key={example.query}
              onClick={() => onSuggestionSelect?.(example.query)}
              className="
                px-3 py-2 text-left text-sm
                bg-gray-50 hover:bg-gray-100
                border border-gray-200 rounded-lg
                transition-colors
              "
            >
              <div className="font-medium text-gray-700 truncate">
                {example.query}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {example.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Search help panel showing all available query types
 */
export interface SearchHelpProps {
  /** Called when an example is clicked */
  onExampleClick?: (query: string) => void
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  'data-testid'?: string
}

export function SearchHelp({
  onExampleClick,
  className = '',
  'data-testid': testId = 'search-help'
}: SearchHelpProps) {
  const categories = [
    {
      title: 'Budget & Variance',
      icon: <TrendingUp className="w-4 h-4" />,
      examples: [
        { query: 'over budget', description: 'Projects exceeding budget' },
        { query: 'under budget', description: 'Projects within budget' },
        { query: 'high variance', description: 'Projects with unusual variance' },
        { query: 'variance > 50000', description: 'Specific variance threshold' },
      ]
    },
    {
      title: 'Health & Status',
      icon: <AlertTriangle className="w-4 h-4" />,
      examples: [
        { query: 'at risk', description: 'Low health score projects' },
        { query: 'healthy', description: 'Good health score projects' },
        { query: 'status active', description: 'Only active projects' },
        { query: 'health < 50', description: 'Specific health threshold' },
      ]
    },
    {
      title: 'Filters & Sorting',
      icon: <Filter className="w-4 h-4" />,
      examples: [
        { query: 'budget > 100k', description: 'Large budget projects' },
        { query: 'vendor Acme', description: 'Filter by vendor' },
        { query: 'sort by variance desc', description: 'Sort by field' },
        { query: 'in EUR', description: 'Filter by currency' },
      ]
    },
  ]
  
  return (
    <div
      className={`
        bg-white border border-gray-200 rounded-lg
        p-4
        ${className}
      `}
      data-testid={testId}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <h3 className="font-medium text-gray-900">AI Search Guide</h3>
      </div>
      
      <p className="text-sm text-gray-500 mb-4">
        Use natural language to search and filter projects. Here are some examples:
      </p>
      
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category.title}>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <span className="text-gray-400">{category.icon}</span>
              {category.title}
            </div>
            <div className="grid grid-cols-2 gap-1.5 pl-6">
              {category.examples.map((example) => (
                <button
                  key={example.query}
                  onClick={() => onExampleClick?.(example.query)}
                  className="
                    px-2 py-1.5 text-left text-xs
                    bg-gray-50 hover:bg-gray-100
                    rounded transition-colors
                    group
                  "
                >
                  <span className="font-medium text-gray-700 group-hover:text-blue-600">
                    {example.query}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Tip: Combine queries for more specific results, e.g., "active budget &gt; 50k"
        </p>
      </div>
    </div>
  )
}

export default SearchSuggestions
