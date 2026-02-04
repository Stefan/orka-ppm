'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, Sparkles, ChevronDown, Mic, MicOff } from 'lucide-react'
import {
  parseNLQuery,
  getAutocompleteSuggestions,
  getSimilarSearches,
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
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<{ stop: () => void; start: () => void } | null>(null)
  
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

  const startVoiceSearch = useCallback(() => {
    setVoiceError(null)
    const win = typeof window !== 'undefined' ? window : null
    type RecInstance = { start: () => void; stop: () => void; onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void; onerror: () => void; onend: () => void; continuous?: boolean; interimResults?: boolean; lang?: string }
    const SpeechRecognition = win && ((win as unknown as { webkitSpeechRecognition?: new () => RecInstance }).webkitSpeechRecognition ?? (win as unknown as { SpeechRecognition?: new () => RecInstance }).SpeechRecognition)
    if (!SpeechRecognition) {
      setVoiceError('Voice not supported')
      return
    }
    try {
      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US'
      rec.onresult = (e: { results: Array<Array<{ transcript: string }>> }) => {
        const transcript = (e.results?.[0]?.[0]?.transcript ?? '').trim()
        if (transcript) {
          const result = parseNLQuery(transcript)
          onChange(transcript)
          onFilterChange?.(result.criteria, result)
        }
        setIsListening(false)
        recognitionRef.current = null
      }
      rec.onerror = () => {
        setIsListening(false)
        setVoiceError('Voice input failed')
        recognitionRef.current = null
      }
      rec.onend = () => {
        setIsListening(false)
        recognitionRef.current = null
      }
      recognitionRef.current = rec
      rec.start()
      setIsListening(true)
    } catch {
      setVoiceError('Could not start voice')
      setIsListening(false)
    }
  }, [onChange, onFilterChange])

  const similarSearches = value.trim() ? getSimilarSearches(value, 3) : []
  
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
          bg-white dark:bg-slate-800 border rounded-lg
          transition-all duration-200
          ${isFocused 
            ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900 shadow-sm' 
            : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-slate-700' : ''}
        `}
      >
        {/* Search icon */}
        <div className="pl-3 text-gray-400 dark:text-slate-500">
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
            text-sm text-gray-900 dark:text-slate-100
            placeholder-gray-400 dark:placeholder-slate-500
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
          <div className="flex items-center gap-1 px-2 py-1 mr-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded-full">
            <Sparkles className="w-3 h-3" />
            <span>AI</span>
          </div>
        )}
        
        {/* Voice search */}
        {typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
          <button
            type="button"
            onClick={startVoiceSearch}
            disabled={isListening}
            className={`p-1.5 mr-1 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-600' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            aria-label={isListening ? 'Listening...' : 'Voice search'}
            title={voiceError || (isListening ? 'Listening...' : 'Search by voice')}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
        {/* Clear button */}
        {hasValue && (
          <button
            onClick={handleClear}
            className="p-1 mr-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Clear search"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {voiceError && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{voiceError}</p>
      )}
      
      {/* Filter interpretation chips */}
      {hasValue && parseResult && parseResult.patterns.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {parseResult.patterns.map((pattern, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 rounded-full"
            >
              {pattern}
            </span>
          ))}
          {parseResult.confidence < 0.5 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 rounded-full">
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

      {/* Similar searches (Ähnliche Suchen) */}
      {hasValue && similarSearches.length > 0 && (
        <div className="mt-2 px-1">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Similar searches</p>
          <div className="flex flex-wrap gap-1">
            {similarSearches.map((s) => (
              <button
                key={s.query}
                type="button"
                onClick={() => handleSuggestionSelect(s.query)}
                className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                {s.query}
              </button>
            ))}
          </div>
        </div>
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
          p-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200
          hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg
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
        className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        aria-label="Close search"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default NLSearchInput
