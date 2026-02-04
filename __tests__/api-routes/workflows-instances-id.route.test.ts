/**
 * API Route Tests: Workflows Instance by ID
 * GET /api/workflows/instances/[id] (proxies to backend)
 * @jest-environment node
 */

import { createAuthenticatedRequest, createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/workflows/instances/[id]', () => {
  it('returns 401 when no auth header', async () => {
    const { GET } = await import('@/app/api/workflows/instances/[id]/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/workflows/instances/wi-1',
      method: 'GET',
    })
    const response = await GET(request as any, { params: { id: 'wi-1' } })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization header required')
  })

  it('returns 200 and transformed data when backend succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'wi-1',
          workflow_id: 'wf-1',
          workflow_name: 'Approval',
          entity_type: 'project',
          entity_id: 'p1',
          current_step: 1,
          status: 'pending',
          initiated_by: 'user-1',
          initiated_at: '2024-01-01T00:00:00Z',
          approvals: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }),
    })

    const { GET } = await import('@/app/api/workflows/instances/[id]/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/workflows/instances/wi-1'
    )
    const response = await GET(request as any, { params: { id: 'wi-1' } })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).id).toBe('wi-1')
    expect((data as Record<string, unknown>).started_by).toBe('user-1')
  })

  it('returns 404 when backend returns 404', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    })

    const { GET } = await import('@/app/api/workflows/instances/[id]/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/workflows/instances/nonexistent'
    )
    const response = await GET(request as any, { params: { id: 'nonexistent' } })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(404)
    expect((data as Record<string, unknown>).error).toBe('Workflow instance not found')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { GET } = await import('@/app/api/workflows/instances/[id]/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/workflows/instances/wi-1'
    )
    const response = await GET(request as any, { params: { id: 'wi-1' } })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to fetch workflow instance')
  })
})
