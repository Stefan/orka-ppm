/**
 * API Route Tests: AI Help Tips
 * GET /api/ai/help/tips (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

function createRequestWithNextUrl(url: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  const req = createMockNextRequest({ url, method: init.method || 'GET', headers: init.headers || {} })
  ;(req as Request & { nextUrl?: URL }).nextUrl = new URL(url)
  return req
}

describe('GET /api/ai/help/tips', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })
  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 200 and forwards backend response', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tips: [{ id: 't1', title: 'Tip 1' }] }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/ai/help/tips/route')
    const request = createRequestWithNextUrl('http://localhost:3000/api/ai/help/tips')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).tips).toHaveLength(1)
    expect((data as Record<string, unknown>).tips?.[0]?.title).toBe('Tip 1')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/ai\/help\/tips/),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('forwards query string to backend', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/ai/help/tips/route')
    const request = createRequestWithNextUrl(
      'http://localhost:3000/api/ai/help/tips?context=dashboard&limit=5'
    )
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('context=dashboard'),
      expect.any(Object)
    )
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=5'),
      expect.any(Object)
    )
  })

  it('forwards Authorization when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/ai/help/tips/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/ai/help/tips')
    ;(request as Request & { nextUrl?: URL }).nextUrl = new URL('http://localhost:3000/api/ai/help/tips')
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('returns backend status when backend returns error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Backend error',
    })

    const { GET } = await import('@/app/api/ai/help/tips/route')
    const request = createRequestWithNextUrl('http://localhost:3000/api/ai/help/tips')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Backend error')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/ai/help/tips/route')
    const request = createRequestWithNextUrl('http://localhost:3000/api/ai/help/tips')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to get proactive tips')
    expect((data as Record<string, unknown>).details).toBe('Network error')
  })
})
