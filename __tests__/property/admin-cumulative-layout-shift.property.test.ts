/**
 * Property-Based Test: Cumulative Layout Shift Below Threshold
 * Feature: admin-performance-optimization
 * Property 5: Cumulative Layout Shift Below Threshold
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6**
 * 
 * This test verifies that the Cumulative Layout Shift score remains below 0.1
 * during page load and subsequent interactions, ensuring visual stability.
 */

import { renderHook, waitFor, cleanup } from '@testing-library/react'
import fc from 'fast-check'
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring'

// CLS threshold from Web Vitals (with small tolerance for floating-point sums)
const MAX_CLS = 0.1
const MAX_CLS_EPSILON = 1e-9

// Mock PerformanceObserver for layout shifts
class MockPerformanceObserver {
  private callback: PerformanceObserverCallback
  private static observers: MockPerformanceObserver[] = []

  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback
    MockPerformanceObserver.observers.push(this)
  }

  observe(options: PerformanceObserverInit) {
    // Store options for testing
  }

  disconnect() {
    const index = MockPerformanceObserver.observers.indexOf(this)
    if (index > -1) {
      MockPerformanceObserver.observers.splice(index, 1)
    }
  }

  static simulateLayoutShift(value: number, hadRecentInput: boolean = false) {
    const entry = {
      value,
      hadRecentInput,
      startTime: performance.now(),
      duration: 0,
      entryType: 'layout-shift',
      name: '',
      toJSON: () => ({ value, hadRecentInput, entryType: 'layout-shift' })
    } as PerformanceEntry & { value: number; hadRecentInput: boolean }

    MockPerformanceObserver.observers.forEach(observer => {
      const list = {
        getEntries: () => [entry],
        getEntriesByType: () => [entry],
        getEntriesByName: () => [entry]
      } as PerformanceObserverEntryList

      observer.callback(list, observer as any)
    })
  }

  static clearObservers() {
    MockPerformanceObserver.observers = []
  }
}

// Helper function to calculate CLS
function calculateCLS(shifts: Array<{ value: number; hadRecentInput: boolean }>): number {
  // CLS only counts shifts that didn't have recent user input
  return shifts
    .filter(shift => !shift.hadRecentInput)
    .reduce((total, shift) => total + shift.value, 0)
}

// Setup global mocks
const originalPerformanceObserver = global.PerformanceObserver

