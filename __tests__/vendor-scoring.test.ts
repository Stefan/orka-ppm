// Tests for Vendor Scoring
// Phase 3: Vendor performance analytics

import * as fc from 'fast-check'
import {
  calculateVendorScore,
  calculateOnTimeDeliveryRate,
  calculateCostVariance,
  getVendorRating,
  getScoreColorClass,
  analyzeVendorTrend,
  filterVendors,
  sortVendors,
  formatScore,
  formatPercentage,
  fetchVendors,
  fetchVendorById,
  fetchVendorHistory,
  getVendorStats
} from '@/lib/vendor-scoring'
import {
  VendorMetrics,
  VendorWithMetrics,
  VendorFilter,
  VendorSortOption,
  VendorHistoryPoint,
  VendorRating
} from '@/types/vendor'

describe('Vendor Scoring', () => {
  describe('calculateVendorScore', () => {
    it('should return high score for excellent metrics', () => {
      const metrics: VendorMetrics = {
        vendor_id: 'test',
        avg_delivery_days: 14,
        delivery_std_dev: 1,
        avg_cost_variance: 0,
        late_deliveries: 0,
        total_deliveries: 20,
        avg_quality_rating: 5,
        quality_issues: 0,
        avg_response_time_hours: 1
      }

      const score = calculateVendorScore(metrics)
      expect(score).toBeGreaterThan(90)
    })

    it('should return low score for poor metrics', () => {
      const metrics: VendorMetrics = {
        vendor_id: 'test',
        avg_delivery_days: 60,
        delivery_std_dev: 20,
        avg_cost_variance: 50,
        late_deliveries: 15,
        total_deliveries: 20,
        avg_quality_rating: 1,
        quality_issues: 10,
        avg_response_time_hours: 72
      }

      const score = calculateVendorScore(metrics)
      expect(score).toBeLessThan(40)
    })

    it('should handle zero deliveries', () => {
      const metrics: VendorMetrics = {
        vendor_id: 'test',
        avg_delivery_days: 14,
        delivery_std_dev: 0,
        avg_cost_variance: 0,
        late_deliveries: 0,
        total_deliveries: 0,
        avg_quality_rating: 4,
        quality_issues: 0,
        avg_response_time_hours: 4
      }

      const score = calculateVendorScore(metrics)
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('calculateOnTimeDeliveryRate', () => {
    it('should return 100% for no late deliveries', () => {
      expect(calculateOnTimeDeliveryRate(10, 0)).toBe(100)
    })

    it('should return 50% for half late deliveries', () => {
      expect(calculateOnTimeDeliveryRate(10, 5)).toBe(50)
    })

    it('should return 0% for all late deliveries', () => {
      expect(calculateOnTimeDeliveryRate(10, 10)).toBe(0)
    })

    it('should return 100% for zero total deliveries', () => {
      expect(calculateOnTimeDeliveryRate(0, 0)).toBe(100)
    })
  })

  describe('calculateCostVariance', () => {
    it('should return 0% for matching committed and actual', () => {
      expect(calculateCostVariance(100000, 100000)).toBe(0)
    })

    it('should return positive for over-budget', () => {
      expect(calculateCostVariance(100000, 110000)).toBe(10)
    })

    it('should return negative for under-budget', () => {
      expect(calculateCostVariance(100000, 90000)).toBe(-10)
    })

    it('should return 0 for zero committed', () => {
      expect(calculateCostVariance(0, 10000)).toBe(0)
    })
  })

  describe('getVendorRating', () => {
    it('should return A for scores >= 90', () => {
      expect(getVendorRating(90)).toBe('A')
      expect(getVendorRating(95)).toBe('A')
      expect(getVendorRating(100)).toBe('A')
    })

    it('should return B for scores 75-89', () => {
      expect(getVendorRating(75)).toBe('B')
      expect(getVendorRating(89)).toBe('B')
    })

    it('should return C for scores 60-74', () => {
      expect(getVendorRating(60)).toBe('C')
      expect(getVendorRating(74)).toBe('C')
    })

    it('should return D for scores 40-59', () => {
      expect(getVendorRating(40)).toBe('D')
      expect(getVendorRating(59)).toBe('D')
    })

    it('should return F for scores < 40', () => {
      expect(getVendorRating(0)).toBe('F')
      expect(getVendorRating(39)).toBe('F')
    })
  })

  describe('getScoreColorClass', () => {
    it('should return emerald for scores >= 90', () => {
      expect(getScoreColorClass(90)).toContain('emerald')
    })

    it('should return green for scores >= 75', () => {
      expect(getScoreColorClass(75)).toContain('green')
    })

    it('should return yellow for scores >= 60', () => {
      expect(getScoreColorClass(60)).toContain('yellow')
    })

    it('should return orange for scores >= 40', () => {
      expect(getScoreColorClass(40)).toContain('orange')
    })

    it('should return red for scores < 40', () => {
      expect(getScoreColorClass(30)).toContain('red')
    })
  })

  describe('analyzeVendorTrend', () => {
    it('should return improving for upward trend', () => {
      // Need 6+ entries so first 3 and last 3 don't overlap
      const history: VendorHistoryPoint[] = [
        { date: '2024-01-01', overall_score: 60, on_time_delivery_rate: 60, cost_variance_percentage: 8, quality_score: 60 },
        { date: '2024-02-01', overall_score: 62, on_time_delivery_rate: 62, cost_variance_percentage: 7, quality_score: 62 },
        { date: '2024-03-01', overall_score: 65, on_time_delivery_rate: 65, cost_variance_percentage: 6, quality_score: 65 },
        { date: '2024-04-01', overall_score: 70, on_time_delivery_rate: 70, cost_variance_percentage: 5, quality_score: 70 },
        { date: '2024-05-01', overall_score: 75, on_time_delivery_rate: 75, cost_variance_percentage: 4, quality_score: 75 },
        { date: '2024-06-01', overall_score: 80, on_time_delivery_rate: 80, cost_variance_percentage: 3, quality_score: 80 }
      ]
      // firstAvg = (60+62+65)/3 = 62.3, lastAvg = (70+75+80)/3 = 75, change = +12.7 > 5

      expect(analyzeVendorTrend(history)).toBe('improving')
    })

    it('should return declining for downward trend', () => {
      // Need 6+ entries so first 3 and last 3 don't overlap
      const history: VendorHistoryPoint[] = [
        { date: '2024-01-01', overall_score: 80, on_time_delivery_rate: 80, cost_variance_percentage: 3, quality_score: 80 },
        { date: '2024-02-01', overall_score: 78, on_time_delivery_rate: 78, cost_variance_percentage: 4, quality_score: 78 },
        { date: '2024-03-01', overall_score: 75, on_time_delivery_rate: 75, cost_variance_percentage: 5, quality_score: 75 },
        { date: '2024-04-01', overall_score: 70, on_time_delivery_rate: 70, cost_variance_percentage: 6, quality_score: 70 },
        { date: '2024-05-01', overall_score: 65, on_time_delivery_rate: 65, cost_variance_percentage: 7, quality_score: 65 },
        { date: '2024-06-01', overall_score: 60, on_time_delivery_rate: 60, cost_variance_percentage: 8, quality_score: 60 }
      ]
      // firstAvg = (80+78+75)/3 = 77.7, lastAvg = (70+65+60)/3 = 65, change = -12.7 < -5

      expect(analyzeVendorTrend(history)).toBe('declining')
    })

    it('should return stable for flat trend', () => {
      const history: VendorHistoryPoint[] = [
        { date: '2024-01-01', overall_score: 75, on_time_delivery_rate: 75, cost_variance_percentage: 5, quality_score: 75 },
        { date: '2024-02-01', overall_score: 75, on_time_delivery_rate: 75, cost_variance_percentage: 5, quality_score: 75 },
        { date: '2024-03-01', overall_score: 75, on_time_delivery_rate: 75, cost_variance_percentage: 5, quality_score: 75 }
      ]

      expect(analyzeVendorTrend(history)).toBe('stable')
    })

    it('should return stable for insufficient data', () => {
      const history: VendorHistoryPoint[] = [
        { date: '2024-01-01', overall_score: 75, on_time_delivery_rate: 75, cost_variance_percentage: 5, quality_score: 75 }
      ]

      expect(analyzeVendorTrend(history)).toBe('stable')
    })
  })

  describe('formatScore', () => {
    it('should format with one decimal place', () => {
      expect(formatScore(85.67)).toBe('85.7')
      expect(formatScore(90)).toBe('90.0')
      expect(formatScore(75.5)).toBe('75.5')
    })
  })

  describe('formatPercentage', () => {
    it('should format positive percentages with + prefix', () => {
      expect(formatPercentage(10.5)).toBe('+10.5%')
    })

    it('should format negative percentages without + prefix', () => {
      expect(formatPercentage(-5.5)).toBe('-5.5%')
    })

    it('should format zero', () => {
      // Zero doesn't get a + prefix since it's not positive
      expect(formatPercentage(0)).toBe('0.0%')
    })
  })

  describe('fetchVendors', () => {
    it('should fetch all vendors', async () => {
      const vendors = await fetchVendors()
      expect(Array.isArray(vendors)).toBe(true)
      expect(vendors.length).toBeGreaterThan(0)
    })

    it('should filter by status', async () => {
      const vendors = await fetchVendors({ status: ['active'] })
      expect(vendors.every(v => v.status === 'active')).toBe(true)
    })

    it('should filter by rating', async () => {
      const vendors = await fetchVendors({ rating: ['A', 'B'] })
      expect(vendors.every(v => ['A', 'B'].includes(v.score.rating))).toBe(true)
    })

    it('should sort by score descending', async () => {
      const vendors = await fetchVendors(undefined, { field: 'overall_score', direction: 'desc' })
      for (let i = 1; i < vendors.length; i++) {
        expect(vendors[i - 1].score.overall_score).toBeGreaterThanOrEqual(vendors[i].score.overall_score)
      }
    })
  })

  describe('fetchVendorById', () => {
    it('should return vendor for valid ID', async () => {
      const vendor = await fetchVendorById('vendor-001')
      expect(vendor).not.toBeNull()
      expect(vendor?.id).toBe('vendor-001')
    })

    it('should return null for invalid ID', async () => {
      const vendor = await fetchVendorById('non-existent')
      expect(vendor).toBeNull()
    })
  })

  describe('fetchVendorHistory', () => {
    it('should return history for valid vendor', async () => {
      const history = await fetchVendorHistory('vendor-001')
      expect(history).not.toBeNull()
      expect(history?.vendor_id).toBe('vendor-001')
      expect(history?.history.length).toBeGreaterThan(0)
    })

    it('should return null for invalid vendor', async () => {
      const history = await fetchVendorHistory('non-existent')
      expect(history).toBeNull()
    })
  })

  describe('getVendorStats', () => {
    it('should return aggregate statistics', async () => {
      const stats = await getVendorStats()

      expect(stats).toHaveProperty('total')
      expect(stats).toHaveProperty('byRating')
      expect(stats).toHaveProperty('avgScore')
      expect(stats).toHaveProperty('topPerformer')

      expect(stats.total).toBeGreaterThan(0)
      expect(stats.avgScore).toBeGreaterThan(0)
      expect(stats.topPerformer).not.toBeNull()
    })
  })

  describe('Property-based tests', () => {
    it('score should always be between 0 and 100', () => {
      fc.assert(
        fc.property(
          fc.record({
            vendor_id: fc.string(),
            avg_delivery_days: fc.float({ min: 0, max: 365, noNaN: true }),
            delivery_std_dev: fc.float({ min: 0, max: 50, noNaN: true }),
            avg_cost_variance: fc.float({ min: -100, max: 100, noNaN: true }),
            late_deliveries: fc.nat({ max: 100 }),
            total_deliveries: fc.nat({ max: 100 }),
            avg_quality_rating: fc.float({ min: 0, max: 5, noNaN: true }),
            quality_issues: fc.nat({ max: 50 }),
            avg_response_time_hours: fc.float({ min: 0, max: 168, noNaN: true })
          }),
          (metrics) => {
            // Ensure late_deliveries doesn't exceed total_deliveries
            const adjustedMetrics: VendorMetrics = {
              ...metrics,
              late_deliveries: Math.min(metrics.late_deliveries, metrics.total_deliveries)
            }
            
            const score = calculateVendorScore(adjustedMetrics)
            expect(score).toBeGreaterThanOrEqual(0)
            expect(score).toBeLessThanOrEqual(100)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('on-time delivery rate should be between 0 and 100', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 1000 }),
          fc.nat({ max: 1000 }),
          (total, late) => {
            const adjustedLate = Math.min(late, total)
            const rate = calculateOnTimeDeliveryRate(total, adjustedLate)
            expect(rate).toBeGreaterThanOrEqual(0)
            expect(rate).toBeLessThanOrEqual(100)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('rating should be consistent with score', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          (score) => {
            const rating = getVendorRating(score)
            
            if (score >= 90) expect(rating).toBe('A')
            else if (score >= 75) expect(rating).toBe('B')
            else if (score >= 60) expect(rating).toBe('C')
            else if (score >= 40) expect(rating).toBe('D')
            else expect(rating).toBe('F')
          }
        ),
        { numRuns: 50 }
      )
    })

    it('cost variance should handle any committed/actual values', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 10000000, noNaN: true }),
          fc.float({ min: 0, max: 10000000, noNaN: true }),
          (committed, actual) => {
            const variance = calculateCostVariance(committed, actual)
            
            if (committed === 0) {
              expect(variance).toBe(0)
            } else {
              expect(typeof variance).toBe('number')
              expect(isFinite(variance)).toBe(true)
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('sorting should maintain order consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('overall_score', 'name', 'on_time_delivery_rate', 'projects_completed') as fc.Arbitrary<VendorSortOption['field']>,
          fc.constantFrom('asc', 'desc') as fc.Arbitrary<VendorSortOption['direction']>,
          async (field, direction) => {
            const vendors = await fetchVendors(undefined, { field, direction })
            
            // Verify order is consistent
            for (let i = 1; i < vendors.length; i++) {
              const prev = vendors[i - 1]
              const curr = vendors[i]
              
              let prevVal: number | string
              let currVal: number | string
              
              switch (field) {
                case 'name':
                  prevVal = prev.name.toLowerCase()
                  currVal = curr.name.toLowerCase()
                  break
                case 'overall_score':
                  prevVal = prev.score.overall_score
                  currVal = curr.score.overall_score
                  break
                case 'on_time_delivery_rate':
                  prevVal = prev.score.on_time_delivery_rate
                  currVal = curr.score.on_time_delivery_rate
                  break
                case 'projects_completed':
                  prevVal = prev.score.projects_completed
                  currVal = curr.score.projects_completed
                  break
              }
              
              if (direction === 'asc') {
                expect(prevVal <= currVal).toBe(true)
              } else {
                expect(prevVal >= currVal).toBe(true)
              }
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    // Property 40: Vendor Trend Consistency (Validates: Requirements 42.6)
    it('Property 40: analyzeVendorTrend returns improving when last avg > first avg by >5', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              overall_score: fc.double(50, 70),
              on_time_delivery_rate: fc.double(70, 95),
              quality_score: fc.double(70, 95)
            }),
            { minLength: 4 }
          ),
          (historyPoints) => {
            const history: VendorHistoryPoint[] = historyPoints.map((p, i) => ({
              date: new Date(Date.now() - (historyPoints.length - i) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
              overall_score: p.overall_score,
              on_time_delivery_rate: p.on_time_delivery_rate,
              cost_variance_percentage: 0,
              quality_score: p.quality_score
            }))
            const firstAvg = history.slice(0, 3).reduce((s, h) => s + h.overall_score, 0) / Math.min(3, history.length)
            const lastAvg = history.slice(-3).reduce((s, h) => s + h.overall_score, 0) / Math.min(3, history.length)
            const trend = analyzeVendorTrend(history)
            if (lastAvg - firstAvg > 5) expect(trend).toBe('improving')
            if (firstAvg - lastAvg > 5) expect(trend).toBe('declining')
            expect(['improving', 'stable', 'declining']).toContain(trend)
          }
        ),
        { numRuns: 20 }
      )
    })

    // P3.3.6 Property 20: Vendor Score Calculation Consistency (Validates: Requirements 15.1)
    it('Property 20: same metrics produce same vendor score', () => {
      fc.assert(
        fc.property(
          fc.record({
            avg_delivery_days: fc.integer({ min: 1, max: 90 }),
            delivery_std_dev: fc.integer({ min: 0, max: 30 }),
            avg_cost_variance: fc.double(-50, 50),
            late_deliveries: fc.integer({ min: 0, max: 20 }),
            total_deliveries: fc.integer({ min: 1, max: 50 }),
            avg_quality_rating: fc.double(0, 5),
            quality_issues: fc.integer({ min: 0, max: 20 }),
            avg_response_time_hours: fc.double(0, 72)
          }).filter(
            (r) =>
              Number.isFinite(r.avg_cost_variance) &&
              Number.isFinite(r.avg_quality_rating) &&
              Number.isFinite(r.avg_response_time_hours)
          ),
          (r) => {
            const m: VendorMetrics = {
              vendor_id: 'v',
              ...r,
              total_deliveries: Math.max(1, r.total_deliveries),
              late_deliveries: Math.min(r.late_deliveries, r.total_deliveries)
            }
            const s1 = calculateVendorScore(m)
            const s2 = calculateVendorScore({ ...m })
            expect(s1).toBe(s2)
            expect(s1).toBeGreaterThanOrEqual(0)
            expect(s1).toBeLessThanOrEqual(100)
          }
        ),
        { numRuns: 30 }
      )
    })

    // Property 21: Vendor Metrics Completeness (Validates: Requirements 15.3)
    it('Property 21: filterVendors preserves metric completeness', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            search: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
            min_score: fc.option(fc.double(0, 100), { nil: undefined })
          }),
          async (filter) => {
            const vendors = await fetchVendors(undefined, { field: 'name', direction: 'asc' })
            const filtered = filterVendors(vendors, filter)
            for (const v of filtered) {
              expect(v).toHaveProperty('score')
              expect(v.score).toHaveProperty('overall_score')
              expect(v.score).toHaveProperty('on_time_delivery_rate')
              expect(v.score).toHaveProperty('cost_variance_percentage')
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    // Property 22: Vendor Filtering Correctness (Validates: Requirements 15.5)
    it('Property 22: filtered list is subset and respects filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }).filter(n => n >= 0 && n <= 100),
          async (minScore) => {
            const vendors = await fetchVendors()
            const filtered = filterVendors(vendors, { min_score: minScore })
            expect(filtered.length).toBeLessThanOrEqual(vendors.length)
            for (const v of filtered) {
              expect(v.score.overall_score).toBeGreaterThanOrEqual(minScore)
            }
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})
