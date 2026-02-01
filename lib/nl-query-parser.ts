// Costbook Natural Language Query Parser
// Phase 2: AI-powered search functionality

import { ProjectStatus, Currency } from '@/types/costbook'

/**
 * Filter criteria extracted from natural language queries
 */
export interface FilterCriteria {
  /** Text to search in project names/descriptions */
  textSearch?: string
  /** Filter by project status */
  status?: ProjectStatus[]
  /** Filter by vendor name */
  vendorName?: string
  /** Minimum budget threshold */
  budgetMin?: number
  /** Maximum budget threshold */
  budgetMax?: number
  /** Filter projects over budget */
  overBudget?: boolean
  /** Filter projects under budget */
  underBudget?: boolean
  /** Minimum variance (positive = under budget) */
  varianceMin?: number
  /** Maximum variance (negative = over budget) */
  varianceMax?: number
  /** Minimum health score (0-100) */
  healthMin?: number
  /** Maximum health score (0-100) */
  healthMax?: number
  /** Filter by high variance (outliers) */
  highVariance?: boolean
  /** Filter by low health */
  lowHealth?: boolean
  /** Filter by currency */
  currency?: Currency
  /** Sort field */
  sortBy?: 'name' | 'budget' | 'variance' | 'health' | 'spend'
  /** Sort direction */
  sortDirection?: 'asc' | 'desc'
}

/**
 * Result of parsing a natural language query
 */
export interface ParseResult {
  /** Extracted filter criteria */
  criteria: FilterCriteria
  /** Human-readable interpretation of the query */
  interpretation: string
  /** Confidence score (0-1) */
  confidence: number
  /** Recognized query patterns */
  patterns: string[]
  /** Suggestions for refining the query */
  suggestions: string[]
}

// Pattern definitions for query parsing
interface QueryPattern {
  patterns: RegExp[]
  extract: (match: RegExpMatchArray, query: string) => Partial<FilterCriteria>
  interpretation: string
}

// Number extraction utilities
function parseNumber(str: string): number | undefined {
  // Handle k/K suffix (thousands)
  const kMatch = str.match(/(\d+(?:\.\d+)?)\s*[kK]/)
  if (kMatch) {
    return parseFloat(kMatch[1]) * 1000
  }
  
  // Handle m/M suffix (millions)
  const mMatch = str.match(/(\d+(?:\.\d+)?)\s*[mM]/)
  if (mMatch) {
    return parseFloat(mMatch[1]) * 1000000
  }
  
  // Plain number
  const numMatch = str.match(/(\d+(?:,\d{3})*(?:\.\d+)?)/)
  if (numMatch) {
    return parseFloat(numMatch[1].replace(/,/g, ''))
  }
  
  return undefined
}

function extractNumberFromContext(query: string, keywords: string[]): number | undefined {
  for (const keyword of keywords) {
    // Look for patterns like "budget > 100k" or "variance over 50000"
    const patterns = [
      new RegExp(`${keyword}\\s*(?:>|over|above|more than|greater than)\\s*([\\d,.]+[kKmM]?)`, 'i'),
      new RegExp(`${keyword}\\s*(?:<|under|below|less than)\\s*([\\d,.]+[kKmM]?)`, 'i'),
      new RegExp(`([\\d,.]+[kKmM]?)\\s*(?:>|over|above|more than|greater than)\\s*${keyword}`, 'i'),
      new RegExp(`([\\d,.]+[kKmM]?)\\s*${keyword}`, 'i'),
    ]
    
    for (const pattern of patterns) {
      const match = query.match(pattern)
      if (match && match[1]) {
        return parseNumber(match[1])
      }
    }
  }
  return undefined
}

