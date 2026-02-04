/**
 * API Route Tests: AI Help Languages
 * GET /api/ai/help/languages (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/ai/help/languages', () => {
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
      json: async () => ({ languages: [{ code: 'en', name: 'English' }, { code: 'de', name: 'German' }] }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/ai/help/languages/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/languages',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).languages).toHaveLength(2)
    expect((data as Record<string, unknown>).languages?.[0]?.code).toBe('en')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/ai\/help\/languages$/),
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

    const { GET } = await import('@/app/api/ai/help/languages/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/ai/help/languages')
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
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => 'Backend down',
    })

    const { GET } = await import('@/app/api/ai/help/languages/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/languages',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(503)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Backend down')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/ai/help/languages/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/languages',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to get supported languages')
    expect((data as Record<string, unknown>).details).toBe('Network error')
  })
})
