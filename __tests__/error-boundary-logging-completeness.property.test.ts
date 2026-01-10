/**
 * Property-Based Tests for Error Boundary Logging Completeness
 * Feature: react-rendering-error-fixes, Property 5: Error Boundary Logging Completeness
 * Validates: Requirements 3.1, 3.2, 3.3
 */

import * as fc from 'fast-check'
import '@testing-library/jest-dom'
import { errorInterceptor, EnhancedErrorInfo } from '../lib/monitoring/intercept-console-error'
import { logger } from '../lib/monitoring/logger'

// Mock the logger to capture log calls
jest.mock('../lib/monitoring/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}))

const mockLogger = logger as jest.Mocked<typeof logger>

// Test data generators
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0)

const stackTraceArb = fc.string({ minLength: 10, maxLength: 500 })
  .map(s => `Error: ${s}\n    at Component (file.tsx:10:5)\n    at render (react.js:100:10)`)

const componentStackArb = fc.string({ minLength: 5, maxLength: 300 })
  .map(s => `    in Component (at file.tsx:10)\n    in App (at app.tsx:5)`)

const errorBoundaryNameArb = fc.string({ minLength: 3, maxLength: 50 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s))

const errorTypeArb = fc.constantFrom('console', 'boundary', 'unhandled')
const severityArb = fc.constantFrom('low', 'medium', 'high', 'critical')

const contextArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(
    fc.string(),
    fc.integer(),
    fc.boolean(),
    fc.constant(null)
  ),
  { minKeys: 0, maxKeys: 5 }
)

// Generator for React ErrorInfo-like objects
const reactErrorInfoArb = fc.record({
  componentStack: fc.option(componentStackArb, { nil: undefined }),
  digest: fc.option(fc.string({ minLength: 8, maxLength: 32 }), { nil: undefined })
})

// Generator for Error objects
const errorObjectArb = fc.record({
  name: fc.constantFrom('Error', 'TypeError', 'ReferenceError', 'RangeError'),
  message: errorMessageArb,
  stack: fc.option(stackTraceArb, { nil: undefined })
}).map(({ name, message, stack }) => {
  const error = new Error(message)
  error.name = name
  if (stack) {
    error.stack = stack
  }
  return error
})

