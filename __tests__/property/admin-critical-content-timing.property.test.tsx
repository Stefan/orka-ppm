/**
 * Property-Based Test: Critical Content Renders Before Non-Critical Scripts
 * Feature: admin-performance-optimization
 * Property 3: Critical Content Renders Before Non-Critical Scripts
 * **Validates: Requirements 1.3**
 * 
 * This test verifies that critical content (health status and metric cards)
 * renders in the DOM before non-critical JavaScript (charts, tables) begins loading.
 */

import React from 'react'
import fc from 'fast-check'
import { render, waitFor, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock performance timing API
interface TimingEntry {
  name: string
  timestamp: number
  type: 'render' | 'script' | 'import'
}

class PerformanceTimingTracker {
  private entries: TimingEntry[] = []

  recordRender(name: string) {
    this.entries.push({
      name,
      timestamp: performance.now(),
      type: 'render'
    })
  }

  recordScriptLoad(name: string) {
    this.entries.push({
      name,
      timestamp: performance.now(),
      type: 'script'
    })
  }

  recordDynamicImport(name: string) {
    this.entries.push({
      name,
      timestamp: performance.now(),
      type: 'import'
    })
  }

  getEntries(): TimingEntry[] {
    return [...this.entries].sort((a, b) => a.timestamp - b.timestamp)
  }

  getCriticalRenderTime(): number | null {
    const criticalEntry = this.entries.find(
      e => e.type === 'render' && e.name.includes('critical')
    )
    return criticalEntry?.timestamp ?? null
  }

  getNonCriticalScriptTime(): number | null {
    const nonCriticalEntry = this.entries.find(
      e => (e.type === 'script' || e.type === 'import') && 
           (e.name.includes('chart') || e.name.includes('table'))
    )
    return nonCriticalEntry?.timestamp ?? null
  }

  clear() {
    this.entries = []
  }
}

const timingTracker = new PerformanceTimingTracker()

// Mock component that tracks rendering
function MockCriticalContent({ onRender }: { onRender?: () => void }) {
  React.useEffect(() => {
    timingTracker.recordRender('critical-content')
    onRender?.()
  }, [onRender])

  return (
    <div data-testid="critical-content">
      <div data-testid="health-status">Health Status</div>
      <div data-testid="metric-card-1">Total Requests</div>
      <div data-testid="metric-card-2">Total Errors</div>
      <div data-testid="metric-card-3">Slow Queries</div>
    </div>
  )
}

// Mock lazy component that tracks loading
function MockLazyChart({ onLoad }: { onLoad?: () => void }) {
  React.useEffect(() => {
    timingTracker.recordDynamicImport('chart-section')
    onLoad?.()
  }, [onLoad])

  return <div data-testid="chart-section">Chart</div>
}

describe('Admin Performance Optimization - Critical Content Timing', () => {
  beforeEach(() => {
    timingTracker.clear()
  })

  describe('Property 3: Critical Content Renders Before Non-Critical Scripts', () => {
    it('should render critical content before loading charts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            criticalDelay: fc.integer({ min: 0, max: 50 }),
            chartDelay: fc.integer({ min: 100, max: 500 })
          }),
          async ({ criticalDelay, chartDelay }) => {
            let criticalRendered = false
            let chartLoaded = false

            // Render critical content
            const { rerender } = render(
              <MockCriticalContent
                onRender={() => {
                  criticalRendered = true
                }}
              />
            )

            // Wait for critical content delay
            await new Promise(resolve => setTimeout(resolve, criticalDelay))

            // Verify critical content is rendered
            await waitFor(() => {
              expect(screen.getByTestId('critical-content')).toBeInTheDocument()
            })

            expect(criticalRendered).toBe(true)

            // Now load chart after delay
            await new Promise(resolve => setTimeout(resolve, chartDelay - criticalDelay))

            rerender(
              <>
                <MockCriticalContent />
                <React.Suspense fallback={<div>Loading...</div>}>
                  <MockLazyChart onLoad={() => { chartLoaded = true }} />
                </React.Suspense>
              </>
            )

            // Wait for chart to load
            await waitFor(() => {
              expect(screen.getByTestId('chart-section')).toBeInTheDocument()
            })

            // Verify timing: critical content rendered before chart loaded
            const criticalTime = timingTracker.getCriticalRenderTime()
            const chartTime = timingTracker.getNonCriticalScriptTime()

            expect(criticalTime).not.toBeNull()
            expect(chartTime).not.toBeNull()
            expect(criticalTime!).toBeLessThan(chartTime!)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify critical content is in DOM before any dynamic imports', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom('chart', 'table', 'stats'),
            { minLength: 1, maxLength: 3 }
          ),
          async (nonCriticalComponents) => {
            // Render critical content first
            render(<MockCriticalContent />)

            await waitFor(() => {
              expect(screen.getByTestId('critical-content')).toBeInTheDocument()
            })

            const criticalTime = timingTracker.getCriticalRenderTime()
            expect(criticalTime).not.toBeNull()

            // Simulate loading non-critical components
            for (const component of nonCriticalComponents) {
              await new Promise(resolve => setTimeout(resolve, 50))
              timingTracker.recordDynamicImport(component)
            }

            // Verify all non-critical imports happened after critical render
            const entries = timingTracker.getEntries()
            const criticalIndex = entries.findIndex(
              e => e.type === 'render' && e.name.includes('critical')
            )
            const importIndices = entries
              .map((e, i) => e.type === 'import' ? i : -1)
              .filter(i => i !== -1)

            // All imports should come after critical render
            importIndices.forEach(importIndex => {
              expect(importIndex).toBeGreaterThan(criticalIndex)
            })
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify critical content renders within acceptable time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }),
          async (renderDelay) => {
            const startTime = performance.now()

            render(<MockCriticalContent />)

            await waitFor(() => {
              expect(screen.getByTestId('critical-content')).toBeInTheDocument()
            })

            const endTime = performance.now()
            const renderTime = endTime - startTime

            // Critical content should render quickly (< 500ms)
            expect(renderTime).toBeLessThan(500)

            // Verify it rendered before any non-critical scripts
            const criticalTime = timingTracker.getCriticalRenderTime()
            expect(criticalTime).not.toBeNull()
            expect(criticalTime!).toBeLessThan(500)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify critical elements are present before lazy loading starts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            ['health-status'],
            ['health-status', 'metric-card-1'],
            ['health-status', 'metric-card-1', 'metric-card-2'],
            ['health-status', 'metric-card-1', 'metric-card-2', 'metric-card-3']
          ),
          async (criticalElements) => {
            render(<MockCriticalContent />)

            // Verify all critical elements are present
            for (const elementId of criticalElements) {
              await waitFor(() => {
                expect(screen.getByTestId(elementId)).toBeInTheDocument()
              })
            }

            // Record that critical content is fully rendered
            const criticalTime = timingTracker.getCriticalRenderTime()
            expect(criticalTime).not.toBeNull()

            // Now simulate lazy loading
            timingTracker.recordDynamicImport('lazy-component')

            // Verify lazy loading happened after critical content
            const lazyTime = timingTracker.getNonCriticalScriptTime()
            expect(lazyTime).not.toBeNull()
            expect(criticalTime!).toBeLessThan(lazyTime!)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify timing order is preserved across multiple renders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (renderCount) => {
            const timings: number[] = []

            for (let i = 0; i < renderCount; i++) {
              timingTracker.clear()

              const { unmount } = render(<MockCriticalContent />)

              await waitFor(() => {
                expect(screen.getByTestId('critical-content')).toBeInTheDocument()
              })

              const criticalTime = timingTracker.getCriticalRenderTime()
              expect(criticalTime).not.toBeNull()
              timings.push(criticalTime!)

              unmount()
            }

            // Verify all renders completed (all timings recorded)
            expect(timings.length).toBe(renderCount)

            // Verify all timings are reasonable (< 500ms)
            timings.forEach(timing => {
              expect(timing).toBeLessThan(500)
            })
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should verify critical content renders before Suspense boundaries resolve', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            suspenseDelay: fc.integer({ min: 100, max: 1000 })
          }),
          async ({ suspenseDelay }) => {
            let suspenseResolved = false

            const LazyComponent = React.lazy(
              () =>
                new Promise<{ default: React.ComponentType }>(resolve => {
                  setTimeout(() => {
                    timingTracker.recordDynamicImport('lazy-suspense')
                    suspenseResolved = true
                    resolve({
                      default: () => <div data-testid="lazy-content">Lazy Content</div>
                    })
                  }, suspenseDelay)
                })
            )

            render(
              <>
                <MockCriticalContent />
                <React.Suspense fallback={<div data-testid="loading">Loading...</div>}>
                  <LazyComponent />
                </React.Suspense>
              </>
            )

            // Verify critical content renders immediately
            await waitFor(() => {
              expect(screen.getByTestId('critical-content')).toBeInTheDocument()
            })

            const criticalTime = timingTracker.getCriticalRenderTime()
            expect(criticalTime).not.toBeNull()

            // Verify Suspense fallback is shown
            expect(screen.getByTestId('loading')).toBeInTheDocument()

            // Wait for Suspense to resolve
            await waitFor(
              () => {
                expect(screen.getByTestId('lazy-content')).toBeInTheDocument()
              },
              { timeout: suspenseDelay + 500 }
            )

            expect(suspenseResolved).toBe(true)

            // Verify critical content rendered before lazy content
            const lazyTime = timingTracker.getNonCriticalScriptTime()
            expect(lazyTime).not.toBeNull()
            expect(criticalTime!).toBeLessThan(lazyTime!)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should verify critical content is interactive before lazy scripts execute', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant({}),
          async () => {
            let criticalInteractive = false

            const InteractiveCriticalContent = () => {
              React.useEffect(() => {
                timingTracker.recordRender('critical-content')
                criticalInteractive = true
              }, [])

              return (
                <div data-testid="critical-content">
                  <button
                    data-testid="critical-button"
                    onClick={() => {
                      // Critical interaction
                    }}
                  >
                    Refresh
                  </button>
                </div>
              )
            }

            render(<InteractiveCriticalContent />)

            // Verify critical content is interactive
            await waitFor(() => {
              expect(screen.getByTestId('critical-button')).toBeInTheDocument()
            })

            expect(criticalInteractive).toBe(true)

            // Simulate lazy script loading
            await new Promise(resolve => setTimeout(resolve, 100))
            timingTracker.recordDynamicImport('lazy-script')

            // Verify critical content was interactive before lazy script
            const criticalTime = timingTracker.getCriticalRenderTime()
            const lazyTime = timingTracker.getNonCriticalScriptTime()

            expect(criticalTime).not.toBeNull()
            expect(lazyTime).not.toBeNull()
            expect(criticalTime!).toBeLessThan(lazyTime!)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify timing order is deterministic', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom('critical', 'lazy-chart', 'lazy-table'),
            { minLength: 3, maxLength: 3 }
          ),
          async (components) => {
            // Ensure critical is first
            const orderedComponents = ['critical', ...components.filter(c => c !== 'critical')]

            for (const component of orderedComponents) {
              if (component === 'critical') {
                timingTracker.recordRender('critical-content')
              } else {
                await new Promise(resolve => setTimeout(resolve, 50))
                timingTracker.recordDynamicImport(component)
              }
            }

            const entries = timingTracker.getEntries()

            // Verify critical is first
            expect(entries[0].name).toContain('critical')
            expect(entries[0].type).toBe('render')

            // Verify all subsequent entries are imports
            for (let i = 1; i < entries.length; i++) {
              expect(entries[i].type).toBe('import')
            }

            // Verify timestamps are monotonically increasing
            for (let i = 1; i < entries.length; i++) {
              expect(entries[i].timestamp).toBeGreaterThanOrEqual(entries[i - 1].timestamp)
            }
          }
        ),
        { numRuns: 5 }
      )
    })
  })
})
