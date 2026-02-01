'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, Sparkles, ChevronDown } from 'lucide-react'
import {
  parseNLQuery,
  getAutocompleteSuggestions,
  ParseResult,
  FilterCriteria
} from '@/lib/nl-query-parser'
import { SearchSuggestions } from './SearchSuggestions'

export interface NLSearchInputProps {
  /** Current search query */
  value: string
  /** Called when search query changes */
  onChange: (query: string) => void
  /** Called when filter criteria are parsed */
  onFilterChange?: (criteria: FilterCriteria, parseResult: ParseResult) => void
  /** Placeholder text */
  placeholder?: string
  /** Show AI-powered badge */
  showAiBadge?: boolean
  /** Additional CSS classes */
  className?: string
  /** Disabled state */
  disabled?: boolean
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Test ID */
  'data-testid'?: string
}

/**
 * Natural Language Search Input component
 * Provides intelligent search with autocomplete and filter interpretation
 */
export function NLSearchInput({
  value,
  onChange,
  onFilterChange,
  placeholder = 'Search projects... (e.g., "over budget", "high variance")',
  showAiBadge = true,
  className = '',
  disabled = false,
  autoFocus = false,
  'data-testid': testId = 'nl-search-input'
}: NLSearchInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [suggestions, setSuggestions] = useState<Array<{ query: string; description: string }>>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Parse query when value changes
  useEffect(() => {
    const result = parseNLQuery(value)
    setParseResult(result)
    
    if (onFilterChange) {
      onFilterChange(result.criteria, result)
    }
  }, [value, onFilterChange])
  
  // Update suggestions when value changes
  useEffect(() => {
    const newSuggestions = getAutocompleteSuggestions(value, 6)
    setSuggestions(newSuggestions)
    setSelectedSuggestionIndex(-1)
  }, [value])
  
  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    setShowSuggestions(true)
  }, [onChange])
  
  const handleClear = useCallback(() => {
    onChange('')
    inputRef.current?.focus()
    setShowSuggestions(false)
  }, [onChange])
  
  const handleFocus = useCallback(() => {
    setIsFocused(true)
    setShowSuggestions(true)
  }, [])
  
  const handleBlur = useCallback(() => {
    setIsFocused(false)
    // Delay hiding suggestions to allow click on them
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false)
      }
    }, 200)
  }, [])
  
  const handleSuggestionSelect = useCallback((query: string) => {
    onChange(query)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }, [onChange])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault()
          handleSuggestionSelect(suggestions[selectedSuggestionIndex].query)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
        break
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, handleSuggestionSelect])
  
  const hasValue = value.length > 0
  const hasFilters = parseResult && Object.keys(parseResult.criteria).length > 0
  
  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      data-testid={testId}
    >
      {/* Input container */}
      <div
        className={`
          flex items-center gap-2
          bg-white border rounded-lg
          transition-all duration-200
          ${isFocused 
            ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}
        `}
      >
        {/* Search icon */}
        <div className="pl-3 text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`
            flex-1 py-2 pr-2
            text-sm text-gray-900
            placeholder-gray-400
            bg-transparent
            outline-none
            ${disabled ? 'cursor-not-allowed' : ''}
          `}
          aria-label="Search projects"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
          role="combobox"
        />
        
        {/* AI Badge */}
        {showAiBadge && !hasValue && (
          <div className="flex items-center gap-1 px-2 py-1 mr-1 text-xs font-medium text-purple-600 bg-purple-50 rounded-full">
            <Sparkles className="w-3 h-3" />
            <span>AI</span>
          </div>
        )}
        
        {/* Clear button */}
        {hasValue && (
          <button
            onClick={handleClear}
            className="p-1 mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Clear search"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Filter interpretation chips */}
      {hasValue && parseResult && parseResult.patterns.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {parseResult.patterns.map((pattern, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full"
            >
              {pattern}
            </span>
          ))}
          {parseResult.confidence < 0.5 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
              Low confidence
            </span>
          )}
        </div>
      )}
      
      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <SearchSuggestions
          suggestions={suggestions}
          onSelect={handleSuggestionSelect}
          selectedIndex={selectedSuggestionIndex}
          query={value}
        />
      )}
    </div>
  )
}

/**
 * Compact version of NLSearchInput for mobile/header use
 */
export function CompactNLSearchInput({
  value,
  onChange,
  onFilterChange,
  placeholder = 'Search...',
  className = '',
  disabled = false,
  'data-testid': testId = 'compact-nl-search'
}: Omit<NLSearchInputProps, 'showAiBadge' | 'autoFocus'>) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`
          p-2 text-gray-500 hover:text-gray-700
          hover:bg-gray-100 rounded-lg
          transition-colors
          ${className}
        `}
        aria-label="Open search"
        data-testid={testId}
      >
        <Search className="w-5 h-5" />
      </button>
    )
  }
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <NLSearchInput
        value={value}
        onChange={onChange}
        onFilterChange={onFilterChange}
        placeholder={placeholder}
        showAiBadge={false}
        disabled={disabled}
        autoFocus
        className="flex-1 min-w-[200px]"
        data-testid={testId}
      />
      <button
        onClick={() => {
          setIsExpanded(false)
          onChange('')
        }}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Close search"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default NLSearchInput