describe('Error Boundary Logging Completeness Properties', () => {
  let originalConsoleError: typeof console.error
  let originalConsoleWarn: typeof console.warn
  let capturedLogs: any[]

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    mockLogger.error.mockClear()
    
    // Capture console calls
    capturedLogs = []
    originalConsoleError = console.error
    originalConsoleWarn = console.warn
    
    console.error = (...args) => {
      capturedLogs.push({ level: 'error', args })
      originalConsoleError.apply(console, args)
    }
    
    console.warn = (...args) => {
      capturedLogs.push({ level: 'warn', args })
      originalConsoleWarn.apply(console, args)
    }

    // Reset error interceptor
    errorInterceptor.resetErrorCount()
    
    // Set development environment for detailed logging
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    // Restore original console methods
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
    
    // Restore error interceptor
    errorInterceptor.restore()
  })

  /**
   * Property 5: Error Boundary Logging Completeness
   * For any error caught by the error boundary system, complete error information 
   * including message, stack trace, and component context should be logged
   * Validates: Requirements 3.1, 3.2, 3.3
   */

  test('Property 5.1: All error boundary errors should log complete error information', () => {
    fc.assert(
      fc.property(
        errorObjectArb,
        reactErrorInfoArb,
        fc.option(errorBoundaryNameArb, { nil: undefined }),
        (error, errorInfo, errorBoundary) => {
          // Initialize error interceptor
          errorInterceptor.initialize()
          
          // Log error boundary error
          errorInterceptor.logErrorBoundaryError(error, errorInfo, errorBoundary)
          
          // Verify logger was called
          expect(mockLogger.error).toHaveBeenCalled()
          
          // Get the logged data
          const logCalls = mockLogger.error.mock.calls
          expect(logCalls.length).toBeGreaterThan(0)
          
          // Find the call with enhanced error info
          const errorLogCall = logCalls.find(call => 
            call[1] && typeof call[1] === 'object' && call[1].errorInfo
          )
          
          if (errorLogCall) {
            const loggedData = errorLogCall[1]
            const enhancedErrorInfo = loggedData.errorInfo as EnhancedErrorInfo
            
            // Verify all required fields are present
            expect(enhancedErrorInfo.message).toBe(error.message)
            expect(enhancedErrorInfo.timestamp).toBeDefined()
            expect(enhancedErrorInfo.userAgent).toBeDefined()
            expect(enhancedErrorInfo.url).toBeDefined()
            expect(enhancedErrorInfo.environment).toBeDefined()
            expect(enhancedErrorInfo.errorType).toBe('boundary')
            expect(enhancedErrorInfo.severity).toBe('high')
            
            // Verify stack trace is included when available
            if (error.stack) {
              expect(enhancedErrorInfo.stack).toBe(error.stack)
            }
            
            // Verify component stack is included when available
            if (errorInfo.componentStack) {
              expect(enhancedErrorInfo.componentStack).toBe(errorInfo.componentStack)
            }
            
            // Verify error boundary name is included when provided
            if (errorBoundary) {
              expect(enhancedErrorInfo.errorBoundary).toBe(errorBoundary)
            }
            
            // Verify context includes error info
            expect(enhancedErrorInfo.context).toBeDefined()
            expect(enhancedErrorInfo.context?.errorName).toBe(error.name)
            if (errorInfo.digest) {
              expect(enhancedErrorInfo.context?.digest).toBe(errorInfo.digest)
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  test('Property 5.2: Console errors should be intercepted and logged with full context', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean()), { minLength: 0, maxLength: 3 }),
        (message, additionalArgs) => {
          // Initialize error interceptor
          errorInterceptor.initialize()
          
          // Trigger console error
          console.error(message, ...additionalArgs)
          
          // Verify logger was called
          expect(mockLogger.error).toHaveBeenCalled()
          
          // Get the logged data
          const logCalls = mockLogger.error.mock.calls
          const errorLogCall = logCalls.find(call => 
            call[1] && typeof call[1] === 'object' && call[1].errorInfo
          )
          
          if (errorLogCall) {
            const loggedData = errorLogCall[1]
            const enhancedErrorInfo = loggedData.errorInfo as EnhancedErrorInfo
            
            // Verify error information is complete
            expect(enhancedErrorInfo.message).toContain(message)
            expect(enhancedErrorInfo.timestamp).toBeDefined()
            expect(enhancedErrorInfo.errorType).toBe('console')
            expect(enhancedErrorInfo.severity).toBe('high')
            expect(enhancedErrorInfo.context).toBeDefined()
            expect(enhancedErrorInfo.context?.consoleLevel).toBe('error')
            expect(enhancedErrorInfo.context?.arguments).toBeDefined()
          }
        }
      ),
      { numRuns: 15 }
    )
  })

  test('Property 5.3: Unhandled promise rejections should be logged with complete context', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        fc.option(stackTraceArb, { nil: undefined }),
        (message, stack) => {
          // Initialize error interceptor
          errorInterceptor.initialize()
          
          // Create a promise rejection reason
          const reason = stack ? { message, stack } : message
          
          // Simulate unhandled promise rejection
          const mockEvent = {
            reason,
            promise: Promise.reject(reason)
          } as PromiseRejectionEvent
          
          // Trigger the handler directly (since we can't easily trigger real unhandled rejections in tests)
          const handler = (errorInterceptor as any).handleUnhandledRejection?.bind(errorInterceptor)
          if (handler) {
            handler(mockEvent)
            
            // Verify logger was called
            expect(mockLogger.error).toHaveBeenCalled()
            
            // Get the logged data
            const logCalls = mockLogger.error.mock.calls
            const errorLogCall = logCalls.find(call => 
              call[1] && typeof call[1] === 'object' && call[1].errorInfo
            )
            
            if (errorLogCall) {
              const loggedData = errorLogCall[1]
              const enhancedErrorInfo = loggedData.errorInfo as EnhancedErrorInfo
              
              // Verify error information is complete
              expect(enhancedErrorInfo.message).toContain('Unhandled Promise Rejection')
              expect(enhancedErrorInfo.message).toContain(message)
              expect(enhancedErrorInfo.timestamp).toBeDefined()
              expect(enhancedErrorInfo.errorType).toBe('unhandled')
              expect(enhancedErrorInfo.severity).toBe('critical')
              expect(enhancedErrorInfo.context).toBeDefined()
              expect(enhancedErrorInfo.context?.reason).toBeDefined()
              
              if (stack) {
                expect(enhancedErrorInfo.stack).toBe(stack)
              }
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  test('Property 5.4: Error logging should include environment-specific information', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('development', 'production', 'test'),
        errorObjectArb,
        reactErrorInfoArb,
        (environment, error, errorInfo) => {
          // Set environment
          const originalEnv = process.env.NODE_ENV
          process.env.NODE_ENV = environment
          
          try {
            // Initialize error interceptor
            errorInterceptor.initialize()
            
            // Log error boundary error
            errorInterceptor.logErrorBoundaryError(error, errorInfo)
            
            // Verify logger was called
            expect(mockLogger.error).toHaveBeenCalled()
            
            // Get the logged data
            const logCalls = mockLogger.error.mock.calls
            const errorLogCall = logCalls.find(call => 
              call[1] && typeof call[1] === 'object' && call[1].errorInfo
            )
            
            if (errorLogCall) {
              const loggedData = errorLogCall[1]
              const enhancedErrorInfo = loggedData.errorInfo as EnhancedErrorInfo
              
              // Verify environment is logged
              expect(enhancedErrorInfo.environment).toBe(environment)
              
              // Verify timestamp format
              expect(enhancedErrorInfo.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
              
              // Verify user agent and URL are present
              expect(enhancedErrorInfo.userAgent).toBeDefined()
              expect(enhancedErrorInfo.url).toBeDefined()
            }
          } finally {
            // Restore original environment
            process.env.NODE_ENV = originalEnv
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  test('Property 5.5: Error count should be tracked and included in logs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        errorObjectArb,
        reactErrorInfoArb,
        (errorCount, error, errorInfo) => {
          // Initialize error interceptor
          errorInterceptor.initialize()
          errorInterceptor.resetErrorCount()
          
          // Log multiple errors
          for (let i = 0; i < errorCount; i++) {
            errorInterceptor.logErrorBoundaryError(error, errorInfo, `ErrorBoundary${i}`)
          }
          
          // Verify error count is tracked
          expect(errorInterceptor.getErrorCount()).toBe(errorCount)
          
          // Verify logger was called for each error
          expect(mockLogger.error).toHaveBeenCalledTimes(errorCount * 2) // Once for enhanced logging, once for internal logging
          
          // Check that session error count is included in logs
          const logCalls = mockLogger.error.mock.calls
          const lastLogCall = logCalls[logCalls.length - 1]
          
          if (lastLogCall && lastLogCall[1] && typeof lastLogCall[1] === 'object') {
            expect(lastLogCall[1].sessionErrorCount).toBe(errorCount)
          }
        }
      ),
      { numRuns: 8 }
    )
  })

  test('Property 5.6: Error logging should respect maximum errors per session limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 15 }),
        fc.integer({ min: 20, max: 50 }),
        errorObjectArb,
        reactErrorInfoArb,
        (maxErrors, totalErrors, error, errorInfo) => {
          // Initialize error interceptor with custom max errors
          errorInterceptor.updateConfig({ maxErrorsPerSession: maxErrors })
          errorInterceptor.initialize()
          errorInterceptor.resetErrorCount()
          
          // Log more errors than the limit
          for (let i = 0; i < totalErrors; i++) {
            errorInterceptor.logErrorBoundaryError(error, errorInfo, `ErrorBoundary${i}`)
          }
          
          // Verify error count doesn't exceed the limit
          expect(errorInterceptor.getErrorCount()).toBeLessThanOrEqual(maxErrors)
          
          // Verify logger was not called more than the limit allows
          const expectedLogCalls = Math.min(maxErrors, totalErrors) * 2 // Enhanced + internal logging
          expect(mockLogger.error).toHaveBeenCalledTimes(expectedLogCalls)
        }
      ),
      { numRuns: 5 }
    )
  })

  test('Property 5.7: Stack traces should be included when available and enabled', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        errorObjectArb,
        reactErrorInfoArb,
        (enableStackTrace, error, errorInfo) => {
          // Configure stack trace inclusion
          errorInterceptor.updateConfig({ enableStackTrace })
          errorInterceptor.initialize()
          
          // Log error boundary error
          errorInterceptor.logErrorBoundaryError(error, errorInfo)
          
          // Verify logger was called
          expect(mockLogger.error).toHaveBeenCalled()
          
          // Get the logged data
          const logCalls = mockLogger.error.mock.calls
          const errorLogCall = logCalls.find(call => 
            call[1] && typeof call[1] === 'object' && call[1].errorInfo
          )
          
          if (errorLogCall) {
            const loggedData = errorLogCall[1]
            const enhancedErrorInfo = loggedData.errorInfo as EnhancedErrorInfo
            
            if (enableStackTrace && error.stack) {
              // Stack trace should be included when enabled and available
              expect(enhancedErrorInfo.stack).toBe(error.stack)
            } else if (!enableStackTrace) {
              // Stack trace should not be included when disabled
              expect(enhancedErrorInfo.stack).toBeUndefined()
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  test('Property 5.8: Component stacks should be included when available and enabled', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        errorObjectArb,
        reactErrorInfoArb,
        (enableComponentStack, error, errorInfo) => {
          // Configure component stack inclusion
          errorInterceptor.updateConfig({ enableComponentStack })
          errorInterceptor.initialize()
          
          // Log error boundary error
          errorInterceptor.logErrorBoundaryError(error, errorInfo)
          
          // Verify logger was called
          expect(mockLogger.error).toHaveBeenCalled()
          
          // Get the logged data
          const logCalls = mockLogger.error.mock.calls
          const errorLogCall = logCalls.find(call => 
            call[1] && typeof call[1] === 'object' && call[1].errorInfo
          )
          
          if (errorLogCall) {
            const loggedData = errorLogCall[1]
            const enhancedErrorInfo = loggedData.errorInfo as EnhancedErrorInfo
            
            if (enableComponentStack && errorInfo.componentStack) {
              // Component stack should be included when enabled and available
              expect(enhancedErrorInfo.componentStack).toBe(errorInfo.componentStack)
            } else if (!enableComponentStack) {
              // Component stack should not be included when disabled
              expect(enhancedErrorInfo.componentStack).toBeUndefined()
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })
})

// Integration tests for complete error logging workflow
describe('Error Boundary Logging Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    errorInterceptor.resetErrorCount()
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    errorInterceptor.restore()
  })

  test('Complete error boundary logging workflow', () => {
    // Initialize error interceptor
    errorInterceptor.initialize()
    
    // Create test error and error info
    const testError = new Error('Test component error')
    testError.stack = 'Error: Test component error\n    at TestComponent (test.tsx:10:5)'
    
    const testErrorInfo = {
      componentStack: '    in TestComponent (at test.tsx:10)\n    in App (at app.tsx:5)',
      digest: 'test-digest-123'
    }
    
    // Log error boundary error
    errorInterceptor.logErrorBoundaryError(testError, testErrorInfo, 'TestErrorBoundary')
    
    // Verify complete logging
    expect(mockLogger.error).toHaveBeenCalled()
    
    const logCalls = mockLogger.error.mock.calls
    const errorLogCall = logCalls.find(call => 
      call[1] && typeof call[1] === 'object' && call[1].errorInfo
    )
    
    expect(errorLogCall).toBeDefined()
    
    if (errorLogCall) {
      const loggedData = errorLogCall[1]
      const enhancedErrorInfo = loggedData.errorInfo as EnhancedErrorInfo
      
      // Verify all components of complete logging
      expect(enhancedErrorInfo.message).toBe('Test component error')
      expect(enhancedErrorInfo.stack).toBe(testError.stack)
      expect(enhancedErrorInfo.componentStack).toBe(testErrorInfo.componentStack)
      expect(enhancedErrorInfo.errorBoundary).toBe('TestErrorBoundary')
      expect(enhancedErrorInfo.errorType).toBe('boundary')
      expect(enhancedErrorInfo.severity).toBe('high')
      expect(enhancedErrorInfo.context?.digest).toBe('test-digest-123')
      expect(enhancedErrorInfo.timestamp).toBeDefined()
      expect(enhancedErrorInfo.environment).toBe('development')
    }
  })

  test('Error logging with missing optional information', () => {
    // Initialize error interceptor
    errorInterceptor.initialize()
    
    // Create minimal error (no stack, no component stack)
    const minimalError = new Error('Minimal error')
    const minimalErrorInfo = {}
    
    // Log error boundary error without optional parameters
    errorInterceptor.logErrorBoundaryError(minimalError, minimalErrorInfo)
    
    // Verify logging still works with minimal information
    expect(mockLogger.error).toHaveBeenCalled()
    
    const logCalls = mockLogger.error.mock.calls
    const errorLogCall = logCalls.find(call => 
      call[1] && typeof call[1] === 'object' && call[1].errorInfo
    )
    
    expect(errorLogCall).toBeDefined()
    
    if (errorLogCall) {
      const loggedData = errorLogCall[1]
      const enhancedErrorInfo = loggedData.errorInfo as EnhancedErrorInfo
      
      // Verify required fields are still present
      expect(enhancedErrorInfo.message).toBe('Minimal error')
      expect(enhancedErrorInfo.errorType).toBe('boundary')
      expect(enhancedErrorInfo.severity).toBe('high')
      expect(enhancedErrorInfo.timestamp).toBeDefined()
      expect(enhancedErrorInfo.environment).toBeDefined()
      
      // Optional fields should be undefined
      expect(enhancedErrorInfo.stack).toBeUndefined()
      expect(enhancedErrorInfo.componentStack).toBeUndefined()
      expect(enhancedErrorInfo.errorBoundary).toBeUndefined()
    }
  })
})