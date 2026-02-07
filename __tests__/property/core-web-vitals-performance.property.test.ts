/**
 * Property-based tests for Core Web Vitals performance
 * Feature: mobile-first-ui-enhancements, Property 27: Core Web Vitals Performance
 * Validates: Requirements 9.1, 9.2, 9.3
 */

import fc from 'fast-check'
import { performanceMonitor, getCoreWebVitalsReport, checkPerformanceBudgets } from '@/lib/performance'

// Mock performance APIs for testing
const mockPerformanceObserver = jest.fn()
const mockPerformanceEntry = jest.fn()

// Mock web-vitals library
jest.mock('web-vitals', () => ({
  getCLS: jest.fn((callback) => {
    callback({ name: 'CLS', value: 0.05, id: 'test-cls', delta: 0.05, entries: [] })
  }),
  getFCP: jest.fn((callback) => {
    callback({ name: 'FCP', value: 1200, id: 'test-fcp', delta: 1200, entries: [] })
  }),
  getFID: jest.fn((callback) => {
    callback({ name: 'FID', value: 80, id: 'test-fid', delta: 80, entries: [] })
  }),
  getLCP: jest.fn((callback) => {
    callback({ name: 'LCP', value: 2000, id: 'test-lcp', delta: 2000, entries: [] })
  }),
  getTTFB: jest.fn((callback) => {
    callback({ name: 'TTFB', value: 600, id: 'test-ttfb', delta: 600, entries: [] })
  })
}))

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn()
  },
  writable: true
})

// Mock PerformanceObserver
Object.defineProperty(global, 'PerformanceObserver', {
  value: jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
    takeRecords: jest.fn(() => [])
  })),
  writable: true
})

