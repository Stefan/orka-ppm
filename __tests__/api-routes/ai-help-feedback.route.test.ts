/**
 * API Route Tests: AI Help Feedback
 * POST /api/ai/help/feedback (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('POST /api/ai/help/feedback', () => {
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
      json: async () => ({ success: true, message: 'Feedback received' }),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/ai/help/feedback/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/feedback',
      method: 'POST',
      body: { query_id: 'q1', rating: 5, comment: 'Helpful' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
    expect((data as Record<string, unknown>).message).toBe('Feedback received')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/ai\/help\/feedback$/),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      })
    )
  })

  it('forwards Authorization when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/ai/help/feedback/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/ai/help/feedback', 'token', {
      method: 'POST',
      body: { query_id: 'q1', rating: 3 },
    })
    await POST(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    )
  })

  it('returns backend status when backend returns error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Invalid payload',
    })

    const { POST } = await import('@/app/api/ai/help/feedback/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/feedback',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Invalid payload')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Connection refused'))

    const { POST } = await import('@/app/api/ai/help/feedback/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/feedback',
      method: 'POST',
      body: { query_id: 'q1' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to submit feedback')
    expect((data as Record<string, unknown>).details).toBe('Connection refused')
  })

  it('returns 500 when body is invalid JSON', async () => {
    const { POST } = await import('@/app/api/ai/help/feedback/route')
    const request = new Request('http://localhost:3000/api/ai/help/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid',
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to submit feedback')
  })
})
