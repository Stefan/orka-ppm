/**
 * API Route Tests: Audit Search
 * POST /api/audit/search
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('POST /api/audit/search', () => {
  it('returns 401 when no auth header', async () => {
    const { POST } = await import('@/app/api/audit/search/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/audit/search',
      method: 'POST',
      body: { query: 'login' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization header missing')
  })

  it('returns 200 with mock results when authorized', async () => {
    const { POST } = await import('@/app/api/audit/search/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/audit/search', 'test-token', {
      method: 'POST',
      body: { query: 'user login' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).results).toBeDefined()
    expect(Array.isArray((data as Record<string, unknown>).results)).toBe(true)
    expect((data as Record<string, unknown>).search_query).toBe('user login')
  })
})
