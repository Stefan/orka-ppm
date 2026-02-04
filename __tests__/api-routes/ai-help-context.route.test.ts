/**
 * API Route Tests: AI Help Context
 * GET /api/ai/help/context (proxy, page_route required)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

function createRequestWithNextUrl(url: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  const req = createMockNextRequest({
    url,
    method: init.method || 'GET',
    headers: init.headers || {},
  })
  ;(req as Request & { nextUrl?: URL }).nextUrl = new URL(url)
  return req
}

describe('GET /api/ai/help/context', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })
  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 400 when page_route missing', async () => {
    const { GET } = await import('@/app/api/ai/help/context/route')
    const request = createRequestWithNextUrl('http://localhost:3000/api/ai/help/context')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('page_route parameter is required')
  })

  it('returns 200 and forwards backend response when page_route provided', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ context: 'dashboard', sections: [] }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/ai/help/context/route')
    const request = createRequestWithNextUrl(
      'http://localhost:3000/api/ai/help/context?page_route=/dashboard'
    )
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).context).toBe('dashboard')
    expect((data as Record<string, unknown>).sections).toEqual([])
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('page_route='),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('forwards Authorization when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/ai/help/context/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/ai/help/context?page_route=/projects'
    )
    ;(request as Request & { nextUrl?: URL }).nextUrl = new URL(
      'http://localhost:3000/api/ai/help/context?page_route=/projects'
    )
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
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Not found',
    })

    const { GET } = await import('@/app/api/ai/help/context/route')
    const request = createRequestWithNextUrl(
      'http://localhost:3000/api/ai/help/context?page_route=/unknown'
    )
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(404)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Not found')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Connection refused'))

    const { GET } = await import('@/app/api/ai/help/context/route')
    const request = createRequestWithNextUrl(
      'http://localhost:3000/api/ai/help/context?page_route=/dashboard'
    )
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to get help context')
    expect((data as Record<string, unknown>).details).toBe('Connection refused')
  })
})