describe('Core Web Vitals Performance Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    performanceMonitor.clearMetrics()
  })

  afterEach(() => {
    performanceMonitor.disconnect()
  })

  /**
   * Property 27: Core Web Vitals Performance
   * For any page load or interaction, the system should maintain LCP < 2.5s, FID < 100ms, and CLS < 0.1
   */
  describe('Property 27: Core Web Vitals Performance', () => {
    test('LCP values should be within acceptable thresholds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 0, max: 10000 }), // LCP values in milliseconds
          async (lcpValue) => {
            // Mock LCP measurement
            const mockGetLCP = require('web-vitals').getLCP
            mockGetLCP.mockImplementationOnce((callback: any) => {
              callback({ name: 'LCP', value: lcpValue, id: 'test-lcp', delta: lcpValue, entries: [] })
            })

            // Get Core Web Vitals report
            const report = await getCoreWebVitalsReport()

            // Property: LCP should be measured and categorized correctly
            expect(report.LCP).toBe(lcpValue)

            // Performance budget check
            const budgetStatus = checkPerformanceBudgets()
            const lcpBudget = budgetStatus.find(b => b.metric === 'LCP')

            if (lcpBudget) {
              if (lcpValue <= 2500) {
                // Good performance - should not exceed budget
                expect(lcpBudget.status).not.toBe('exceeded')
              } else if (lcpValue > 4000) {
                // Poor performance - may exceed budget
                expect(lcpValue).toBeGreaterThan(lcpBudget.budget)
              }
            }

            // Property: Performance monitoring should record the metric
            const metrics = performanceMonitor.getMetrics()
            const lcpMetrics = metrics.filter(m => m.name === 'LCP' && m.type === 'web-vital')
            expect(lcpMetrics.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('FID values should be within acceptable thresholds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 0, max: 1000 }), // FID values in milliseconds
          async (fidValue) => {
            // Mock FID measurement
            const mockGetFID = require('web-vitals').getFID
            mockGetFID.mockImplementationOnce((callback: any) => {
              callback({ name: 'FID', value: fidValue, id: 'test-fid', delta: fidValue, entries: [] })
            })

            // Get Core Web Vitals report
            const report = await getCoreWebVitalsReport()

            // Property: FID should be measured and categorized correctly
            expect(report.FID).toBe(fidValue)

            // Performance budget check
            const budgetStatus = checkPerformanceBudgets()
            const fidBudget = budgetStatus.find(b => b.metric === 'FID')

            if (fidBudget) {
              if (fidValue <= 100) {
                // Good performance - should not exceed budget
                expect(fidBudget.status).not.toBe('exceeded')
              } else if (fidValue > 300) {
                // Poor performance - may exceed budget
                expect(fidValue).toBeGreaterThan(fidBudget.budget)
              }
            }

            // Property: Performance monitoring should record the metric
            const metrics = performanceMonitor.getMetrics()
            const fidMetrics = metrics.filter(m => m.name === 'FID' && m.type === 'web-vital')
            expect(fidMetrics.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('CLS values should be within acceptable thresholds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 0, max: 1 }), // CLS values (unitless)
          async (clsValue) => {
            // Mock CLS measurement
            const mockGetCLS = require('web-vitals').getCLS
            mockGetCLS.mockImplementationOnce((callback: any) => {
              callback({ name: 'CLS', value: clsValue, id: 'test-cls', delta: clsValue, entries: [] })
            })

            // Get Core Web Vitals report
            const report = await getCoreWebVitalsReport()

            // Property: CLS should be measured and categorized correctly
            expect(report.CLS).toBe(clsValue)

            // Performance budget check
            const budgetStatus = checkPerformanceBudgets()
            const clsBudget = budgetStatus.find(b => b.metric === 'CLS')

            if (clsBudget) {
              if (clsValue <= 0.1) {
                // Good performance - should not exceed budget
                expect(clsBudget.status).not.toBe('exceeded')
              } else if (clsValue > 0.25) {
                // Poor performance - may exceed budget
                expect(clsValue).toBeGreaterThan(clsBudget.budget)
              }
            }

            // Property: Performance monitoring should record the metric
            const metrics = performanceMonitor.getMetrics()
            const clsMetrics = metrics.filter(m => m.name === 'CLS' && m.type === 'web-vital')
            expect(clsMetrics.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Core Web Vitals score calculation should be consistent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            lcp: fc.float({ min: 0, max: 10000 }),
            fid: fc.float({ min: 0, max: 1000 }),
            cls: fc.float({ min: 0, max: 1 }),
            fcp: fc.float({ min: 0, max: 5000 }),
            ttfb: fc.float({ min: 0, max: 3000 })
          }),
          async (vitals) => {
            // Mock all vitals
            const webVitals = require('web-vitals')
            webVitals.getLCP.mockImplementationOnce((callback: any) => {
              callback({ name: 'LCP', value: vitals.lcp, id: 'test-lcp', delta: vitals.lcp, entries: [] })
            })
            webVitals.getFID.mockImplementationOnce((callback: any) => {
              callback({ name: 'FID', value: vitals.fid, id: 'test-fid', delta: vitals.fid, entries: [] })
            })
            webVitals.getCLS.mockImplementationOnce((callback: any) => {
              callback({ name: 'CLS', value: vitals.cls, id: 'test-cls', delta: vitals.cls, entries: [] })
            })
            webVitals.getFCP.mockImplementationOnce((callback: any) => {
              callback({ name: 'FCP', value: vitals.fcp, id: 'test-fcp', delta: vitals.fcp, entries: [] })
            })
            webVitals.getTTFB.mockImplementationOnce((callback: any) => {
              callback({ name: 'TTFB', value: vitals.ttfb, id: 'test-ttfb', delta: vitals.ttfb, entries: [] })
            })

            // Get Core Web Vitals report
            const report = await getCoreWebVitalsReport()

            // Property: Score should be between 0 and 100
            expect(report.score).toBeGreaterThanOrEqual(0)
            expect(report.score).toBeLessThanOrEqual(100)

            // Property: Score should reflect the quality of the vitals
            const goodLCP = vitals.lcp <= 2500
            const goodFID = vitals.fid <= 100
            const goodCLS = vitals.cls <= 0.1

            const goodVitalsCount = [goodLCP, goodFID, goodCLS].filter(Boolean).length

            if (goodVitalsCount === 3) {
              // All vitals are good - score should be high
              expect(report.score).toBeGreaterThanOrEqual(80)
            } else if (goodVitalsCount === 0) {
              // All vitals are poor - score should be low
              expect(report.score).toBeLessThanOrEqual(40)
            }

            // Property: Score calculation should be deterministic
            const report2 = await getCoreWebVitalsReport()
            expect(report2.score).toBe(report.score)
          }
        ),
        { numRuns: 50 }
      )
    })

    test('Performance budget violations should be detected correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            metric: fc.constantFrom('LCP', 'FID', 'CLS', 'FCP', 'TTFB'),
            value: fc.float({ min: 0, max: 10000 }),
            budget: fc.float({ min: 100, max: 5000 }),
            warning: fc.float({ min: 50, max: 2500 })
          }),
          async (testCase) => {
            // Ensure warning is less than budget
            const warning = Math.min(testCase.warning, testCase.budget * 0.8)
            const budget = testCase.budget

            // Set custom budget
            performanceMonitor.setBudget(testCase.metric, budget, warning)

            // Record a metric
            performanceMonitor.recordMetric(testCase.metric, testCase.value, 'web-vital')

            // Check budget status
            const budgetStatus = checkPerformanceBudgets()
            const metricBudget = budgetStatus.find(b => b.metric === testCase.metric)

            expect(metricBudget).toBeDefined()

            // Property: Budget status should reflect the actual performance
            if (testCase.value > budget) {
              expect(metricBudget!.status).toBe('exceeded')
            } else if (testCase.value > warning) {
              expect(metricBudget!.status).toBe('warning')
            } else {
              expect(metricBudget!.status).toBe('good')
            }

            // Property: Current value should match recorded value
            expect(metricBudget!.current).toBeCloseTo(testCase.value, 1)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Performance metrics should be recorded with correct metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.constantFrom('LCP', 'FID', 'CLS', 'custom_metric'),
            value: fc.float({ min: 0, max: 5000 }),
            type: fc.constantFrom('web-vital', 'custom', 'navigation'),
            metadata: fc.option(fc.record({
              id: fc.string(),
              delta: fc.float({ min: 0, max: 1000 }),
              entries: fc.nat({ max: 10 })
            }))
          }),
          async (metric) => {
            // Record the metric
            performanceMonitor.recordMetric(
              metric.name,
              metric.value,
              metric.type as any,
              metric.metadata || undefined
            )

            // Retrieve metrics
            const metrics = performanceMonitor.getMetrics()
            const recordedMetric = metrics.find(m => 
              m.name === metric.name && 
              Math.abs(m.value - metric.value) < 0.01
            )

            // Property: Metric should be recorded correctly
            expect(recordedMetric).toBeDefined()
            expect(recordedMetric!.name).toBe(metric.name)
            expect(recordedMetric!.value).toBeCloseTo(metric.value, 1)
            expect(recordedMetric!.type).toBe(metric.type)

            // Property: Timestamp should be recent
            expect(recordedMetric!.timestamp).toBeGreaterThan(Date.now() - 1000)
            expect(recordedMetric!.timestamp).toBeLessThanOrEqual(Date.now())

            // Property: Metadata should be preserved
            if (metric.metadata) {
              expect(recordedMetric!.metadata).toEqual(metric.metadata)
            }

            // Property: Web vital metrics should have rating
            if (metric.type === 'web-vital') {
              expect(recordedMetric!.rating).toBeDefined()
              expect(['good', 'needs-improvement', 'poor']).toContain(recordedMetric!.rating)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Performance Budget Management', () => {
    test('Budget thresholds should be enforced consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              metric: fc.string({ minLength: 1, maxLength: 20 }),
              budget: fc.float({ min: 100, max: 10000 }),
              warning: fc.float({ min: 50, max: 5000 }),
              values: fc.array(fc.float({ min: 0, max: 15000 }), { minLength: 1, maxLength: 10 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (budgetConfigs) => {
            // Set up budgets
            budgetConfigs.forEach(config => {
              const warning = Math.min(config.warning, config.budget * 0.8)
              performanceMonitor.setBudget(config.metric, config.budget, warning)
            })

            // Record metrics
            budgetConfigs.forEach(config => {
              config.values.forEach(value => {
                performanceMonitor.recordMetric(config.metric, value, 'custom')
              })
            })

            // Check budget status
            const budgetStatus = checkPerformanceBudgets()

            budgetConfigs.forEach(config => {
              const status = budgetStatus.find(b => b.metric === config.metric)
              expect(status).toBeDefined()

              // Property: Average should be calculated correctly
              const expectedAverage = config.values.reduce((sum, v) => sum + v, 0) / config.values.length
              expect(status!.current).toBeCloseTo(expectedAverage, 1)

              // Property: Status should reflect the average vs thresholds
              const warning = Math.min(config.warning, config.budget * 0.8)
              if (expectedAverage > config.budget) {
                expect(status!.status).toBe('exceeded')
              } else if (expectedAverage > warning) {
                expect(status!.status).toBe('warning')
              } else {
                expect(status!.status).toBe('good')
              }
            })
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})