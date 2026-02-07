/**
 * API Route Tests: Sync Preferences
 * GET /api/sync/preferences (by userId), PUT /api/sync/preferences (update)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

jest.mock('@/lib/auth/verify-jwt', () => ({
  enforceSyncAuth: async (_h: string | null, requestUserId: string | null) => {
    if (!_h || !_h.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401 })
    }
    return { userId: requestUserId ?? 'test-user' }
  },
}))

const mockSingleResolve = { data: null, error: { code: 'PGRST116' } }
const mockInsertResolve = { error: null }

const fromChain = {
  select: () => ({
    eq: () => ({
      single: () => ({
        then: (resolve: (v: typeof mockSingleResolve) => void) => resolve(mockSingleResolve),
      }),
    }),
  }),
  update: () => ({
    eq: () => ({ then: (resolve: (v: { error: null }) => void) => resolve(mockInsertResolve) }),
  }),
  insert: () => ({
    then: (resolve: (v: { error: null }) => void) => resolve(mockInsertResolve),
  }),
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => fromChain,
  }),
}))

describe('GET /api/sync/preferences', () => {
  it('returns 400 when userId missing', async () => {
    const { GET } = await import('@/app/api/sync/preferences/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/preferences',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('Missing required parameter: userId')
  })

  it('returns 200 with default preferences when no profile (PGRST116)', async () => {
    const { GET } = await import('@/app/api/sync/preferences/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/sync/preferences?userId=user-1', 'test-token', { method: 'GET' })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).userId).toBe('user-1')
    expect((data as Record<string, unknown>).theme).toBe('auto')
    expect((data as Record<string, unknown>).language).toBe('en')
    expect(response.headers.get('X-Data-Source')).toBe('defaults')
  })
})

describe('PUT /api/sync/preferences', () => {
  it('returns 400 when userId missing in body', async () => {
    const { PUT } = await import('@/app/api/sync/preferences/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/preferences',
      method: 'PUT',
      body: { theme: 'dark' },
    })
    const response = await PUT(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('Missing required field: userId')
  })

  it('returns 200 and success when userId provided and insert succeeds', async () => {
    const { PUT } = await import('@/app/api/sync/preferences/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/sync/preferences', 'test-token', {
      method: 'PUT',
      body: { userId: 'user-2', theme: 'dark', language: 'de' },
    })
    const response = await PUT(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
    expect((data as Record<string, unknown>).preferences).toBeDefined()
    expect((data as Record<string, unknown>).preferences?.userId).toBe('user-2')
  })
})
