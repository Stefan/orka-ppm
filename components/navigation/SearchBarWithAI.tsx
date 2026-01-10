'use client'

import React, { useRef, useEffect } from 'react'
import { 
  Search, 
  Clock, 
  TrendingUp, 
  Zap, 
  ArrowRight,
  Hash,
  FileText,
  HelpCircle,
  Navigation
} from 'lucide-react'
import { useIntelligentSearch } from '../hooks/useIntelligentSearch'
import { highlightMatch } from '../utils/fuzzySearch'
import type { SearchResult, SearchSuggestion } from '../types/search'

interface SearchBarWithAIProps {
  placeholder?: string
  className?: string
  onClose?: () => void
  autoFocus?: boolean
}

const CATEGORY_ICONS = {
  navigation: Navigation,
  feature: Zap,
  content: FileText,
  help: HelpCircle
} as const

const SUGGESTION_ICONS = {
  recent: Clock,
  popular: TrendingUp,
  ai_suggested: Zap
} as const

export default function SearchBarWithAI({
  placeholder = "Search features, pages, or get help...",
  className = "",
  onClose,
  autoFocus = false
}: SearchBarWithAIProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const {
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
    getSearchInsights,
    setIsOpen
  } = useIntelligentSearch()

  // Auto-focus input when component mounts
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        if (onClose) onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    return undefined
  }, [isOpen, onClose, setIsOpen])

  const renderSearchSuggestion = (suggestion: SearchSuggestion, index: number) => {
    const Icon = SUGGESTION_ICONS[suggestion.type]
    const isSelected = index === selectedIndex
    
    return (
      <button
        key={`suggestion-${index}`}
        className={`
          w-full flex items-center px-4 py-3 text-left hover:bg-gray-50 transition-colors
          ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
          min-h-[44px] touch-manipulation
        `}
        onClick={() => handleSelectSuggestion(suggestion)}
        onMouseEnter={() => {/* setSelectedIndex(index) */}}
      >
        <Icon className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-700 truncate block">
            {suggestion.query}
          </span>
          <span className="text-xs text-gray-500 capitalize">
            {suggestion.type === 'ai_suggested' ? 'AI Suggestion' : 
             suggestion.type === 'recent' ? 'Recent' : 'Popular'}
            {suggestion.frequency && ` • ${suggestion.frequency} searches`}
          </span>
        </div>
        <ArrowRight className="h-3 w-3 text-gray-400 ml-2 flex-shrink-0" />
      </button>
    )
  }

  const renderSearchResult = (result: SearchResult, index: number) => {
    const Icon = result.icon || CATEGORY_ICONS[result.category]
    const actualIndex = searchSuggestions.length + index
    const isSelected = actualIndex === selectedIndex
    
    return (
      <button
        key={result.id}
        className={`
          w-full flex items-start px-4 py-3 text-left hover:bg-gray-50 transition-colors
          ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
          min-h-[44px] touch-manipulation
        `}
        onClick={() => handleSelectResult(result)}
        onMouseEnter={() => {/* setSelectedIndex(actualIndex) */}}
      >
        <Icon className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div 
            className="text-sm font-medium text-gray-900 truncate"
            dangerouslySetInnerHTML={{ 
              __html: highlightMatch(result.title, query) 
            }}
          />
          <div 
            className="text-xs text-gray-500 line-clamp-2 mt-1"
            dangerouslySetInnerHTML={{ 
              __html: highlightMatch(result.description, query) 
            }}
          />
          <div className="flex items-center mt-1">
            <span className="text-xs text-blue-600 capitalize bg-blue-50 px-2 py-0.5 rounded">
              {result.category}
            </span>
            {result.relevanceScore > 0.8 && (
              <span className="text-xs text-green-600 ml-2">
                Excellent match
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }

  const insights = getSearchInsights()
  const hasResults = searchResults.length > 0 || searchSuggestions.length > 0

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(query.trim().length > 0)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`
            w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            placeholder-gray-500 text-sm
            min-h-[44px] touch-manipulation
            ${isOpen ? 'rounded-b-none border-b-0' : ''}
          `}
          aria-label="Search features and pages"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
        />
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 border-t-0 rounded-b-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* AI Insights */}
          {insights.length > 0 && !query.trim() && (
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
              <div className="flex items-center mb-2">
                <Zap className="h-4 w-4 text-blue-500 mr-2" />
                <span className="text-sm font-medium text-blue-700">
                  Search Insights
                </span>
              </div>
              <div className="space-y-1">
                {insights.map((insight, index) => (
                  <div key={index} className="text-xs text-blue-600">
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Suggestions */}
          {searchSuggestions.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-4 py-2 bg-gray-50">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Suggestions
                </span>
              </div>
              {searchSuggestions.map(renderSearchSuggestion)}
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Results ({searchResults.length})
                </span>
              </div>
              {searchResults.map(renderSearchResult)}
            </div>
          )}

          {/* No Results */}
          {query.trim() && !hasResults && (
            <div className="px-4 py-8 text-center">
              <Search className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">
                No results found for "{query}"
              </p>
              <p className="text-xs text-gray-400">
                Try different keywords or check spelling
              </p>
            </div>
          )}

          {/* Empty State */}
          {!query.trim() && !hasResults && insights.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Search className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">
                Start typing to search
              </p>
              <p className="text-xs text-gray-400">
                Find features, pages, or get help
              </p>
            </div>
          )}

          {/* Keyboard Shortcuts Hint */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Use ↑↓ to navigate, Enter to select, Esc to close</span>
              <div className="flex items-center space-x-2">
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">⌘K</kbd>
                <span>to search</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}