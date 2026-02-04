/**
 * API Route Tests: Admin Cache Clear
 * POST /api/admin/cache/clear (proxies to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('POST /api/admin/cache/clear', () => {
  it('returns 200 and data when backend succeeds', async () => {
    const mockData = { cleared: true, keys: 5 }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { POST } = await import('@/app/api/admin/cache/clear/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/cache/clear',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toEqual(mockData)
  })

  it('forwards auth header to backend', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })

    const { POST } = await import('@/app/api/admin/cache/clear/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/cache/clear', 'test-token', {
      method: 'POST',
      body: {},
    })
    await POST(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/cache/clear'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('returns backend status when backend fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve('Forbidden'),
    })

    const { POST } = await import('@/app/api/admin/cache/clear/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/cache/clear',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)

    expect(response.status).toBe(403)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { POST } = await import('@/app/api/admin/cache/clear/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/cache/clear',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to clear cache')
  })
})
