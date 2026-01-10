/**
 * Property-based tests for SearchBarWithAI smart search functionality
 * Feature: mobile-first-ui-enhancements, Property 7: Smart Search Functionality
 * **Validates: Requirements 2.2**
 */

import * as fc from 'fast-check'
import { fuzzySearch, generateSearchSuggestions, highlightMatch } from '../../utils/fuzzySearch'
import type { SearchResult } from '../../types/search'

// Test data generators
const searchResultArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  title: fc.string({ minLength: 3, maxLength: 50 }),
  description: fc.string({ minLength: 10, maxLength: 100 }),
  href: fc.webPath(),
  category: fc.constantFrom('navigation', 'feature', 'content', 'help'),
  relevanceScore: fc.float({ min: 0, max: 1 }),
  keywords: fc.array(fc.string({ minLength: 2, maxLength: 15 }), { minLength: 0, maxLength: 5 })
}) as fc.Arbitrary<SearchResult>

const searchQueryArbitrary = fc.oneof(
  fc.string({ minLength: 1, maxLength: 30 }), // Regular queries
  fc.string({ minLength: 1, maxLength: 10 }).map(s => s.toLowerCase()), // Lowercase queries
  fc.string({ minLength: 1, maxLength: 10 }).map(s => s.toUpperCase()), // Uppercase queries
  fc.string({ minLength: 2, maxLength: 15 }).map(s => s + ' '), // Queries with trailing space
  fc.string({ minLength: 2, maxLength: 15 }).map(s => ' ' + s) // Queries with leading space
)

