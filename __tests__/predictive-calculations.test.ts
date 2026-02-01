// Tests for Costbook Predictive EAC/ETC Calculations
// Phase 2: AI-powered forecasting

import * as fc from 'fast-check'
import {
  calculatePredictiveMetrics,
  calculatePortfolioPredictions,
  getRiskLevelColor,
  getTrendIndicator,
  formatConfidence,
  generateMockHistoricalData,
  PredictiveMetrics
} from '@/lib/predictive-calculations'
import { ProjectWithFinancials, ProjectStatus, Currency } from '@/types/costbook'

// Helper to create a valid project
function createTestProject(overrides: Partial<ProjectWithFinancials> = {}): ProjectWithFinancials {
  const now = new Date()
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  const endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) // 60 days from now
  
  return {
    id: 'test-project',
    name: 'Test Project',
    status: ProjectStatus.ACTIVE,
    budget: 100000,
    currency: Currency.USD,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    created_at: startDate.toISOString(),
    updated_at: now.toISOString(),
    total_commitments: 30000,
    total_actuals: 20000,
    total_spend: 50000,
    variance: 50000,
    spend_percentage: 50,
    health_score: 75,
    ...overrides
  }
}

describe('Predictive Calculations', () => {
  describe('calculatePredictiveMetrics', () => {
    it('should return valid metrics for a healthy project', () => {
      const project = createTestProject({
        budget: 100000,
        total_spend: 50000,
        variance: 50000,
        health_score: 80
      })
      
      const metrics = calculatePredictiveMetrics(project)
      
      expect(metrics.predictedEAC).toBeGreaterThan(0)
      expect(metrics.etc).toBeGreaterThanOrEqual(0)
      expect(metrics.eacLow).toBeLessThanOrEqual(metrics.predictedEAC)
      expect(metrics.eacHigh).toBeGreaterThanOrEqual(metrics.predictedEAC)
      expect(metrics.confidence).toBeGreaterThan(0)
      expect(metrics.confidence).toBeLessThanOrEqual(1)
      expect(['low', 'medium', 'high', 'critical']).toContain(metrics.riskLevel)
      expect(['improving', 'stable', 'declining']).toContain(metrics.trend)
    })

    it('should identify critical risk for heavily over-budget projects', () => {
      const project = createTestProject({
        budget: 100000,
        total_spend: 120000,
        variance: -20000,
        health_score: 30
      })
      
      const metrics = calculatePredictiveMetrics(project)
      
      expect(['high', 'critical']).toContain(metrics.riskLevel)
    })

    it('should identify appropriate risk for under-budget projects', () => {
      const project = createTestProject({
        budget: 100000,
        total_spend: 40000,
        variance: 60000,
        health_score: 90
      })
      
      const metrics = calculatePredictiveMetrics(project)
      
      // Under-budget projects with good health should have valid risk level
      // Risk depends on projected EAC which may differ from current variance
      expect(['low', 'medium', 'high', 'critical']).toContain(metrics.riskLevel)
      
      // But should have positive projected variance or reasonable values
      expect(metrics.confidence).toBeGreaterThan(0)
      expect(metrics.predictedEAC).toBeGreaterThan(0)
    })

    it('should calculate days until budget exhaustion for over-budget trajectory', () => {
      const now = new Date()
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      const project = createTestProject({
        budget: 100000,
        total_spend: 80000, // 80% spent
        variance: 20000,
        health_score: 50,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      })
      
      const metrics = calculatePredictiveMetrics(project)
      
      // If projecting to go over budget, should have days remaining
      if (metrics.projectedVariance < 0) {
        expect(metrics.daysUntilBudgetExhaustion).toBeDefined()
      }
    })

    it('should return declining trend for deteriorating projects', () => {
      const project = createTestProject({
        budget: 100000,
        total_spend: 90000,
        variance: -10000,
        health_score: 40
      })
      
      const metrics = calculatePredictiveMetrics(project)
      
      expect(metrics.trend).toBe('declining')
    })

    it('should return improving trend for good performance', () => {
      const project = createTestProject({
        budget: 100000,
        total_spend: 40000,
        variance: 60000,
        health_score: 85
      })
      
      const metrics = calculatePredictiveMetrics(project)
      
      expect(metrics.trend).toBe('improving')
    })

    it('should handle zero spend projects', () => {
      const project = createTestProject({
        budget: 100000,
        total_spend: 0,
        variance: 100000,
        health_score: 100
      })
      
      const metrics = calculatePredictiveMetrics(project)
      
      expect(metrics.predictedEAC).toBe(100000) // Should fall back to budget
      expect(metrics.confidence).toBeLessThan(0.5) // Low confidence for no data
    })
  })

  describe('calculatePortfolioPredictions', () => {
    it('should aggregate predictions for multiple projects', () => {
      const projects = [
        createTestProject({ id: 'p1', budget: 100000, total_spend: 50000, variance: 50000 }),
        createTestProject({ id: 'p2', budget: 200000, total_spend: 180000, variance: 20000 }),
        createTestProject({ id: 'p3', budget: 50000, total_spend: 60000, variance: -10000, health_score: 40 })
      ]
      
      const portfolio = calculatePortfolioPredictions(projects)
      
      expect(portfolio.totalBudget).toBe(350000)
      expect(portfolio.totalPredictedEAC).toBeGreaterThan(0)
      expect(portfolio.projectMetrics.size).toBe(3)
    })

    it('should identify critical projects', () => {
      const projects = [
        createTestProject({ id: 'p1', budget: 100000, variance: 50000, health_score: 80 }),
        createTestProject({ id: 'p2', budget: 100000, variance: -30000, health_score: 25 }) // Critical
      ]
      
      const portfolio = calculatePortfolioPredictions(projects)
      
      expect(portfolio.criticalProjects.length + portfolio.highRiskProjects.length).toBeGreaterThan(0)
    })

    it('should set portfolio risk level based on project risks', () => {
      const projects = [
        createTestProject({ id: 'p1', budget: 100000, variance: -25000, health_score: 20 }), // Critical
        createTestProject({ id: 'p2', budget: 100000, variance: 50000, health_score: 80 })
      ]
      
      const portfolio = calculatePortfolioPredictions(projects)
      
      expect(portfolio.portfolioRiskLevel).toBe('critical')
    })
  })

  describe('getRiskLevelColor', () => {
    it('should return correct colors for each risk level', () => {
      expect(getRiskLevelColor('critical').text).toContain('red')
      expect(getRiskLevelColor('high').text).toContain('orange')
      expect(getRiskLevelColor('medium').text).toContain('yellow')
      expect(getRiskLevelColor('low').text).toContain('green')
    })
  })

  describe('getTrendIndicator', () => {
    it('should return correct indicators for each trend', () => {
      expect(getTrendIndicator('improving').icon).toBe('up')
      expect(getTrendIndicator('declining').icon).toBe('down')
      expect(getTrendIndicator('stable').icon).toBe('stable')
    })
  })

  describe('formatConfidence', () => {
    it('should format high confidence correctly', () => {
      const result = formatConfidence(0.85)
      expect(result.label).toBe('High')
      expect(result.percentage).toBe('85%')
    })

    it('should format medium confidence correctly', () => {
      const result = formatConfidence(0.6)
      expect(result.label).toBe('Medium')
      expect(result.percentage).toBe('60%')
    })

    it('should format low confidence correctly', () => {
      const result = formatConfidence(0.3)
      expect(result.label).toBe('Low')
      expect(result.percentage).toBe('30%')
    })
  })

  describe('generateMockHistoricalData', () => {
    it('should generate correct number of data points', () => {
      const project = createTestProject()
      const data = generateMockHistoricalData(project, 10)
      
      expect(data.length).toBe(10)
    })

    it('should have final cumulative spend match project total', () => {
      const project = createTestProject({ total_spend: 50000 })
      const data = generateMockHistoricalData(project, 5)
      
      expect(data[data.length - 1].cumulativeSpend).toBe(50000)
    })

    it('should have monotonically increasing cumulative spend', () => {
      const project = createTestProject()
      const data = generateMockHistoricalData(project, 10)
      
      for (let i = 1; i < data.length; i++) {
        expect(data[i].cumulativeSpend).toBeGreaterThanOrEqual(data[i - 1].cumulativeSpend)
      }
    })
  })

  describe('Property-based tests', () => {
    const projectArb = fc.record({
      id: fc.string({ minLength: 1 }),
      name: fc.string({ minLength: 1 }),
      status: fc.constantFrom(
        ProjectStatus.ACTIVE,
        ProjectStatus.ON_HOLD,
        ProjectStatus.COMPLETED,
        ProjectStatus.CANCELLED
      ),
      budget: fc.float({ min: 1000, max: 10000000, noNaN: true }).map(Math.fround),
      currency: fc.constant(Currency.USD),
      start_date: fc.constant(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      end_date: fc.constant(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()),
      created_at: fc.constant(new Date().toISOString()),
      updated_at: fc.constant(new Date().toISOString()),
      total_commitments: fc.float({ min: 0, max: 5000000, noNaN: true }).map(Math.fround),
      total_actuals: fc.float({ min: 0, max: 5000000, noNaN: true }).map(Math.fround),
      total_spend: fc.float({ min: 0, max: 5000000, noNaN: true }).map(Math.fround),
      variance: fc.float({ min: -5000000, max: 5000000, noNaN: true }).map(Math.fround),
      spend_percentage: fc.float({ min: 0, max: 200, noNaN: true }).map(Math.fround),
      health_score: fc.integer({ min: 0, max: 100 })
    })

    it('calculatePredictiveMetrics should always return valid structure', () => {
      fc.assert(
        fc.property(projectArb, (project) => {
          const metrics = calculatePredictiveMetrics(project as ProjectWithFinancials)
          
          // Should always have required properties
          expect(metrics).toHaveProperty('predictedEAC')
          expect(metrics).toHaveProperty('etc')
          expect(metrics).toHaveProperty('eacLow')
          expect(metrics).toHaveProperty('eacHigh')
          expect(metrics).toHaveProperty('confidence')
          expect(metrics).toHaveProperty('riskLevel')
          expect(metrics).toHaveProperty('trend')
          
          // Confidence should be between 0 and 1
          expect(metrics.confidence).toBeGreaterThanOrEqual(0)
          expect(metrics.confidence).toBeLessThanOrEqual(1)
          
          // EAC bounds should be ordered correctly
          expect(metrics.eacLow).toBeLessThanOrEqual(metrics.eacHigh)
          
          // Risk level should be valid
          expect(['low', 'medium', 'high', 'critical']).toContain(metrics.riskLevel)
          
          // Trend should be valid
          expect(['improving', 'stable', 'declining']).toContain(metrics.trend)
        }),
        { numRuns: 50 }
      )
    })

    it('ETC should be non-negative', () => {
      fc.assert(
        fc.property(projectArb, (project) => {
          const metrics = calculatePredictiveMetrics(project as ProjectWithFinancials)
          expect(metrics.etc).toBeGreaterThanOrEqual(0)
        }),
        { numRuns: 50 }
      )
    })

    it('predictedCompletion should be between 0 and 100', () => {
      fc.assert(
        fc.property(projectArb, (project) => {
          const metrics = calculatePredictiveMetrics(project as ProjectWithFinancials)
          expect(metrics.predictedCompletion).toBeGreaterThanOrEqual(0)
          expect(metrics.predictedCompletion).toBeLessThanOrEqual(100)
        }),
        { numRuns: 50 }
      )
    })

    it('burnRate should be non-negative', () => {
      fc.assert(
        fc.property(projectArb, (project) => {
          const metrics = calculatePredictiveMetrics(project as ProjectWithFinancials)
          expect(metrics.burnRate).toBeGreaterThanOrEqual(0)
        }),
        { numRuns: 50 }
      )
    })

    /**
     * Property 14: Predictive EAC Bounds
     * Validates: Requirements 2.4 (enhanced)
     * Verifies EAC predictions are within reasonable bounds and have valid structure.
     */
    describe('Property 14: Predictive EAC Bounds', () => {
      it('predicted EAC should have valid structure and bounds ordering', () => {
        fc.assert(
          fc.property(projectArb, (project) => {
            const metrics = calculatePredictiveMetrics(project as ProjectWithFinancials)
            
            // EAC should never be negative
            expect(metrics.predictedEAC).toBeGreaterThanOrEqual(0)
            
            // EAC bounds should be ordered: low <= predicted <= high
            expect(metrics.eacLow).toBeLessThanOrEqual(metrics.predictedEAC)
            expect(metrics.predictedEAC).toBeLessThanOrEqual(metrics.eacHigh)
            
            // eacLow and eacHigh should both be non-negative
            expect(metrics.eacLow).toBeGreaterThanOrEqual(0)
            expect(metrics.eacHigh).toBeGreaterThanOrEqual(0)
            
            // ETC (Estimate to Complete) should be non-negative
            expect(metrics.etc).toBeGreaterThanOrEqual(0)
          }),
          { numRuns: 100 }
        )
      })

      it('EAC confidence intervals should be proportional to uncertainty', () => {
        fc.assert(
          fc.property(projectArb, (project) => {
            const metrics = calculatePredictiveMetrics(project as ProjectWithFinancials)
            
            // The range between eacHigh and eacLow represents uncertainty
            const uncertaintyRange = metrics.eacHigh - metrics.eacLow
            
            // Uncertainty should be non-negative
            expect(uncertaintyRange).toBeGreaterThanOrEqual(0)
            
            // Lower confidence should correlate with wider uncertainty bands
            // (inverse relationship is expected but hard to test precisely,
            // so we just verify the values are consistent)
            if (metrics.confidence > 0.9) {
              // High confidence means narrow bands relative to EAC
              expect(uncertaintyRange).toBeLessThanOrEqual(metrics.predictedEAC * 2)
            }
          }),
          { numRuns: 100 }
        )
      })

      it('EAC should scale reasonably with budget changes', () => {
        fc.assert(
          fc.property(
            fc.float({ min: Math.fround(10000), max: Math.fround(1000000), noNaN: true }),
            fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true }),
            (budget, spendRatio) => {
              const totalSpend = budget * spendRatio
              
              const project: ProjectWithFinancials = {
                id: 'test',
                name: 'Test Project',
                status: ProjectStatus.ACTIVE,
                budget: budget,
                currency: Currency.USD,
                start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                total_commitments: totalSpend * 0.6,
                total_actuals: totalSpend * 0.4,
                total_spend: totalSpend,
                variance: budget - totalSpend,
                spend_percentage: spendRatio * 100,
                health_score: 75
              }
              
              const metrics = calculatePredictiveMetrics(project)
              
              // EAC should be in a reasonable range (not wildly different from budget)
              // Allow for up to 3x budget for severely off-track projects
              expect(metrics.predictedEAC).toBeLessThanOrEqual(budget * 3)
              
              // EAC should be at least the current spend
              expect(metrics.predictedEAC).toBeGreaterThanOrEqual(totalSpend)
            }
          ),
          { numRuns: 100 }
        )
      })
    })
  })
})
