/**
 * API Route Tests: Admin Cache Stats
 * GET /api/admin/cache/stats (proxies to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/admin/cache/stats', () => {
  it('returns 200 and stats when backend succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ hits: 10, misses: 2, size: 5 }),
    })

    const { GET } = await import('@/app/api/admin/cache/stats/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/cache/stats')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).hits).toBe(10)
    expect((data as Record<string, unknown>).misses).toBe(2)
  })

  it('returns empty stats on 404', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    })

    const { GET } = await import('@/app/api/admin/cache/stats/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/cache/stats',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).hits).toBe(0)
    expect((data as Record<string, unknown>).misses).toBe(0)
  })

  it('returns empty stats when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { GET } = await import('@/app/api/admin/cache/stats/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/cache/stats',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).hits).toBe(0)
  })
})
