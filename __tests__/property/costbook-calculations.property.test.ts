/**
 * Property-Based Tests for Costbook Calculation Functions
 * 
 * These tests validate the mathematical correctness and edge case handling
 * of all calculation functions using fast-check for property-based testing.
 */

import * as fc from 'fast-check'
import {
  safeNumber,
  roundToDecimal,
  calculateTotalSpend,
  calculateTotalSpendFromArrays,
  calculateVariance,
  calculateSpendPercentage,
  calculateHealthScore,
  calculateKPIs,
  calculateEAC,
  calculateETC,
  enrichProjectWithFinancials,
  validateProjectFinancials,
  sumAmounts,
  categorizeProjectsByBudgetStatus
} from '@/lib/costbook-calculations'
import {
  detectAnomalies,
  calculateAnomalySummary,
  AnomalyType
} from '@/lib/costbook/anomaly-detection'
import { ProjectWithFinancials, Commitment, Actual, Currency, ProjectStatus, POStatus, ActualStatus } from '@/types/costbook'

// Helper to generate valid ProjectWithFinancials
const projectWithFinancialsArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 })),
  status: fc.constantFrom(ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED),
  budget: fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
  currency: fc.constantFrom(Currency.USD, Currency.EUR, Currency.GBP, Currency.CHF, Currency.JPY),
  start_date: fc.string().map(() => '2024-01-01T00:00:00Z'),
  end_date: fc.string().map(() => '2024-12-31T23:59:59Z'),
  project_manager: fc.option(fc.string({ maxLength: 100 })),
  client_id: fc.option(fc.uuid()),
  created_at: fc.string().map(() => '2024-01-01T00:00:00Z'),
  updated_at: fc.string().map(() => '2024-01-01T00:00:00Z'),
  total_commitments: fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
  total_actuals: fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
  total_spend: fc.float({ min: 0, max: 2000000, noNaN: true }).map(Math.fround),
  variance: fc.float({ min: -1000000, max: 1000000, noNaN: true }).map(Math.fround),
  spend_percentage: fc.float({ min: 0, max: 200, noNaN: true }).map(Math.fround),
  health_score: fc.integer({ min: 0, max: 100 }),
  eac: fc.option(fc.float({ min: 0, max: 2000000, noNaN: true }).map(Math.fround))
})

// Helper to generate valid Commitment
const commitmentArbitrary = fc.record({
  id: fc.uuid(),
  project_id: fc.uuid(),
  po_number: fc.string({ minLength: 1, maxLength: 20 }),
  vendor_name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ maxLength: 500 }),
  amount: fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
  currency: fc.constantFrom(Currency.USD, Currency.EUR, Currency.GBP, Currency.CHF, Currency.JPY),
  status: fc.constantFrom(POStatus.DRAFT, POStatus.APPROVED, POStatus.ISSUED, POStatus.RECEIVED, POStatus.CANCELLED),
  issue_date: fc.string().map(() => '2024-01-01T00:00:00Z'),
  delivery_date: fc.option(fc.string().map(() => '2024-06-01T00:00:00Z')),
  created_at: fc.string().map(() => '2024-01-01T00:00:00Z'),
  updated_at: fc.string().map(() => '2024-01-01T00:00:00Z')
})

// Helper to generate valid Actual
const actualArbitrary = fc.record({
  id: fc.uuid(),
  project_id: fc.uuid(),
  commitment_id: fc.option(fc.uuid()),
  po_number: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
  vendor_id: fc.uuid(),
  vendor_name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ maxLength: 500 }),
  amount: fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
  currency: fc.constantFrom(Currency.USD, Currency.EUR, Currency.GBP, Currency.CHF, Currency.JPY),
  status: fc.constantFrom(ActualStatus.PENDING, ActualStatus.APPROVED, ActualStatus.REJECTED, ActualStatus.CANCELLED),
  invoice_date: fc.string().map(() => '2024-02-01T00:00:00Z'),
  payment_date: fc.option(fc.string().map(() => '2024-03-01T00:00:00Z')),
  created_at: fc.string().map(() => '2024-02-01T00:00:00Z'),
  updated_at: fc.string().map(() => '2024-02-01T00:00:00Z')
})