// Query patterns for different filter types
const queryPatterns: QueryPattern[] = [
  // Over budget patterns
  {
    patterns: [
      /over\s*budget/i,
      /above\s*budget/i,
      /exceed(?:s|ing)?\s*budget/i,
      /budget\s*exceed(?:ed)?/i,
      /negative\s*variance/i,
      /in\s*the\s*red/i,
      /überschritten/i, // German: exceeded
      /über\s*budget/i, // German: over budget
    ],
    extract: () => ({ overBudget: true }),
    interpretation: 'projects over budget'
  },
  
  // Under budget patterns
  {
    patterns: [
      /under\s*budget/i,
      /below\s*budget/i,
      /within\s*budget/i,
      /positive\s*variance/i,
      /in\s*the\s*green/i,
      /unter\s*budget/i, // German: under budget
    ],
    extract: () => ({ underBudget: true }),
    interpretation: 'projects under budget'
  },
  
  // High variance patterns
  {
    patterns: [
      /high\s*variance/i,
      /large\s*variance/i,
      /significant\s*variance/i,
      /variance\s*outlier/i,
      /hohe\s*varianz/i, // German: high variance
    ],
    extract: () => ({ highVariance: true }),
    interpretation: 'projects with high variance'
  },
  
  // Variance threshold patterns
  {
    patterns: [
      /variance\s*(?:>|over|above|more than|greater than)\s*([\d,.]+[kKmM]?)/i,
    ],
    extract: (match) => {
      const value = parseNumber(match[1])
      return value !== undefined ? { varianceMin: value } : {}
    },
    interpretation: 'projects with variance above threshold'
  },
  {
    patterns: [
      /variance\s*(?:<|under|below|less than)\s*([\d,.]+[kKmM]?)/i,
    ],
    extract: (match) => {
      const value = parseNumber(match[1])
      return value !== undefined ? { varianceMax: value } : {}
    },
    interpretation: 'projects with variance below threshold'
  },
  
  // Budget threshold patterns
  {
    patterns: [
      /budget\s*(?:>|over|above|more than|greater than)\s*([\d,.]+[kKmM]?)/i,
      /(?:>|over|above|more than)\s*([\d,.]+[kKmM]?)\s*budget/i,
    ],
    extract: (match) => {
      const value = parseNumber(match[1])
      return value !== undefined ? { budgetMin: value } : {}
    },
    interpretation: 'projects with budget above threshold'
  },
  {
    patterns: [
      /budget\s*(?:<|under|below|less than)\s*([\d,.]+[kKmM]?)/i,
      /(?:<|under|below|less than)\s*([\d,.]+[kKmM]?)\s*budget/i,
    ],
    extract: (match) => {
      const value = parseNumber(match[1])
      return value !== undefined ? { budgetMax: value } : {}
    },
    interpretation: 'projects with budget below threshold'
  },
  
  // Status patterns
  {
    patterns: [
      /status\s*(?:is\s*)?(active|on[\s_-]?hold|completed|cancelled)/i,
      /(active|on[\s_-]?hold|completed|cancelled)\s*projects?/i,
      /(active|on[\s_-]?hold|completed|cancelled)\s*status/i,
    ],
    extract: (match) => {
      const statusMap: Record<string, ProjectStatus> = {
        'active': ProjectStatus.ACTIVE,
        'on_hold': ProjectStatus.ON_HOLD,
        'on-hold': ProjectStatus.ON_HOLD,
        'onhold': ProjectStatus.ON_HOLD,
        'on hold': ProjectStatus.ON_HOLD,
        'completed': ProjectStatus.COMPLETED,
        'cancelled': ProjectStatus.CANCELLED,
      }
      const statusKey = match[1].toLowerCase().replace(/[\s-]/g, '_')
      const status = statusMap[statusKey] || statusMap[match[1].toLowerCase()]
      return status ? { status: [status] } : {}
    },
    interpretation: 'projects with specific status'
  },
  
  // At risk / low health patterns
  {
    patterns: [
      /at[\s-]?risk/i,
      /low\s*health/i,
      /poor\s*health/i,
      /unhealthy/i,
      /critical/i,
      /gefährdet/i, // German: at risk
    ],
    extract: () => ({ lowHealth: true, healthMax: 50 }),
    interpretation: 'projects at risk (low health)'
  },
  
  // Good health patterns
  {
    patterns: [
      /healthy/i,
      /good\s*health/i,
      /high\s*health/i,
      /on[\s-]?track/i,
    ],
    extract: () => ({ healthMin: 70 }),
    interpretation: 'healthy projects'
  },
  
  // Health threshold patterns
  {
    patterns: [
      /health\s*(?:>|over|above)\s*(\d+)/i,
      /health\s*score\s*(?:>|over|above)\s*(\d+)/i,
    ],
    extract: (match) => {
      const value = parseInt(match[1], 10)
      return !isNaN(value) ? { healthMin: Math.min(value, 100) } : {}
    },
    interpretation: 'projects with health above threshold'
  },
  {
    patterns: [
      /health\s*(?:<|under|below)\s*(\d+)/i,
      /health\s*score\s*(?:<|under|below)\s*(\d+)/i,
    ],
    extract: (match) => {
      const value = parseInt(match[1], 10)
      return !isNaN(value) ? { healthMax: Math.min(value, 100) } : {}
    },
    interpretation: 'projects with health below threshold'
  },
  
  // Vendor patterns
  {
    patterns: [
      /vendor\s*(?:is\s*)?["']?([^"']+)["']?/i,
      /from\s*vendor\s*["']?([^"']+)["']?/i,
      /supplier\s*["']?([^"']+)["']?/i,
      /lieferant\s*["']?([^"']+)["']?/i, // German: supplier
    ],
    extract: (match) => {
      const vendorName = match[1].trim()
      return vendorName ? { vendorName } : {}
    },
    interpretation: 'projects with specific vendor'
  },
  
  // Sort patterns
  {
    patterns: [
      /sort(?:ed)?\s*by\s*(name|budget|variance|health|spend)/i,
      /order(?:ed)?\s*by\s*(name|budget|variance|health|spend)/i,
    ],
    extract: (match) => {
      const field = match[1].toLowerCase() as FilterCriteria['sortBy']
      return { sortBy: field }
    },
    interpretation: 'sorted by field'
  },
  {
    patterns: [
      /(ascending|asc|lowest|smallest)\s*(?:first)?/i,
      /(?:sort|order).*?(ascending|asc)/i,
    ],
    extract: () => ({ sortDirection: 'asc' }),
    interpretation: 'ascending order'
  },
  {
    patterns: [
      /(descending|desc|highest|largest)\s*(?:first)?/i,
      /(?:sort|order).*?(descending|desc)/i,
    ],
    extract: () => ({ sortDirection: 'desc' }),
    interpretation: 'descending order'
  },
  
  // Currency patterns
  {
    patterns: [
      /in\s*(USD|EUR|GBP|CHF|JPY)/i,
      /currency\s*(?:is\s*)?(USD|EUR|GBP|CHF|JPY)/i,
      /(USD|EUR|GBP|CHF|JPY)\s*projects?/i,
    ],
    extract: (match) => {
      const currency = match[1].toUpperCase() as Currency
      return { currency }
    },
    interpretation: 'projects in specific currency'
  },
]

