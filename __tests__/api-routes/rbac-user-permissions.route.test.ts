/**
 * API Route Tests: RBAC User Permissions
 * GET /api/rbac/user-permissions (proxy, auth required)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/rbac/user-permissions', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })
  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 401 when no Authorization header', async () => {
    const { GET } = await import('@/app/api/rbac/user-permissions/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/rbac/user-permissions',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization header required')
  })

  it('returns 200 and forwards backend response when authorized', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ permissions: ['read:projects'], roles: ['viewer'] }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/rbac/user-permissions/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/rbac/user-permissions')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).permissions).toEqual(['read:projects'])
    expect((data as Record<string, unknown>).roles).toEqual(['viewer'])
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rbac/user-permissions'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('returns backend status when backend returns error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Access denied',
    })

    const { GET } = await import('@/app/api/rbac/user-permissions/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/rbac/user-permissions')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(403)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Access denied')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/rbac/user-permissions/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/rbac/user-permissions')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to get user permissions')
    expect((data as Record<string, unknown>).details).toBe('Network error')
  })
})
