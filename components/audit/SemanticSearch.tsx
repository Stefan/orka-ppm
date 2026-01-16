'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Search,
  Loader2,
  AlertCircle,
  Sparkles,
  FileText,
  Clock,
  TrendingUp,
  ChevronRight,
  X,
  Info
} from 'lucide-react'
import { AuditEvent } from './Timeline'

/**
 * Search Result Interface
 */
export interface SearchResult {
  event: AuditEvent
  similarity_score: number
  relevance_explanation: string
}

/**
 * Search Response Interface
 */
export interface SearchResponse {
  query: string
  results: SearchResult[]
  ai_response: string
  sources: Array<{
    event_id: string
    event_type: string
    timestamp: string
  }>
  total_results: number
}

/**
 * Semantic Search Props
 */
export interface SemanticSearchProps {
  onSearch: (query: string) => Promise<SearchResponse>
  loading?: boolean
  className?: string
  placeholder?: string
  maxHeight?: number
}

/**
 * Example queries for user guidance
 */
const EXAMPLE_QUERIES = [
  {
    text: 'Show me all budget changes last week',
    category: 'Financial',
    icon: '💰'
  },
  {
    text: 'Explain this security event',
    category: 'Security',
    icon: '🔒'
  },
  {
    text: 'What resource changes happened yesterday?',
    category: 'Resources',
    icon: '👥'
  },
  {
    text: 'Find all critical risk events this month',
    category: 'Risk',
    icon: '⚠️'
  },
  {
    text: 'Show me permission changes by admin users',
    category: 'Security',
    icon: '🛡️'
  },
  {
    text: 'What compliance actions were taken recently?',
    category: 'Compliance',
    icon: '📋'
  }
]

/**
 * Semantic Search Component
 * 
 * Natural language search interface for audit logs using RAG.
 * Features:
 * - Natural language query input
 * - AI-generated responses
 * - Ranked results with similarity scores
 * - Source references
 * - Related events
 * - Example queries for guidance
 */
