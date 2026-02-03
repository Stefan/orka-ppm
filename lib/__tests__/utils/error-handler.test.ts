/**
 * Unit tests for lib/utils/error-handler.ts
 * Tests public API: handleError, handleApiError, handleNetworkError, handleValidationError,
 * getStoredErrors, clearStoredErrors, and singleton exports.
 * @jest-environment jsdom
 */

jest.mock('../../monitoring/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}))

// Response is available in jsdom in Node 18+; ensure it exists for handleApiError tests
if (typeof globalThis.Response === 'undefined') {
  const { Response } = require('undici')
  globalThis.Response = Response
}

describe('lib/utils/error-handler', () => {
  let errorHandler: import('../../utils/error-handler').ErrorHandler
  let handleError: (error: Error | import('../../utils/error-handler').AppError, context?: Record<string, unknown>) => void
  let handleApiError: (response: Response, context?: Record<string, unknown>) => import('../../utils/error-handler').AppError
  let handleNetworkError: (error: Error, context?: Record<string, unknown>) => import('../../utils/error-handler').AppError
  let handleValidationError: (message: string, field?: string, context?: Record<string, unknown>) => import('../../utils/error-handler').AppError

  const storedGetItem = jest.fn()
  const storedSetItem = jest.fn()
  const storedRemoveItem = jest.fn()

  beforeAll(async () => {
    const mod = await import('../../utils/error-handler')
    errorHandler = mod.errorHandler as unknown as import('../../utils/error-handler').ErrorHandler
    handleError = mod.handleError
    handleApiError = mod.handleApiError
    handleNetworkError = mod.handleNetworkError
    handleValidationError = mod.handleValidationError
  })

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: storedGetItem,
        setItem: storedSetItem,
        removeItem: storedRemoveItem,
      },
      writable: true,
    })
    storedGetItem.mockReturnValue(null)
  })

  describe('handleError', () => {
    it('accepts plain Error and queues it', () => {
      handleError(new Error('test message'))
      expect(storedSetItem).toHaveBeenCalledWith('orka_error_log', expect.any(String))
      const payload = JSON.parse(storedSetItem.mock.calls[0][1])
      expect(payload).toHaveLength(1)
      expect(payload[0].code).toBe('UNKNOWN_ERROR')
      expect(payload[0].timestamp).toBeDefined()
    })

    it('accepts AppError with code and preserves it', () => {
      const appError = new Error('api fail') as import('../../utils/error-handler').AppError
      appError.code = 'API_ERROR'
      appError.statusCode = 404
      handleError(appError)
      const payload = JSON.parse(storedSetItem.mock.calls[0][1])
      expect(payload[0].code).toBe('API_ERROR')
    })

    it('passes context into stored context', () => {
      handleError(new Error('x'), { feature: 'test' })
      const payload = JSON.parse(storedSetItem.mock.calls[0][1])
      expect(payload[0].context).toMatchObject({ feature: 'test' })
    })
  })

  describe('handleApiError', () => {
    it('creates AppError from Response and returns it', () => {
      const res = new Response('Not Found', { status: 404, statusText: 'Not Found' })
      const err = handleApiError(res)
      expect(err).toBeDefined()
      expect(err.statusCode).toBe(404)
      expect(err.code).toBe('API_ERROR')
      expect(err.context).toMatchObject({ status: 404, statusText: 'Not Found' })
    })

    it('accepts optional context', () => {
      const res = new Response('Error', { status: 500 })
      const err = handleApiError(res, { endpoint: '/api/x' })
      expect(err.context).toMatchObject({ endpoint: '/api/x' })
    })
  })

  describe('handleNetworkError', () => {
    it('creates AppError with NETWORK_ERROR code', () => {
      const err = handleNetworkError(new Error('fetch failed'))
      expect(err.code).toBe('NETWORK_ERROR')
      expect(err.context).toBeDefined()
    })
  })

  describe('handleValidationError', () => {
    it('creates AppError with VALIDATION_ERROR code and optional field', () => {
      const err = handleValidationError('Invalid email', 'email')
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.context).toMatchObject({ field: 'email' })
    })

    it('works without field', () => {
      const err = handleValidationError('Something wrong')
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.context?.field).toBeUndefined()
    })
  })

  describe('getStoredErrors', () => {
    it('returns empty array when no stored errors', () => {
      storedGetItem.mockReturnValue(null)
      expect(errorHandler.getStoredErrors()).toEqual([])
    })

    it('returns parsed stored errors', () => {
      const stored = [{ message: 'old', code: 'X', timestamp: 1 }]
      storedGetItem.mockReturnValue(JSON.stringify(stored))
      expect(errorHandler.getStoredErrors()).toEqual(stored)
    })

    it('returns [] on invalid JSON', () => {
      storedGetItem.mockReturnValue('not json')
      expect(errorHandler.getStoredErrors()).toEqual([])
    })
  })

  describe('clearStoredErrors', () => {
    it('calls localStorage.removeItem', () => {
      errorHandler.clearStoredErrors()
      expect(storedRemoveItem).toHaveBeenCalledWith('orka_error_log')
    })
  })

  describe('error queue cap', () => {
    it('keeps only last 50 errors when storing', () => {
      storedGetItem.mockReturnValue(
        JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ message: `e${i}`, code: 'X', timestamp: i })))
      )
      handleError(new Error('new one'))
      const payload = JSON.parse(storedSetItem.mock.calls[0][1])
      expect(payload.length).toBe(50)
      expect(payload[payload.length - 1].code).toBe('UNKNOWN_ERROR')
    })
  })
})
