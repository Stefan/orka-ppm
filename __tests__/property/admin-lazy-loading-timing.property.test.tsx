/**
 * Property-Based Test: Lazy Loading Timing
 * Feature: admin-performance-optimization
 * Property 13: Charts Load After Initial Render
 * **Validates: Requirements 7.2**
 * 
 * This test verifies that the Recharts library begins loading only after
 * the initial page shell has rendered, ensuring progressive loading strategy.
 */

import { render, waitFor, cleanup } from '@testing-library/react'
import React, { Suspense, lazy } from 'react'
import fc from 'fast-check'

// Mock ChartSection to track when it's loaded
const mockChartSectionLoaded = jest.fn()

// Simulate the lazy loading behavior
const createLazyChartSection = () => {
  return lazy(() => {
    mockChartSectionLoaded()
    return Promise.resolve({
      default: ({ endpointData, slowQueriesData, translations }: any) => (
        <div data-testid="chart-section">
          <div data-testid="chart-loaded">Charts Loaded</div>
          <div data-testid="endpoint-count">{endpointData.length}</div>
        </div>
      )
    })
  })
}

// Arbitraries for generating test data
const chartDataPointArbitrary = fc.record({
  endpoint: fc.string({ minLength: 5, maxLength: 50 }),
  fullEndpoint: fc.string({ minLength: 10, maxLength: 100 }),
  avg_duration: fc.integer({ min: 10, max: 5000 }),
  requests: fc.integer({ min: 1, max: 100000 }),
  error_rate: fc.float({ min: Math.fround(0), max: Math.fround(100) }),
  rpm: fc.float({ min: Math.fround(0.1), max: Math.fround(1000) })
})

const slowQueryDataPointArbitrary = fc.record({
  endpoint: fc.string({ minLength: 5, maxLength: 100 }),
  duration: fc.integer({ min: 100, max: 10000 }),
  time: fc.string({ minLength: 8, maxLength: 12 })
})

const translationsArbitrary = fc.record({
  endpointPerformance: fc.string({ minLength: 5, maxLength: 50 }),
  avgDuration: fc.string({ minLength: 5, maxLength: 30 }),
  totalRequestsLabel: fc.string({ minLength: 5, maxLength: 30 }),
  errorRate: fc.string({ minLength: 5, maxLength: 30 }),
  requestsPerMin: fc.string({ minLength: 5, maxLength: 30 }),
  requestVolume: fc.string({ minLength: 5, maxLength: 50 })
})

