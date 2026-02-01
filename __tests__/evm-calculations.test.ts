// Tests for Earned Value Management (EVM) Calculations
// Phase 3: Advanced project performance metrics

import * as fc from 'fast-check'
import {
  calculateBCWS,
  calculateBCWP,
  calculateACWP,
  calculateCPI,
  calculateSPI,
  calculateCV,
  calculateSV,
  calculateEACTypical,
  calculateEACAtypical,
  calculateEACCombined,
  calculateETC,
  calculateVAC,
  calculateTCPI,
  getEVMStatus,
  getIndexColorClass,
  calculateEVMMetrics,
  calculateExtendedEVMMetrics,
  enrichProjectWithEVM,
  formatIndex,
  formatEVMCurrency
} from '@/lib/evm-calculations'
import { EVMInputData, DEFAULT_EVM_THRESHOLDS } from '@/types/evm'
import { ProjectWithFinancials, ProjectStatus, Currency } from '@/types/costbook'

describe('EVM Calculations', () => {
  describe('BCWS (Budgeted Cost of Work Scheduled)', () => {
    it('should calculate BCWS correctly', () => {
      expect(calculateBCWS(100000, 0.5)).toBe(50000)
      expect(calculateBCWS(100000, 0)).toBe(0)
      expect(calculateBCWS(100000, 1)).toBe(100000)
    })

    it('should handle edge cases', () => {
      expect(calculateBCWS(0, 0.5)).toBe(0)
      expect(calculateBCWS(-100000, 0.5)).toBe(0)
      expect(calculateBCWS(100000, 1.5)).toBe(100000) // Clamped to 1
      expect(calculateBCWS(100000, -0.5)).toBe(0) // Clamped to 0
    })
  })

  describe('BCWP (Budgeted Cost of Work Performed)', () => {
    it('should calculate BCWP correctly', () => {
      expect(calculateBCWP(100000, 0.5)).toBe(50000)
      expect(calculateBCWP(100000, 0.25)).toBe(25000)
    })

    it('should handle edge cases', () => {
      expect(calculateBCWP(0, 0.5)).toBe(0)
      expect(calculateBCWP(100000, 0)).toBe(0)
    })
  })

  describe('ACWP (Actual Cost of Work Performed)', () => {
    it('should return actual cost', () => {
      expect(calculateACWP(50000)).toBe(50000)
      expect(calculateACWP(0)).toBe(0)
    })

    it('should handle negative values', () => {
      expect(calculateACWP(-1000)).toBe(0)
    })
  })

  describe('CPI (Cost Performance Index)', () => {
    it('should calculate CPI correctly', () => {
      // Under budget: CPI > 1
      expect(calculateCPI(60000, 50000)).toBe(1.2)
      // On budget: CPI = 1
      expect(calculateCPI(50000, 50000)).toBe(1)
      // Over budget: CPI < 1
      expect(calculateCPI(40000, 50000)).toBe(0.8)
    })

    it('should handle edge cases', () => {
      expect(calculateCPI(50000, 0)).toBe(1.0) // Division by zero returns 1
      expect(calculateCPI(0, 50000)).toBe(0)
    })
  })

  describe('SPI (Schedule Performance Index)', () => {
    it('should calculate SPI correctly', () => {
      // Ahead of schedule: SPI > 1
      expect(calculateSPI(60000, 50000)).toBe(1.2)
      // On schedule: SPI = 1
      expect(calculateSPI(50000, 50000)).toBe(1)
      // Behind schedule: SPI < 1
      expect(calculateSPI(40000, 50000)).toBe(0.8)
    })

    it('should handle edge cases', () => {
      expect(calculateSPI(50000, 0)).toBe(1.0)
    })
  })

  describe('CV (Cost Variance)', () => {
    it('should calculate CV correctly', () => {
      expect(calculateCV(60000, 50000)).toBe(10000) // Under budget
      expect(calculateCV(50000, 50000)).toBe(0) // On budget
      expect(calculateCV(40000, 50000)).toBe(-10000) // Over budget
    })
  })

  describe('SV (Schedule Variance)', () => {
    it('should calculate SV correctly', () => {
      expect(calculateSV(60000, 50000)).toBe(10000) // Ahead
      expect(calculateSV(50000, 50000)).toBe(0) // On track
      expect(calculateSV(40000, 50000)).toBe(-10000) // Behind
    })
  })

  describe('EAC (Estimate at Completion)', () => {
    it('should calculate typical EAC correctly', () => {
      // EAC = BAC / CPI
      expect(calculateEACTypical(100000, 1.0)).toBe(100000)
      expect(calculateEACTypical(100000, 0.8)).toBe(125000) // Over budget projection
      expect(calculateEACTypical(100000, 1.25)).toBe(80000) // Under budget projection
    })

    it('should calculate atypical EAC correctly', () => {
      // EAC = ACWP + (BAC - BCWP)
      expect(calculateEACAtypical(40000, 100000, 50000)).toBe(90000)
    })

    it('should calculate combined EAC correctly', () => {
      // EAC = ACWP + (BAC - BCWP) / (CPI * SPI)
      const result = calculateEACCombined(40000, 100000, 50000, 1.0, 1.0)
      expect(result).toBe(90000)
    })
  })

  describe('ETC (Estimate to Complete)', () => {
    it('should calculate ETC correctly', () => {
      expect(calculateETC(100000, 40000)).toBe(60000)
      expect(calculateETC(100000, 100000)).toBe(0)
      expect(calculateETC(100000, 120000)).toBe(0) // Can't be negative
    })
  })

  describe('VAC (Variance at Completion)', () => {
    it('should calculate VAC correctly', () => {
      expect(calculateVAC(100000, 90000)).toBe(10000) // Under budget
      expect(calculateVAC(100000, 100000)).toBe(0) // On budget
      expect(calculateVAC(100000, 110000)).toBe(-10000) // Over budget
    })
  })

  describe('TCPI (To-Complete Performance Index)', () => {
    it('should calculate TCPI correctly', () => {
      // Required CPI to complete within budget
      const tcpi = calculateTCPI(100000, 50000, 40000)
      // TCPI = (BAC - BCWP) / (BAC - ACWP) = 50000 / 60000 = 0.833
      expect(tcpi).toBeCloseTo(0.833, 2)
    })

    it('should handle edge cases', () => {
      expect(calculateTCPI(100000, 50000, 100000)).toBe(1.0) // No remaining budget
    })
  })

  describe('getEVMStatus', () => {
    it('should return excellent for high performers', () => {
      expect(getEVMStatus(1.2, 1.15)).toBe('excellent')
    })

    it('should return good for on-track projects', () => {
      expect(getEVMStatus(1.05, 1.02)).toBe('good')
    })

    it('should return caution for slight deviations', () => {
      expect(getEVMStatus(0.95, 0.92)).toBe('caution')
    })

    it('should return warning for significant deviations', () => {
      expect(getEVMStatus(0.85, 0.82)).toBe('warning')
    })

    it('should return critical for major issues', () => {
      expect(getEVMStatus(0.7, 0.75)).toBe('critical')
    })

    it('should use the lower of CPI and SPI', () => {
      expect(getEVMStatus(1.2, 0.7)).toBe('critical') // SPI is critical
      expect(getEVMStatus(0.7, 1.2)).toBe('critical') // CPI is critical
    })
  })

  describe('getIndexColorClass', () => {
    it('should return correct colors for different values', () => {
      expect(getIndexColorClass(1.15)).toContain('emerald')
      expect(getIndexColorClass(1.05)).toContain('green')
      expect(getIndexColorClass(0.95)).toContain('yellow')
      expect(getIndexColorClass(0.85)).toContain('orange')
      expect(getIndexColorClass(0.75)).toContain('red')
    })
  })

  describe('calculateEVMMetrics', () => {
    it('should calculate all metrics correctly', () => {
      const input: EVMInputData = {
        budget: 100000,
        plannedProgress: 0.5,
        earnedProgress: 0.4,
        actualCost: 45000,
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      }

      const metrics = calculateEVMMetrics(input)

      expect(metrics.bac).toBe(100000)
      expect(metrics.bcws).toBe(50000) // 100000 * 0.5
      expect(metrics.bcwp).toBe(40000) // 100000 * 0.4
      expect(metrics.acwp).toBe(45000)
      expect(metrics.cpi).toBeCloseTo(0.889, 2) // 40000 / 45000
      expect(metrics.spi).toBe(0.8) // 40000 / 50000
      expect(metrics.cv).toBe(-5000) // 40000 - 45000
      expect(metrics.sv).toBe(-10000) // 40000 - 50000
    })
  })

  describe('formatIndex', () => {
    it('should format indices with 2 decimal places', () => {
      expect(formatIndex(1.0)).toBe('1.00')
      expect(formatIndex(0.95)).toBe('0.95')
      expect(formatIndex(1.123)).toBe('1.12')
    })
  })

  describe('formatEVMCurrency', () => {
    it('should format large values correctly', () => {
      expect(formatEVMCurrency(1500000)).toBe('$1.5M')
      expect(formatEVMCurrency(50000)).toBe('$50K')
      expect(formatEVMCurrency(500)).toBe('$500')
    })

    it('should handle negative values', () => {
      expect(formatEVMCurrency(-50000)).toBe('$-50K')
    })
  })

  describe('Property-based tests', () => {
    it('CPI should be consistent with cost performance', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 1000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 1, max: 1000000, noNaN: true }).map(Math.fround),
          (bcwp, acwp) => {
            const cpi = calculateCPI(bcwp, acwp)
            
            // CPI should be positive
            expect(cpi).toBeGreaterThanOrEqual(0)
            
            // If BCWP > ACWP (with tolerance), CPI should be > 1 (under budget)
            if (bcwp > acwp * 1.001 && acwp > 0) {
              expect(cpi).toBeGreaterThan(1)
            }
            // If BCWP < ACWP (with tolerance), CPI should be < 1 (over budget)
            if (bcwp * 1.001 < acwp && acwp > 0) {
              expect(cpi).toBeLessThan(1)
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('SPI should be consistent with schedule performance', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 1000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 1, max: 1000000, noNaN: true }).map(Math.fround),
          (bcwp, bcws) => {
            const spi = calculateSPI(bcwp, bcws)
            
            // SPI should be positive
            expect(spi).toBeGreaterThanOrEqual(0)
            
            // If BCWP > BCWS (with tolerance), SPI should be > 1 (ahead of schedule)
            if (bcwp > bcws * 1.001 && bcws > 0) {
              expect(spi).toBeGreaterThan(1)
            }
            // If BCWP < BCWS (with tolerance), SPI should be < 1 (behind schedule)
            if (bcwp * 1.001 < bcws && bcws > 0) {
              expect(spi).toBeLessThan(1)
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('CV should equal BCWP - ACWP', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000000, max: 1000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          (bcwp, acwp) => {
            const cv = calculateCV(bcwp, acwp)
            expect(cv).toBeCloseTo(bcwp - acwp, 1)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('SV should equal BCWP - BCWS', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000000, max: 1000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          (bcwp, bcws) => {
            const sv = calculateSV(bcwp, bcws)
            expect(sv).toBeCloseTo(bcwp - bcws, 1)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('EVM status should be consistent with thresholds', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.5, max: 1.5, noNaN: true }),
          fc.float({ min: 0.5, max: 1.5, noNaN: true }),
          (cpi, spi) => {
            const status = getEVMStatus(cpi, spi)
            const minIndex = Math.min(cpi, spi)
            
            // Verify status matches thresholds
            if (minIndex >= 1.1) {
              expect(status).toBe('excellent')
            } else if (minIndex >= 1.0) {
              expect(status).toBe('good')
            } else if (minIndex >= 0.9) {
              expect(status).toBe('caution')
            } else if (minIndex >= 0.8) {
              expect(status).toBe('warning')
            } else {
              expect(status).toBe('critical')
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('ETC should be non-negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          fc.float({ min: 0, max: 1000000, noNaN: true }).map(Math.fround),
          (eac, acwp) => {
            const etc = calculateETC(eac, acwp)
            expect(etc).toBeGreaterThanOrEqual(0)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('calculateEVMMetrics should return valid structure', () => {
      const inputArb = fc.record({
        budget: fc.float({ min: 1000, max: 10000000, noNaN: true }).map(Math.fround),
        plannedProgress: fc.float({ min: 0, max: 1, noNaN: true }),
        earnedProgress: fc.float({ min: 0, max: 1, noNaN: true }),
        actualCost: fc.float({ min: 0, max: 10000000, noNaN: true }).map(Math.fround),
        startDate: fc.constant('2024-01-01'),
        endDate: fc.constant('2024-12-31')
      })

      fc.assert(
        fc.property(inputArb, (input) => {
          const metrics = calculateEVMMetrics(input as EVMInputData)
          
          // All metrics should be defined
          expect(metrics).toHaveProperty('bcws')
          expect(metrics).toHaveProperty('bcwp')
          expect(metrics).toHaveProperty('acwp')
          expect(metrics).toHaveProperty('cpi')
          expect(metrics).toHaveProperty('spi')
          expect(metrics).toHaveProperty('cv')
          expect(metrics).toHaveProperty('sv')
          expect(metrics).toHaveProperty('eac')
          expect(metrics).toHaveProperty('etc')
          expect(metrics).toHaveProperty('vac')
          expect(metrics).toHaveProperty('tcpi')
          expect(metrics).toHaveProperty('bac')
          
          // CPI and SPI should be positive
          expect(metrics.cpi).toBeGreaterThanOrEqual(0)
          expect(metrics.spi).toBeGreaterThanOrEqual(0)
          
          // BAC should equal input budget
          expect(metrics.bac).toBe(input.budget)
        }),
        { numRuns: 50 }
      )
    })
  })
})
