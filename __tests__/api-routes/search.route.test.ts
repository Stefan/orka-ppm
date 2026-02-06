/**
 * API Route Tests: Topbar Unified Search
 * GET /api/search?q=...&limit=10
 * @jest-environment node
 */

import { createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/search', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 200 with empty results when q is empty', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ fulltext: [], semantic: [], suggestions: [], meta: {} }),
    })

    const { GET } = await import('@/app/api/search/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/search?q=',
      'test-token'
    )
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toBeDefined()
    const body = data as Record<string, unknown>
    expect(body.fulltext).toEqual([])
    expect(body.semantic).toEqual([])
    expect(Array.isArray(body.suggestions)).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/search\?.*q=/),
      expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
    )
  })

  it('forwards q and limit to backend and returns structure', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        fulltext: [],
        semantic: [],
        suggestions: ['Costbook'],
        meta: { role: 'user' },
      }),
    })

    const { GET } = await import('@/app/api/search/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/search?q=costbook&limit=5',
      'test-token'
    )
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const body = data as Record<string, unknown>
    expect(body).toHaveProperty('fulltext')
    expect(body).toHaveProperty('semantic')
    expect(body).toHaveProperty('suggestions')
    expect(body).toHaveProperty('meta')
    expect(Array.isArray(body.fulltext)).toBe(true)
    expect(Array.isArray(body.suggestions)).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=costbook'),
      expect.any(Object)
    )
  })

  it('returns backend error status when backend fails', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ detail: 'Service unavailable' }),
    })

    const { GET } = await import('@/app/api/search/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/search?q=x')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(503)
    expect((data as Record<string, unknown>).error).toBeDefined()
  })
})
