/**
 * API Route Tests: Projects Import
 * POST /api/projects/import - auth required, token extraction, proxy error forwarding
 * @jest-environment node
 */

import {
  createMockNextRequestWithCookies,
  createAuthenticatedRequest,
  parseJsonResponse,
} from './helpers'

describe('POST /api/projects/import', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 401 when no token (no header, no cookies)', async () => {
    const request = createMockNextRequestWithCookies({
      url: 'http://localhost:3000/api/projects/import',
      method: 'POST',
      body: [],
      cookies: [],
    })
    request.headers.set('Content-Type', 'application/json')

    const { POST } = await import('@/app/api/projects/import/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).message).toContain('Authentication required')
    expect((data as Record<string, unknown>).success).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('forwards request to backend when Bearer token is present and returns backend response', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          count: 2,
          errors: [],
          message: 'Imported 2 projects',
        }),
    })

    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/import', 'secret-token', {
      method: 'POST',
      body: [{ name: 'P1' }, { name: 'P2' }],
    })

    const { POST } = await import('@/app/api/projects/import/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
    expect((data as Record<string, unknown>).count).toBe(2)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/projects\/import$/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('forwards 401 from backend with message', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Invalid or expired token' }),
    })

    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/import', 'bad-token', {
      method: 'POST',
      body: [],
    })

    const { POST } = await import('@/app/api/projects/import/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).success).toBe(false)
    expect((data as Record<string, unknown>).message).toBeDefined()
  })

  it('forwards 403 from backend (permission)', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({ message: 'Insufficient permissions. The data_import permission is required.' }),
    })

    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/import', 'token', {
      method: 'POST',
      body: [],
    })

    const { POST } = await import('@/app/api/projects/import/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect((data as Record<string, unknown>).success).toBe(false)
  })

  it('uses cookie auth when auth_token cookie is set', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, count: 0, errors: [], message: 'OK' }),
    })

    const request = createMockNextRequestWithCookies({
      url: 'http://localhost:3000/api/projects/import',
      method: 'POST',
      body: [],
      cookies: [{ name: 'auth_token', value: 'cookie-token' }],
    })
    request.headers.set('Content-Type', 'application/json')

    const { POST } = await import('@/app/api/projects/import/route')
    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer cookie-token',
        }),
      })
    )
  })
})
