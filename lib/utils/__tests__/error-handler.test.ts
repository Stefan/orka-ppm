/**
 * @jest-environment jsdom
 */
if (typeof global.Response === 'undefined') {
  try {
    const { Response } = require('undici')
    global.Response = Response
  } catch {
    // fallback if undici not available
  }
}

jest.mock('../../monitoring/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import {
  ErrorHandler,
  errorHandler,
  handleError,
  handleApiError,
  handleNetworkError,
  handleValidationError,
} from '../error-handler'

const getHandler = () => errorHandler

describe('lib/utils/error-handler', () => {
  beforeEach(() => {
    getHandler().clearStoredErrors()
    try {
      localStorage.clear()
    } catch {
      // ignore
    }
  })

  describe('getInstance', () => {
    it('returns singleton', () => {
      expect(ErrorHandler.getInstance()).toBe(ErrorHandler.getInstance())
    })
  })

  describe('handleError', () => {
    it('accepts Error and queues it', () => {
      handleError(new Error('test'))
      const stored = getHandler().getStoredErrors()
      expect(stored.length).toBeGreaterThanOrEqual(1)
      expect((stored[stored.length - 1] as { message: string }).message).toBe('test')
    })

    it('accepts context', () => {
      handleError(new Error('e'), { page: 'dashboard' })
      const stored = getHandler().getStoredErrors()
      expect((stored[0] as { context?: { page: string } }).context?.page).toBe('dashboard')
    })
  })

  describe('handleApiError', () => {
    it('creates AppError from Response', () => {
      if (typeof Response === 'undefined') return
      const res = new Response('', { status: 500, statusText: 'Server Error' })
      Object.defineProperty(res, 'url', { value: 'https://api.example.com' })
      const err = handleApiError(res as Response)
      expect(err.message).toContain('500')
      expect(err.statusCode).toBe(500)
      expect(err.code).toBe('API_ERROR')
    })
  })

  describe('handleNetworkError', () => {
    it('creates AppError with NETWORK_ERROR code', () => {
      handleNetworkError(new Error('fetch failed'))
      const stored = getHandler().getStoredErrors()
      expect((stored[0] as { code: string }).code).toBe('NETWORK_ERROR')
    })
  })

  describe('handleValidationError', () => {
    it('creates AppError with field', () => {
      const err = handleValidationError('Invalid email', 'email')
      expect(err.message).toBe('Invalid email')
      expect(err.code).toBe('VALIDATION_ERROR')
      const stored = getHandler().getStoredErrors()
      expect((stored[stored.length - 1] as { context?: { field: string } }).context?.field).toBe('email')
    })
  })

  describe('getStoredErrors', () => {
    it('returns empty array when none stored', () => {
      expect((getHandler() as { getStoredErrors: () => unknown[] }).getStoredErrors()).toEqual([])
    })
    it('returns stored errors after handleError', () => {
      handleError(new Error('one'))
      handleError(new Error('two'))
      expect((getHandler() as { getStoredErrors: () => unknown[] }).getStoredErrors().length).toBe(2)
    })
  })

  describe('clearStoredErrors', () => {
    it('removes stored errors', () => {
      handleError(new Error('x'))
      ;(getHandler() as { clearStoredErrors: () => void }).clearStoredErrors()
      expect((getHandler() as { getStoredErrors: () => unknown[] }).getStoredErrors()).toEqual([])
    })
  })
})
