/**
 * API Route Tests: Resources
 * GET/POST /api/resources (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/resources', () => {
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
      json: async () => ([{ id: 'r1', name: 'Resource 1' }]),
      text: async () => '[]',
    })

    const { GET } = await import('@/app/api/resources/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/resources',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect((data as any[])[0].name).toBe('Resource 1')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/resources\/?$/),
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

    const { GET } = await import('@/app/api/resources/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/resources')
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('forwards portfolio_id query to backend when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ([]),
      text: async () => '[]',
    })

    const { GET } = await import('@/app/api/resources/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/resources?portfolio_id=pf-123'
    )
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('portfolio_id=pf-123'),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('returns backend status when backend returns error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Server error',
    })

    const { GET } = await import('@/app/api/resources/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/resources',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Backend error')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/resources/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/resources',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to fetch resources')
  })
})

describe('POST /api/resources', () => {
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
      json: async () => ({ id: 'r2', name: 'New Resource' }),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/resources/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/resources',
      method: 'POST',
      body: { name: 'New Resource' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(201)
    expect((data as Record<string, unknown>).id).toBe('r2')
    expect((data as Record<string, unknown>).name).toBe('New Resource')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/resources\/?$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New Resource' }),
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

    const { POST } = await import('@/app/api/resources/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/resources', 'token', {
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

    const { POST } = await import('@/app/api/resources/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/resources',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to create resource')
  })
})
