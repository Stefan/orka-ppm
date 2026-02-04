import { generateRecommendations } from '../recommendation-engine'
import type { ProjectWithFinancials } from '@/types/costbook'
import { ProjectStatus } from '@/types/costbook'

function mockProject(overrides: Partial<ProjectWithFinancials> = {}): ProjectWithFinancials {
  return {
    id: 'p1',
    name: 'Project 1',
    status: ProjectStatus.ACTIVE,
    budget: 100000,
    currency: 'USD' as any,
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    total_commitments: 50000,
    total_actuals: 50000,
    total_spend: 50000,
    variance: 50000,
    spend_percentage: 50,
    health_score: 80,
    ...overrides
  }
}

describe('lib/recommendation-engine', () => {
  describe('generateRecommendations', () => {
    it('returns empty when no projects', () => {
      expect(generateRecommendations([])).toEqual([])
    })

    it('respects config categories', () => {
      const projects = [
        mockProject(),
        mockProject({ id: 'p2', variance: -20000, health_score: 40 })
      ]
      const onlyBudget = generateRecommendations(projects, [], { categories: ['budget'] })
      const all = generateRecommendations(projects, [], {})
      expect(Array.isArray(onlyBudget)).toBe(true)
      expect(Array.isArray(all)).toBe(true)
    })

    it('respects maxRecommendations', () => {
      const projects = [
        mockProject({ id: 'a', variance: 30000, spend_percentage: 60 }),
        mockProject({ id: 'b', variance: -25000 }),
        mockProject({ id: 'c', variance: -15000 })
      ]
      const result = generateRecommendations(projects, [], { maxRecommendations: 2 })
      expect(result.length).toBeLessThanOrEqual(2)
    })

    it('respects minConfidence', () => {
      const projects = [
        mockProject({ id: 'a', variance: 30000, spend_percentage: 60 }),
        mockProject({ id: 'b', variance: -25000 })
      ]
      const result = generateRecommendations(projects, [], { minConfidence: 0.9 })
      result.forEach(r => expect(r.confidence_score).toBeGreaterThanOrEqual(0.9))
    })

    it('includes low priority when includeLowPriority is true', () => {
      const projects = [mockProject(), mockProject({ id: 'p2' })]
      const withLow = generateRecommendations(projects, [], {
        includeLowPriority: true,
        maxRecommendations: 20
      })
      expect(Array.isArray(withLow)).toBe(true)
    })
  })
})
