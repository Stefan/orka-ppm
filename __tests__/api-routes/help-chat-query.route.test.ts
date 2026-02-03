/**
 * API Route Tests: Help Chat Query
 * POST /api/help-chat/query - validation, auth, proxy
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

const mockGetUser = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}))

describe('POST /api/help-chat/query', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    mockGetUser.mockReset()
    global.fetch = originalFetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 400 when query is missing', async () => {
    const { POST } = await import('@/app/api/help-chat/query/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/help-chat/query', 'token', {
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('Query is required')
  })

  it('returns 400 when query is empty string', async () => {
    const { POST } = await import('@/app/api/help-chat/query/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/help-chat/query', 'token', {
      method: 'POST',
      body: { query: '   ' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('Query is required')
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await import('@/app/api/help-chat/query/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/help-chat/query', 'token', {
      method: 'POST',
      body: { query: 'How do I create a project?' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Unauthorized')
  })

  it('returns 200 and backend response when authenticated and backend ok', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: 'You can create a project from the dashboard.',
        query_id: 'q-1',
      }),
    })

    const { POST } = await import('@/app/api/help-chat/query/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/help-chat/query', 'token', {
      method: 'POST',
      body: { query: 'How do I create a project?', language: 'en' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).response).toBe('You can create a project from the dashboard.')
    expect((data as Record<string, unknown>).query_id).toBe('q-1')
  })

  it('returns 500 when backend request fails', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Backend error' }),
    })

    const { POST } = await import('@/app/api/help-chat/query/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/help-chat/query', 'token', {
      method: 'POST',
      body: { query: 'Help me' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBeDefined()
  })
})
