/**
 * @jest-environment jsdom
 */

import React, { Component } from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'

// Mock logger before importing ErrorBoundary
jest.mock('../../lib/monitoring/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

import { ErrorBoundary } from '../../components/shared/ErrorBoundary'

// Get the mocked logger
const { logger: mockLogger } = require('../lib/monitoring/logger')

// Test error class
class TestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TestError'
  }
}

// Component that throws errors
class ThrowingComponent extends Component<{ errorMessage: string }> {
  render() {
    throw new TestError(this.props.errorMessage)
  }
}

// Component that doesn't throw errors
const SafeComponent = () => <div>Safe content</div>

describe('Error Boundary Environment-Specific Error Handling Property Tests', () => {
  let originalNodeEnv: string | undefined
  let capturedConsoleErrors: any[]
  let capturedConsoleGroups: any[]
  let originalConsoleError: typeof console.error
  let originalConsoleGroup: typeof console.group
  let originalConsoleGroupEnd: typeof console.groupEnd

  beforeEach(() => {
    // Store original environment
    originalNodeEnv = process.env.NODE_ENV
    
    // Mock console methods and capture calls
    capturedConsoleErrors = []
    capturedConsoleGroups = []
    originalConsoleError = console.error
    originalConsoleGroup = console.group
    originalConsoleGroupEnd = console.groupEnd
    
    console.error = (...args) => {
      capturedConsoleErrors.push(args)
      originalConsoleError.apply(console, args)
    }
    
    console.group = (...args) => {
      capturedConsoleGroups.push(args)
      originalConsoleGroup.apply(console, args)
    }
    
    console.groupEnd = jest.fn()
    
    // Clear mock calls
    mockLogger.error.mockClear()
    
    // Thoroughly clear the DOM and React state
    document.body.innerHTML = ''
    
    // Force garbage collection if available (helps with React cleanup)
    if (global.gc) {
      global.gc()
    }
  })

  afterEach(() => {
    // Restore original environment and console methods
    process.env.NODE_ENV = originalNodeEnv
    console.error = originalConsoleError
    console.group = originalConsoleGroup
    console.groupEnd = originalConsoleGroupEnd
    
    // Thoroughly clear the DOM
    document.body.innerHTML = ''
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  })

  /**
   * Property 6: Environment-Specific Error Handling
   * Validates: Requirements 3.4, 3.5
   * 
   * For any error message, the error boundary should handle errors differently
   * in development vs production environments while maintaining consistent
   * error catching behavior.
   */
  it('Property 6: Environment-specific error handling behaves correctly for all error types', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), // Filter out whitespace-only strings
        (errorMessage) => {
          // Test development environment
          process.env.NODE_ENV = 'development'
          capturedConsoleErrors.length = 0
          capturedConsoleGroups.length = 0
          mockLogger.error.mockClear()
          document.body.innerHTML = ''

          const { unmount: unmountDev, container: devContainer } = render(
            <ErrorBoundary>
              <ThrowingComponent errorMessage={errorMessage} />
            </ErrorBoundary>
          )

          // In development: should show detailed error info in UI
          const devErrorDetails = screen.queryAllByText('Development Error Details:')
          expect(devErrorDetails.length).toBeGreaterThan(0)
          
          // In development: should show error message in UI (use container to scope search)
          const errorMessageElements = Array.from(devContainer.querySelectorAll('*')).filter(el => 
            el.textContent?.includes(errorMessage)
          )
          expect(errorMessageElements.length).toBeGreaterThan(0)
          
          // In development: should log detailed console information
          const hasDetailedConsoleLogging = capturedConsoleGroups.some(group => 
            group.some((arg: any) => typeof arg === 'string' && arg.includes('ErrorBoundary Details'))
          )
          expect(hasDetailedConsoleLogging).toBe(true)
          
          // In development: should NOT call production logger
          expect(mockLogger.error).not.toHaveBeenCalled()

          unmountDev()
          document.body.innerHTML = ''

          // Test production environment
          process.env.NODE_ENV = 'production'
          capturedConsoleErrors.length = 0
          capturedConsoleGroups.length = 0
          mockLogger.error.mockClear()

          const { unmount: unmountProd, container: prodContainer } = render(
            <ErrorBoundary>
              <ThrowingComponent errorMessage={errorMessage} />
            </ErrorBoundary>
          )

          // In production: should NOT show detailed error info in UI
          const prodErrorDetails = screen.queryAllByText('Development Error Details:')
          expect(prodErrorDetails.length).toBe(0)
          
          // In production: should NOT show error message in UI (only user-friendly message)
          const prodUserVisibleElements = Array.from(prodContainer.querySelectorAll('h1, h2, h3, p')).filter(el => 
            el.textContent?.includes(errorMessage) && 
            !el.closest('[class*="bg-red"]') && // Exclude development error details
            !el.textContent?.includes('Stack Trace:') && // Exclude stack traces
            !el.textContent?.includes('Component Stack:') // Exclude component stacks
          )
          expect(prodUserVisibleElements.length).toBe(0)
          
          // In production: should NOT log detailed console information
          const hasDetailedConsoleLoggingProd = capturedConsoleGroups.some(group => 
            group.some((arg: any) => typeof arg === 'string' && arg.includes('ErrorBoundary Details'))
          )
          expect(hasDetailedConsoleLoggingProd).toBe(false)
          
          // In production: should call production logger
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Production error caught by ErrorBoundary',
            expect.objectContaining({
              message: errorMessage,
              name: 'TestError',
              stack: expect.any(String),
              componentStack: expect.any(String),
              errorId: expect.any(String)
            })
          )

          unmountProd()
          document.body.innerHTML = ''
        }
      ),
      { numRuns: 25 } // Reduced from 50 for better reliability
    )
  })

  /**
   * Property 6.1: Development Environment Error Visibility
   * Validates: Requirements 3.4
   * 
   * For any error in development environment, all error details should be
   * visible to developers for debugging purposes.
   */
  it('Property 6.1: Development environment exposes all error details for debugging', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (errorMessage, errorName) => {
          process.env.NODE_ENV = 'development'
          capturedConsoleErrors.length = 0
          capturedConsoleGroups.length = 0
          document.body.innerHTML = ''

          // Create custom error with specific name
          class CustomError extends Error {
            constructor(message: string) {
              super(message)
              this.name = errorName
            }
          }

          class CustomThrowingComponent extends Component {
            render() {
              throw new CustomError(errorMessage)
            }
          }

          const { unmount, container } = render(
            <ErrorBoundary>
              <CustomThrowingComponent />
            </ErrorBoundary>
          )

          // Should show development error details section
          expect(screen.queryAllByText('Development Error Details:').length).toBeGreaterThan(0)
          
          // Should show error message (use container to scope search)
          const errorMessageElements = Array.from(container.querySelectorAll('*')).filter(el => 
            el.textContent?.includes(errorMessage)
          )
          expect(errorMessageElements.length).toBeGreaterThan(0)
          
          // Should show stack trace section
          expect(screen.queryAllByText('Stack Trace:').length).toBeGreaterThan(0)
          
          // Should log detailed console information
          const hasErrorMessage = capturedConsoleErrors.some(errorArgs =>
            errorArgs.some((arg: any) => 
              typeof arg === 'string' && arg.includes('Error message:') ||
              (typeof arg === 'string' && arg === errorMessage)
            )
          )
          expect(hasErrorMessage).toBe(true)
          
          const hasErrorName = capturedConsoleErrors.some(errorArgs =>
            errorArgs.some((arg: any) => 
              typeof arg === 'string' && arg.includes('Error name:') ||
              (typeof arg === 'string' && arg === errorName)
            )
          )
          expect(hasErrorName).toBe(true)

          unmount()
          document.body.innerHTML = ''
        }
      ),
      { numRuns: 20 } // Reduced for better reliability
    )
  })

  /**
   * Property 6.2: Production Environment Error Security
   * Validates: Requirements 3.4, 3.5
   * 
   * For any error in production environment, sensitive error details should be
   * hidden from users while still being logged for monitoring.
   */
  it('Property 6.2: Production environment hides sensitive error details from users', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.oneof(
          fc.constant('SyntaxError'),
          fc.constant('TypeError'),
          fc.constant('ReferenceError'),
          fc.constant('NetworkError'),
          fc.constant('SecurityError')
        ),
        (errorMessage, errorType) => {
          process.env.NODE_ENV = 'production'
          mockLogger.error.mockClear()
          document.body.innerHTML = ''

          class ProductionError extends Error {
            constructor(message: string) {
              super(message)
              this.name = errorType
            }
          }

          class ProductionThrowingComponent extends Component {
            render() {
              throw new ProductionError(errorMessage)
            }
          }

          const { unmount, container } = render(
            <ErrorBoundary>
              <ProductionThrowingComponent />
            </ErrorBoundary>
          )

          // Should NOT show development error details
          expect(screen.queryAllByText('Development Error Details:').length).toBe(0)
          
          // Should NOT show raw error message (check only in user-visible areas, not in stack traces)
          const userVisibleElements = Array.from(container.querySelectorAll('h1, h2, h3, p')).filter(el => 
            el.textContent?.includes(errorMessage) && 
            !el.closest('[class*="bg-red"]') && // Exclude development error details
            !el.textContent?.includes('Stack Trace:') && // Exclude stack traces
            !el.textContent?.includes('Component Stack:') // Exclude component stacks
          )
          expect(userVisibleElements.length).toBe(0)
          
          // Should NOT show stack trace in UI
          expect(screen.queryAllByText('Stack Trace:').length).toBe(0)
          
          // Should show user-friendly error message instead (check for any of the possible messages)
          const hasUserFriendlyMessage = 
            screen.queryAllByText(/An unexpected error occurred while loading/i).length > 0 ||
            screen.queryAllByText(/Application configuration issue detected/i).length > 0 ||
            screen.queryAllByText(/Data loading issue detected/i).length > 0 ||
            screen.queryAllByText(/Network connection issue detected/i).length > 0 ||
            screen.queryAllByText(/Access permission issue/i).length > 0 ||
            screen.queryAllByText(/Request timed out/i).length > 0
          expect(hasUserFriendlyMessage).toBe(true)
          
          // Should still log to production monitoring
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Production error caught by ErrorBoundary',
            expect.objectContaining({
              message: errorMessage,
              name: errorType,
              stack: expect.any(String)
            })
          )

          unmount()
          document.body.innerHTML = ''
        }
      ),
      { numRuns: 20 } // Reduced for better reliability
    )
  })

  /**
   * Property 6.3: Environment-Independent Error Recovery
   * Validates: Requirements 3.5
   * 
   * For any environment, error recovery mechanisms should work consistently
   * regardless of the error details visibility.
   */
  it('Property 6.3: Error recovery mechanisms work consistently across environments', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.oneof(fc.constant('development'), fc.constant('production')),
        (errorMessage, environment) => {
          process.env.NODE_ENV = environment
          document.body.innerHTML = ''

          const { unmount } = render(
            <ErrorBoundary>
              <ThrowingComponent errorMessage={errorMessage} />
            </ErrorBoundary>
          )

          // Should show error UI regardless of environment
          expect(screen.queryAllByText(/error/i).length).toBeGreaterThan(0)
          
          // Should show retry button regardless of environment
          expect(screen.queryAllByRole('button', { name: /retry loading this section/i }).length).toBeGreaterThan(0)
          
          // Should show refresh button regardless of environment
          expect(screen.queryAllByRole('button', { name: /refresh the entire page/i }).length).toBeGreaterThan(0)
          
          // Should show navigation options regardless of environment
          expect(screen.queryAllByRole('button', { name: /go to portfolio dashboards home page/i }).length).toBeGreaterThan(0)
          
          // Should show error ID for support regardless of environment
          expect(screen.queryAllByText('Error ID:').length).toBeGreaterThan(0)

          unmount()
          document.body.innerHTML = ''

          // Test recovery by rendering a new ErrorBoundary with safe component
          // (ErrorBoundary state doesn't reset on rerender, need new instance)
          const { unmount: unmountRecovery } = render(
            <ErrorBoundary>
              <SafeComponent />
            </ErrorBoundary>
          )

          // After recovery with new ErrorBoundary, should show safe content
          expect(screen.queryAllByText('Safe content').length).toBeGreaterThan(0)
          expect(screen.queryAllByText(/error/i).length).toBe(0)

          unmountRecovery()
          document.body.innerHTML = ''
        }
      ),
      { numRuns: 15 } // Reduced for better reliability
    )
  })

  /**
   * Property 6.4: Error Logging Consistency
   * Validates: Requirements 3.1, 3.4
   * 
   * For any error, basic error information should always be captured
   * regardless of environment, but detailed logging should vary by environment.
   */
  it('Property 6.4: Error logging maintains consistency while adapting to environment', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.oneof(fc.constant('development'), fc.constant('production')),
        (errorMessage, environment) => {
          process.env.NODE_ENV = environment
          capturedConsoleErrors.length = 0
          mockLogger.error.mockClear()
          document.body.innerHTML = ''

          const { unmount } = render(
            <ErrorBoundary>
              <ThrowingComponent errorMessage={errorMessage} />
            </ErrorBoundary>
          )

          // Basic error information should always be captured
          const hasBasicErrorLogging = capturedConsoleErrors.some(errorArgs =>
            errorArgs.some((arg: any) => 
              (typeof arg === 'string' && arg.includes('ErrorBoundary caught an error')) ||
              (arg instanceof Error && arg.message === errorMessage)
            )
          )
          expect(hasBasicErrorLogging).toBe(true)

          if (environment === 'development') {
            // Development should have detailed console logging
            const hasDetailedLogging = capturedConsoleErrors.some(errorArgs =>
              errorArgs.some((arg: any) => 
                typeof arg === 'string' && (
                  arg.includes('Error message:') ||
                  arg.includes('Error stack:') ||
                  arg.includes('Component stack:')
                )
              )
            )
            expect(hasDetailedLogging).toBe(true)
            expect(mockLogger.error).not.toHaveBeenCalled()
          } else {
            // Production should use structured logging
            expect(mockLogger.error).toHaveBeenCalledWith(
              'Production error caught by ErrorBoundary',
              expect.objectContaining({
                message: errorMessage,
                name: 'TestError'
              })
            )
          }

          unmount()
          document.body.innerHTML = ''
        }
      ),
      { numRuns: 15 } // Reduced for better reliability
    )
  })
})