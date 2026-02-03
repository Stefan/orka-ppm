/**
 * API Route Tests: Projects Import
 * POST /api/projects/import - auth required, proxy to backend
 * Uses createMockNextRequestWithCookies so request.cookies exists (NextRequest contract).
 * @jest-environment node
 */

import { createMockNextRequestWithCookies, parseJsonResponse } from './helpers'

describe('POST /api/projects/import', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 401 when no token (no Authorization, no cookies)', async () => {
    const { POST } = await import('@/app/api/projects/import/route')
    const request = createMockNextRequestWithCookies({
      url: 'http://localhost:3000/api/projects/import',
      method: 'POST',
      body: [],
      cookies: [],
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data).toBeDefined()
    const obj = data as Record<string, unknown>
    expect(obj.success).toBe(false)
    expect(obj.message).toMatch(/Authentication required/i)
  })

  it('returns 401 when Authorization header is not Bearer', async () => {
    const { POST } = await import('@/app/api/projects/import/route')
    const request = createMockNextRequestWithCookies({
      url: 'http://localhost:3000/api/projects/import',
      method: 'POST',
      headers: { Authorization: 'Basic x' },
      body: [],
      cookies: [],
    })
    const response = await POST(request as any)
    expect(response.status).toBe(401)
  })

  it('returns 200 and backend response when Bearer token and backend ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, count: 2, errors: [] }),
    })

    const { POST } = await import('@/app/api/projects/import/route')
    const request = createMockNextRequestWithCookies({
      url: 'http://localhost:3000/api/projects/import',
      method: 'POST',
      headers: { Authorization: 'Bearer my-token' },
      body: [{ name: 'P1' }, { name: 'P2' }],
      cookies: [],
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toBeDefined()
    const obj = data as Record<string, unknown>
    expect(obj.success).toBe(true)
    expect(obj.count).toBe(2)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/import'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
      })
    )
  })

  it('returns 401 when backend returns 401', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: 'Invalid token' }),
    })

    const { POST } = await import('@/app/api/projects/import/route')
    const request = createMockNextRequestWithCookies({
      url: 'http://localhost:3000/api/projects/import',
      method: 'POST',
      headers: { Authorization: 'Bearer bad-token' },
      body: [],
      cookies: [],
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).success).toBe(false)
  })

  it('returns 403 when backend returns 403', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ detail: 'Insufficient permissions' }),
    })

    const { POST } = await import('@/app/api/projects/import/route')
    const request = createMockNextRequestWithCookies({
      url: 'http://localhost:3000/api/projects/import',
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: [],
      cookies: [],
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect((data as Record<string, unknown>).success).toBe(false)
  })

  it('accepts auth from cookie when no Authorization header', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, count: 0, errors: [] }),
    })

    const { POST } = await import('@/app/api/projects/import/route')
    const request = createMockNextRequestWithCookies({
      url: 'http://localhost:3000/api/projects/import',
      method: 'POST',
      body: [],
      cookies: [{ name: 'auth_token', value: 'cookie-token' }],
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer cookie-token' }),
      })
    )
  })
})
