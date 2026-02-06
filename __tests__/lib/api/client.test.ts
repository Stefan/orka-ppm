/**
 * Unit tests for API client (getApiUrl, apiRequest).
 * Critical area: Frontend – API client, error handling.
 * @regression
 */

import { getApiUrl, apiRequest, API_CONFIG } from '@/lib/api/client'

describe('lib/api/client [@regression]', () => {
  describe('getApiUrl', () => {
    it('prefixes endpoint with /api when endpoint does not start with /api', () => {
      expect(getApiUrl('/projects')).toBe('/api/projects')
      expect(getApiUrl('projects')).toBe('/api/projects')
    })

    it('does not double-prefix when endpoint already has /api/', () => {
      expect(getApiUrl('/api/projects')).toBe('/api/projects')
      expect(getApiUrl('/api/v1/costbook/rows')).toBe('/api/v1/costbook/rows')
    })

    it('normalizes leading slash', () => {
      expect(getApiUrl('financial-tracking')).toBe('/api/financial-tracking')
      expect(getApiUrl('/financial-tracking')).toBe('/api/financial-tracking')
    })

    it('preserves path segments and query strings are not stripped by getApiUrl', () => {
      expect(getApiUrl('/projects/123')).toBe('/api/projects/123')
      expect(getApiUrl('/api/audit/logs')).toBe('/api/audit/logs')
    })
  })

  describe('API_CONFIG', () => {
    it('exposes baseURL and timeout', () => {
      expect(API_CONFIG.baseURL).toBe('/api')
      expect(API_CONFIG.timeout).toBe(10000)
    })
    it('sets Content-Type header', () => {
      expect(API_CONFIG.headers['Content-Type']).toBe('application/json')
    })
  })

  describe('apiRequest', () => {
    const originalFetch = global.fetch

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('calls getApiUrl for the endpoint and fetches with correct URL', async () => {
      const mockJson = jest.fn().mockResolvedValue({ data: true })
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: mockJson,
      })

      await apiRequest('/projects')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      )
      expect(mockJson).toHaveBeenCalled()
    })

    it('returns parsed JSON when response is ok', async () => {
      const payload = { items: [1, 2, 3] }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      })

      const result = await apiRequest<{ items: number[] }>('/projects')
      expect(result).toEqual(payload)
    })

    it('throws when response is not ok and no mock data exists for endpoint', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(apiRequest('/unknown/endpoint')).rejects.toThrow(
        /API request failed: 500 Internal Server Error/
      )
    })

    it('merges optional request init (method, body)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
      })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' }),
        })
      )
    })
  })
})