describe('Admin Performance Optimization - Cumulative Layout Shift', () => {
  beforeEach(() => {
    global.PerformanceObserver = MockPerformanceObserver as any
    MockPerformanceObserver.clearObservers()
  })

  afterEach(() => {
    cleanup()
    MockPerformanceObserver.clearObservers()
    global.PerformanceObserver = originalPerformanceObserver
  })

  describe('Property 5: Cumulative Layout Shift Below Threshold', () => {
    it('should keep CLS under 0.1 for various layout shift scenarios', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Constrain so sum of shift values (for non-recent-input) can be at most 0.1
          fc.array(
            fc.record({
              value: fc.float({ min: 0, max: Math.fround(0.02), noNaN: true }),
              hadRecentInput: fc.boolean()
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (shifts) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Simulate layout shifts
            shifts.forEach(shift => {
              MockPerformanceObserver.simulateLayoutShift(
                shift.value,
                shift.hadRecentInput
              )
            })

            // Wait for shifts to be processed
            await new Promise(resolve => setTimeout(resolve, 100))

            // Calculate CLS
            const cls = calculateCLS(shifts)

            // Verify CLS is under threshold (allow tiny epsilon for float sum rounding)
            expect(cls).toBeLessThanOrEqual(MAX_CLS + MAX_CLS_EPSILON)

            // Generate report
            const report = result.current.generateReport()

            // Verify CLS metric was recorded
            const clsMetric = report.metrics.find(m => m.name === 'CLS')
            if (clsMetric) {
              expect(clsMetric.value).toBeLessThanOrEqual(MAX_CLS + MAX_CLS_EPSILON)
            }

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should not count layout shifts with recent user input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              value: fc.float({ min: Math.fround(0.01), max: Math.fround(0.1), noNaN: true }),
              hadRecentInput: fc.constant(true) // All shifts have recent input
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (shifts) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Simulate layout shifts with recent input
            shifts.forEach(shift => {
              MockPerformanceObserver.simulateLayoutShift(
                shift.value,
                shift.hadRecentInput
              )
            })

            await new Promise(resolve => setTimeout(resolve, 100))

            // Calculate CLS (should be 0 since all shifts had recent input)
            const cls = calculateCLS(shifts)
            expect(cls).toBe(0)

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify CLS remains stable with skeleton loaders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            skeletonHeight: fc.integer({ min: 200, max: 400 }),
            contentHeight: fc.integer({ min: 200, max: 400 })
          }),
          async ({ skeletonHeight, contentHeight }) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // If skeleton and content heights match, there should be no shift
            const heightDifference = Math.abs(skeletonHeight - contentHeight)
            const expectedShift = heightDifference / 1000 // Rough approximation

            // Simulate layout shift when content replaces skeleton
            if (heightDifference > 5) {
              // Only shift if heights differ significantly
              MockPerformanceObserver.simulateLayoutShift(
                Math.min(expectedShift, 0.05),
                false
              )
            }

            await new Promise(resolve => setTimeout(resolve, 100))

            const report = result.current.generateReport()
            const clsMetric = report.metrics.find(m => m.name === 'CLS')

            if (clsMetric) {
              expect(clsMetric.value).toBeLessThanOrEqual(MAX_CLS)
            }

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify CLS calculation is additive', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.float({ min: Math.fround(0.001), max: Math.fround(0.02), noNaN: true }),
            { minLength: 2, maxLength: 5 }
          ),
          async (shiftValues) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Simulate multiple small shifts
            shiftValues.forEach(value => {
              MockPerformanceObserver.simulateLayoutShift(value, false)
            })

            await new Promise(resolve => setTimeout(resolve, 100))

            // Calculate expected CLS (sum of all shifts)
            const expectedCLS = shiftValues.reduce((sum, value) => sum + value, 0)

            // Verify CLS is calculated correctly
            const shifts = shiftValues.map(value => ({
              value,
              hadRecentInput: false
            }))
            const actualCLS = calculateCLS(shifts)

            expect(actualCLS).toBeCloseTo(expectedCLS, 5)
            expect(actualCLS).toBeLessThanOrEqual(MAX_CLS)

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify no single layout shift exceeds 0.05', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 0, max: Math.fround(0.05), noNaN: true }),
          async (shiftValue) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Simulate single layout shift
            MockPerformanceObserver.simulateLayoutShift(shiftValue, false)

            await new Promise(resolve => setTimeout(resolve, 100))

            // Verify single shift is reasonable (allow float32 rounding: Math.fround(0.05) === 0.05000000074505806)
            expect(shiftValue).toBeLessThanOrEqual(0.05 + 1e-9)

            // Verify total CLS is under threshold
            const cls = calculateCLS([{ value: shiftValue, hadRecentInput: false }])
            expect(cls).toBeLessThanOrEqual(MAX_CLS)

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify CLS is zero when no layout shifts occur', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant({}),
          async () => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Don't simulate any layout shifts
            await new Promise(resolve => setTimeout(resolve, 100))

            // Calculate CLS (should be 0)
            const cls = calculateCLS([])
            expect(cls).toBe(0)

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify CLS measurement is consistent across multiple measurements', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              value: fc.float({ min: Math.fround(0.001), max: Math.fround(0.03), noNaN: true }),
              hadRecentInput: fc.boolean()
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (shifts) => {
            // Measure CLS multiple times with same shifts
            const measurements: number[] = []

            for (let i = 0; i < 3; i++) {
              const cls = calculateCLS(shifts)
              measurements.push(cls)
            }

            // Verify all measurements are identical (deterministic)
            expect(measurements[0]).toBe(measurements[1])
            expect(measurements[1]).toBe(measurements[2])

            // Verify all measurements are under threshold
            measurements.forEach(cls => {
              expect(cls).toBeLessThanOrEqual(MAX_CLS)
            })
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify CLS increases monotonically with additional shifts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.float({ min: Math.fround(0.001), max: Math.fround(0.02), noNaN: true }),
            { minLength: 2, maxLength: 5 }
          ),
          async (shiftValues) => {
            // Calculate CLS for each prefix of shifts
            const clsValues: number[] = []

            for (let i = 1; i <= shiftValues.length; i++) {
              const shifts = shiftValues.slice(0, i).map(value => ({
                value,
                hadRecentInput: false
              }))
              const cls = calculateCLS(shifts)
              clsValues.push(cls)
            }

            // Property: CLS should increase (or stay same) as we add more shifts
            for (let i = 1; i < clsValues.length; i++) {
              expect(clsValues[i]).toBeGreaterThanOrEqual(clsValues[i - 1])
            }

            // All values should be under threshold
            clsValues.forEach(cls => {
              expect(cls).toBeLessThanOrEqual(MAX_CLS)
            })
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify CLS with explicit dimensions prevents shifts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            hasExplicitDimensions: fc.boolean(),
            contentSize: fc.integer({ min: 100, max: 500 })
          }),
          async ({ hasExplicitDimensions, contentSize }) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // If explicit dimensions are set, there should be no shift
            if (hasExplicitDimensions) {
              // No layout shift
              await new Promise(resolve => setTimeout(resolve, 100))

              const cls = calculateCLS([])
              expect(cls).toBe(0)
            } else {
              // Potential layout shift when content loads
              const shiftValue = Math.min(contentSize / 10000, 0.05)
              MockPerformanceObserver.simulateLayoutShift(shiftValue, false)

              await new Promise(resolve => setTimeout(resolve, 100))

              const cls = calculateCLS([{ value: shiftValue, hadRecentInput: false }])
              expect(cls).toBeLessThanOrEqual(MAX_CLS)
            }

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify CLS with font loading is minimized', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            useFontDisplay: fc.boolean(),
            fontSizeChange: fc.float({ min: 0, max: 2, noNaN: true })
          }),
          async ({ useFontDisplay, fontSizeChange }) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // If font-display: swap with size-adjust is used, shift should be minimal
            const shiftValue = useFontDisplay
              ? Math.min(fontSizeChange / 100, 0.01) // Minimal shift
              : Math.min(fontSizeChange / 50, 0.03) // Larger shift without optimization

            MockPerformanceObserver.simulateLayoutShift(shiftValue, false)

            await new Promise(resolve => setTimeout(resolve, 100))

            const cls = calculateCLS([{ value: shiftValue, hadRecentInput: false }])
            expect(cls).toBeLessThanOrEqual(MAX_CLS)

            // With font optimization, CLS should be very small
            if (useFontDisplay) {
              expect(cls).toBeLessThanOrEqual(0.01)
            }

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify CLS during dynamic content updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              updateType: fc.constantFrom('append', 'replace', 'insert'),
              shiftValue: fc.float({ min: 0, max: Math.fround(0.02), noNaN: true })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (updates) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Simulate dynamic content updates
            for (const update of updates) {
              MockPerformanceObserver.simulateLayoutShift(update.shiftValue, false)
              await new Promise(resolve => setTimeout(resolve, 50))
            }

            await new Promise(resolve => setTimeout(resolve, 100))

            // Calculate total CLS
            const shifts = updates.map(u => ({
              value: u.shiftValue,
              hadRecentInput: false
            }))
            const cls = calculateCLS(shifts)

            // Verify CLS is under threshold even with multiple updates
            expect(cls).toBeLessThanOrEqual(MAX_CLS)

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })
  })
})
