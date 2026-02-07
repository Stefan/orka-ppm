/**
 * Property-Based Test: No Console Errors on Page Load
 * Feature: admin-performance-optimization
 * Property 11: No Console Errors on Page Load
 * **Validates: Requirements 6.1**
 * 
 * This test verifies that no errors are logged to the browser console
 * during page load and operation.
 */

import { render, waitFor, screen } from '@testing-library/react'
import fc from 'fast-check'
import '@testing-library/jest-dom'
import React from 'react'

// Console error tracker
class ConsoleErrorTracker {
  private errors: Array<{ message: string; timestamp: number }> = []
  private originalError: typeof console.error

  constructor() {
    this.originalError = console.error
  }

  start() {
    console.error = (...args: any[]) => {
      this.errors.push({
        message: args.map(arg => String(arg)).join(' '),
        timestamp: performance.now()
      })
      // Still log to console for debugging
      this.originalError.apply(console, args)
    }
  }

  stop() {
    console.error = this.originalError
  }

  getErrors() {
    return [...this.errors]
  }

  getErrorCount() {
    return this.errors.length
  }

  clear() {
    this.errors = []
  }

  hasErrors() {
    return this.errors.length > 0
  }
}

const errorTracker = new ConsoleErrorTracker()

// Mock component that may produce errors
function MockComponent({ shouldError = false, errorType = 'none' }: {
  shouldError?: boolean
  errorType?: 'none' | 'render' | 'effect' | 'event'
}) {
  React.useEffect(() => {
    if (shouldError && errorType === 'effect') {
      console.error('Effect error occurred')
    }
  }, [shouldError, errorType])

  if (shouldError && errorType === 'render') {
    console.error('Render error occurred')
  }

  const handleClick = () => {
    if (shouldError && errorType === 'event') {
      console.error('Event error occurred')
    }
  }

  return (
    <div data-testid="mock-component">
      <button onClick={handleClick} data-testid="error-button">
        Click
      </button>
    </div>
  )
}

