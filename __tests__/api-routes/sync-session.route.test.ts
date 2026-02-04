/**
 * API Route Tests: Sync Session
 * GET/PUT /api/sync/session (in-memory session state)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('PUT /api/sync/session', () => {
  it('returns 400 when userId or deviceId missing', async () => {
    const { PUT } = await import('@/app/api/sync/session/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/session',
      method: 'PUT',
      body: { userId: 'u1' },
    })
    const response = await PUT(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('userId')
  })

  it('returns 200 and updates session state', async () => {
    const { PUT } = await import('@/app/api/sync/session/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/session',
      method: 'PUT',
      body: {
        userId: 'user-1',
        deviceId: 'device-1',
        currentPage: '/projects',
        scrollPosition: {},
        formData: {},
        openModals: [],
        selectedItems: {},
        filters: {},
        searchQueries: {},
        lastActivity: new Date(),
        sessionId: 's1',
      },
    })
    const response = await PUT(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
    expect((data as Record<string, unknown>).sessionState).toBeDefined()
    expect((data as Record<string, unknown>).sessionState?.userId).toBe('user-1')
  })
})

describe('GET /api/sync/session', () => {
  it('returns 400 when userId missing', async () => {
    const { GET } = await import('@/app/api/sync/session/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/session',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('userId')
  })

  it('returns 200 with default session when none stored', async () => {
    const { GET } = await import('@/app/api/sync/session/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/session?userId=new-user',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).userId).toBe('new-user')
    expect((data as Record<string, unknown>).currentPage).toBe('/')
  })

  it('returns 200 with stored session after PUT', async () => {
    const { PUT, GET } = await import('@/app/api/sync/session/route')
    const putRequest = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/session',
      method: 'PUT',
      body: {
        userId: 'stored-user',
        deviceId: 'd1',
        currentPage: '/dashboard',
        scrollPosition: {},
        formData: {},
        openModals: [],
        selectedItems: {},
        filters: {},
        searchQueries: {},
        lastActivity: new Date(),
        sessionId: 's2',
      },
    })
    await PUT(putRequest as any)

    const getRequest = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/session?userId=stored-user',
      method: 'GET',
    })
    const response = await GET(getRequest as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).userId).toBe('stored-user')
    expect((data as Record<string, unknown>).currentPage).toBe('/dashboard')
  })
})
