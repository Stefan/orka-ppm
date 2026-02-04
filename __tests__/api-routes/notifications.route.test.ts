/**
 * API Route Tests: Notifications
 * GET /api/notifications (proxy to backend, auth required)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/notifications', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 401 when no Authorization header', async () => {
    const { GET } = await import('@/app/api/notifications/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/notifications',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization required')
  })

  it('returns 200 and forwards backend response when authorized', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ notifications: [], unread: 0 }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/notifications/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/notifications')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).notifications).toEqual([])
    expect((data as Record<string, unknown>).unread).toBe(0)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/feedback/notifications'),
      expect.objectContaining({
        method: 'GET',
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

    const { GET } = await import('@/app/api/notifications/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications?limit=10&offset=0'
    )
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.any(Object)
    )
  })

  it('returns backend status when backend returns error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Backend error',
    })

    const { GET } = await import('@/app/api/notifications/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/notifications')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Backend error')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/notifications/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/notifications')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to get notifications')
    expect((data as Record<string, unknown>).details).toBe('Network error')
  })
})
