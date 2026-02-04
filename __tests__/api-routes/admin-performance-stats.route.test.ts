/**
 * API Route Tests: Admin Performance Stats
 * GET /api/admin/performance/stats (proxies to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/admin/performance/stats', () => {
  it('returns 200 and data when backend succeeds', async () => {
    const mockData = { requests: 100, avgLatency: 50 }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { GET } = await import('@/app/api/admin/performance/stats/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/performance/stats')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toEqual(mockData)
  })

  it('returns backend status when backend fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    })

    const { GET } = await import('@/app/api/admin/performance/stats/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/performance/stats',
      method: 'GET',
    })
    const response = await GET(request as any)

    expect(response.status).toBe(403)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { GET } = await import('@/app/api/admin/performance/stats/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/performance/stats',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to get performance stats')
  })
})
