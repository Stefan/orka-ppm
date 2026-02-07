/**
 * API Route Tests: Projects
 * GET /api/projects - proxy to backend, auth forwarding, error handling
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

describe('GET /api/projects [@regression]', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 200 and forwards backend response when backend returns ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: '1', name: 'Project A' }],
      text: async () => '[]',
    })

    const { GET } = await import('@/app/api/projects/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect((data as any[]).length).toBe(1)
    expect((data as any[])[0].name).toBe('Project A')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    )
  })

  it('forwards backend status when backend returns 401', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })

    const { GET } = await import('@/app/api/projects/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBeDefined()
  })

  it('sends request without Authorization when no auth header', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => '[]',
    })

    const { GET } = await import('@/app/api/projects/route')
    const request = createMockNextRequest({ url: 'http://localhost:3000/api/projects', method: 'GET' })
    const response = await GET(request as any)

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'GET',
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      })
    )
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/projects/route')
    const request = createMockNextRequest({ url: 'http://localhost:3000/api/projects', method: 'GET' })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBeDefined()
  })
})