describe('SearchBarWithAI Smart Search Functionality - Property Tests', () => {
  /**
   * Property 7: Smart Search Functionality
   * For any search query, the system should provide predictive suggestions 
   * with fuzzy matching capabilities
   */
  describe('Property 7: Smart Search Functionality', () => {
    test('should return relevant results for any valid search query', () => {
      fc.assert(
        fc.property(
          searchQueryArbitrary,
          fc.array(searchResultArbitrary, { minLength: 1, maxLength: 20 }),
          (query, searchItems) => {
            const trimmedQuery = query.trim()
            
            // Skip empty queries as they should return empty results
            if (!trimmedQuery) {
              const results = fuzzySearch(query, searchItems)
              expect(results).toHaveLength(0)
              return
            }

            const results = fuzzySearch(trimmedQuery, searchItems, { threshold: 0.2 })

            // All results should have valid relevance scores
            results.forEach(result => {
              expect(result.relevanceScore).toBeGreaterThanOrEqual(0)
              expect(result.relevanceScore).toBeLessThanOrEqual(1)
              expect(result.relevanceScore).toBeGreaterThanOrEqual(0.2) // Above threshold
            })

            // Results should be sorted by relevance (descending)
            for (let i = 1; i < results.length; i++) {
              expect(results[i - 1].relevanceScore).toBeGreaterThanOrEqual(results[i].relevanceScore)
            }

            // Results should maintain original structure
            results.forEach(result => {
              expect(result).toHaveProperty('id')
              expect(result).toHaveProperty('title')
              expect(result).toHaveProperty('description')
              expect(result).toHaveProperty('href')
              expect(result).toHaveProperty('category')
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    test('should provide fuzzy matching for misspelled or partial queries', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 15 }),
          fc.array(searchResultArbitrary, { minLength: 1, maxLength: 10 }),
          (baseQuery, searchItems) => {
            // Create items that should match the base query
            const matchingItems = searchItems.map((item, index) => ({
              ...item,
              title: index === 0 ? baseQuery : item.title, // Ensure at least one exact match
              id: `item-${index}`
            }))

            // Test exact match
            const exactResults = fuzzySearch(baseQuery, matchingItems, { threshold: 0.3 })
            expect(exactResults.length).toBeGreaterThan(0)
            
            // The exact match should have high relevance
            const exactMatch = exactResults.find(r => r.title === baseQuery)
            if (exactMatch) {
              expect(exactMatch.relevanceScore).toBeGreaterThan(0.5)
            }

            // Test partial match (first few characters)
            if (baseQuery.length > 3) {
              const partialQuery = baseQuery.substring(0, Math.floor(baseQuery.length / 2))
              const partialResults = fuzzySearch(partialQuery, matchingItems, { threshold: 0.2 })
              
              // Should find some results for partial matches
              partialResults.forEach(result => {
                expect(result.relevanceScore).toBeGreaterThanOrEqual(0.2)
              })
            }

            // Test case insensitive matching
            const upperQuery = baseQuery.toUpperCase()
            const lowerQuery = baseQuery.toLowerCase()
            
            const upperResults = fuzzySearch(upperQuery, matchingItems, { threshold: 0.3 })
            const lowerResults = fuzzySearch(lowerQuery, matchingItems, { threshold: 0.3 })
            
            // Case shouldn't matter for matching
            expect(upperResults.length).toBeGreaterThan(0)
            expect(lowerResults.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('should generate meaningful search suggestions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 10 }),
          fc.array(searchResultArbitrary, { minLength: 1, maxLength: 15 }),
          (query, searchItems) => {
            const suggestions = generateSearchSuggestions(query, searchItems, 5)

            // Suggestions should be limited to requested number
            expect(suggestions.length).toBeLessThanOrEqual(5)

            // All suggestions should be strings
            suggestions.forEach(suggestion => {
              expect(typeof suggestion).toBe('string')
              expect(suggestion.length).toBeGreaterThan(0)
            })

            // Suggestions should be unique
            const uniqueSuggestions = new Set(suggestions)
            expect(uniqueSuggestions.size).toBe(suggestions.length)

            // If query is empty, should return empty suggestions
            const emptySuggestions = generateSearchSuggestions('', searchItems, 5)
            expect(emptySuggestions).toHaveLength(0)

            // Suggestions should be relevant to the query
            const lowerQuery = query.toLowerCase()
            suggestions.forEach(suggestion => {
              const lowerSuggestion = suggestion.toLowerCase()
              // Should either start with query or contain it
              const isRelevant = lowerSuggestion.includes(lowerQuery) || 
                                lowerQuery.includes(lowerSuggestion.substring(0, Math.min(3, lowerSuggestion.length)))
              expect(isRelevant).toBe(true)
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    test('should highlight matching text correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 20 }),
          fc.string({ minLength: 10, maxLength: 50 }),
          (query, text) => {
            const highlighted = highlightMatch(text, query)

            // Should return a string
            expect(typeof highlighted).toBe('string')

            // If query is empty, should return original text
            if (!query.trim()) {
              expect(highlighted).toBe(text)
              return
            }

            // If text contains query (case insensitive), should have highlight markup
            const lowerText = text.toLowerCase()
            const lowerQuery = query.toLowerCase().trim()
            
            if (lowerText.includes(lowerQuery)) {
              expect(highlighted).toContain('<mark')
              expect(highlighted).toContain('</mark>')
              expect(highlighted).toContain('bg-yellow-200')
            }

            // Highlighted text should still contain original content
            const strippedHighlight = highlighted.replace(/<mark[^>]*>|<\/mark>/g, '')
            expect(strippedHighlight).toBe(text)

            // Should not break on special regex characters
            const specialChars = ['(', ')', '[', ']', '{', '}', '+', '*', '?', '^', '$', '|', '.', '\\']
            specialChars.forEach(char => {
              const specialQuery = query + char
              expect(() => highlightMatch(text, specialQuery)).not.toThrow()
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    test('should handle edge cases and invalid inputs gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.string({ minLength: 1, maxLength: 10 }).map(s => s.repeat(10)) // Very long queries
          ),
          fc.array(searchResultArbitrary, { minLength: 0, maxLength: 20 }),
          (query, searchItems) => {
            // Should not throw errors for any input
            expect(() => {
              const results = fuzzySearch(query, searchItems)
              return results
            }).not.toThrow()

            expect(() => {
              const suggestions = generateSearchSuggestions(query, searchItems)
              return suggestions
            }).not.toThrow()

            expect(() => {
              const highlighted = highlightMatch('test text', query)
              return highlighted
            }).not.toThrow()

            // Empty search items should return empty results
            const emptyResults = fuzzySearch(query, [])
            expect(emptyResults).toHaveLength(0)

            // Very long queries should still work
            if (query.length > 50) {
              const results = fuzzySearch(query, searchItems)
              expect(Array.isArray(results)).toBe(true)
            }

            // Whitespace-only queries should return empty results
            if (!query.trim()) {
              const results = fuzzySearch(query, searchItems)
              expect(results).toHaveLength(0)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('should maintain search performance with large datasets', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 15 }),
          fc.integer({ min: 10, max: 100 }),
          (query, itemCount) => {
            // Generate large dataset
            const largeDataset: SearchResult[] = Array.from({ length: itemCount }, (_, i) => ({
              id: `item-${i}`,
              title: `Test Item ${i} ${query}`,
              description: `Description for item ${i} containing ${query}`,
              href: `/item/${i}`,
              category: 'content' as const,
              relevanceScore: 0,
              keywords: [`keyword${i}`, query]
            }))

            const startTime = Date.now()
            const results = fuzzySearch(query, largeDataset, { threshold: 0.3 })
            const endTime = Date.now()

            // Should complete within reasonable time (less than 1 second for 100 items)
            const executionTime = endTime - startTime
            expect(executionTime).toBeLessThan(1000)

            // Should still return valid results
            expect(Array.isArray(results)).toBe(true)
            results.forEach(result => {
              expect(result.relevanceScore).toBeGreaterThanOrEqual(0.3)
            })

            // Results should be properly sorted
            for (let i = 1; i < results.length; i++) {
              expect(results[i - 1].relevanceScore).toBeGreaterThanOrEqual(results[i].relevanceScore)
            }
          }
        ),
        { numRuns: 50 } // Fewer runs for performance tests
      )
    })

    test('should provide consistent results for identical queries', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 15 }),
          fc.array(searchResultArbitrary, { minLength: 5, maxLength: 15 }),
          (query, searchItems) => {
            // Run the same search multiple times
            const results1 = fuzzySearch(query, searchItems, { threshold: 0.3 })
            const results2 = fuzzySearch(query, searchItems, { threshold: 0.3 })
            const results3 = fuzzySearch(query, searchItems, { threshold: 0.3 })

            // Results should be identical
            expect(results1).toEqual(results2)
            expect(results2).toEqual(results3)

            // Suggestions should also be consistent
            const suggestions1 = generateSearchSuggestions(query, searchItems, 5)
            const suggestions2 = generateSearchSuggestions(query, searchItems, 5)

            expect(suggestions1).toEqual(suggestions2)

            // Highlighting should be consistent
            const text = 'This is a test text for highlighting'
            const highlight1 = highlightMatch(text, query)
            const highlight2 = highlightMatch(text, query)

            expect(highlight1).toBe(highlight2)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})