/**
 * Example queries for user guidance
 */
export const exampleQueries = [
  { query: 'over budget', description: 'Find projects exceeding their budget' },
  { query: 'high variance', description: 'Find projects with unusual variance' },
  { query: 'status active', description: 'Show only active projects' },
  { query: 'budget > 100k', description: 'Projects with budget over $100,000' },
  { query: 'variance > 50000', description: 'Projects with variance over $50,000' },
  { query: 'at risk', description: 'Projects with low health scores' },
  { query: 'vendor Acme', description: 'Projects with Acme as vendor' },
  { query: 'healthy', description: 'Projects in good health' },
  { query: 'sort by variance desc', description: 'Sort by variance, highest first' },
  { query: 'active budget > 50k', description: 'Active projects over $50k budget' },
]

/**
 * Parse a natural language query into filter criteria
 */
export function parseNLQuery(query: string): ParseResult {
  const trimmedQuery = query.trim()
  
  // Handle empty query
  if (!trimmedQuery) {
    return {
      criteria: {},
      interpretation: 'All projects',
      confidence: 1.0,
      patterns: [],
      suggestions: ['Try searching for "over budget" or "high variance"']
    }
  }
  
  const criteria: FilterCriteria = {}
  const matchedPatterns: string[] = []
  const interpretations: string[] = []
  let confidence = 0
  
  // Try each pattern
  for (const patternDef of queryPatterns) {
    for (const pattern of patternDef.patterns) {
      const match = trimmedQuery.match(pattern)
      if (match) {
        const extracted = patternDef.extract(match, trimmedQuery)
        Object.assign(criteria, extracted)
        matchedPatterns.push(patternDef.interpretation)
        interpretations.push(patternDef.interpretation)
        confidence += 0.2
        break // Only match first pattern in group
      }
    }
  }
  
  // If no patterns matched, treat as text search
  if (matchedPatterns.length === 0) {
    criteria.textSearch = trimmedQuery
    interpretations.push(`searching for "${trimmedQuery}"`)
    confidence = 0.3
  }
  
  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0)
  
  // Generate interpretation string
  const interpretation = interpretations.length > 0
    ? `Showing ${interpretations.join(', ')}`
    : `Searching for "${trimmedQuery}"`
  
  // Generate suggestions based on what was not matched
  const suggestions = generateSuggestions(criteria, trimmedQuery)
  
  return {
    criteria,
    interpretation,
    confidence,
    patterns: matchedPatterns,
    suggestions
  }
}

