/**
 * Rundown Profiles Tests
 * 
 * Tests for rundown profile types, utilities, and calculations
 */

import { describe, it, expect, test } from '@jest/globals'
import fc from 'fast-check'
import {
  formatMonthLabel,
  getCurrentMonth,
  compareMonths,
  isFutureMonth,
  isCurrentMonth,
  calculateVariance,
  profilesToChartData,
  RundownProfile,
  RundownChartPoint,
  DEFAULT_RUNDOWN_CONFIG
} from '../../types/rundown'

describe('Rundown Profile Utilities', () => {
  describe('formatMonthLabel', () => {
    it('should format YYYYMM to "Mon YY"', () => {
      expect(formatMonthLabel('202401')).toBe('Jan 24')
      expect(formatMonthLabel('202306')).toBe('Jun 23')
      expect(formatMonthLabel('202412')).toBe('Dec 24')
    })
    
    it('should handle edge cases', () => {
      expect(formatMonthLabel('202501')).toBe('Jan 25')
      expect(formatMonthLabel('200001')).toBe('Jan 00')
    })
    
    // Property test: output always contains 3-letter month and 2-digit year
    test('formatMonthLabel output format', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2000, max: 2100 }),
          fc.integer({ min: 1, max: 12 }),
          (year, month) => {
            const input = `${year}${month.toString().padStart(2, '0')}`
            const result = formatMonthLabel(input)
            
            // Result should be "Mon YY" format (6 chars)
            expect(result.length).toBe(6)
            expect(result).toMatch(/^[A-Z][a-z]{2} \d{2}$/)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
  
  describe('getCurrentMonth', () => {
    it('should return current month in YYYYMM format', () => {
      const result = getCurrentMonth()
      expect(result).toMatch(/^\d{6}$/)
      
      const now = new Date()
      const expectedYear = now.getFullYear().toString()
      const expectedMonth = (now.getMonth() + 1).toString().padStart(2, '0')
      
      expect(result).toBe(`${expectedYear}${expectedMonth}`)
    })
  })
  
  describe('compareMonths', () => {
    it('should correctly compare months', () => {
      expect(compareMonths('202401', '202402')).toBeLessThan(0)
      expect(compareMonths('202402', '202401')).toBeGreaterThan(0)
      expect(compareMonths('202401', '202401')).toBe(0)
    })
    
    it('should handle year boundaries', () => {
      expect(compareMonths('202312', '202401')).toBeLessThan(0)
      expect(compareMonths('202401', '202312')).toBeGreaterThan(0)
    })
    
    // Property test: comparison is consistent
    test('compareMonths consistency', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 202001, max: 203012 }),
          fc.integer({ min: 202001, max: 203012 }),
          (a, b) => {
            const aStr = a.toString()
            const bStr = b.toString()
            
            const cmp = compareMonths(aStr, bStr)
            
            if (a < b) expect(cmp).toBeLessThan(0)
            else if (a > b) expect(cmp).toBeGreaterThan(0)
            else expect(cmp).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
  
  describe('isFutureMonth', () => {
    it('should identify future months', () => {
      // A month far in the future should be identified as future
      expect(isFutureMonth('209912')).toBe(true)
    })
    
    it('should identify past months', () => {
      // A month in the past
      expect(isFutureMonth('202001')).toBe(false)
    })
  })
  
  describe('isCurrentMonth', () => {
    it('should identify current month', () => {
      const currentMonth = getCurrentMonth()
      expect(isCurrentMonth(currentMonth)).toBe(true)
    })
    
    it('should not identify other months as current', () => {
      expect(isCurrentMonth('200001')).toBe(false)
      expect(isCurrentMonth('209912')).toBe(false)
    })
  })
  
  describe('calculateVariance', () => {
    it('should calculate positive variance (over budget)', () => {
      const result = calculateVariance(110, 100)
      expect(result.absolute).toBe(10)
      expect(result.percentage).toBeCloseTo(10)
      expect(result.isOver).toBe(true)
    })
    
    it('should calculate negative variance (under budget)', () => {
      const result = calculateVariance(90, 100)
      expect(result.absolute).toBe(-10)
      expect(result.percentage).toBeCloseTo(-10)
      expect(result.isOver).toBe(false)
    })
    
    it('should handle zero planned', () => {
      const result = calculateVariance(100, 0)
      expect(result.percentage).toBe(0)
      expect(result.isOver).toBe(true)
    })
    
    it('should handle zero actual', () => {
      const result = calculateVariance(0, 100)
      expect(result.absolute).toBe(-100)
      expect(result.percentage).toBeCloseTo(-100)
      expect(result.isOver).toBe(false)
    })
    
    // Property test: variance sign matches isOver
    test('variance isOver consistency', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0), max: Math.fround(1000000), noNaN: true }),
          fc.float({ min: Math.fround(1), max: Math.fround(1000000), noNaN: true }),
          (actual, planned) => {
            const result = calculateVariance(actual, planned)
            
            // isOver should be true when actual > planned
            expect(result.isOver).toBe(actual > planned)
            
            // Absolute variance matches sign
            if (actual > planned) {
              expect(result.absolute).toBeGreaterThan(0)
            } else if (actual < planned) {
              expect(result.absolute).toBeLessThan(0)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
  
  describe('profilesToChartData', () => {
    it('should convert profiles to chart data', () => {
      const profiles: RundownProfile[] = [
        {
          id: '1',
          project_id: 'proj1',
          month: '202401',
          planned_value: 10000,
          actual_value: 9500,
          predicted_value: null,
          profile_type: 'standard',
          scenario_name: 'baseline',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        },
        {
          id: '2',
          project_id: 'proj1',
          month: '202402',
          planned_value: 20000,
          actual_value: 21000,
          predicted_value: null,
          profile_type: 'standard',
          scenario_name: 'baseline',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]
      
      const chartData = profilesToChartData(profiles)
      
      expect(chartData).toHaveLength(2)
      expect(chartData[0].month).toBe('202401')
      expect(chartData[0].label).toBe('Jan 24')
      expect(chartData[0].planned).toBe(10000)
      expect(chartData[0].actual).toBe(9500)
      expect(chartData[1].month).toBe('202402')
    })
    
    it('should sort by month', () => {
      const profiles: RundownProfile[] = [
        {
          id: '2',
          project_id: 'proj1',
          month: '202403',
          planned_value: 30000,
          actual_value: 30000,
          predicted_value: null,
          profile_type: 'standard',
          scenario_name: 'baseline',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        },
        {
          id: '1',
          project_id: 'proj1',
          month: '202401',
          planned_value: 10000,
          actual_value: 10000,
          predicted_value: null,
          profile_type: 'standard',
          scenario_name: 'baseline',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]
      
      const chartData = profilesToChartData(profiles)
      
      expect(chartData[0].month).toBe('202401')
      expect(chartData[1].month).toBe('202403')
    })
    
    it('should handle empty profiles', () => {
      const chartData = profilesToChartData([])
      expect(chartData).toHaveLength(0)
    })
    
    // Property test: output length matches input length
    test('profilesToChartData preserves count', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              project_id: fc.uuid(),
              month: fc.integer({ min: 202001, max: 202512 }).map(n => n.toString()),
              planned_value: fc.float({ min: Math.fround(0), max: Math.fround(1000000), noNaN: true }),
              actual_value: fc.float({ min: Math.fround(0), max: Math.fround(1000000), noNaN: true }),
              predicted_value: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(1000000), noNaN: true }), { nil: null }),
              profile_type: fc.constant('standard' as const),
              scenario_name: fc.constant('baseline'),
              created_at: fc.constant('2024-01-01'),
              updated_at: fc.constant('2024-01-01')
            }),
            { minLength: 0, maxLength: 24 }
          ),
          (profiles) => {
            const chartData = profilesToChartData(profiles as RundownProfile[])
            expect(chartData.length).toBe(profiles.length)
          }
        ),
        { numRuns: 50 }
      )
    })
  })
  
  describe('DEFAULT_RUNDOWN_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_RUNDOWN_CONFIG.cron_schedule).toBe('0 2 * * *')
      expect(DEFAULT_RUNDOWN_CONFIG.prediction_months).toBe(6)
      expect(DEFAULT_RUNDOWN_CONFIG.warning_threshold).toBe(10)
      expect(DEFAULT_RUNDOWN_CONFIG.realtime_enabled).toBe(true)
      expect(DEFAULT_RUNDOWN_CONFIG.realtime_debounce_ms).toBe(2000)
    })
  })
})

describe('Rundown Profile Types', () => {
  it('should define correct profile types', () => {
    const standardProfile: RundownProfile = {
      id: '1',
      project_id: 'proj1',
      month: '202401',
      planned_value: 10000,
      actual_value: 10500,
      predicted_value: null,
      profile_type: 'standard',
      scenario_name: 'baseline',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
    
    expect(standardProfile.profile_type).toBe('standard')
    expect(standardProfile.scenario_name).toBe('baseline')
  })
  
  it('should allow optimistic and pessimistic profile types', () => {
    const optimisticProfile: RundownProfile = {
      id: '1',
      project_id: 'proj1',
      month: '202401',
      planned_value: 9000,
      actual_value: 9000,
      predicted_value: 8500,
      profile_type: 'optimistic',
      scenario_name: 'optimistic-2024',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
    
    expect(optimisticProfile.profile_type).toBe('optimistic')
    expect(optimisticProfile.predicted_value).toBe(8500)
  })
})
