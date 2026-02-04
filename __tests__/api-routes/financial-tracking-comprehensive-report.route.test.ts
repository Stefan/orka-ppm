/**
 * API Route Tests: Financial Tracking Comprehensive Report
 * GET /api/financial-tracking/comprehensive-report (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/financial-tracking/comprehensive-report', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 200 and forwards backend JSON when backend returns ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ summary: {}, sections: [] }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/financial-tracking/comprehensive-report/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/financial-tracking/comprehensive-report',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).summary).toBeDefined()
    expect((data as Record<string, unknown>).sections).toEqual([])
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/financial-tracking\/comprehensive-report$/),
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

    const { GET } = await import('@/app/api/financial-tracking/comprehensive-report/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/financial-tracking/comprehensive-report'
    )
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
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

    const { GET } = await import('@/app/api/financial-tracking/comprehensive-report/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/financial-tracking/comprehensive-report?project_id=p1',
      method: 'GET',
    })
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('project_id=p1'),
      expect.any(Object)
    )
  })

  it('returns backend status when backend returns non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Access denied',
    })

    const { GET } = await import('@/app/api/financial-tracking/comprehensive-report/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/financial-tracking/comprehensive-report',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Access denied')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/financial-tracking/comprehensive-report/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/financial-tracking/comprehensive-report',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to get comprehensive report')
    expect((data as Record<string, unknown>).details).toBe('Network error')
  })
})
