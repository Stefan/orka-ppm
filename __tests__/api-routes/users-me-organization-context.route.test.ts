/**
 * API Route Tests: Organization Context (RLS / sub-orgs)
 * GET /api/users/me/organization-context
 * Spec: .kiro/specs/rls-sub-organizations/ Task 5.4
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/users/me/organization-context', () => {
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
    const { GET } = await import('@/app/api/users/me/organization-context/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/users/me/organization-context',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)
    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization required')
  })

  it('returns 200 with organizationId, organizationPath, isAdmin when backend returns them', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ roles: ['user'], scopes: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'org-uuid', path: '1.2', name: 'Acme' }) })

    const { GET } = await import('@/app/api/users/me/organization-context/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/users/me/organization-context')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).organizationId).toBeDefined()
    expect(typeof (data as Record<string, unknown>).organizationPath).toBe('string')
    expect(typeof (data as Record<string, unknown>).isAdmin).toBe('boolean')
  })

  it('returns isAdmin true when backend permissions include admin role', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ roles: ['admin'], role_names: ['admin'], scopes: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'org-uuid', path: '1' }) })

    const { GET } = await import('@/app/api/users/me/organization-context/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/users/me/organization-context')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).isAdmin).toBe(true)
  })
})
