/**
 * API Route Tests: Financial Tracking Budget Alerts
 * GET /api/financial-tracking/budget-alerts (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/financial-tracking/budget-alerts', () => {
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
      json: async () => ({ alerts: [], total: 0 }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/financial-tracking/budget-alerts/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/financial-tracking/budget-alerts',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).alerts).toEqual([])
    expect((data as Record<string, unknown>).total).toBe(0)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/financial-tracking\/budget-alerts$/),
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

    const { GET } = await import('@/app/api/financial-tracking/budget-alerts/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/financial-tracking/budget-alerts'
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

    const { GET } = await import('@/app/api/financial-tracking/budget-alerts/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/financial-tracking/budget-alerts?project_id=p1&limit=10',
      method: 'GET',
    })
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('project_id=p1'),
      expect.any(Object)
    )
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.any(Object)
    )
  })

  it('returns backend status and error body when backend returns non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Backend error detail',
    })

    const { GET } = await import('@/app/api/financial-tracking/budget-alerts/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/financial-tracking/budget-alerts',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Backend error detail')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/financial-tracking/budget-alerts/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/financial-tracking/budget-alerts',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to get budget alerts')
    expect((data as Record<string, unknown>).details).toBe('Network error')
  })
})