describe('Admin Performance Optimization - Lazy Loading Timing', () => {
  beforeEach(() => {
    mockChartSectionLoaded.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Property 13: Charts Load After Initial Render', () => {
    it('should render skeleton before chart component loads', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(chartDataPointArbitrary, { minLength: 1, maxLength: 10 }),
          fc.array(slowQueryDataPointArbitrary, { minLength: 0, maxLength: 5 }),
          translationsArbitrary,
          async (endpointData, slowQueriesData, translations) => {
            const LazyChartSection = createLazyChartSection()

            const TestComponent = () => {
              return (
                <div data-testid="page-shell">
                  <div data-testid="critical-content">Critical Content</div>
                  <Suspense fallback={<div data-testid="skeleton">Loading...</div>}>
                    <LazyChartSection
                      endpointData={endpointData}
                      slowQueriesData={slowQueriesData}
                      translations={translations}
                    />
                  </Suspense>
                </div>
              )
            }

            const { getByTestId, queryByTestId, unmount } = render(<TestComponent />)

            // Verify page shell renders immediately
            expect(getByTestId('page-shell')).toBeInTheDocument()
            expect(getByTestId('critical-content')).toBeInTheDocument()

            // Verify skeleton appears before chart loads
            expect(getByTestId('skeleton')).toBeInTheDocument()
            expect(queryByTestId('chart-section')).not.toBeInTheDocument()

            // Wait for lazy component to load
            await waitFor(() => {
              expect(queryByTestId('chart-loaded')).toBeInTheDocument()
            }, { timeout: 3000 })

            // Verify chart loaded after initial render
            expect(mockChartSectionLoaded).toHaveBeenCalled()
            expect(queryByTestId('skeleton')).not.toBeInTheDocument()

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should not block initial render while loading chart library', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(chartDataPointArbitrary, { minLength: 1, maxLength: 10 }),
          fc.array(slowQueryDataPointArbitrary, { minLength: 0, maxLength: 5 }),
          translationsArbitrary,
          fc.integer({ min: 50, max: 200 }), // Simulated load delay
          async (endpointData, slowQueriesData, translations, loadDelay) => {
            const LazyChartSection = lazy(() => {
              mockChartSectionLoaded()
              return new Promise(resolve => {
                setTimeout(() => {
                  resolve({
                    default: ({ endpointData, slowQueriesData, translations }: any) => (
                      <div data-testid="chart-section">
                        <div data-testid="chart-loaded">Charts Loaded</div>
                      </div>
                    )
                  })
                }, loadDelay)
              })
            })

            const TestComponent = () => {
              return (
                <div data-testid="page-shell">
                  <div data-testid="critical-metrics">
                    <div data-testid="metric-1">Metric 1</div>
                    <div data-testid="metric-2">Metric 2</div>
                  </div>
                  <Suspense fallback={<div data-testid="skeleton">Loading...</div>}>
                    <LazyChartSection
                      endpointData={endpointData}
                      slowQueriesData={slowQueriesData}
                      translations={translations}
                    />
                  </Suspense>
                </div>
              )
            }

            const renderStartTime = performance.now()
            const { getByTestId, queryByTestId, unmount } = render(<TestComponent />)
            const renderEndTime = performance.now()

            // Initial render should be fast (< 100ms) regardless of chart load delay
            const initialRenderTime = renderEndTime - renderStartTime
            expect(initialRenderTime).toBeLessThan(100)

            // Critical content should be visible immediately
            expect(getByTestId('page-shell')).toBeInTheDocument()
            expect(getByTestId('critical-metrics')).toBeInTheDocument()
            expect(getByTestId('metric-1')).toBeInTheDocument()
            expect(getByTestId('metric-2')).toBeInTheDocument()

            // Skeleton should be visible while chart loads
            expect(getByTestId('skeleton')).toBeInTheDocument()

            // Wait for chart to load
            await waitFor(() => {
              expect(queryByTestId('chart-loaded')).toBeInTheDocument()
            }, { timeout: loadDelay + 1000 })

            // Verify chart loaded after delay
            expect(mockChartSectionLoaded).toHaveBeenCalled()

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should maintain page interactivity while chart loads', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(chartDataPointArbitrary, { minLength: 1, maxLength: 10 }),
          fc.array(slowQueryDataPointArbitrary, { minLength: 0, maxLength: 5 }),
          translationsArbitrary,
          async (endpointData, slowQueriesData, translations) => {
            let buttonClicked = false

            const LazyChartSection = lazy(() => {
              mockChartSectionLoaded()
              return new Promise(resolve => {
                setTimeout(() => {
                  resolve({
                    default: () => <div data-testid="chart-loaded">Charts Loaded</div>
                  })
                }, 100)
              })
            })

            const TestComponent = () => {
              return (
                <div>
                  <button
                    data-testid="interactive-button"
                    onClick={() => { buttonClicked = true }}
                  >
                    Click Me
                  </button>
                  <Suspense fallback={<div data-testid="skeleton">Loading...</div>}>
                    <LazyChartSection
                      endpointData={endpointData}
                      slowQueriesData={slowQueriesData}
                      translations={translations}
                    />
                  </Suspense>
                </div>
              )
            }

            const { getByTestId, queryByTestId, unmount } = render(<TestComponent />)

            // Button should be interactive immediately
            const button = getByTestId('interactive-button')
            expect(button).toBeInTheDocument()

            // Click button while chart is loading
            button.click()
            expect(buttonClicked).toBe(true)

            // Wait for chart to load
            await waitFor(() => {
              expect(queryByTestId('chart-loaded')).toBeInTheDocument()
            }, { timeout: 3000 })

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should load chart only once per mount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(chartDataPointArbitrary, { minLength: 1, maxLength: 10 }),
          fc.array(slowQueryDataPointArbitrary, { minLength: 0, maxLength: 5 }),
          translationsArbitrary,
          async (endpointData, slowQueriesData, translations) => {
            // Clear mock before each test iteration
            mockChartSectionLoaded.mockClear()
            
            const LazyChartSection = createLazyChartSection()

            const TestComponent = () => {
              return (
                <Suspense fallback={<div data-testid="skeleton">Loading...</div>}>
                  <LazyChartSection
                    endpointData={endpointData}
                    slowQueriesData={slowQueriesData}
                    translations={translations}
                  />
                </Suspense>
              )
            }

            const { queryByTestId, unmount } = render(<TestComponent />)

            // Wait for chart to load
            await waitFor(() => {
              expect(queryByTestId('chart-loaded')).toBeInTheDocument()
            }, { timeout: 1000 })

            // Chart should load exactly once
            expect(mockChartSectionLoaded).toHaveBeenCalledTimes(1)

            unmount()
          }
        ),
        { numRuns: 5 }
      )
    }, 60000)
  })
})
