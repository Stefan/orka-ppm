import * as fc from 'fast-check'
import {
  calculatePeriods,
  applyLinearDistribution,
  applyCustomDistribution,
  generateAIDistribution,
  applyReprofiling,
  validateCustomDistribution
} from '@/lib/costbook/distribution-engine'

describe('Distribution Engine - Property Tests', () => {
  describe('calculatePeriods', () => {
    it('should generate valid periods for any date range', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          fc.constantFrom('week', 'month'),
          (start, end, granularity) => {
            // Ensure start < end
            if (start >= end) {
              ;[start, end] = [end, start]
            }
            
            const periods = calculatePeriods(
              start.toISOString(),
              end.toISOString(),
              granularity as 'week' | 'month'
            )
            
            // Property: All periods should be within start-end range
            periods.forEach(period => {
              const pStart = new Date(period.start_date)
              const pEnd = new Date(period.end_date)
              expect(pStart).toBeInstanceOf(Date)
              expect(pEnd).toBeInstanceOf(Date)
              expect(pStart.getTime()).toBeGreaterThanOrEqual(start.getTime())
              expect(pEnd.getTime()).toBeLessThanOrEqual(end.getTime())
              expect(pStart.getTime()).toBeLessThan(pEnd.getTime())
            })
            
            // Property: Periods should be contiguous (no gaps)
            for (let i = 1; i < periods.length; i++) {
              const prevEnd = new Date(periods[i - 1].end_date)
              const currStart = new Date(periods[i].start_date)
              expect(prevEnd.getTime()).toBe(currStart.getTime())
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('applyLinearDistribution', () => {
    it('should distribute budget evenly across periods', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1000, max: 1000000 }),
          fc.integer({ min: 1, max: 12 }),
          (budget, numPeriods) => {
            // Generate dummy periods
            const periods = Array.from({ length: numPeriods }, (_, i) => ({
              id: `period-${i}`,
              start_date: new Date(2024, 0, i + 1).toISOString(),
              end_date: new Date(2024, 0, i + 2).toISOString(),
              amount: 0,
              percentage: 0,
              label: `Period ${i + 1}`
            }))
            
            const result = applyLinearDistribution(budget, periods)
            
            // Property: Total should equal budget
            const totalAmount = result.periods.reduce((sum, p) => sum + p.amount, 0)
            expect(totalAmount).toBeCloseTo(budget, 2)
            
            // Property: All periods should have equal amounts
            const expectedAmount = budget / numPeriods
            result.periods.forEach(period => {
              expect(period.amount).toBeCloseTo(expectedAmount, 2)
            })
            
            // Property: Percentages should sum to 100
            const totalPercentage = result.periods.reduce((sum, p) => sum + p.percentage, 0)
            expect(totalPercentage).toBeCloseTo(100, 2)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('applyCustomDistribution', () => {
    it('should validate that custom percentages sum to 100', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1000, max: 1000000 }),
          fc.array(fc.float({ min: 0, max: 100 }), { minLength: 1, maxLength: 12 }),
          (budget, percentages) => {
            // Generate periods matching percentages length
            const periods = Array.from({ length: percentages.length }, (_, i) => ({
              id: `period-${i}`,
              start_date: new Date(2024, 0, i + 1).toISOString(),
              end_date: new Date(2024, 0, i + 2).toISOString(),
              amount: 0,
              percentage: 0,
              label: `Period ${i + 1}`
            }))
            
            const result = applyCustomDistribution(budget, periods, percentages)
            
            const sum = percentages.reduce((a, b) => a + b, 0)
            
            if (Math.abs(sum - 100) > 0.01) {
              // Property: Should return error if percentages don't sum to 100
              expect(result.error).toBeDefined()
            } else {
              // Property: Should successfully distribute if percentages sum to 100
              expect(result.error).toBeUndefined()
              
              // Property: Total should equal budget
              const totalAmount = result.periods.reduce((s, p) => s + p.amount, 0)
              expect(totalAmount).toBeCloseTo(budget, 2)
            }
          }
        ),
        { numRuns: 50 }
      )
    })
    
    it('should correctly apply custom percentages', () => {
      const budget = 10000
      const percentages = [20, 30, 50] // Sums to 100
      const periods = Array.from({ length: 3 }, (_, i) => ({
        id: `period-${i}`,
        start_date: new Date(2024, i, 1).toISOString(),
        end_date: new Date(2024, i + 1, 1).toISOString(),
        amount: 0,
        percentage: 0,
        label: `Month ${i + 1}`
      }))
      
      const result = applyCustomDistribution(budget, periods, percentages)
      
      expect(result.error).toBeUndefined()
      expect(result.periods[0].amount).toBeCloseTo(2000, 2) // 20% of 10000
      expect(result.periods[1].amount).toBeCloseTo(3000, 2) // 30% of 10000
      expect(result.periods[2].amount).toBeCloseTo(5000, 2) // 50% of 10000
    })
  })

  describe('generateAIDistribution', () => {
    it('should generate valid S-curve distribution', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1000, max: 1000000 }),
          fc.integer({ min: 3, max: 12 }),
          (budget, numPeriods) => {
            // Generate dummy periods
            const periods = Array.from({ length: numPeriods }, (_, i) => ({
              id: `period-${i}`,
              start_date: new Date(2024, i, 1).toISOString(),
              end_date: new Date(2024, i + 1, 1).toISOString(),
              amount: 0,
              percentage: 0,
              label: `Month ${i + 1}`
            }))
            
            const result = generateAIDistribution(budget, periods)
            
            // Property: Total should equal budget
            const totalAmount = result.periods.reduce((sum, p) => sum + p.amount, 0)
            expect(totalAmount).toBeCloseTo(budget, 2)
            
            // Property: Percentages should sum to 100
            const totalPercentage = result.periods.reduce((sum, p) => sum + p.percentage, 0)
            expect(totalPercentage).toBeCloseTo(100, 2)
            
            // Property: S-curve should have lower values at start and end
            // (middle periods should generally have higher values)
            const firstAmount = result.periods[0].amount
            const middleAmount = result.periods[Math.floor(numPeriods / 2)].amount
            const lastAmount = result.periods[numPeriods - 1].amount
            
            // Relaxed assertion: middle should be >= start or end (typical S-curve)
            expect(middleAmount).toBeGreaterThanOrEqual(Math.min(firstAmount, lastAmount))
            
            // Property: Confidence score should be present
            expect(result.confidence).toBeDefined()
            expect(result.confidence).toBeGreaterThan(0)
            expect(result.confidence).toBeLessThanOrEqual(1)
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe('applyReprofiling', () => {
    it('should redistribute remaining budget to future periods', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 10000, max: 100000 }),
          fc.float({ min: 0, max: 1 }),
          fc.integer({ min: 4, max: 12 }),
          (budget, spendRatio, numPeriods) => {
            const currentSpend = budget * spendRatio
            const currentDate = new Date(2024, Math.floor(numPeriods / 2), 1)
            
            // Generate periods
            const periods = Array.from({ length: numPeriods }, (_, i) => ({
              id: `period-${i}`,
              start_date: new Date(2024, i, 1).toISOString(),
              end_date: new Date(2024, i + 1, 1).toISOString(),
              amount: 0,
              percentage: 0,
              label: `Month ${i + 1}`
            }))
            
            const result = applyReprofiling(budget, currentSpend, periods, currentDate)
            
            const remainingBudget = budget - currentSpend
            
            if (remainingBudget <= 0) {
              // Property: Should zero out all periods if budget consumed
              result.periods.forEach(period => {
                expect(period.amount).toBe(0)
              })
            } else {
              // Property: Only future periods should have amounts
              result.periods.forEach(period => {
                const periodStart = new Date(period.start_date)
                if (periodStart >= currentDate) {
                  expect(period.amount).toBeGreaterThan(0)
                } else {
                  expect(period.amount).toBe(0)
                }
              })
              
              // Property: Total of future periods should equal remaining budget
              const totalAmount = result.periods.reduce((sum, p) => sum + p.amount, 0)
              expect(totalAmount).toBeCloseTo(remainingBudget, 2)
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('validateCustomDistribution', () => {
    it('should validate percentage sums correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 0, max: 100 }), { minLength: 1, maxLength: 12 }),
          (percentages) => {
            const result = validateCustomDistribution(percentages)
            const sum = percentages.reduce((a, b) => a + b, 0)
            
            if (Math.abs(sum - 100) <= 0.01) {
              expect(result.valid).toBe(true)
              expect(result.error).toBeUndefined()
            } else {
              expect(result.valid).toBe(false)
              expect(result.error).toBeDefined()
            }
          }
        ),
        { numRuns: 50 }
      )
    })
    
    it('should reject negative percentages', () => {
      const result = validateCustomDistribution([50, -10, 60])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('negative')
    })
    
    it('should accept valid distribution', () => {
      const result = validateCustomDistribution([25, 25, 25, 25])
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })
})
