/**
 * API Route Tests: Optimized Dashboard Projects Summary
 * GET /api/optimized/dashboard/projects-summary (proxy with fallback)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/optimized/dashboard/projects-summary', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 200 and forwards backend array when backend returns ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: '1', name: 'Project A', status: 'active' }],
    })

    const { GET } = await import('@/app/api/optimized/dashboard/projects-summary/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/optimized/dashboard/projects-summary',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect((data as any[])[0].name).toBe('Project A')
    expect(response.headers.get('X-Data-Source')).toBe('backend-real')
  })

  it('returns 200 with fallback mock when backend returns non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const { GET } = await import('@/app/api/optimized/dashboard/projects-summary/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/optimized/dashboard/projects-summary',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(response.headers.get('X-Data-Source')).toBe('fallback-mock')
  })

  it('forwards limit and offset to backend URL', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    })

    const { GET } = await import('@/app/api/optimized/dashboard/projects-summary/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/optimized/dashboard/projects-summary?limit=5&offset=2',
      method: 'GET',
    })
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=5'),
      expect.any(Object)
    )
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('offset=2'),
      expect.any(Object)
    )
  })

  it('forwards Authorization when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    })

    const { GET } = await import('@/app/api/optimized/dashboard/projects-summary/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/optimized/dashboard/projects-summary'
    )
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('returns 200 with fallback when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/optimized/dashboard/projects-summary/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/optimized/dashboard/projects-summary',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(response.headers.get('X-Data-Source')).toBe('fallback-mock')
  })
})
