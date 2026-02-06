/**
 * Property-based tests for comprehensive error logging
 * Feature: dashboard-white-page-fix, Property 1: Comprehensive Error Logging
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.4
 */

import fc from 'fast-check'
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'

import { 
  diagnosticCollector,
  logError,
  logAuthenticationError,
  logApiError,
  logComponentError,
  type ErrorLog
} from '../lib/diagnostics/diagnostic-collector'

// Generators for property-based testing
const errorTypeGen = fc.constantFrom(
  'javascript', 'authentication', 'api', 'component', 'network', 'validation'
)

const severityGen = fc.constantFrom('low', 'medium', 'high', 'critical')

const componentNameGen = fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s))

const errorMessageGen = fc.string({ minLength: 1, maxLength: 200 })

const contextGen = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(
    fc.string(),
    fc.integer(),
    fc.boolean(),
    fc.constant(null)
  )
)

const errorGen = fc.record({
  message: errorMessageGen,
  name: fc.string({ minLength: 1, maxLength: 50 }),
  stack: fc.option(fc.string(), { nil: undefined })
}).map(({ message, name, stack }) => {
  const error = new Error(message)
  error.name = name
  if (stack) error.stack = stack
  return error
})

const apiErrorGen = fc.record({
  endpoint: fc.string({ minLength: 10, maxLength: 100 }).map(s => `https://api.example.com/${s}`),
  method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
  statusCode: fc.integer({ min: 400, max: 599 }),
  responseTime: fc.integer({ min: 1, max: 30000 }),
  retryCount: fc.integer({ min: 0, max: 5 })
})