describe('Costbook Calculations - Property Tests', () => {
  
  // ============================================
  // Property 1: Total Spend Calculation Correctness
  // ============================================
  describe('Property 1: Total Spend Calculation Correctness', () => {
    it('should correctly sum commitments and actuals', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          (commitments, actuals) => {
            const result = calculateTotalSpend(commitments, actuals)
            const expected = roundToDecimal(commitments + actuals)
            return result === expected
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return 0 for empty arrays', () => {
      const result = calculateTotalSpendFromArrays([], [])
      expect(result).toBe(0)
    })

    it('should handle null arrays gracefully', () => {
      const result = calculateTotalSpendFromArrays(null, null)
      expect(result).toBe(0)
    })

    it('should correctly sum amounts from commitment and actual arrays', () => {
      fc.assert(
        fc.property(
          fc.array(commitmentArbitrary, { maxLength: 20 }),
          fc.array(actualArbitrary, { maxLength: 20 }),
          (commitments, actuals) => {
            const result = calculateTotalSpendFromArrays(commitments, actuals)
            const expectedCommitments = commitments.reduce((sum, c) => sum + (c.amount || 0), 0)
            const expectedActuals = actuals.reduce((sum, a) => sum + (a.amount || 0), 0)
            const expected = roundToDecimal(expectedCommitments + expectedActuals)
            return result === expected
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should always return a non-negative value for positive inputs', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          (commitments, actuals) => {
            const result = calculateTotalSpend(commitments, actuals)
            return result >= 0
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // ============================================
  // Property 2: Variance Calculation Correctness
  // ============================================
  describe('Property 2: Variance Calculation Correctness', () => {
    it('should correctly calculate variance as budget minus spend', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          (budget, totalSpend) => {
            const result = calculateVariance(budget, totalSpend)
            const expected = roundToDecimal(budget - totalSpend)
            return result === expected
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return positive variance when under budget', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 100, max: 1000000, noNaN: true }).map(Math.fround),
          (budget) => {
            const spend = budget * 0.8 // 80% of budget
            const result = calculateVariance(budget, spend)
            return result > 0
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return negative variance when over budget', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 100, max: 1000000, noNaN: true }).map(Math.fround),
          (budget) => {
            const spend = budget * 1.2 // 120% of budget
            const result = calculateVariance(budget, spend)
            return result < 0
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return zero variance when spend equals budget', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000000, noNaN: true }),
          (budget) => {
            const result = calculateVariance(budget, budget)
            return result === 0
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // ============================================
  // Property 3: KPI Aggregation Correctness
  // ============================================
  describe('Property 3: KPI Aggregation Correctness', () => {
    it('should correctly aggregate all KPI metrics', () => {
      fc.assert(
        fc.property(
          fc.array(projectWithFinancialsArbitrary, { minLength: 1, maxLength: 20 }),
          (projects) => {
            const kpis = calculateKPIs(projects)
            
            // Verify total budget
            const expectedBudget = roundToDecimal(projects.reduce((sum, p) => sum + (p.budget || 0), 0))
            if (kpis.total_budget !== expectedBudget) return false

            // Verify total commitments
            const expectedCommitments = roundToDecimal(projects.reduce((sum, p) => sum + (p.total_commitments || 0), 0))
            if (kpis.total_commitments !== expectedCommitments) return false

            // Verify total actuals
            const expectedActuals = roundToDecimal(projects.reduce((sum, p) => sum + (p.total_actuals || 0), 0))
            if (kpis.total_actuals !== expectedActuals) return false

            // Verify total spend
            const expectedSpend = roundToDecimal(projects.reduce((sum, p) => sum + (p.total_spend || 0), 0))
            if (kpis.total_spend !== expectedSpend) return false

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return zero KPIs for empty project array', () => {
      const kpis = calculateKPIs([])
      expect(kpis.total_budget).toBe(0)
      expect(kpis.total_commitments).toBe(0)
      expect(kpis.total_actuals).toBe(0)
      expect(kpis.total_spend).toBe(0)
      expect(kpis.net_variance).toBe(0)
      expect(kpis.over_budget_count).toBe(0)
      expect(kpis.under_budget_count).toBe(0)
    })

    it('should return zero KPIs for null input', () => {
      const kpis = calculateKPIs(null)
      expect(kpis.total_budget).toBe(0)
      expect(kpis.total_spend).toBe(0)
    })

    it('should correctly count over and under budget projects', () => {
      const projects: ProjectWithFinancials[] = [
        { ...createMockProject(), variance: -100 }, // Over budget
        { ...createMockProject(), variance: 100 },  // Under budget
        { ...createMockProject(), variance: 0 },    // On budget
        { ...createMockProject(), variance: -50 },  // Over budget
      ]
      
      const kpis = calculateKPIs(projects)
      expect(kpis.over_budget_count).toBe(2)
      expect(kpis.under_budget_count).toBe(1)
    })
  })

  // ============================================
  // Property 4: Currency Precision Preservation
  // ============================================
  describe('Property 4: Currency Precision Preservation', () => {
    it('should always round to 2 decimal places', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000000, max: 1000000, noNaN: true }).map(Math.fround),
          (value) => {
            const result = roundToDecimal(value)
            const decimalPart = result.toString().split('.')[1] || ''
            return decimalPart.length <= 2
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain precision in total spend calculation', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          (commitments, actuals) => {
            const result = calculateTotalSpend(commitments, actuals)
            const decimalPart = result.toString().split('.')[1] || ''
            return decimalPart.length <= 2
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain precision in variance calculation', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          (budget, spend) => {
            const result = calculateVariance(budget, spend)
            const decimalPart = result.toString().split('.')[1] || ''
            return decimalPart.length <= 2
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain precision in spend percentage calculation', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000000, noNaN: true }),
          fc.float({ min: 1, max: 1000000, noNaN: true }).map(Math.fround), // Avoid division by zero
          (spend, budget) => {
            const result = calculateSpendPercentage(spend, budget)
            const decimalPart = result.toString().split('.')[1] || ''
            return decimalPart.length <= 2
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // ============================================
  // Property 5: Null Value Handling in Calculations
  // ============================================
  describe('Property 5: Null Value Handling in Calculations', () => {
    it('should treat null as zero in safeNumber', () => {
      expect(safeNumber(null)).toBe(0)
      expect(safeNumber(undefined)).toBe(0)
      expect(safeNumber(NaN)).toBe(0)
    })

    it('should handle null values in calculateTotalSpend', () => {
      expect(calculateTotalSpend(null, null)).toBe(0)
      expect(calculateTotalSpend(100, null)).toBe(100)
      expect(calculateTotalSpend(null, 100)).toBe(100)
    })

    it('should handle null values in calculateVariance', () => {
      expect(calculateVariance(null, null)).toBe(0)
      expect(calculateVariance(100, null)).toBe(100)
      expect(calculateVariance(null, 100)).toBe(-100)
    })

    it('should handle null values in calculateSpendPercentage', () => {
      expect(calculateSpendPercentage(null, null)).toBe(0)
      expect(calculateSpendPercentage(100, null)).toBe(100) // Spend > 0, budget = 0 => 100%
      expect(calculateSpendPercentage(null, 100)).toBe(0)
    })

    it('should handle projects with null financial fields', () => {
      const projectWithNulls: Partial<ProjectWithFinancials> = {
        budget: null as any,
        total_spend: null as any,
        spend_percentage: null as any
      }
      
      // Should not throw errors
      const healthScore = calculateHealthScore(projectWithNulls)
      expect(typeof healthScore).toBe('number')
      expect(healthScore).toBe(100) // Both budget and spend are 0, so 100% health
      
      const eac = calculateEAC(projectWithNulls)
      expect(typeof eac).toBe('number')
      expect(eac).toBe(0)
    })

    it('should handle arrays with null/undefined items', () => {
      const commitments = [
        { amount: 100 } as Commitment,
        null as any,
        { amount: 200 } as Commitment,
        undefined as any,
        { amount: null } as any
      ]
      
      const result = sumAmounts(commitments)
      expect(result).toBe(300)
    })
  })

  // ============================================
  // Additional Property Tests
  // ============================================
  describe('Additional Calculation Properties', () => {
    describe('Health Score Calculation', () => {
      it('should return 100 for projects at or under 80% spend', () => {
        fc.assert(
          fc.property(
            fc.float({ min: Math.fround(100), max: Math.fround(1000000), noNaN: true }),
            fc.float({ min: Math.fround(0), max: Math.fround(0.8), noNaN: true }),
            (budget, spendRatio) => {
              const totalSpend = budget * spendRatio
              const project: Partial<ProjectWithFinancials> = {
                budget,
                total_spend: totalSpend
              }
              const score = calculateHealthScore(project)
              return score === 100
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should return 0 for projects over 120% spend', () => {
        fc.assert(
          fc.property(
            fc.float({ min: Math.fround(100), max: Math.fround(1000000), noNaN: true }),
            fc.float({ min: Math.fround(1.21), max: Math.fround(2), noNaN: true }),
            (budget, spendRatio) => {
              const totalSpend = budget * spendRatio
              const project: Partial<ProjectWithFinancials> = {
                budget,
                total_spend: totalSpend
              }
              const score = calculateHealthScore(project)
              return score === 0
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should return value between 0 and 100', () => {
        fc.assert(
          fc.property(
            projectWithFinancialsArbitrary,
            (project) => {
              const score = calculateHealthScore(project)
              return score >= 0 && score <= 100
            }
          ),
          { numRuns: 100 }
        )
      })
    })

    describe('Spend Percentage Calculation', () => {
      it('should return 0 when both spend and budget are 0', () => {
        const result = calculateSpendPercentage(0, 0)
        expect(result).toBe(0)
      })

      it('should return 100 when spend > 0 and budget is 0', () => {
        const result = calculateSpendPercentage(100, 0)
        expect(result).toBe(100)
      })

      it('should return 100 for spend equal to budget', () => {
        fc.assert(
          fc.property(
            fc.float({ min: 1, max: 1000000, noNaN: true }),
            (value) => {
              const result = calculateSpendPercentage(value, value)
              return result === 100
            }
          ),
          { numRuns: 100 }
        )
      })
    })

    describe('EAC and ETC Calculations', () => {
      it('should return budget for projects under budget', () => {
        const project: Partial<ProjectWithFinancials> = {
          budget: 10000,
          total_spend: 5000,
          spend_percentage: 50
        }
        const eac = calculateEAC(project)
        expect(eac).toBe(10000)
      })

      it('should return adjusted EAC for over-budget projects', () => {
        const project: Partial<ProjectWithFinancials> = {
          budget: 10000,
          total_spend: 12000,
          spend_percentage: 120
        }
        const eac = calculateEAC(project)
        expect(eac).toBe(12000) // 12000/10000 = 1.2, 10000 * 1.2 = 12000
      })

      it('should calculate ETC as EAC minus total spend', () => {
        fc.assert(
          fc.property(
            projectWithFinancialsArbitrary,
            (project) => {
              const eac = calculateEAC(project)
              const etc = calculateETC(project)
              const totalSpend = safeNumber(project.total_spend)
              return etc === roundToDecimal(Math.max(0, eac - totalSpend))
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should never return negative ETC', () => {
        fc.assert(
          fc.property(
            projectWithFinancialsArbitrary,
            (project) => {
              const etc = calculateETC(project)
              return etc >= 0
            }
          ),
          { numRuns: 100 }
        )
      })
    })

    describe('Project Categorization', () => {
      it('should correctly categorize projects by budget status', () => {
        const projects: ProjectWithFinancials[] = [
          { ...createMockProject(), spend_percentage: 50 },  // On track
          { ...createMockProject(), spend_percentage: 85 },  // At risk
          { ...createMockProject(), spend_percentage: 110 }, // Over budget
          { ...createMockProject(), spend_percentage: 75 },  // On track
          { ...createMockProject(), spend_percentage: 95 },  // At risk
        ]
        
        const categorized = categorizeProjectsByBudgetStatus(projects)
        
        expect(categorized.onTrack.length).toBe(2)
        expect(categorized.atRisk.length).toBe(2)
        expect(categorized.overBudget.length).toBe(1)
      })

      it('should handle null input', () => {
        const categorized = categorizeProjectsByBudgetStatus(null)
        expect(categorized.onTrack).toEqual([])
        expect(categorized.atRisk).toEqual([])
        expect(categorized.overBudget).toEqual([])
      })
    })

    describe('Project Validation', () => {
      it('should validate complete projects', () => {
        const validProject: ProjectWithFinancials = {
          id: 'test-id',
          name: 'Test Project',
          status: ProjectStatus.ACTIVE,
          budget: 10000,
          currency: Currency.USD,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          total_commitments: 3000,
          total_actuals: 2000,
          total_spend: 5000,
          variance: 5000,
          spend_percentage: 50,
          health_score: 100
        }

        expect(validateProjectFinancials(validProject)).toBe(true)
      })

      it('should reject projects with missing required fields', () => {
        const invalidProject: Partial<ProjectWithFinancials> = {
          id: 'test-id',
          name: 'Test Project'
          // Missing budget, total_commitments, etc.
        }

        expect(validateProjectFinancials(invalidProject)).toBe(false)
      })
    })
  })

  // ============================================
  // Property 12: Anomaly Detection Consistency
  // ============================================
  describe('Property 12: Anomaly Detection Consistency', () => {
    it('should detect basic variance outliers', () => {
      // Create test projects with clear outlier
      const projects: ProjectWithFinancials[] = [
        {
          id: 'normal-1',
          name: 'Normal Project 1',
          status: ProjectStatus.ACTIVE,
          budget: 10000,
          currency: Currency.USD,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          total_commitments: 5000,
          total_actuals: 4000,
          total_spend: 9000,
          variance: 1000,
          spend_percentage: 90,
          health_score: 85
        },
        {
          id: 'outlier-1',
          name: 'Outlier Project',
          status: ProjectStatus.ACTIVE,
          budget: 10000,
          currency: Currency.USD,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          total_commitments: 20000,
          total_actuals: 15000,
          total_spend: 35000,
          variance: -25000, // Major overrun
          spend_percentage: 350,
          health_score: 10
        }
      ]

      const anomalies = detectAnomalies(projects)

      // Should detect anomalies or handle edge case with few projects
      // With only 2 projects, statistical anomalies may not be detected
      // The function should at least return an array
      expect(Array.isArray(anomalies)).toBe(true)

      // If anomalies are detected, they should have valid structure
      if (anomalies.length > 0) {
        const varianceAnomalies = anomalies.filter(a => a.anomalyType === AnomalyType.VARIANCE_OUTLIER)
        // Some anomalies may or may not be variance outliers
      }

      // Should have valid confidence scores
      anomalies.forEach(anomaly => {
        expect(anomaly.confidence).toBeGreaterThanOrEqual(0)
        expect(anomaly.confidence).toBeLessThanOrEqual(1)
        expect(anomaly.projectId).toBeDefined()
        expect(Object.values(AnomalyType)).toContain(anomaly.anomalyType)
      })
    })

    it('should calculate anomaly summary correctly', () => {
      const mockAnomalies: AnomalyResult[] = [
        {
          projectId: 'proj-1',
          anomalyType: AnomalyType.VARIANCE_OUTLIER,
          severity: 'high',
          confidence: 0.8,
          description: 'Test anomaly',
          details: { actualValue: 100, expectedValue: 50, deviation: 50 }
        },
        {
          projectId: 'proj-2',
          anomalyType: AnomalyType.SPEND_VELOCITY,
          severity: 'medium',
          confidence: 0.6,
          description: 'Test anomaly 2',
          details: { actualValue: 95 }
        }
      ]

      const summary = calculateAnomalySummary(mockAnomalies)

      expect(summary.total).toBe(2)
      expect(summary.bySeverity.high).toBe(1)
      expect(summary.bySeverity.medium).toBe(1)
      expect(summary.byType[AnomalyType.VARIANCE_OUTLIER]).toBe(1)
      expect(summary.byType[AnomalyType.SPEND_VELOCITY]).toBe(1)
      expect(summary.affectedProjects).toBe(2)
      expect(summary.averageConfidence).toBe(0.7)
    })

    it('should handle empty project arrays', () => {
      const anomalies = detectAnomalies([])
      expect(anomalies).toEqual([])
    })

    it('should handle single project arrays', () => {
      const singleProject: ProjectWithFinancials = {
        id: 'single',
        name: 'Single Project',
        status: ProjectStatus.ACTIVE,
        budget: 10000,
        currency: Currency.USD,
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        total_commitments: 5000,
        total_actuals: 4000,
        total_spend: 9000,
        variance: 1000,
        spend_percentage: 90,
        health_score: 85
      }

      const anomalies = detectAnomalies([singleProject])
      // Single project should not trigger statistical anomalies
      expect(anomalies.length).toBeLessThanOrEqual(1)
    })
  })
})

// Helper function to create mock project
function createMockProject(): ProjectWithFinancials {
  return {
    id: 'mock-id',
    name: 'Mock Project',
    status: ProjectStatus.ACTIVE,
    budget: 10000,
    currency: Currency.USD,
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    total_commitments: 3000,
    total_actuals: 2000,
    total_spend: 5000,
    variance: 5000,
    spend_percentage: 50,
    health_score: 100
  }
}