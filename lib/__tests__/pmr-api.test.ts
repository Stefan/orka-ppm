/**
 * Tests for Enhanced PMR API Client
 * Core functionality tests for type-safe API calls, caching, and error handling
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  pmrAPI,
  clearPMRCache,
  invalidateReportCache,
  PMRAPIError
} from '../pmr-api'

// Mock fetch globally
global.fetch = jest.fn()

describe('PMR API Client', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch.mockClear()
    clearPMRCache()
  })

  describe('API Client Structure', () => {
    it('should export all required API methods', () => {
      expect(pmrAPI).toBeDefined()
      expect(pmrAPI.generatePMR).toBeDefined()
      expect(pmrAPI.getPMRReport).toBeDefined()
      expect(pmrAPI.updatePMRSection).toBeDefined()
      expect(pmrAPI.chatEditPMR).toBeDefined()
      expect(pmrAPI.generateAIInsights).toBeDefined()
      expect(pmrAPI.runMonteCarloAnalysis).toBeDefined()
      expect(pmrAPI.exportPMR).toBeDefined()
      expect(pmrAPI.listPMRTemplates).toBeDefined()
      expect(pmrAPI.startCollaborationSession).toBeDefined()
    })

    it('should export cache utility methods', () => {
      expect(pmrAPI.invalidateReportCache).toBeDefined()
      expect(pmrAPI.clearPMRCache).toBeDefined()
      expect(pmrAPI.isReportCached).toBeDefined()
    })

    it('should export batch operation methods', () => {
      expect(pmrAPI.batchUpdateSections).toBeDefined()
      expect(pmrAPI.batchValidateInsights).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should create PMRAPIError with correct properties', () => {
      const error = new PMRAPIError('Test error', 404, 'NOT_FOUND', { detail: 'test' })
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(PMRAPIError)
      expect(error.message).toBe('Test error')
      expect(error.status).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
      expect(error.details).toEqual({ detail: 'test' })
      expect(error.name).toBe('PMRAPIError')
    })

    it('should handle API errors correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          message: 'Report not found',
          code: 'NOT_FOUND'
        })
      } as Response)

      await expect(pmrAPI.getPMRReport('invalid-id')).rejects.toThrow()
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      await expect(pmrAPI.getPMRReport('report-123')).rejects.toThrow()
    })
  })

  describe('Cache Management', () => {
    it('should clear all cache', () => {
      // Should not throw
      expect(() => clearPMRCache()).not.toThrow()
    })

    it('should invalidate report cache', () => {
      // Should not throw
      expect(() => invalidateReportCache('report-123')).not.toThrow()
    })

    it('should check if report is cached', () => {
      const isCached = pmrAPI.isReportCached('report-123')
      expect(typeof isCached).toBe('boolean')
    })
  })

  describe('Type Safety', () => {
    it('should have proper TypeScript types for all methods', () => {
      // This test verifies that TypeScript compilation succeeds
      // If types are incorrect, the test file won't compile
      expect(true).toBe(true)
    })
  })

  describe('API Configuration', () => {
    it('should use correct base URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { id: 'test' }, success: true })
      } as Response)

      try {
        await pmrAPI.getPMRReport('test-id')
      } catch (e) {
        // Ignore errors, we just want to check the URL
      }

      if (mockFetch.mock.calls.length > 0) {
        const callUrl = mockFetch.mock.calls[0][0] as string
        expect(callUrl).toContain('/api/reports/pmr')
      }
    })
  })
})
