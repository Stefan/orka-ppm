/**
 * Feature: register-nested-grids, Task 18.4: Unit tests for error handling
 */

import {
  handleError,
  isRecoverableError,
  withRetry,
  type NestedGridError,
} from '@/lib/register-nested-grids/error-handler'

describe('register-nested-grids error handling', () => {
  describe('Permission errors', () => {
    it('returns user message and action for permission_denied', () => {
      const err: NestedGridError = {
        type: 'permission_denied',
        message: 'Denied',
        recoverable: false,
      }
      const res = handleError(err)
      expect(res.userMessage).toMatch(/permission/)
      expect(['retry', 'restore', 'alternative', 'none']).toContain(res.action)
    })
  })

  describe('Data loading errors', () => {
    it('suggests retry for recoverable data_load_failed', () => {
      const err: NestedGridError = {
        type: 'data_load_failed',
        message: 'Load failed',
        recoverable: true,
      }
      const res = handleError(err)
      expect(res.action).toBe('retry')
    })
  })

  describe('Save operation errors', () => {
    it('suggests retry for recoverable save_failed', () => {
      const err: NestedGridError = {
        type: 'save_failed',
        message: 'Save failed',
        recoverable: true,
      }
      const res = handleError(err)
      expect(res.action).toBe('retry')
    })
  })

  describe('Drag & Drop errors', () => {
    it('suggests restore for reorder_failed', () => {
      const err: NestedGridError = {
        type: 'reorder_failed',
        message: 'Reorder failed',
        recoverable: true,
      }
      const res = handleError(err)
      expect(res.action).toBe('restore')
    })
  })

  describe('withRetry', () => {
    it('returns result when operation succeeds', async () => {
      const result = await withRetry(() => Promise.resolve(42))
      expect(result).toBe(42)
    })

    it('retries on recoverable error', async () => {
      let attempts = 0
      const result = await withRetry(() => {
        attempts++
        if (attempts < 2) return Promise.reject({ code: 'NETWORK_ERROR' })
        return Promise.resolve('ok')
      }, 3, 10)
      expect(result).toBe('ok')
      expect(attempts).toBe(2)
    })

    it('throws immediately on non-recoverable error', async () => {
      await expect(
        withRetry(() => Promise.reject(new Error('validation')))
      ).rejects.toThrow('validation')
    })
  })

  describe('isRecoverableError', () => {
    it('returns true for NETWORK_ERROR', () => {
      expect(isRecoverableError({ code: 'NETWORK_ERROR' })).toBe(true)
    })
    it('returns false for unknown', () => {
      expect(isRecoverableError(new Error('x'))).toBe(false)
    })
  })
})
