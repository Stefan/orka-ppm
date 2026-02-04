/**
 * API Route Tests: Admin Performance Health
 * GET /api/admin/performance/health (proxies to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/admin/performance/health', () => {
  it('returns 200 and data when backend succeeds', async () => {
    const mockData = { status: 'ok', latency: 10 }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { GET } = await import('@/app/api/admin/performance/health/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/performance/health')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toEqual(mockData)
  })

  it('returns backend status when backend fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    })

    const { GET } = await import('@/app/api/admin/performance/health/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/performance/health',
      method: 'GET',
    })
    const response = await GET(request as any)

    expect(response.status).toBe(503)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { GET } = await import('@/app/api/admin/performance/health/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/performance/health',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to get performance health')
  })
})
