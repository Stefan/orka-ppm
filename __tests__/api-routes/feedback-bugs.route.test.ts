/**
 * API Route Tests: Feedback Bugs
 * GET/POST /api/feedback/bugs - proxy to backend
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/feedback/bugs', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 200 and backend data when backend returns ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0 }),
    })

    const { GET } = await import('@/app/api/feedback/bugs/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/feedback/bugs',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toBeDefined()
    expect((data as Record<string, unknown>).items).toEqual([])
  })

  it('forwards auth header when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    })

    const { GET } = await import('@/app/api/feedback/bugs/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/feedback/bugs')
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/feedback/bugs'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('returns backend status when backend returns 500', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const { GET } = await import('@/app/api/feedback/bugs/route')
    const request = createMockNextRequest({ url: 'http://localhost:3000/api/feedback/bugs', method: 'GET' })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBeDefined()
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/feedback/bugs/route')
    const request = createMockNextRequest({ url: 'http://localhost:3000/api/feedback/bugs', method: 'GET' })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to get bugs')
  })
})

describe('POST /api/feedback/bugs', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 401 when no Authorization header', async () => {
    const { POST } = await import('@/app/api/feedback/bugs/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/feedback/bugs',
      method: 'POST',
      body: { title: 'Bug', description: 'Test' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization required')
  })

  it('returns 201 and backend data when authenticated and backend ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'bug-1', title: 'Bug', status: 'open' }),
    })

    const { POST } = await import('@/app/api/feedback/bugs/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/feedback/bugs', 'token', {
      method: 'POST',
      body: { title: 'Bug', description: 'Test' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(201)
    expect((data as Record<string, unknown>).id).toBe('bug-1')
  })
})
