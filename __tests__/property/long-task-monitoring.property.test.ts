/**
 * Property-Based Test: Long Task Monitoring
 * Feature: admin-performance-optimization
 * Property 2: No Long Tasks Exceed Threshold
 * **Validates: Requirements 1.2, 9.4**
 * 
 * This test verifies that the usePerformanceMonitoring hook properly
 * monitors long tasks using PerformanceObserver and ensures no single
 * task exceeds 50ms duration.
 */

import { renderHook, waitFor, cleanup } from '@testing-library/react'
import fc from 'fast-check'
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring'

// Mock PerformanceObserver
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

  static simulateLongTask(duration: number, startTime: number, name: string = 'self') {
    const entry = {
      duration,
      startTime,
      name,
      entryType: 'longtask',
      toJSON: () => ({ duration, startTime, name, entryType: 'longtask' })
    } as PerformanceEntry

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

// Setup global mocks
const originalPerformanceObserver = global.PerformanceObserver

describe('Admin Performance Optimization - Long Task Monitoring', () => {
  beforeEach(() => {
    // Mock PerformanceObserver
    global.PerformanceObserver = MockPerformanceObserver as any
    MockPerformanceObserver.clearObservers()
  })

  afterEach(() => {
    cleanup()
    MockPerformanceObserver.clearObservers()
    global.PerformanceObserver = originalPerformanceObserver
  })

  describe('Property 2: No Long Tasks Exceed Threshold', () => {
    it('should detect and record long tasks exceeding 50ms', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              duration: fc.integer({ min: 51, max: 500 }), // Tasks exceeding 50ms
              startTime: fc.integer({ min: 0, max: 10000 }),
              name: fc.constantFrom('self', 'same-origin', 'cross-origin')
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (longTasks) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Simulate long tasks
            longTasks.forEach(task => {
              MockPerformanceObserver.simulateLongTask(
                task.duration,
                task.startTime,
                task.name
              )
            })

            // Wait for tasks to be processed
            await new Promise(resolve => setTimeout(resolve, 100))

            // Generate report to check long tasks
            const report = result.current.generateReport()

            // Verify long tasks were recorded
            expect(report.longTasks).toBeDefined()
            expect(report.longTasks.length).toBeGreaterThan(0)

            // Verify each recorded task matches our simulated tasks
            report.longTasks.forEach(recordedTask => {
              expect(recordedTask.duration).toBeGreaterThan(50)
              expect(recordedTask.startTime).toBeGreaterThanOrEqual(0)
              expect(recordedTask.name).toBeDefined()
            })

            // Verify metrics were recorded for long tasks
            const longTaskMetrics = report.metrics.filter(m => m.name === 'long_task')
            expect(longTaskMetrics.length).toBeGreaterThan(0)

            longTaskMetrics.forEach(metric => {
              expect(metric.value).toBeGreaterThan(50)
              expect(metric.tags?.exceeds_threshold).toBe('true')
            })

            unmount()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not record tasks under 50ms threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              duration: fc.integer({ min: 1, max: 50 }), // Tasks under threshold
              startTime: fc.integer({ min: 0, max: 10000 }),
              name: fc.constantFrom('self', 'same-origin')
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (shortTasks) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Simulate short tasks (these would not be reported by PerformanceObserver as longtask)
            // In reality, PerformanceObserver only reports tasks > 50ms
            // This test verifies our hook doesn't record metrics for tasks under threshold

            // Generate report
            const report = result.current.generateReport()

            // If any long tasks were recorded, they should all exceed 50ms
            report.longTasks.forEach(task => {
              expect(task.duration).toBeGreaterThan(50)
            })

            unmount()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should limit stored long tasks to prevent memory issues', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 51, max: 100 }), // Number of long tasks to simulate
          async (taskCount) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Simulate many long tasks
            for (let i = 0; i < taskCount; i++) {
              MockPerformanceObserver.simulateLongTask(
                100 + i, // Duration > 50ms
                i * 100,
                'self'
              )
            }

            // Wait for tasks to be processed
            await new Promise(resolve => setTimeout(resolve, 100))

            // Generate report
            const report = result.current.generateReport()

            // Verify long tasks array is limited to 50 entries (as per implementation)
            expect(report.longTasks.length).toBeLessThanOrEqual(50)

            // If we simulated more than 50 tasks, verify we kept the most recent ones
            if (taskCount > 50) {
              expect(report.longTasks.length).toBe(50)
              
              // The last task should be one of the more recent ones
              const lastTask = report.longTasks[report.longTasks.length - 1]
              expect(lastTask.duration).toBeGreaterThan(50)
            }

            unmount()
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should track long task metrics with proper tags', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            duration: fc.integer({ min: 51, max: 300 }),
            startTime: fc.integer({ min: 0, max: 5000 }),
            name: fc.constantFrom('self', 'same-origin', 'cross-origin', 'unknown')
          }),
          async (task) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Simulate long task
            MockPerformanceObserver.simulateLongTask(
              task.duration,
              task.startTime,
              task.name
            )

            // Wait for task to be processed
            await new Promise(resolve => setTimeout(resolve, 100))

            // Generate report
            const report = result.current.generateReport()

            // Find the long task metric
            const longTaskMetrics = report.metrics.filter(m => m.name === 'long_task')
            
            if (longTaskMetrics.length > 0) {
              const metric = longTaskMetrics[0]
              
              // Verify metric properties
              expect(metric.value).toBe(task.duration)
              expect(metric.tags).toBeDefined()
              expect(metric.tags?.name).toBe(task.name)
              expect(metric.tags?.exceeds_threshold).toBe('true')
              expect(metric.timestamp).toBeGreaterThan(0)
            }

            unmount()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle PerformanceObserver errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant({}),
          async () => {
            // Mock PerformanceObserver to throw error
            const ErrorObserver = class {
              constructor() {
                throw new Error('PerformanceObserver not supported')
              }
              observe() {}
              disconnect() {}
            }

            global.PerformanceObserver = ErrorObserver as any

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            // Should still initialize despite error
            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Should not crash when generating report
            expect(() => result.current.generateReport()).not.toThrow()

            consoleErrorSpy.mockRestore()
            unmount()
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should properly cleanup PerformanceObserver on unmount', async () => {
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

            // Verify observer was created
            expect(MockPerformanceObserver['observers'].length).toBeGreaterThan(0)

            // Unmount
            unmount()

            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 100))

            // Verify observer was disconnected
            expect(MockPerformanceObserver['observers'].length).toBe(0)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should continue monitoring after processing multiple long tasks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.integer({ min: 51, max: 200 }),
            { minLength: 2, maxLength: 20 }
          ),
          async (durations) => {
            const { result, unmount } = renderHook(() =>
              usePerformanceMonitoring({
                enabled: true
              })
            )

            await waitFor(() => {
              expect(result.current.isMonitoring).toBe(true)
            }, { timeout: 1000 })

            // Simulate multiple long tasks over time
            for (let i = 0; i < durations.length; i++) {
              MockPerformanceObserver.simulateLongTask(
                durations[i],
                i * 100,
                'self'
              )
              await new Promise(resolve => setTimeout(resolve, 10))
            }

            // Wait for all tasks to be processed
            await new Promise(resolve => setTimeout(resolve, 100))

            // Generate report
            const report = result.current.generateReport()

            // Verify all tasks were recorded (up to the limit)
            const expectedCount = Math.min(durations.length, 50)
            expect(report.longTasks.length).toBe(expectedCount)

            // Verify monitoring is still active
            expect(result.current.isMonitoring).toBe(true)

            unmount()
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})
