// Tests for Costbook Natural Language Query Parser
// Phase 2: AI-powered search functionality

import * as fc from 'fast-check'
import {
  parseNLQuery,
  matchesFilter,
  sortProjects,
  getAutocompleteSuggestions,
  exampleQueries,
  FilterCriteria
} from '@/lib/nl-query-parser'
import { ProjectStatus, Currency } from '@/types/costbook'

describe('NL Query Parser', () => {
  describe('parseNLQuery', () => {
    it('should return empty criteria for empty query', () => {
      const result = parseNLQuery('')
      expect(result.criteria).toEqual({})
      expect(result.interpretation).toBe('All projects')
      expect(result.confidence).toBe(1.0)
    })

    it('should detect "over budget" queries', () => {
      const queries = ['over budget', 'above budget', 'exceeds budget', 'über budget']
      
      for (const query of queries) {
        const result = parseNLQuery(query)
        expect(result.criteria.overBudget).toBe(true)
        expect(result.confidence).toBeGreaterThan(0)
      }
    })

    it('should detect "under budget" queries', () => {
      const queries = ['under budget', 'below budget', 'within budget', 'unter budget']
      
      for (const query of queries) {
        const result = parseNLQuery(query)
        expect(result.criteria.underBudget).toBe(true)
        expect(result.confidence).toBeGreaterThan(0)
      }
    })

    it('should detect "high variance" queries', () => {
      const queries = ['high variance', 'large variance', 'significant variance', 'hohe varianz']
      
      for (const query of queries) {
        const result = parseNLQuery(query)
        expect(result.criteria.highVariance).toBe(true)
        expect(result.confidence).toBeGreaterThan(0)
      }
    })

    it('should extract numeric thresholds from budget queries', () => {
      expect(parseNLQuery('budget > 100000').criteria.budgetMin).toBe(100000)
      expect(parseNLQuery('budget over 50k').criteria.budgetMin).toBe(50000)
      expect(parseNLQuery('budget < 1m').criteria.budgetMax).toBe(1000000)
      expect(parseNLQuery('budget under 25000').criteria.budgetMax).toBe(25000)
    })

    it('should extract numeric thresholds from variance queries', () => {
      expect(parseNLQuery('variance > 10000').criteria.varianceMin).toBe(10000)
      expect(parseNLQuery('variance over 5k').criteria.varianceMin).toBe(5000)
      expect(parseNLQuery('variance < 1000').criteria.varianceMax).toBe(1000)
    })

    it('should detect status filters', () => {
      expect(parseNLQuery('status active').criteria.status).toContain(ProjectStatus.ACTIVE)
      expect(parseNLQuery('status on_hold').criteria.status).toContain(ProjectStatus.ON_HOLD)
      expect(parseNLQuery('status completed').criteria.status).toContain(ProjectStatus.COMPLETED)
      expect(parseNLQuery('active projects').criteria.status).toContain(ProjectStatus.ACTIVE)
    })

    it('should detect at risk / low health queries', () => {
      const queries = ['at risk', 'low health', 'critical', 'gefährdet']
      
      for (const query of queries) {
        const result = parseNLQuery(query)
        expect(result.criteria.lowHealth).toBe(true)
        expect(result.criteria.healthMax).toBe(50)
      }
    })

    it('should detect healthy project queries', () => {
      const queries = ['healthy', 'good health', 'on track']
      
      for (const query of queries) {
        const result = parseNLQuery(query)
        expect(result.criteria.healthMin).toBe(70)
      }
    })

    it('should extract health thresholds', () => {
      expect(parseNLQuery('health > 80').criteria.healthMin).toBe(80)
      expect(parseNLQuery('health score above 60').criteria.healthMin).toBe(60)
      expect(parseNLQuery('health < 40').criteria.healthMax).toBe(40)
    })

    it('should extract vendor names', () => {
      expect(parseNLQuery('vendor Acme Corp').criteria.vendorName).toBe('Acme Corp')
      expect(parseNLQuery('from vendor "Tech Solutions"').criteria.vendorName).toBeTruthy()
      expect(parseNLQuery('supplier ABC').criteria.vendorName).toBe('ABC')
    })

    it('should detect sort queries', () => {
      expect(parseNLQuery('sort by variance').criteria.sortBy).toBe('variance')
      expect(parseNLQuery('order by budget').criteria.sortBy).toBe('budget')
      expect(parseNLQuery('sort by name').criteria.sortBy).toBe('name')
    })

    it('should detect sort direction', () => {
      expect(parseNLQuery('descending').criteria.sortDirection).toBe('desc')
      expect(parseNLQuery('ascending').criteria.sortDirection).toBe('asc')
      expect(parseNLQuery('highest first').criteria.sortDirection).toBe('desc')
      expect(parseNLQuery('lowest first').criteria.sortDirection).toBe('asc')
    })

    it('should detect currency filters', () => {
      expect(parseNLQuery('in USD').criteria.currency).toBe(Currency.USD)
      expect(parseNLQuery('currency EUR').criteria.currency).toBe(Currency.EUR)
      expect(parseNLQuery('GBP projects').criteria.currency).toBe(Currency.GBP)
    })

    it('should handle combined queries', () => {
      const result = parseNLQuery('status active over budget sort by variance desc')
      
      expect(result.criteria.status).toContain(ProjectStatus.ACTIVE)
      expect(result.criteria.overBudget).toBe(true)
      expect(result.criteria.sortBy).toBe('variance')
      expect(result.criteria.sortDirection).toBe('desc')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should fall back to text search for unknown queries', () => {
      const result = parseNLQuery('project alpha')
      
      expect(result.criteria.textSearch).toBe('project alpha')
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should provide interpretation for matched patterns', () => {
      const result = parseNLQuery('over budget')
      
      expect(result.interpretation).toContain('over budget')
      expect(result.patterns.length).toBeGreaterThan(0)
    })
  })

  describe('matchesFilter', () => {
    const baseProject = {
      name: 'Test Project',
      description: 'A test project description',
      status: ProjectStatus.ACTIVE,
      budget: 100000,
      variance: -5000,
      health_score: 75,
      currency: Currency.USD
    }

    it('should match all projects with empty criteria', () => {
      expect(matchesFilter(baseProject, {})).toBe(true)
    })

    it('should filter by text search', () => {
      expect(matchesFilter(baseProject, { textSearch: 'test' })).toBe(true)
      expect(matchesFilter(baseProject, { textSearch: 'nonexistent' })).toBe(false)
      expect(matchesFilter(baseProject, { textSearch: 'description' })).toBe(true)
    })

    it('should filter by status', () => {
      expect(matchesFilter(baseProject, { status: [ProjectStatus.ACTIVE] })).toBe(true)
      expect(matchesFilter(baseProject, { status: [ProjectStatus.COMPLETED] })).toBe(false)
    })

    it('should filter by budget thresholds', () => {
      expect(matchesFilter(baseProject, { budgetMin: 50000 })).toBe(true)
      expect(matchesFilter(baseProject, { budgetMin: 150000 })).toBe(false)
      expect(matchesFilter(baseProject, { budgetMax: 150000 })).toBe(true)
      expect(matchesFilter(baseProject, { budgetMax: 50000 })).toBe(false)
    })

    it('should filter over/under budget', () => {
      // Project has negative variance, so it's over budget
      expect(matchesFilter(baseProject, { overBudget: true })).toBe(true)
      expect(matchesFilter(baseProject, { underBudget: true })).toBe(false)
      
      const underBudgetProject = { ...baseProject, variance: 5000 }
      expect(matchesFilter(underBudgetProject, { overBudget: true })).toBe(false)
      expect(matchesFilter(underBudgetProject, { underBudget: true })).toBe(true)
    })

    it('should filter by variance thresholds', () => {
      expect(matchesFilter(baseProject, { varianceMin: -10000 })).toBe(true)
      expect(matchesFilter(baseProject, { varianceMin: 0 })).toBe(false)
      expect(matchesFilter(baseProject, { varianceMax: 0 })).toBe(true)
      expect(matchesFilter(baseProject, { varianceMax: -10000 })).toBe(false)
    })

    it('should filter by high variance', () => {
      // High variance = more than 20% of budget
      const highVarianceProject = { ...baseProject, variance: -25000 }
      expect(matchesFilter(highVarianceProject, { highVariance: true })).toBe(true)
      expect(matchesFilter(baseProject, { highVariance: true })).toBe(false)
    })

    it('should filter by health thresholds', () => {
      expect(matchesFilter(baseProject, { healthMin: 70 })).toBe(true)
      expect(matchesFilter(baseProject, { healthMin: 80 })).toBe(false)
      expect(matchesFilter(baseProject, { healthMax: 80 })).toBe(true)
      expect(matchesFilter(baseProject, { healthMax: 70 })).toBe(false)
    })

    it('should filter by low health', () => {
      const lowHealthProject = { ...baseProject, health_score: 40 }
      expect(matchesFilter(lowHealthProject, { lowHealth: true })).toBe(true)
      expect(matchesFilter(baseProject, { lowHealth: true })).toBe(false)
    })

    it('should filter by currency', () => {
      expect(matchesFilter(baseProject, { currency: Currency.USD })).toBe(true)
      expect(matchesFilter(baseProject, { currency: Currency.EUR })).toBe(false)
    })

    it('should combine multiple filters', () => {
      expect(matchesFilter(baseProject, {
        status: [ProjectStatus.ACTIVE],
        budgetMin: 50000,
        healthMin: 70
      })).toBe(true)
      
      expect(matchesFilter(baseProject, {
        status: [ProjectStatus.ACTIVE],
        budgetMin: 150000, // Fails
        healthMin: 70
      })).toBe(false)
    })
  })

  describe('sortProjects', () => {
    const projects = [
      { name: 'B Project', budget: 50000, variance: -1000, health_score: 80, total_spend: 40000 },
      { name: 'A Project', budget: 100000, variance: 5000, health_score: 60, total_spend: 95000 },
      { name: 'C Project', budget: 75000, variance: -3000, health_score: 90, total_spend: 78000 },
    ]

    it('should not modify order without sort criteria', () => {
      const sorted = sortProjects(projects, {})
      expect(sorted[0].name).toBe('B Project')
    })

    it('should sort by name ascending', () => {
      const sorted = sortProjects(projects, { sortBy: 'name', sortDirection: 'asc' })
      expect(sorted[0].name).toBe('A Project')
      expect(sorted[1].name).toBe('B Project')
      expect(sorted[2].name).toBe('C Project')
    })

    it('should sort by name descending', () => {
      const sorted = sortProjects(projects, { sortBy: 'name', sortDirection: 'desc' })
      expect(sorted[0].name).toBe('C Project')
      expect(sorted[2].name).toBe('A Project')
    })

    it('should sort by budget', () => {
      const sorted = sortProjects(projects, { sortBy: 'budget', sortDirection: 'desc' })
      expect(sorted[0].budget).toBe(100000)
      expect(sorted[2].budget).toBe(50000)
    })

    it('should sort by variance', () => {
      const sorted = sortProjects(projects, { sortBy: 'variance', sortDirection: 'asc' })
      expect(sorted[0].variance).toBe(-3000)
      expect(sorted[2].variance).toBe(5000)
    })

    it('should sort by health', () => {
      const sorted = sortProjects(projects, { sortBy: 'health', sortDirection: 'desc' })
      expect(sorted[0].health_score).toBe(90)
      expect(sorted[2].health_score).toBe(60)
    })

    it('should sort by spend', () => {
      const sorted = sortProjects(projects, { sortBy: 'spend', sortDirection: 'desc' })
      expect(sorted[0].total_spend).toBe(95000)
      expect(sorted[2].total_spend).toBe(40000)
    })
  })

  describe('getAutocompleteSuggestions', () => {
    it('should return example queries for empty input', () => {
      const suggestions = getAutocompleteSuggestions('')
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.length).toBeLessThanOrEqual(5)
    })

    it('should filter suggestions by partial input', () => {
      const suggestions = getAutocompleteSuggestions('bud')
      expect(suggestions.some(s => s.query.toLowerCase().includes('budget'))).toBe(true)
    })

    it('should provide status suggestions', () => {
      const suggestions = getAutocompleteSuggestions('stat')
      expect(suggestions.some(s => s.query.toLowerCase().includes('status'))).toBe(true)
    })

    it('should provide variance suggestions', () => {
      const suggestions = getAutocompleteSuggestions('var')
      expect(suggestions.some(s => s.query.toLowerCase().includes('variance'))).toBe(true)
    })

    it('should provide sort suggestions', () => {
      const suggestions = getAutocompleteSuggestions('sort')
      expect(suggestions.some(s => s.query.toLowerCase().includes('sort'))).toBe(true)
    })

    it('should limit suggestions count', () => {
      const suggestions = getAutocompleteSuggestions('', 3)
      expect(suggestions.length).toBeLessThanOrEqual(3)
    })
  })

  describe('Property-based tests', () => {
    it('parseNLQuery should always return valid structure', () => {
      fc.assert(
        fc.property(fc.string(), (query) => {
          const result = parseNLQuery(query)
          
          // Should always return object with required properties
          expect(result).toHaveProperty('criteria')
          expect(result).toHaveProperty('interpretation')
          expect(result).toHaveProperty('confidence')
          expect(result).toHaveProperty('patterns')
          expect(result).toHaveProperty('suggestions')
          
          // Confidence should be between 0 and 1
          expect(result.confidence).toBeGreaterThanOrEqual(0)
          expect(result.confidence).toBeLessThanOrEqual(1)
          
          // Arrays should be arrays
          expect(Array.isArray(result.patterns)).toBe(true)
          expect(Array.isArray(result.suggestions)).toBe(true)
        }),
        { numRuns: 50 }
      )
    })

    it('matchesFilter with empty criteria should match any project', () => {
      const projectArb = fc.record({
        name: fc.string({ minLength: 1 }),
        description: fc.option(fc.string(), { nil: undefined }),
        status: fc.constantFrom(
          ProjectStatus.ACTIVE,
          ProjectStatus.ON_HOLD,
          ProjectStatus.COMPLETED,
          ProjectStatus.CANCELLED
        ),
        budget: fc.float({ min: 1, max: 10000000 }).map(Math.fround),
        variance: fc.float({ min: -1000000, max: 1000000 }).map(Math.fround),
        health_score: fc.integer({ min: 0, max: 100 }),
        currency: fc.constantFrom(
          Currency.USD,
          Currency.EUR,
          Currency.GBP,
          Currency.CHF,
          Currency.JPY
        )
      })

      fc.assert(
        fc.property(projectArb, (project) => {
          // Empty criteria should always match
          expect(matchesFilter(project, {})).toBe(true)
        }),
        { numRuns: 50 }
      )
    })

    it('sortProjects should preserve all elements', () => {
      const projectsArb = fc.array(
        fc.record({
          name: fc.string({ minLength: 1 }),
          budget: fc.float({ min: 1, max: 10000000 }).map(Math.fround),
          variance: fc.float({ min: -1000000, max: 1000000 }).map(Math.fround),
          health_score: fc.integer({ min: 0, max: 100 }),
          total_spend: fc.float({ min: 0, max: 10000000 }).map(Math.fround)
        }),
        { minLength: 0, maxLength: 20 }
      )

      const criteriaArb = fc.record({
        sortBy: fc.option(
          fc.constantFrom('name', 'budget', 'variance', 'health', 'spend') as fc.Arbitrary<FilterCriteria['sortBy']>,
          { nil: undefined }
        ),
        sortDirection: fc.option(
          fc.constantFrom('asc', 'desc') as fc.Arbitrary<'asc' | 'desc'>,
          { nil: undefined }
        )
      })

      fc.assert(
        fc.property(projectsArb, criteriaArb, (projects, criteria) => {
          const sorted = sortProjects(projects, criteria)
          
          // Should have same length
          expect(sorted.length).toBe(projects.length)
          
          // Should contain all original elements
          for (const project of projects) {
            expect(sorted).toContainEqual(project)
          }
        }),
        { numRuns: 50 }
      )
    })

    it('budget filters should be mutually exclusive when satisfied', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 10000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 1, max: 10000000, noNaN: true }).map(Math.fround),
          (budget, threshold) => {
            // Skip if values are NaN or zero (floating point edge cases)
            if (isNaN(budget) || isNaN(threshold) || budget === 0 || threshold === 0) {
              return
            }
            
            const project = {
              name: 'Test',
              status: ProjectStatus.ACTIVE,
              budget,
              variance: 0,
              health_score: 50,
              currency: Currency.USD
            }
            
            const matchesMin = matchesFilter(project, { budgetMin: threshold })
            const matchesMax = matchesFilter(project, { budgetMax: threshold })
            
            // If budget equals threshold, both should match
            if (budget === threshold) {
              expect(matchesMin).toBe(true)
              expect(matchesMax).toBe(true)
            }
            // If budget > threshold, min should match, max should not
            else if (budget > threshold) {
              expect(matchesMin).toBe(true)
              expect(matchesMax).toBe(false)
            }
            // If budget < threshold, max should match, min should not
            else {
              expect(matchesMin).toBe(false)
              expect(matchesMax).toBe(true)
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})