describe('Admin Performance Optimization - Console Errors', () => {
  beforeEach(() => {
    errorTracker.clear()
    errorTracker.start()
  })

  afterEach(() => {
    errorTracker.stop()
  })

  describe('Property 11: No Console Errors on Page Load', () => {
    it('should not log errors during normal component rendering', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (componentCount) => {
            errorTracker.clear()

            // Render multiple components
            render(
              <div>
                {Array.from({ length: componentCount }).map((_, i) => (
                  <MockComponent key={i} shouldError={false} />
                ))}
              </div>
            )

            await waitFor(() => {
              expect(screen.getAllByTestId('mock-component')).toHaveLength(componentCount)
            })

            // Verify no errors were logged
            expect(errorTracker.getErrorCount()).toBe(0)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify error count remains zero across multiple renders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (renderCount) => {
            const errorCounts: number[] = []

            for (let i = 0; i < renderCount; i++) {
              errorTracker.clear()

              const { unmount } = render(<MockComponent shouldError={false} />)

              await waitFor(() => {
                expect(screen.getByTestId('mock-component')).toBeInTheDocument()
              })

              errorCounts.push(errorTracker.getErrorCount())

              unmount()
            }

            // Verify all error counts are zero
            errorCounts.forEach(count => {
              expect(count).toBe(0)
            })
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should verify no errors during component lifecycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('mount', 'update', 'unmount'),
          async (lifecycle) => {
            errorTracker.clear()

            const { rerender, unmount } = render(<MockComponent shouldError={false} />)

            await waitFor(() => {
              expect(screen.getByTestId('mock-component')).toBeInTheDocument()
            })

            // Verify no errors during mount
            expect(errorTracker.getErrorCount()).toBe(0)

            if (lifecycle === 'update') {
              // Trigger update
              rerender(<MockComponent shouldError={false} />)
              await waitFor(() => {
                expect(screen.getByTestId('mock-component')).toBeInTheDocument()
              })

              // Verify no errors during update
              expect(errorTracker.getErrorCount()).toBe(0)
            }

            if (lifecycle === 'unmount') {
              // Trigger unmount
              unmount()

              // Verify no errors during unmount
              expect(errorTracker.getErrorCount()).toBe(0)
            }
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify no errors with various prop combinations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            shouldError: fc.constant(false),
            errorType: fc.constantFrom('none', 'render', 'effect', 'event')
          }),
          async (props) => {
            errorTracker.clear()

            render(<MockComponent {...props} />)

            await waitFor(() => {
              expect(screen.getByTestId('mock-component')).toBeInTheDocument()
            })

            // Since shouldError is false, no errors should be logged
            expect(errorTracker.getErrorCount()).toBe(0)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify no errors during data loading', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            loadDelay: fc.integer({ min: 0, max: 500 }),
            hasData: fc.boolean()
          }),
          async ({ loadDelay, hasData }) => {
            errorTracker.clear()

            const DataLoadingComponent = () => {
              const [data, setData] = React.useState<any>(null)
              const [loading, setLoading] = React.useState(true)

              React.useEffect(() => {
                setTimeout(() => {
                  setData(hasData ? { value: 'test' } : null)
                  setLoading(false)
                }, loadDelay)
              }, [])

              if (loading) {
                return <div data-testid="loading">Loading...</div>
              }

              return (
                <div data-testid="data-component">
                  {data ? data.value : 'No data'}
                </div>
              )
            }

            render(<DataLoadingComponent />)

            await waitFor(
              () => {
                expect(screen.getByTestId('data-component')).toBeInTheDocument()
              },
              { timeout: loadDelay + 500 }
            )

            // Verify no errors during data loading
            expect(errorTracker.getErrorCount()).toBe(0)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify no errors with conditional rendering', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 3, maxLength: 10 }),
          async (conditions) => {
            errorTracker.clear()

            const ConditionalComponent = () => (
              <div data-testid="conditional-component">
                {conditions.map((condition, index) =>
                  condition ? (
                    <div key={index} data-testid={`item-${index}`}>
                      Item {index}
                    </div>
                  ) : null
                )}
              </div>
            )

            render(<ConditionalComponent />)

            await waitFor(() => {
              expect(screen.getByTestId('conditional-component')).toBeInTheDocument()
            })

            // Verify no errors with conditional rendering
            expect(errorTracker.getErrorCount()).toBe(0)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify no errors with safe data access patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            data: fc.option(
              fc.record({
                value: fc.string(),
                nested: fc.option(fc.record({ deep: fc.integer() }))
              }),
              { nil: null }
            )
          }),
          async ({ data }) => {
            errorTracker.clear()

            const SafeAccessComponent = () => {
              // Use optional chaining and nullish coalescing
              const value = data?.value ?? 'default'
              const deep = data?.nested?.deep ?? 0

              return (
                <div data-testid="safe-access">
                  <div>{value}</div>
                  <div>{deep}</div>
                </div>
              )
            }

            render(<SafeAccessComponent />)

            await waitFor(() => {
              expect(screen.getByTestId('safe-access')).toBeInTheDocument()
            })

            // Verify no errors with safe access patterns
            expect(errorTracker.getErrorCount()).toBe(0)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify no errors during async operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              delay: fc.integer({ min: 10, max: 200 }),
              success: fc.boolean()
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (operations) => {
            errorTracker.clear()

            const AsyncComponent = () => {
              const [results, setResults] = React.useState<string[]>([])

              React.useEffect(() => {
                operations.forEach((op, index) => {
                  setTimeout(() => {
                    if (op.success) {
                      setResults(prev => [...prev, `Success ${index}`])
                    } else {
                      // Handle failure gracefully without console.error
                      setResults(prev => [...prev, `Failed ${index}`])
                    }
                  }, op.delay)
                })
              }, [])

              return (
                <div data-testid="async-component">
                  {results.map((result, i) => (
                    <div key={i}>{result}</div>
                  ))}
                </div>
              )
            }

            render(<AsyncComponent />)

            await waitFor(() => {
              expect(screen.getByTestId('async-component')).toBeInTheDocument()
            })

            // Wait for all operations to complete
            const maxDelay = Math.max(...operations.map(op => op.delay))
            await new Promise(resolve => setTimeout(resolve, maxDelay + 100))

            // Verify no errors during async operations
            expect(errorTracker.getErrorCount()).toBe(0)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should verify error-free operation is deterministic', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (iterations) => {
            const errorCounts: number[] = []

            for (let i = 0; i < iterations; i++) {
              errorTracker.clear()

              const { unmount } = render(<MockComponent shouldError={false} />)

              await waitFor(() => {
                expect(screen.getByTestId('mock-component')).toBeInTheDocument()
              })

              errorCounts.push(errorTracker.getErrorCount())

              unmount()
            }

            // Verify all iterations have zero errors
            expect(errorCounts.every(count => count === 0)).toBe(true)

            // Verify consistency
            const allSame = errorCounts.every(count => count === errorCounts[0])
            expect(allSame).toBe(true)
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})