describe('Comprehensive Error Logging Property Tests', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    // Clear diagnostic data before each test
    diagnosticCollector.clearDiagnosticData()
    jest.clearAllMocks()
    // Suppress console.error during tests – this suite intentionally logs many errors to assert behaviour
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    diagnosticCollector.clearDiagnosticData()
    consoleErrorSpy?.mockRestore?.()
  })

  test('Property 1: Comprehensive Error Logging - All errors are captured with required fields', () => {
    fc.assert(fc.property(
      errorGen,
      componentNameGen,
      errorTypeGen,
      severityGen,
      contextGen,
      (error, component, errorType, severity, context) => {
        // Act: Log the error
        const errorId = logError({
          error,
          component,
          errorType: errorType as any,
          severity: severity as any,
          context
        })

        // Assert: Error should be logged with all required fields
        expect(errorId).toBeDefined()
        expect(typeof errorId).toBe('string')
        expect(errorId).toMatch(/^error_\d+_[a-z0-9]+$/)

        // Retrieve the logged error
        const errorLogs = diagnosticCollector.getErrorLogs()
        const loggedError = errorLogs.find(log => log.id === errorId)

        expect(loggedError).toBeDefined()
        expect(loggedError).toMatchObject({
          id: errorId,
          component,
          errorType,
          severity,
          context,
          userAgent: navigator.userAgent,
          url: window.location.href
        })

        // Verify required fields are present
        expect(loggedError!.timestamp).toBeInstanceOf(Date)
        expect(loggedError!.error).toBeDefined()
        expect(loggedError!.error.message).toBe(error.message)
        expect(loggedError!.stackTrace).toBeDefined()
        expect(loggedError!.sessionId).toBeDefined()
        expect(loggedError!.breadcrumbs).toBeDefined()
        expect(Array.isArray(loggedError!.breadcrumbs)).toBe(true)

        // Verify error details match
        expect(loggedError!.error.message).toBe(error.message)
        expect(loggedError!.error.name).toBe(error.name)
      }
    ), { numRuns: 100 })
  })

  test('Property 1: JavaScript errors are captured with specific context', () => {
    fc.assert(fc.property(
      errorGen,
      componentNameGen,
      contextGen,
      (error, component, context) => {
        // Act: Log a JavaScript error
        const errorId = logError({
          error,
          component,
          errorType: 'javascript',
          severity: 'high',
          context
        })

        // Assert: JavaScript error should be logged with correct type
        const errorLogs = diagnosticCollector.getErrorLogs({ errorType: 'javascript' })
        const loggedError = errorLogs.find(log => log.id === errorId)

        expect(loggedError).toBeDefined()
        expect(loggedError!.errorType).toBe('javascript')
        expect(loggedError!.severity).toBe('high')
        expect(loggedError!.context).toEqual(context)

        // Verify stack trace is captured
        expect(loggedError!.stackTrace).toBeDefined()
        expect(typeof loggedError!.stackTrace).toBe('string')
      }
    ), { numRuns: 100 })
  })

  test('Property 1: Authentication errors are captured with auth context', () => {
    fc.assert(fc.property(
      errorGen,
      contextGen,
      (error, context) => {
        // Act: Log an authentication error
        const errorId = logAuthenticationError(error, context)

        // Assert: Authentication error should be logged correctly
        const errorLogs = diagnosticCollector.getErrorLogs({ errorType: 'authentication' })
        const loggedError = errorLogs.find(log => log.id === errorId)

        expect(loggedError).toBeDefined()
        expect(loggedError!.errorType).toBe('authentication')
        expect(loggedError!.severity).toBe('high')
        expect(loggedError!.component).toBe('authentication')

        // Verify auth-specific context is added
        expect(loggedError!.context).toBeDefined()
        expect(loggedError!.context!.authState).toBe('failed')
        expect(loggedError!.context!.timestamp).toBeDefined()

        // Original context should be preserved
        if (context) {
          Object.keys(context).forEach(key => {
            expect(loggedError!.context![key]).toEqual(context[key])
          })
        }
      }
    ), { numRuns: 100 })
  })

  test('Property 1: API errors are captured with network details', () => {
    fc.assert(fc.property(
      errorGen,
      apiErrorGen,
      contextGen,
      (error, apiParams, context) => {
        // Act: Log an API error
        const errorId = logApiError({
          ...apiParams,
          error,
          context
        })

        // Assert: API error should be logged with network details
        const allErrorLogs = diagnosticCollector.getErrorLogs()
        const loggedError = allErrorLogs.find(log => log.id === errorId)

        expect(loggedError).toBeDefined()
        expect(loggedError!.errorType).toBe('api')
        expect(loggedError!.component).toBe('api-client')

        // Verify API-specific context
        expect(loggedError!.context).toBeDefined()
        expect(loggedError!.context!.endpoint).toBe(apiParams.endpoint)
        expect(loggedError!.context!.method).toBe(apiParams.method)
        expect(loggedError!.context!.statusCode).toBe(apiParams.statusCode)
        expect(loggedError!.context!.responseTime).toBe(apiParams.responseTime)
        expect(loggedError!.context!.retryCount).toBe(apiParams.retryCount)

        // Verify severity is set based on status code
        const expectedSeverity = apiParams.statusCode >= 500 ? 'high' : 'medium'
        expect(loggedError!.severity).toBe(expectedSeverity)

        // Check that API metrics are also logged
        const diagnosticData = diagnosticCollector.getDiagnosticData()
        const apiMetrics = diagnosticData.apiMetrics
        const relatedMetric = apiMetrics.find(metric => 
          metric.endpoint === apiParams.endpoint && 
          metric.method === apiParams.method &&
          metric.statusCode === apiParams.statusCode
        )
        expect(relatedMetric).toBeDefined()
      }
    ), { numRuns: 100 })
  })

  test('Property 1: Component errors are captured with component context', () => {
    fc.assert(fc.property(
      errorGen,
      componentNameGen,
      contextGen,
      (error, componentName, context) => {
        // Act: Log a component error
        const errorId = logComponentError(error, componentName, context)

        // Assert: Component error should be logged correctly
        const errorLogs = diagnosticCollector.getErrorLogs({ errorType: 'component' })
        const loggedError = errorLogs.find(log => log.id === errorId)

        expect(loggedError).toBeDefined()
        expect(loggedError!.errorType).toBe('component')
        expect(loggedError!.severity).toBe('medium')
        expect(loggedError!.component).toBe(componentName)

        // Verify component-specific context
        expect(loggedError!.context).toBeDefined()
        expect(loggedError!.context!.componentName).toBe(componentName)
        expect(loggedError!.context!.renderError).toBe(true)

        // Original context should be preserved
        if (context) {
          Object.keys(context).forEach(key => {
            expect(loggedError!.context![key]).toEqual(context[key])
          })
        }
      }
    ), { numRuns: 100 })
  })

  test('Property 1: Error filtering works correctly', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        error: errorGen,
        component: componentNameGen,
        errorType: errorTypeGen,
        severity: severityGen,
        context: contextGen
      }), { minLength: 5, maxLength: 20 }),
      (errorConfigs) => {
        // Act: Log multiple errors
        const errorIds = errorConfigs.map(config => 
          logError({
            error: config.error,
            component: config.component,
            errorType: config.errorType as any,
            severity: config.severity as any,
            context: config.context
          })
        )

        // Assert: All errors should be retrievable
        const allErrors = diagnosticCollector.getErrorLogs()
        expect(allErrors.length).toBeGreaterThanOrEqual(errorConfigs.length)

        // Test filtering by component
        const uniqueComponents = [...new Set(errorConfigs.map(c => c.component))]
        for (const component of uniqueComponents) {
          const filteredErrors = diagnosticCollector.getErrorLogs({ component })
          const expectedCount = errorConfigs.filter(c => c.component === component).length
          expect(filteredErrors.filter(e => errorIds.includes(e.id)).length).toBe(expectedCount)
          
          // All filtered errors should have the correct component
          filteredErrors.forEach(error => {
            expect(error.component).toBe(component)
          })
        }

        // Test filtering by error type
        const uniqueErrorTypes = [...new Set(errorConfigs.map(c => c.errorType))]
        for (const errorType of uniqueErrorTypes) {
          const filteredErrors = diagnosticCollector.getErrorLogs({ errorType: errorType as any })
          const expectedCount = errorConfigs.filter(c => c.errorType === errorType).length
          expect(filteredErrors.filter(e => errorIds.includes(e.id)).length).toBe(expectedCount)
          
          // All filtered errors should have the correct type
          filteredErrors.forEach(error => {
            expect(error.errorType).toBe(errorType)
          })
        }

        // Test filtering by severity
        const uniqueSeverities = [...new Set(errorConfigs.map(c => c.severity))]
        for (const severity of uniqueSeverities) {
          const filteredErrors = diagnosticCollector.getErrorLogs({ severity: severity as any })
          const expectedCount = errorConfigs.filter(c => c.severity === severity).length
          expect(filteredErrors.filter(e => errorIds.includes(e.id)).length).toBe(expectedCount)
          
          // All filtered errors should have the correct severity
          filteredErrors.forEach(error => {
            expect(error.severity).toBe(severity)
          })
        }
      }
    ), { numRuns: 50 })
  })

  test('Property 1: Breadcrumbs are captured with errors', () => {
    fc.assert(fc.property(
      errorGen,
      componentNameGen,
      errorTypeGen,
      severityGen,
      (error, component, errorType, severity) => {
        // Act: Add some breadcrumbs and then log an error
        diagnosticCollector.addBreadcrumb({
          category: 'navigation',
          message: 'User navigated to dashboard'
        })
        
        diagnosticCollector.addBreadcrumb({
          category: 'user-action',
          message: 'User clicked button',
          data: { buttonId: 'test-button' }
        })

        const errorId = logError({
          error,
          component,
          errorType: errorType as any,
          severity: severity as any
        })

        // Assert: Error should include breadcrumbs
        const errorLogs = diagnosticCollector.getErrorLogs()
        const loggedError = errorLogs.find(log => log.id === errorId)

        expect(loggedError).toBeDefined()
        expect(loggedError!.breadcrumbs).toBeDefined()
        expect(Array.isArray(loggedError!.breadcrumbs)).toBe(true)
        expect(loggedError!.breadcrumbs.length).toBeGreaterThanOrEqual(2)

        // Verify breadcrumb structure
        loggedError!.breadcrumbs.forEach(breadcrumb => {
          expect(breadcrumb.timestamp).toBeInstanceOf(Date)
          expect(breadcrumb.category).toBeDefined()
          expect(breadcrumb.message).toBeDefined()
          expect(typeof breadcrumb.message).toBe('string')
        })

        // Should include the breadcrumbs that existed before this error
        // The error's own breadcrumb is added AFTER the error log is created,
        // so it won't be in this error's breadcrumbs array (which is correct behavior)
        expect(loggedError!.breadcrumbs).toBeDefined()
        expect(Array.isArray(loggedError!.breadcrumbs)).toBe(true)
        expect(loggedError!.breadcrumbs.length).toBeGreaterThanOrEqual(2)

        // Verify breadcrumb structure
        loggedError!.breadcrumbs.forEach(breadcrumb => {
          expect(breadcrumb.timestamp).toBeInstanceOf(Date)
          expect(breadcrumb.category).toBeDefined()
          expect(breadcrumb.message).toBeDefined()
          expect(typeof breadcrumb.message).toBe('string')
        })

        // Verify that the breadcrumbs we added before the error are present
        const navigationBreadcrumb = loggedError!.breadcrumbs.find(b => 
          b.category === 'navigation' && b.message === 'User navigated to dashboard'
        )
        expect(navigationBreadcrumb).toBeDefined()

        const userActionBreadcrumb = loggedError!.breadcrumbs.find(b => 
          b.category === 'user-action' && b.message === 'User clicked button'
        )
        expect(userActionBreadcrumb).toBeDefined()
        expect(userActionBreadcrumb!.data).toBeDefined()
        expect(userActionBreadcrumb!.data!.buttonId).toBe('test-button')
      }
    ), { numRuns: 100 })
  })

  test('Property 1: Session information is consistent across errors', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        error: errorGen,
        component: componentNameGen,
        errorType: errorTypeGen,
        severity: severityGen
      }), { minLength: 2, maxLength: 10 }),
      (errorConfigs) => {
        // Act: Log multiple errors in the same session
        const errorIds = errorConfigs.map(config => 
          logError({
            error: config.error,
            component: config.component,
            errorType: config.errorType as any,
            severity: config.severity as any
          })
        )

        // Assert: All errors should have the same session ID
        const errorLogs = diagnosticCollector.getErrorLogs()
        const sessionErrors = errorLogs.filter(log => errorIds.includes(log.id))
        
        expect(sessionErrors.length).toBe(errorConfigs.length)

        // All errors should have the same session ID
        const sessionIds = [...new Set(sessionErrors.map(error => error.sessionId))]
        expect(sessionIds.length).toBe(1)

        // Session ID should be properly formatted
        const sessionId = sessionIds[0]
        expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/)

        // All errors should have consistent system information
        sessionErrors.forEach(error => {
          expect(error.userAgent).toBe(navigator.userAgent)
          expect(error.url).toBe(window.location.href)
          expect(error.sessionId).toBe(sessionId)
        })
      }
    ), { numRuns: 50 })
  })

  test('Property 1: Diagnostic data export includes all error information', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        error: errorGen,
        component: componentNameGen,
        errorType: errorTypeGen,
        severity: severityGen,
        context: contextGen
      }), { minLength: 1, maxLength: 5 }),
      (errorConfigs) => {
        // Act: Log errors and export diagnostic data
        const errorIds = errorConfigs.map(config => 
          logError({
            error: config.error,
            component: config.component,
            errorType: config.errorType as any,
            severity: config.severity as any,
            context: config.context
          })
        )

        const diagnosticData = diagnosticCollector.getDiagnosticData()

        // Assert: Diagnostic data should include all logged errors
        expect(diagnosticData.errorLogs).toBeDefined()
        expect(Array.isArray(diagnosticData.errorLogs)).toBe(true)
        
        const exportedErrors = diagnosticData.errorLogs.filter(log => errorIds.includes(log.id))
        expect(exportedErrors.length).toBe(errorConfigs.length)

        // Verify system info is included
        expect(diagnosticData.systemInfo).toBeDefined()
        expect(diagnosticData.systemInfo.userAgent).toBe(navigator.userAgent)

        // Verify session info is included
        expect(diagnosticData.sessionInfo).toBeDefined()
        expect(diagnosticData.sessionInfo.sessionId).toBeDefined()
        expect(diagnosticData.sessionInfo.startTime).toBeInstanceOf(Date)

        // Verify other diagnostic arrays are present
        expect(Array.isArray(diagnosticData.performanceMetrics)).toBe(true)
        expect(Array.isArray(diagnosticData.apiMetrics)).toBe(true)
        expect(Array.isArray(diagnosticData.userActions)).toBe(true)
      }
    ), { numRuns: 50 })
  })
})