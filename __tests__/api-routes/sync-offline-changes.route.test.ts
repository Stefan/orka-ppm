/**
 * API Route Tests: Sync Offline Changes
 * GET/POST /api/sync/offline-changes
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

describe('POST /api/sync/offline-changes', () => {
  it('returns 400 when required fields missing', async () => {
    const { POST } = await import('@/app/api/sync/offline-changes/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/offline-changes',
      method: 'POST',
      body: { userId: 'u1' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('userId')
  })

  it('returns 200 and records offline change', async () => {
    const { POST } = await import('@/app/api/sync/offline-changes/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/sync/offline-changes', 'test-token', {
      method: 'POST',
      body: {
        userId: 'user-offline-1',
        deviceId: 'device-1',
        type: 'create',
        entity: 'project',
        entityId: 'proj-1',
        data: { name: 'New Project' },
        timestamp: new Date(),
        synced: false,
      },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
    expect((data as Record<string, unknown>).totalChanges).toBe(1)
    expect((data as Record<string, unknown>).change).toBeDefined()
    expect((data as Record<string, unknown>).change?.type).toBe('create')
    expect((data as Record<string, unknown>).change?.entity).toBe('project')
  })

  it('assigns id when not provided', async () => {
    const { POST } = await import('@/app/api/sync/offline-changes/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/sync/offline-changes', 'test-token', {
      method: 'POST',
      body: {
        userId: 'user-offline-2',
        deviceId: 'd2',
        type: 'update',
        entity: 'task',
        entityId: 'task-1',
        data: {},
      },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).change?.id).toBeDefined()
    expect(String((data as Record<string, unknown>).change?.id)).toMatch(/^change_/)
  })
})

describe('GET /api/sync/offline-changes', () => {
  it('returns 400 when userId missing', async () => {
    const { GET } = await import('@/app/api/sync/offline-changes/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/offline-changes',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('userId')
  })

  it('returns 200 with empty changes when user has none', async () => {
    const { GET } = await import('@/app/api/sync/offline-changes/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/sync/offline-changes?userId=user-no-changes', 'test-token', { method: 'GET' })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).changes).toEqual([])
    expect((data as Record<string, unknown>).totalChanges).toBe(0)
  })

  it('returns 200 with stored changes after POST', async () => {
    const { POST, GET } = await import('@/app/api/sync/offline-changes/route')
    const userId = 'user-get-changes'
    await POST(
      createAuthenticatedRequest('http://localhost:3000/api/sync/offline-changes', 'test-token', {
        method: 'POST',
        body: {
          userId,
          deviceId: 'd1',
          type: 'delete',
          entity: 'comment',
          entityId: 'c1',
          data: {},
        },
      }) as any
    )

    const getResponse = await GET(
      createAuthenticatedRequest(`http://localhost:3000/api/sync/offline-changes?userId=${userId}`, 'test-token', { method: 'GET' }) as any
    )
    const getData = await parseJsonResponse(getResponse)

    expect(getResponse.status).toBe(200)
    expect((getData as Record<string, unknown>).totalChanges).toBe(1)
    expect((getData as Record<string, unknown>).changes?.[0]?.type).toBe('delete')
  })
})
