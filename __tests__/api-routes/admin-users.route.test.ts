/**
 * API Route Tests: Admin Users
 * GET/POST /api/admin/users (proxies to backend; requires auth)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

const mockFetch = jest.fn()
beforeAll(() => {
  global.fetch = mockFetch
})
afterEach(() => {
  mockFetch.mockReset()
})

describe('GET /api/admin/users', () => {
  it('returns 401 when Authorization header missing', async () => {
    const { GET } = await import('@/app/api/admin/users/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/users',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toContain('Authorization')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 200 with backend data when auth provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: [{ id: '1', email: 'admin@test.com' }] }),
    })
    const { GET } = await import('@/app/api/admin/users/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/users')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).users).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/users'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('forwards query string to backend', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) })
    const { GET } = await import('@/app/api/admin/users/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/users?role=viewer')
    await GET(request as any)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\?.*role=viewer/),
      expect.any(Object)
    )
  })
})

describe('POST /api/admin/users', () => {
  it('returns 401 when Authorization header missing', async () => {
    const { POST } = await import('@/app/api/admin/users/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/users',
      method: 'POST',
      body: { email: 'new@test.com' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toContain('Authorization')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 201 with backend data when auth and body provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '2', email: 'new@test.com' }),
    })
    const { POST } = await import('@/app/api/admin/users/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/users', 'token', {
      method: 'POST',
      body: { email: 'new@test.com', role: 'viewer' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(201)
    expect((data as Record<string, unknown>).email).toBe('new@test.com')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/users'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'new@test.com', role: 'viewer' }),
      })
    )
  })
})
