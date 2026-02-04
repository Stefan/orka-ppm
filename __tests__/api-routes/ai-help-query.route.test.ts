/**
 * API Route Tests: AI Help Query
 * POST /api/ai/help/query (proxy to backend, fallback on error)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('POST /api/ai/help/query', () => {
  const originalFetch = global.fetch
  const originalConsoleLog = console.log
  const originalConsoleError = console.error

  beforeEach(() => {
    console.log = jest.fn()
    console.error = jest.fn()
  })
  afterEach(() => {
    global.fetch = originalFetch
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  it('returns 500 when body is invalid', async () => {
    const { POST } = await import('@/app/api/ai/help/query/route')
    const request = new Request('http://localhost:3000/api/ai/help/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid',
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to process help query')
  })

  it('returns 200 with fallback when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Connection refused'))

    const { POST } = await import('@/app/api/ai/help/query/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/query',
      method: 'POST',
      body: { query: 'How do I create a project?' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).response).toBeDefined()
    expect((data as Record<string, unknown>).isFallback).toBe(true)
    expect((data as Record<string, unknown>).sources).toEqual([])
  })

  it('returns 200 with transformed backend data when backend succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        response: 'You can create a project from the Projects page.',
        session_id: 'sess-123',
        sources: [{ id: 1, title: 'Guide' }],
        confidence: 0.9,
        response_time_ms: 100,
        proactive_tips: [],
        suggested_actions: [],
        related_guides: [],
        is_cached: false,
        is_fallback: false,
      }),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/ai/help/query/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/query',
      method: 'POST',
      body: { query: 'How to create project?', sessionId: 's1' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).response).toBe('You can create a project from the Projects page.')
    expect((data as Record<string, unknown>).sessionId).toBe('sess-123')
    expect((data as Record<string, unknown>).sources).toHaveLength(1)
    expect((data as Record<string, unknown>).confidence).toBe(0.9)
    expect((data as Record<string, unknown>).responseTimeMs).toBe(100)
    expect((data as Record<string, unknown>).isFallback).toBe(false)
  })

  it('forwards Authorization when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        response: 'Ok',
        session_id: 's1',
        sources: [],
        confidence: 0,
        is_fallback: false,
      }),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/ai/help/query/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/ai/help/query', 'token', {
      method: 'POST',
      body: { query: 'test' },
    })
    await POST(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ai/help/query'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    )
  })

  it('returns backend status when backend returns non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limited',
    })

    const { POST } = await import('@/app/api/ai/help/query/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/query',
      method: 'POST',
      body: { query: 'test' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(429)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Rate limited')
  })
})
