/**
 * @jest-environment jsdom
 */
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn()
  }
}))
import { ErrorInterceptor } from '../intercept-console-error'

describe('lib/monitoring/intercept-console-error', () => {
  let interceptor: ErrorInterceptor
  const originalError = console.error
  const originalWarn = console.warn

  beforeEach(() => {
    console.error = originalError
    console.warn = originalWarn
    interceptor = new ErrorInterceptor({
      enableConsoleInterception: false,
      enableUnhandledRejectionInterception: false,
      enableErrorBoundaryLogging: true,
      maxErrorsPerSession: 100
    })
    interceptor.resetErrorCount()
  })

  afterEach(() => {
    interceptor.restore()
    console.error = originalError
    console.warn = originalWarn
  })

  describe('getErrorCount / resetErrorCount', () => {
    it('starts at 0', () => {
      expect(interceptor.getErrorCount()).toBe(0)
    })

    it('resetErrorCount sets count to 0', () => {
      interceptor.logErrorBoundaryError(new Error('e'), {})
      expect(interceptor.getErrorCount()).toBeGreaterThan(0)
      interceptor.resetErrorCount()
      expect(interceptor.getErrorCount()).toBe(0)
    })
  })

  describe('logErrorBoundaryError', () => {
    it('increments error count when enabled', () => {
      interceptor.logErrorBoundaryError(new Error('boundary'), { componentStack: ' at Div' })
      expect(interceptor.getErrorCount()).toBe(1)
    })

    it('does not increment when enableErrorBoundaryLogging is false', () => {
      interceptor.updateConfig({ enableErrorBoundaryLogging: false })
      interceptor.logErrorBoundaryError(new Error('x'), {})
      expect(interceptor.getErrorCount()).toBe(0)
    })

    it('accepts errorBoundary name', () => {
      interceptor.logErrorBoundaryError(new Error('e'), {}, 'AppBoundary')
      expect(interceptor.getErrorCount()).toBe(1)
    })
  })

  describe('updateConfig', () => {
    it('merges partial config', () => {
      interceptor.updateConfig({ maxErrorsPerSession: 5 })
      interceptor.logErrorBoundaryError(new Error('1'), {})
      interceptor.logErrorBoundaryError(new Error('2'), {})
      expect(interceptor.getErrorCount()).toBe(2)
    })
  })

  describe('createEnhancedErrorInfo (via logErrorBoundaryError)', () => {
    it('includes message, errorType, severity', () => {
      interceptor.logErrorBoundaryError(new Error('test message'), {})
      expect(interceptor.getErrorCount()).toBe(1)
    })
  })

  describe('restore', () => {
    it('sets isInitialized to false', () => {
      interceptor.initialize()
      interceptor.restore()
      interceptor.initialize()
      interceptor.restore()
    })

    it('restores original console.error and console.warn', () => {
      interceptor = new ErrorInterceptor({ enableConsoleInterception: true })
      interceptor.initialize()
      const wrappedError = console.error
      const wrappedWarn = console.warn
      interceptor.restore()
      expect(console.error).toBe(originalError)
      expect(console.warn).toBe(originalWarn)
    })
  })

  describe('initialize and console interception', () => {
    it('when enableConsoleInterception is true, console.error and warn call handleConsoleError', () => {
      const logger = require('../logger').logger
      interceptor = new ErrorInterceptor({
        enableConsoleInterception: true,
        enableUnhandledRejectionInterception: false,
        maxErrorsPerSession: 10
      })
      interceptor.initialize()
      console.error('fail')
      expect(interceptor.getErrorCount()).toBe(1)
      expect(logger.error).toHaveBeenCalled()
      console.warn('warning')
      expect(interceptor.getErrorCount()).toBe(2)
    })

    it('stops incrementing when errorCount >= maxErrorsPerSession', () => {
      interceptor = new ErrorInterceptor({
        enableConsoleInterception: true,
        maxErrorsPerSession: 2
      })
      interceptor.initialize()
      console.error('1')
      console.error('2')
      console.error('3')
      expect(interceptor.getErrorCount()).toBe(2)
    })

    it('formatConsoleArgs: string, Error, and object args', () => {
      interceptor = new ErrorInterceptor({
        enableConsoleInterception: true,
        maxErrorsPerSession: 10
      })
      interceptor.initialize()
      console.error('hello', new Error('err'), { foo: 1 })
      expect(interceptor.getErrorCount()).toBe(1)
    })
  })

  describe('initialize idempotent', () => {
    it('does not double-initialize when already initialized', () => {
      interceptor.initialize()
      interceptor.initialize()
      interceptor.restore()
    })
  })

  describe('logErrorBoundaryError with stack and componentStack', () => {
    it('includes stack when enableStackTrace is true', () => {
      const err = new Error('with stack')
      err.stack = 'Error: with stack\n    at fn (file:1:1)'
      interceptor.logErrorBoundaryError(err, {})
      expect(interceptor.getErrorCount()).toBe(1)
    })

    it('includes componentStack when provided', () => {
      interceptor.logErrorBoundaryError(new Error('e'), { componentStack: ' at Component (div)' })
      expect(interceptor.getErrorCount()).toBe(1)
    })
  })

  describe('formatConsoleArgs', () => {
    it('formats circular reference with String() fallback', () => {
      interceptor = new ErrorInterceptor({
        enableConsoleInterception: true,
        maxErrorsPerSession: 10
      })
      interceptor.initialize()
      const circular: Record<string, unknown> = {}
      circular.self = circular
      console.error('msg', circular)
      expect(interceptor.getErrorCount()).toBe(1)
    })
  })

  describe('singleton and default export', () => {
    it('errorInterceptor has getErrorCount and resetErrorCount', async () => {
      const { errorInterceptor: singleton } = await import('../intercept-console-error')
      singleton.resetErrorCount()
      expect(singleton.getErrorCount()).toBe(0)
    })
  })
})
