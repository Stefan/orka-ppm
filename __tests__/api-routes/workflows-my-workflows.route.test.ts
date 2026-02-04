/**
 * API Route Tests: Workflows My Workflows
 * GET /api/workflows/instances/my-workflows (proxies to backend)
 * @jest-environment node
 */

import { createAuthenticatedRequest, createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/workflows/instances/my-workflows', () => {
  it('returns 401 when no auth header', async () => {
    const { GET } = await import('@/app/api/workflows/instances/my-workflows/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/workflows/instances/my-workflows',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization header required')
  })

  it('returns 200 with workflows when backend returns pending approvals', async () => {
    global.fetch = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          approvals: [
            { workflow_instance_id: 'wi-1' },
          ],
        }),
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'wi-1',
          workflow_id: 'wf-1',
          workflow_name: 'Approve',
          entity_type: 'project',
          entity_id: 'p1',
          current_step: 1,
          status: 'pending',
          started_by: 'user-1',
          started_at: '2024-01-01T00:00:00Z',
          approvals: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }),
    })

    const { GET } = await import('@/app/api/workflows/instances/my-workflows/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/workflows/instances/my-workflows'
    )
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).workflows).toBeDefined()
    expect((data as Record<string, unknown>).count).toBe(1)
  })

  it('returns 200 with empty workflows when pending approvals fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error'),
    })

    const { GET } = await import('@/app/api/workflows/instances/my-workflows/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/workflows/instances/my-workflows'
    )
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).workflows).toEqual([])
    expect((data as Record<string, unknown>).count).toBe(0)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { GET } = await import('@/app/api/workflows/instances/my-workflows/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/workflows/instances/my-workflows'
    )
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to fetch workflows')
  })
})