const SemanticSearch: React.FC<SemanticSearchProps> = ({
  onSearch,
  loading = false,
  className = '',
  placeholder = 'Ask a question about audit logs...',
  maxHeight = 600
}) => {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Handle search submission
   */
  const handleSearch = useCallback(async () => {
    if (!query.trim() || isSearching) return

    setIsSearching(true)
    setError(null)
    setSearchResults(null)

    try {
      const results = await onSearch(query.trim())
      setSearchResults(results)
    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Failed to perform search')
    } finally {
      setIsSearching(false)
    }
  }, [query, isSearching, onSearch])

  /**
   * Handle example query click
   */
  const handleExampleClick = useCallback((exampleQuery: string) => {
    setQuery(exampleQuery)
    inputRef.current?.focus()
  }, [])

  /**
   * Handle key press (Enter to search)
   */
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }, [handleSearch])

  /**
   * Clear search
   */
  const handleClear = useCallback(() => {
    setQuery('')
    setSearchResults(null)
    setError(null)
    setSelectedResult(null)
    inputRef.current?.focus()
  }, [])

  /**
   * Format similarity score as percentage
   */
  const formatScore = (score: number): string => {
    return `${(score * 100).toFixed(1)}%`
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`} data-testid="semantic-search">
      {/* Search Input Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <Sparkles className="h-6 w-6 text-purple-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">AI-Powered Search</h2>
            <p className="text-sm text-gray-600">Ask questions in natural language</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isSearching}
            className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-500"
            data-testid="search-input"
          />
          
          {/* Clear Button */}
          {query && !isSearching && (
            <button
              onClick={handleClear}
              className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isSearching}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
            data-testid="search-button"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Searching...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span className="text-sm">Search</span>
              </>
            )}
          </button>
        </div>

        {/* Example Queries */}
        {!searchResults && !error && (
          <div className="mt-4">
            <p className="text-xs text-gray-600 mb-2 flex items-center">
              <Info className="h-3 w-3 mr-1" />
              Try these example queries:
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example.text)}
                  disabled={isSearching}
                  className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
                  data-testid={`example-query-${index}`}
                >
                  <span>{example.icon}</span>
                  <span>{example.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">Search Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 text-red-400 hover:text-red-600 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults && (
        <div className="divide-y divide-gray-200" style={{ maxHeight, overflowY: 'auto' }}>
          {/* AI Response Section */}
          <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-start space-x-3">
              <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">AI Analysis</h3>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {searchResults.ai_response}
                </p>
                
                {/* Source References */}
                {searchResults.sources && searchResults.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <p className="text-xs text-gray-600 mb-2 flex items-center">
                      <FileText className="h-3 w-3 mr-1" />
                      Sources ({searchResults.sources.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {searchResults.sources.map((source, index) => (
                        <div
                          key={index}
                          className="px-2 py-1 text-xs bg-white border border-purple-200 rounded text-gray-700"
                        >
                          <span className="font-medium">{source.event_type}</span>
                          <span className="text-gray-500 ml-1">
                            • {new Date(source.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                Relevant Events ({searchResults.total_results})
              </h3>
              <span className="text-xs text-gray-500">
                Sorted by relevance
              </span>
            </div>

            {searchResults.results.length === 0 ? (
              <div className="text-center py-8">
                <Info className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No matching events found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.results.map((result, index) => (
                  <div
                    key={result.event.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => setSelectedResult(result)}
                    data-testid={`search-result-${index}`}
                  >
                    {/* Result Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {result.event.event_type}
                          </h4>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            result.event.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            result.event.severity === 'error' ? 'bg-orange-100 text-orange-700' :
                            result.event.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {result.event.severity}
                          </span>
                          {result.event.is_anomaly && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                              Anomaly
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-gray-600">
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(result.event.timestamp).toLocaleString()}
                          </span>
                          {result.event.user_name && (
                            <span>User: {result.event.user_name}</span>
                          )}
                          {result.event.category && (
                            <span className="px-2 py-0.5 bg-gray-100 rounded">
                              {result.event.category}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Similarity Score */}
                      <div className="flex flex-col items-end ml-4">
                        <div className="flex items-center space-x-1 mb-1">
                          <TrendingUp className="h-3 w-3 text-purple-600" />
                          <span className="text-sm font-semibold text-purple-600">
                            {formatScore(result.similarity_score)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">relevance</span>
                      </div>
                    </div>

                    {/* Relevance Explanation */}
                    {result.relevance_explanation && (
                      <p className="text-sm text-gray-700 mb-2 italic">
                        "{result.relevance_explanation}"
                      </p>
                    )}

                    {/* Event Tags */}
                    {result.event.tags && Object.keys(result.event.tags).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(result.event.tags).slice(0, 3).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                          >
                            {key}: {String(value)}
                          </span>
                        ))}
                        {Object.keys(result.event.tags).length > 3 && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                            +{Object.keys(result.event.tags).length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* View Details Link */}
                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Entity: {result.event.entity_type}
                      </span>
                      <button className="text-xs text-purple-600 hover:text-purple-700 flex items-center">
                        View Details
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isSearching && !searchResults && (
        <div className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-purple-600 animate-spin mb-3" />
          <p className="text-sm text-gray-600">Analyzing audit logs...</p>
          <p className="text-xs text-gray-500 mt-1">This may take a few seconds</p>
        </div>
      )}

      {/* Empty State */}
      {!searchResults && !isSearching && !error && (
        <div className="p-12 text-center">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Search Audit Logs with AI
          </h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Ask questions in natural language and get AI-powered insights from your audit trail.
            Try one of the example queries above to get started.
          </p>
        </div>
      )}

      {/* Selected Result Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {selectedResult.event.event_type}
                </h2>
                <p className="text-sm text-gray-600">
                  Relevance: {formatScore(selectedResult.similarity_score)}
                </p>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Relevance Explanation */}
              {selectedResult.relevance_explanation && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-purple-900 mb-2">
                    Why this event is relevant:
                  </h3>
                  <p className="text-sm text-purple-800">
                    {selectedResult.relevance_explanation}
                  </p>
                </div>
              )}

              {/* Event Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Event Information</h3>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-xs text-gray-600">Timestamp</dt>
                      <dd className="text-sm text-gray-900">
                        {new Date(selectedResult.event.timestamp).toLocaleString()}
                      </dd>
                    </div>
                    {selectedResult.event.user_name && (
                      <div>
                        <dt className="text-xs text-gray-600">User</dt>
                        <dd className="text-sm text-gray-900">{selectedResult.event.user_name}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs text-gray-600">Entity</dt>
                      <dd className="text-sm text-gray-900">{selectedResult.event.entity_type}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-600">Severity</dt>
                      <dd className="text-sm text-gray-900 capitalize">{selectedResult.event.severity}</dd>
                    </div>
                  </dl>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Classification</h3>
                  <dl className="space-y-2">
                    {selectedResult.event.category && (
                      <div>
                        <dt className="text-xs text-gray-600">Category</dt>
                        <dd className="text-sm text-gray-900">{selectedResult.event.category}</dd>
                      </div>
                    )}
                    {selectedResult.event.risk_level && (
                      <div>
                        <dt className="text-xs text-gray-600">Risk Level</dt>
                        <dd className="text-sm text-gray-900">{selectedResult.event.risk_level}</dd>
                      </div>
                    )}
                    {selectedResult.event.is_anomaly && selectedResult.event.anomaly_score && (
                      <div>
                        <dt className="text-xs text-gray-600">Anomaly Score</dt>
                        <dd className="text-sm font-semibold text-red-600">
                          {(selectedResult.event.anomaly_score * 100).toFixed(2)}%
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Action Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Action Details</h3>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(selectedResult.event.action_details, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SemanticSearch
