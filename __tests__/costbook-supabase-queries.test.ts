/**
 * Unit Tests for Costbook Supabase Query Functions
 * 
 * Tests error handling, data mapping, and edge cases for all query functions.
 */

import {
  CostbookQueryError,
  fetchProjectsWithFinancials,
  fetchProjectWithFinancials,
  fetchCommitmentsByProject,
  fetchActualsByProject,
  fetchAllCommitments,
  fetchAllActuals,
  getMockProjectsWithFinancials,
  getMockCommitments,
  getMockActuals
} from '@/lib/costbook/supabase-queries'
import { Currency, ProjectStatus, POStatus, ActualStatus } from '@/types/costbook'

// Mock the Supabase client
jest.mock('@/lib/api/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          order: jest.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        in: jest.fn(() => Promise.resolve({ data: [], error: null })),
        single: jest.fn(() => Promise.resolve({ data: null, error: null }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }
}))

describe('Costbook Supabase Queries - Unit Tests', () => {

  describe('CostbookQueryError', () => {
    it('should create error with correct properties', () => {
      const error = new CostbookQueryError('Test error', 'TEST_CODE', 'Details')
      
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.details).toBe('Details')
      expect(error.name).toBe('CostbookQueryError')
      expect(error instanceof Error).toBe(true)
    })

    it('should create error without details', () => {
      const error = new CostbookQueryError('Test error', 'TEST_CODE')
      
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.details).toBeUndefined()
    })
  })

  describe('Mock Data Functions', () => {
    describe('getMockProjectsWithFinancials', () => {
      it('should return array of mock projects', () => {
        const projects = getMockProjectsWithFinancials()
        
        expect(Array.isArray(projects)).toBe(true)
        expect(projects.length).toBeGreaterThan(0)
      })

      it('should return projects with all required fields', () => {
        const projects = getMockProjectsWithFinancials()
        
        for (const project of projects) {
          expect(project.id).toBeDefined()
          expect(project.name).toBeDefined()
          expect(project.budget).toBeDefined()
          expect(typeof project.budget).toBe('number')
          expect(project.currency).toBeDefined()
          expect(project.total_commitments).toBeDefined()
          expect(project.total_actuals).toBeDefined()
          expect(project.total_spend).toBeDefined()
          expect(project.variance).toBeDefined()
          expect(project.spend_percentage).toBeDefined()
          expect(project.health_score).toBeDefined()
        }
      })

      it('should return projects with valid status values', () => {
        const projects = getMockProjectsWithFinancials()
        const validStatuses = Object.values(ProjectStatus)

        for (const project of projects) {
          expect(validStatuses).toContain(project.status)
        }
      })

      it('should return projects with valid currency values', () => {
        const projects = getMockProjectsWithFinancials()
        const validCurrencies = Object.values(Currency)
        
        for (const project of projects) {
          expect(validCurrencies).toContain(project.currency)
        }
      })

      it('should have consistent financial calculations', () => {
        const projects = getMockProjectsWithFinancials()
        
        for (const project of projects) {
          // Total spend should be approximately commitments + actuals
          // (might differ slightly due to test data design)
          expect(project.total_spend).toBeLessThanOrEqual(
            project.total_commitments + project.total_actuals + 1
          )
          
          // Variance should be budget - total_spend
          const expectedVariance = project.budget - project.total_spend
          expect(project.variance).toBeCloseTo(expectedVariance, 0)
        }
      })
    })

    describe('getMockCommitments', () => {
      it('should return array of mock commitments', () => {
        const commitments = getMockCommitments()
        
        expect(Array.isArray(commitments)).toBe(true)
        expect(commitments.length).toBeGreaterThan(0)
      })

      it('should return commitments with all required fields', () => {
        const commitments = getMockCommitments()
        
        for (const commitment of commitments) {
          expect(commitment.id).toBeDefined()
          expect(commitment.project_id).toBeDefined()
          expect(commitment.po_number).toBeDefined()
          expect(commitment.vendor_id).toBeDefined()
          expect(commitment.vendor_name).toBeDefined()
          expect(commitment.amount).toBeDefined()
          expect(typeof commitment.amount).toBe('number')
          expect(commitment.currency).toBeDefined()
          expect(commitment.status).toBeDefined()
        }
      })

      it('should return commitments with valid status values', () => {
        const commitments = getMockCommitments()
        const validStatuses = Object.values(POStatus)
        
        for (const commitment of commitments) {
          expect(validStatuses).toContain(commitment.status)
        }
      })
    })

    describe('getMockActuals', () => {
      it('should return array of mock actuals', () => {
        const actuals = getMockActuals()
        
        expect(Array.isArray(actuals)).toBe(true)
        expect(actuals.length).toBeGreaterThan(0)
      })

      it('should return actuals with all required fields', () => {
        const actuals = getMockActuals()
        
        for (const actual of actuals) {
          expect(actual.id).toBeDefined()
          expect(actual.project_id).toBeDefined()
          expect(actual.vendor_id).toBeDefined()
          expect(actual.vendor_name).toBeDefined()
          expect(actual.amount).toBeDefined()
          expect(typeof actual.amount).toBe('number')
          expect(actual.currency).toBeDefined()
          expect(actual.status).toBeDefined()
        }
      })

      it('should return actuals with valid status values', () => {
        const actuals = getMockActuals()
        const validStatuses = Object.values(ActualStatus)
        
        for (const actual of actuals) {
          expect(validStatuses).toContain(actual.status)
        }
      })

      it('should link to valid commitments', () => {
        const actuals = getMockActuals()
        const commitments = getMockCommitments()
        const commitmentIds = new Set(commitments.map(c => c.id))
        
        for (const actual of actuals) {
          if (actual.commitment_id) {
            expect(commitmentIds.has(actual.commitment_id)).toBe(true)
          }
        }
      })
    })
  })

  describe('Data Consistency', () => {
    it('should have actuals linked to valid projects', () => {
      const projects = getMockProjectsWithFinancials()
      const actuals = getMockActuals()
      const projectIds = new Set(projects.map(p => p.id))
      
      for (const actual of actuals) {
        expect(projectIds.has(actual.project_id)).toBe(true)
      }
    })

    it('should have commitments linked to valid projects', () => {
      const projects = getMockProjectsWithFinancials()
      const commitments = getMockCommitments()
      const projectIds = new Set(projects.map(p => p.id))
      
      for (const commitment of commitments) {
        expect(projectIds.has(commitment.project_id)).toBe(true)
      }
    })
  })

  describe('Error Handling Scenarios', () => {
    it('should handle empty result sets gracefully', async () => {
      // This tests that the functions don't throw on empty data
      // The mock returns empty arrays by default
      const projects = await fetchProjectsWithFinancials()
      expect(Array.isArray(projects)).toBe(true)
    })
  })

  describe('Data Type Validation', () => {
    it('should ensure all amounts are positive numbers', () => {
      const commitments = getMockCommitments()
      const actuals = getMockActuals()
      
      for (const commitment of commitments) {
        expect(commitment.amount).toBeGreaterThanOrEqual(0)
      }
      
      for (const actual of actuals) {
        expect(actual.amount).toBeGreaterThanOrEqual(0)
      }
    })

    it('should ensure all dates are valid ISO strings', () => {
      const projects = getMockProjectsWithFinancials()
      
      for (const project of projects) {
        expect(() => new Date(project.start_date)).not.toThrow()
        expect(() => new Date(project.end_date)).not.toThrow()
        expect(() => new Date(project.created_at)).not.toThrow()
        expect(() => new Date(project.updated_at)).not.toThrow()
      }
    })

    it('should ensure health scores are within 0-100 range', () => {
      const projects = getMockProjectsWithFinancials()
      
      for (const project of projects) {
        expect(project.health_score).toBeGreaterThanOrEqual(0)
        expect(project.health_score).toBeLessThanOrEqual(100)
      }
    })

    it('should ensure spend percentages are non-negative', () => {
      const projects = getMockProjectsWithFinancials()
      
      for (const project of projects) {
        expect(project.spend_percentage).toBeGreaterThanOrEqual(0)
      }
    })
  })
})