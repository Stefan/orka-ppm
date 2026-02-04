/**
 * API Route Tests: Admin Roles
 * GET/POST /api/admin/roles (proxies to backend; requires auth)
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

describe('GET /api/admin/roles', () => {
  it('returns 401 when Authorization header missing', async () => {
    const { GET } = await import('@/app/api/admin/roles/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/roles',
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
      json: async () => ({ roles: [{ id: '1', name: 'admin' }] }),
    })
    const { GET } = await import('@/app/api/admin/roles/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/roles')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).roles).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/roles'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('returns backend status and details when backend returns error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Access denied',
    })
    const { GET } = await import('@/app/api/admin/roles/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/roles')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect((data as Record<string, unknown>).error).toContain('Backend error')
    expect((data as Record<string, unknown>).details).toBe('Access denied')
    consoleSpy.mockRestore()
  })
})

describe('POST /api/admin/roles', () => {
  it('returns 401 when Authorization header missing', async () => {
    const { POST } = await import('@/app/api/admin/roles/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/admin/roles',
      method: 'POST',
      body: { name: 'viewer' },
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
      json: async () => ({ id: '2', name: 'viewer' }),
    })
    const { POST } = await import('@/app/api/admin/roles/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/admin/roles', 'token', {
      method: 'POST',
      body: { name: 'viewer' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(201)
    expect((data as Record<string, unknown>).name).toBe('viewer')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/roles'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'viewer' }),
      })
    )
  })
})