/**
 * Generate helpful suggestions based on current query
 */
function generateSuggestions(criteria: FilterCriteria, query: string): string[] {
  const suggestions: string[] = []
  
  // If only text search, suggest more specific queries
  if (criteria.textSearch && Object.keys(criteria).length === 1) {
    suggestions.push('Try "over budget" to find projects exceeding budget')
    suggestions.push('Try "status active" to filter by status')
    suggestions.push('Try "budget > 100k" for budget threshold')
  }
  
  // If filtering by status, suggest combining with budget
  if (criteria.status && !criteria.budgetMin && !criteria.budgetMax) {
    suggestions.push('Add a budget filter like "budget > 50k"')
  }
  
  // If filtering by variance, suggest sorting
  if ((criteria.highVariance || criteria.varianceMin || criteria.varianceMax) && !criteria.sortBy) {
    suggestions.push('Add "sort by variance desc" to see highest first')
  }
  
  // If no specific filters, suggest common ones
  if (Object.keys(criteria).length === 0) {
    suggestions.push('Try "over budget" to find budget issues')
    suggestions.push('Try "at risk" to find critical projects')
    suggestions.push('Try "vendor X" to filter by vendor')
  }
  
  return suggestions.slice(0, 3) // Limit to 3 suggestions
}

/**
 * Get autocomplete suggestions based on partial input
 */
