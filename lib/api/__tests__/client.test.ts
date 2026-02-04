/**
 * Unit tests for lib/api/client.ts – getApiUrl, API_CONFIG, apiRequest
 * @jest-environment node
 */

import { getApiUrl, API_CONFIG, apiRequest } from '../client'

describe('getApiUrl', () => {
  it('prepends /api when endpoint starts with /', () => {
    expect(getApiUrl('/projects')).toBe('/api/projects')
  })

  it('prepends /api when endpoint does not start with /', () => {
    expect(getApiUrl('projects')).toBe('/api/projects')
  })

  it('strips /api prefix from endpoint and adds it once', () => {
    expect(getApiUrl('/api/projects')).toBe('/api/projects')
  })

  it('preserves path after stripping query', () => {
    expect(getApiUrl('/projects?limit=10')).toBe('/api/projects?limit=10')
  })
})

describe('API_CONFIG', () => {
  it('has baseURL and headers', () => {
    expect(API_CONFIG.baseURL).toBe('/api')
    expect(API_CONFIG.headers['Content-Type']).toBe('application/json')
  })
})

describe('apiRequest', () => {
  it('returns parsed JSON when response is ok', async () => {
    const data = { id: '1', name: 'Test' }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    })

    const result = await apiRequest('/projects/1')
    expect(result).toEqual(data)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/1',
      expect.objectContaining({ headers: expect.any(Object) })
    )
  })

  it('uses mock data fallback for /projects when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const result = await apiRequest('/projects')
    expect(Array.isArray(result)).toBe(true)
    expect((result as any[]).length).toBeGreaterThan(0)
  })

  it('uses mock data fallback for /optimized/dashboard/quick-stats when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const result = await apiRequest('/optimized/dashboard/quick-stats')
    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).quick_stats).toBeDefined()
  })

  it('throws when response not ok and no mock data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    })

    await expect(apiRequest('/unknown/endpoint')).rejects.toThrow('API request failed')
  })

  it('forwards request options and merges headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    await apiRequest('/test', {
      method: 'POST',
      body: JSON.stringify({ x: 1 }),
      headers: { 'X-Custom': 'value' },
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ x: 1 }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom': 'value',
        }),
      })
    )
  })
})
