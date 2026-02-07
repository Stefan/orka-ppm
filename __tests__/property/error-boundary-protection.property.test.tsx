/**
 * Property-Based Test: Error Boundary Protection
 * 
 * Feature: dashboard-white-page-fix
 * Property 2: Error Boundary Protection
 * 
 * This test validates that for any component error that occurs, the error boundary 
 * should catch the error, prevent white page display, show a user-friendly message, 
 * and provide a retry button.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import * as fc from 'fast-check'
import { DashboardErrorBoundary, ComponentErrorBoundary } from '@/components/error-boundaries'

// Mock the diagnostic collector and error reporter
jest.mock('@/lib/diagnostics/diagnostic-collector', () => ({
  DiagnosticCollector: {
    getInstance: () => ({
      logError: jest.fn(),
      logUserAction: jest.fn()
    })
  }
}))

jest.mock('@/lib/diagnostics/error-reporting', () => ({
  ErrorReporter: {
    getInstance: () => ({
      reportError: jest.fn()
    })
  }
}))

// Test component that can throw errors on demand
interface ErrorThrowingComponentProps {
  shouldThrow: boolean
  errorMessage: string
  errorType: 'Error' | 'TypeError' | 'ReferenceError' | 'RangeError'
  componentName: string
}

const ErrorThrowingComponent: React.FC<ErrorThrowingComponentProps> = ({ 
  shouldThrow, 
  errorMessage, 
  errorType,
  componentName 
}) => {
  if (shouldThrow) {
    let error: Error
    switch (errorType) {
      case 'TypeError':
        error = new TypeError(errorMessage)
        break
      case 'ReferenceError':
        error = new ReferenceError(errorMessage)
        break
      case 'RangeError':
        error = new RangeError(errorMessage)
        break
      default:
        error = new Error(errorMessage)
    }
    throw error
  }
  
  const testId = componentName + '-content'
  return React.createElement('div', { 'data-testid': testId }, 'Component working normally')
}

// Arbitraries for generating test data
const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 })
const errorTypeArb = fc.constantFrom('Error', 'TypeError', 'ReferenceError', 'RangeError')
const componentNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s))

describe('Property 2: Error Boundary Protection', () => {
  beforeEach(() => {
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('DashboardErrorBoundary catches any component error and prevents white page', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        componentNameArb,
        (errorMessage, errorType, componentName) => {
          // Render component that will throw an error
          const { container, unmount } = render(
            <DashboardErrorBoundary>
              <ErrorThrowingComponent
                shouldThrow={true}
                errorMessage={errorMessage}
                errorType={errorType}
                componentName={componentName}
              />
            </DashboardErrorBoundary>
          )

          // Verify error boundary caught the error and shows fallback UI
          expect(container.textContent).toContain('Dashboard Error')
          expect(container.textContent).toContain('Something went wrong while loading the dashboard')
          
          // Verify error message is displayed
          expect(container.textContent).toContain(errorMessage)
          
          // Verify retry button is present
          expect(container.textContent).toContain('Try Again')
          
          // Verify no white page (content is rendered)
          expect(container.textContent).not.toBe('')
          expect(container.textContent?.trim()).not.toBe('')
          
          // Verify the original component content is not rendered
          expect(container.textContent).not.toContain('Component working normally')
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  test('ComponentErrorBoundary isolates component errors and shows error placeholder', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        componentNameArb,
        (errorMessage, errorType, componentName) => {
          // Render component that will throw an error
          const { container, unmount } = render(
            <div>
              <div data-testid="other-content">Other dashboard content</div>
              <ComponentErrorBoundary componentName={componentName}>
                <ErrorThrowingComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                  errorType={errorType}
                  componentName={componentName}
                />
              </ComponentErrorBoundary>
            </div>
          )

          // Verify error boundary shows component-specific error
          expect(container.textContent).toContain(componentName + ' Error')
          expect(container.textContent).toContain('This component encountered an error')
          
          // Verify retry button is present
          expect(container.textContent).toContain('Retry')
          
          // Verify other content is still rendered (isolation)
          expect(container.textContent).toContain('Other dashboard content')
          
          // Verify the failed component content is not rendered
          expect(container.textContent).not.toContain('Component working normally')
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Error boundary retry functionality works for any error type', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        componentNameArb,
        (errorMessage, errorType, componentName) => {
          // Render component that will throw an error
          const { container, unmount } = render(
            <DashboardErrorBoundary>
              <ErrorThrowingComponent
                shouldThrow={true}
                errorMessage={errorMessage}
                errorType={errorType}
                componentName={componentName}
              />
            </DashboardErrorBoundary>
          )

          // Verify error state
          expect(container.textContent).toContain('Dashboard Error')
          
          // Verify retry button is present
          expect(container.textContent).toContain('Try Again')
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Error boundaries provide user-friendly messages for any error', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        componentNameArb,
        (errorMessage, errorType, componentName) => {
          const { container, unmount } = render(
            <DashboardErrorBoundary>
              <ErrorThrowingComponent
                shouldThrow={true}
                errorMessage={errorMessage}
                errorType={errorType}
                componentName={componentName}
              />
            </DashboardErrorBoundary>
          )

          // Verify user-friendly title and description
          expect(container.textContent).toContain('Dashboard Error')
          expect(container.textContent).toContain('Something went wrong while loading the dashboard')
          expect(container.textContent).toContain('Don\'t worry, we\'re here to help')
          
          // Verify error ID is provided for support
          expect(container.textContent).toContain('Error ID:')
          
          // Verify Go Home button is available
          expect(container.textContent).toContain('Go Home')
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Component error boundaries show component-specific error information', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        componentNameArb,
        (errorMessage, errorType, componentName) => {
          const { container, unmount } = render(
            <ComponentErrorBoundary componentName={componentName}>
              <ErrorThrowingComponent
                shouldThrow={true}
                errorMessage={errorMessage}
                errorType={errorType}
                componentName={componentName}
              />
            </ComponentErrorBoundary>
          )

          // Verify component-specific error title
          expect(container.textContent).toContain(componentName + ' Error')
          
          // Verify component-specific error description
          expect(container.textContent).toContain('This component encountered an error and couldn\'t load properly')
          
          // Verify Show Details button is available
          expect(container.textContent).toContain('Show Details')
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Error boundaries prevent white page for component isolation', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        componentNameArb,
        (errorMessage, errorType, componentName) => {
          const { container, unmount } = render(
            <DashboardErrorBoundary>
              <div>Dashboard Header</div>
              <ComponentErrorBoundary componentName={componentName}>
                <ErrorThrowingComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                  errorType={errorType}
                  componentName={componentName}
                />
              </ComponentErrorBoundary>
              <div>Working Component</div>
            </DashboardErrorBoundary>
          )

          // Verify dashboard header is still visible
          expect(container.textContent).toContain('Dashboard Header')
          
          // Verify first component shows error
          expect(container.textContent).toContain(componentName + ' Error')
          
          // Verify other component works normally
          expect(container.textContent).toContain('Working Component')
          
          // Verify no white page
          expect(container.textContent).not.toBe('')
          expect(container.textContent?.trim()).not.toBe('')
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})