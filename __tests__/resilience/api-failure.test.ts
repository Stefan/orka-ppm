/**
 * Resilience tests: API failure, 5xx, network error, timeout
 * Enterprise Test Strategy - Section 4
 * Ensures frontend/API client handles backend down, 5xx, and timeouts
 * without unhandled rejections and with defined error behavior.
 */

import { apiRequest, getApiUrl } from '@/lib/api/client'
import { resilientFetch } from '@/lib/api/resilient-fetch'

describe('Resilience: API failure and timeout', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  describe('apiRequest (lib/api/client)', () => {
    it('throws with expected message when backend returns 503 (no mock fallback)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })
      await expect(apiRequest('/health')).rejects.toThrow(
        /API request failed: 503 Service Unavailable/
      )
    })

    it('throws when backend returns 500 (endpoint without mock)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
      await expect(apiRequest('/some/unknown/endpoint')).rejects.toThrow(
        /API request failed: 500/
      )
    })

    it('throws and does not leave unhandled rejection on network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
      const promise = apiRequest('/health')
      await expect(promise).rejects.toThrow()
      const err = await promise.catch((e) => e)
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toMatch(/Network error|Unknown API error/)
    })

    it('uses mock fallback for /projects when API returns 503', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })
      const data = await apiRequest<unknown[]>('/projects')
      expect(Array.isArray(data)).toBe(true)
      expect((data as unknown[]).length).toBeGreaterThan(0)
    })
  })

  describe('resilientFetch (lib/api/resilient-fetch)', () => {
    it('returns error result when backend returns 503 (no fallback)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })
      const result = await resilientFetch<unknown>('/api/health', { timeout: 2000 })
      expect(result.data).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.isFromFallback).toBe(false)
      expect(result.error?.message).toMatch(/503|Service Unavailable/)
    })

    it('returns fallback data when provided and backend returns 503', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })
      const fallback = { status: 'degraded' }
      const result = await resilientFetch<{ status: string }>('/api/health', {
        timeout: 2000,
        fallbackData: fallback,
      })
      expect(result.data).toEqual(fallback)
      expect(result.error).not.toBeNull()
      expect(result.isFromFallback).toBe(true)
    })

    it('handles timeout: slow response aborted and returns error (no unhandled rejection)', async () => {
      global.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
        return new Promise((_, reject) => {
          const signal = options?.signal as AbortSignal | undefined
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          } else {
            setTimeout(() => reject(new Error('timeout')), 500)
          }
        })
      })
      const result = await resilientFetch<unknown>('http://test/api/slow', {
        timeout: 50,
        retries: 0,
      })
      expect(result.data).toBeNull()
      expect(result.error).not.toBeNull()
    })

    it('handles network error and returns error result', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'))
      const result = await resilientFetch<unknown>('/api/projects', { timeout: 2000 })
      expect(result.data).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toMatch(/Failed to fetch|Unknown error/)
    })
  })

  describe('getApiUrl', () => {
    it('builds URL for Next.js API proxy', () => {
      expect(getApiUrl('/health')).toBe('/api/health')
      expect(getApiUrl('projects')).toBe('/api/projects')
      expect(getApiUrl('/api/projects')).toBe('/api/projects')
    })
  })
})