export function getAutocompleteSuggestions(
  partialQuery: string,
  limit: number = 5
): Array<{ query: string; description: string }> {
  const lower = partialQuery.toLowerCase().trim()
  
  if (!lower) {
    return exampleQueries.slice(0, limit)
  }
  
  // Filter example queries that match partial input
  const matching = exampleQueries.filter(
    ex => ex.query.toLowerCase().includes(lower) ||
          ex.description.toLowerCase().includes(lower)
  )
  
  // Add dynamic suggestions based on input
  const dynamic: Array<{ query: string; description: string }> = []
  
  if (lower.startsWith('bud') || lower.includes('budget')) {
    dynamic.push(
      { query: 'budget > 100k', description: 'Budget over $100,000' },
      { query: 'budget < 50k', description: 'Budget under $50,000' }
    )
  }
  
  if (lower.startsWith('var') || lower.includes('variance')) {
    dynamic.push(
      { query: 'high variance', description: 'Projects with unusual variance' },
      { query: 'variance > 10000', description: 'Variance over $10,000' }
    )
  }
  
  if (lower.startsWith('stat') || lower.includes('status')) {
    dynamic.push(
      { query: 'status active', description: 'Active projects' },
      { query: 'status on_hold', description: 'Projects on hold' },
      { query: 'status completed', description: 'Completed projects' }
    )
  }
  
  if (lower.startsWith('ven') || lower.includes('vendor')) {
    dynamic.push(
      { query: 'vendor ', description: 'Filter by vendor name...' }
    )
  }
  
  if (lower.startsWith('sort') || lower.includes('order')) {
    dynamic.push(
      { query: 'sort by variance desc', description: 'Sort by variance, highest first' },
      { query: 'sort by budget desc', description: 'Sort by budget, largest first' },
      { query: 'sort by health asc', description: 'Sort by health, lowest first' }
    )
  }
  
  // Combine and deduplicate
  const combined = [...matching, ...dynamic]
  const seen = new Set<string>()
  const unique = combined.filter(item => {
    if (seen.has(item.query)) return false
    seen.add(item.query)
    return true
  })
  
  return unique.slice(0, limit)
}

/**
 * Check if a project matches the filter criteria
 */
export function matchesFilter(
  project: {
    name: string
    description?: string
    status: ProjectStatus
    budget: number
    variance: number
    health_score: number
    currency: Currency
  },
  criteria: FilterCriteria
): boolean {
  // Text search
  if (criteria.textSearch) {
    const searchLower = criteria.textSearch.toLowerCase()
    const nameMatch = project.name.toLowerCase().includes(searchLower)
    const descMatch = project.description?.toLowerCase().includes(searchLower)
    if (!nameMatch && !descMatch) return false
  }
  
  // Status filter
  if (criteria.status && criteria.status.length > 0) {
    if (!criteria.status.includes(project.status)) return false
  }
  
  // Budget filters
  if (criteria.budgetMin !== undefined && project.budget < criteria.budgetMin) return false
  if (criteria.budgetMax !== undefined && project.budget > criteria.budgetMax) return false
  
  // Over/under budget
  if (criteria.overBudget && project.variance >= 0) return false
  if (criteria.underBudget && project.variance < 0) return false
  
  // Variance filters
  if (criteria.varianceMin !== undefined && project.variance < criteria.varianceMin) return false
  if (criteria.varianceMax !== undefined && project.variance > criteria.varianceMax) return false
  
  // High variance (outlier detection - more than 20% of budget)
  if (criteria.highVariance) {
    const variancePercent = Math.abs(project.variance) / project.budget
    if (variancePercent < 0.2) return false
  }
  
  // Health filters
  if (criteria.healthMin !== undefined && project.health_score < criteria.healthMin) return false
  if (criteria.healthMax !== undefined && project.health_score > criteria.healthMax) return false
  if (criteria.lowHealth && project.health_score >= 50) return false
  
  // Currency filter
  if (criteria.currency && project.currency !== criteria.currency) return false
  
  return true
}

/**
 * Sort projects based on filter criteria
 */
export function sortProjects<T extends {
  name: string
  budget: number
  variance: number
  health_score: number
  total_spend: number
}>(projects: T[], criteria: FilterCriteria): T[] {
  if (!criteria.sortBy) return projects
  
  const direction = criteria.sortDirection === 'asc' ? 1 : -1
  
  return [...projects].sort((a, b) => {
    let comparison = 0
    
    switch (criteria.sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'budget':
        comparison = a.budget - b.budget
        break
      case 'variance':
        comparison = a.variance - b.variance
        break
      case 'health':
        comparison = a.health_score - b.health_score
        break
      case 'spend':
        comparison = a.total_spend - b.total_spend
        break
    }
    
    return comparison * direction
  })
}

export default parseNLQuery
