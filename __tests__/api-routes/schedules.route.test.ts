/**
 * API Route Tests: Schedules
 * GET/POST /api/schedules (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/schedules', () => {
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
      json: async () => ([{ id: 's1', name: 'Schedule 1' }]),
      text: async () => '[]',
    })

    const { GET } = await import('@/app/api/schedules/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/schedules',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect((data as any[])[0].name).toBe('Schedule 1')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/schedules'),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('forwards Authorization when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ([]),
      text: async () => '[]',
    })

    const { GET } = await import('@/app/api/schedules/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/schedules')
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('forwards query string', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ([]),
      text: async () => '[]',
    })

    const { GET } = await import('@/app/api/schedules/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/schedules?project_id=p1',
      method: 'GET',
    })
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('project_id=p1'),
      expect.any(Object)
    )
  })

  it('returns backend status on error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })

    const { GET } = await import('@/app/api/schedules/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/schedules',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Failed to fetch schedules')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/schedules/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/schedules',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to fetch schedules')
  })
})

describe('POST /api/schedules', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 201 and forwards backend response', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 's2', name: 'New Schedule' }),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/schedules/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/schedules',
      method: 'POST',
      body: { name: 'New Schedule' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(201)
    expect((data as Record<string, unknown>).id).toBe('s2')
    expect((data as Record<string, unknown>).name).toBe('New Schedule')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/schedules'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    )
  })

  it('forwards Authorization when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/schedules/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/schedules', 'token', {
      method: 'POST',
      body: {},
    })
    await POST(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    )
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Backend down'))

    const { POST } = await import('@/app/api/schedules/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/schedules',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to create schedule')
  })
})
