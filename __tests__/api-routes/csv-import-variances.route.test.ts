/**
 * API Route Tests: CSV Import Variances
 * GET /api/csv-import/variances (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

function createRequestWithNextUrl(url: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  const req = createMockNextRequest({ url, method: init.method || 'GET', headers: init.headers || {} })
  ;(req as Request & { nextUrl?: URL }).nextUrl = new URL(url)
  return req
}

describe('GET /api/csv-import/variances', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 200 and forwards backend JSON', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ variances: [], total: 0 }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/csv-import/variances/route')
    const request = createRequestWithNextUrl('http://localhost:3000/api/csv-import/variances')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).variances).toEqual([])
    expect((data as Record<string, unknown>).total).toBe(0)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/csv-import\/variances$/),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('forwards Authorization header when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/csv-import/variances/route')
    const request = createRequestWithNextUrl(
      'http://localhost:3000/api/csv-import/variances',
      { headers: { Authorization: 'Bearer test-token' } }
    )
    const authReq = createAuthenticatedRequest('http://localhost:3000/api/csv-import/variances')
    ;(authReq as Request & { nextUrl?: URL }).nextUrl = new URL('http://localhost:3000/api/csv-import/variances')
    await GET(authReq as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('forwards query string to backend', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/csv-import/variances/route')
    const request = createRequestWithNextUrl(
      'http://localhost:3000/api/csv-import/variances?project_id=p1&period=2024'
    )
    const response = await GET(request as any)

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('project_id=p1'),
      expect.any(Object)
    )
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('period=2024'),
      expect.any(Object)
    )
  })

  it('returns backend status when backend returns non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Backend error',
    })

    const { GET } = await import('@/app/api/csv-import/variances/route')
    const request = createRequestWithNextUrl('http://localhost:3000/api/csv-import/variances')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Backend error')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/csv-import/variances/route')
    const request = createRequestWithNextUrl('http://localhost:3000/api/csv-import/variances')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to get variances')
    expect((data as Record<string, unknown>).details).toBe('Network error')
  })
})
