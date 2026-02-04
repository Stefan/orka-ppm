/**
 * API Route Tests: AI Resource Optimizer
 * GET/POST /api/ai/resource-optimizer (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/ai/resource-optimizer', () => {
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
      json: async () => ({ status: 'ready', suggestions_count: 0 }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/ai/resource-optimizer/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/resource-optimizer',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).status).toBe('ready')
    expect((data as Record<string, unknown>).suggestions_count).toBe(0)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/ai\/resource-optimizer$/),
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

    const { GET } = await import('@/app/api/ai/resource-optimizer/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/ai/resource-optimizer')
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
      json: async () => ({ detail: 'Service unavailable' }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/ai/resource-optimizer/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/resource-optimizer',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(503)
    expect((data as Record<string, unknown>).error).toBe('Service unavailable')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/ai/resource-optimizer/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/resource-optimizer',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Internal server error')
  })
})

describe('POST /api/ai/resource-optimizer', () => {
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
      json: async () => ({ suggestions: [], summary: 'Analysis complete' }),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/ai/resource-optimizer/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/resource-optimizer',
      method: 'POST',
      body: { project_ids: ['p1'], horizon_days: 30 },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).suggestions).toEqual([])
    expect((data as Record<string, unknown>).summary).toBe('Analysis complete')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/ai\/resource-optimizer$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ project_ids: ['p1'], horizon_days: 30 }),
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

    const { POST } = await import('@/app/api/ai/resource-optimizer/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/ai/resource-optimizer', 'token', {
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

  it('returns backend status when backend returns error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Invalid request' }),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/ai/resource-optimizer/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/resource-optimizer',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('Invalid request')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Backend down'))

    const { POST } = await import('@/app/api/ai/resource-optimizer/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/resource-optimizer',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Internal server error')
  })
})
