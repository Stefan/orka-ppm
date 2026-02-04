/**
 * API Route Tests: Schedules catch-all [...path]
 * GET/POST/PUT/DELETE/PATCH /api/schedules/:path (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/schedules/[...path]', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 404 when path is empty', async () => {
    const { GET } = await import('@/app/api/schedules/[...path]/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/schedules',
      method: 'GET',
    })
    const response = await GET(request as any, {
      params: Promise.resolve({ path: [] }),
    })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(404)
    expect((data as Record<string, unknown>).error).toBe('Not found')
  })

  it('proxies to backend and returns JSON when path has segments', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 's1', name: 'Schedule 1' }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/schedules/[...path]/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/schedules/s1',
      method: 'GET',
    })
    const response = await GET(request as any, {
      params: Promise.resolve({ path: ['s1'] }),
    })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).id).toBe('s1')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/schedules\/s1$/),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('forwards Authorization and query string', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/schedules/[...path]/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/schedules/s1/tasks?status=open')
    const response = await GET(request as any, {
      params: Promise.resolve({ path: ['s1', 'tasks'] }),
    })

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('status=open'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })
})

describe('POST /api/schedules/[...path]', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 404 when path is empty', async () => {
    const { POST } = await import('@/app/api/schedules/[...path]/route')
    const request = createMockNextRequest({ url: 'http://localhost:3000/api/schedules', method: 'POST' })
    const response = await POST(request as any, { params: Promise.resolve({ path: [] }) })
    expect(response.status).toBe(404)
  })

  it('proxies body to backend', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 's2' }),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/schedules/[...path]/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/schedules',
      method: 'POST',
      body: { name: 'New' },
    })
    await POST(request as any, { params: Promise.resolve({ path: ['s2', 'tasks'] }) })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/schedules/s2/tasks'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      })
    )
  })
})
