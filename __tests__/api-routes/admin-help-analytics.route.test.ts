/**
 * API Route Tests: Admin Help Analytics
 * GET /api/admin/help-analytics (proxies to backend, admin only)
 * Property 7.7: Admin Authorization
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/admin/help-analytics', () => {
  it('returns 200 and metrics when backend succeeds', async () => {
    const mockData = {
      period: { start_date: '2025-01-01', end_date: '2025-01-08' },
      metrics: {
        total_queries: 10,
        unique_users: 3,
        avg_response_time: 250,
        satisfaction_rate: 80,
        top_queries: [],
        common_issues: [],
      },
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { GET } = await import('@/app/api/admin/help-analytics/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/help-analytics')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).metrics).toEqual(mockData.metrics)
  })

  it('returns 403 when backend rejects (admin required)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    })

    const { GET } = await import('@/app/api/admin/help-analytics/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/help-analytics',
      method: 'GET',
    })
    const response = await GET(request as any)

    expect(response.status).toBe(403)
  })

  it('returns 401 when backend returns unauthorized', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    })

    const { GET } = await import('@/app/api/admin/help-analytics/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/help-analytics',
      method: 'GET',
    })
    const response = await GET(request as any)

    expect(response.status).toBe(401)
  })

  it('forwards query params to backend', async () => {
    let capturedUrl = ''
    global.fetch = jest.fn().mockImplementation((url: string) => {
      capturedUrl = url
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ period: {}, metrics: {} }),
      })
    })

    const { GET } = await import('@/app/api/admin/help-analytics/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/help-analytics?start_date=2025-01-01&end_date=2025-01-15',
      method: 'GET',
    })
    await GET(request as any)

    expect(capturedUrl).toContain('start_date=2025-01-01')
    expect(capturedUrl).toContain('end_date=2025-01-15')
  })
})
