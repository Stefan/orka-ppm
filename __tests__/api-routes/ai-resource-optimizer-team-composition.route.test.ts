/**
 * API Route Tests: AI Resource Optimizer Team Composition
 * POST /api/ai/resource-optimizer/team-composition - proxy to backend
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('POST /api/ai/resource-optimizer/team-composition', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 200 and forwards backend response', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ teams: [], summary: {} }),
    }) as typeof fetch

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/ai/resource-optimizer/team-composition',
      'token',
      { method: 'POST', body: { project_id: 'p1' } }
    )

    const { POST } = await import('@/app/api/ai/resource-optimizer/team-composition/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai/resource-optimizer/team-composition'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error')) as typeof fetch

    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/resource-optimizer/team-composition',
      method: 'POST',
      body: {},
    })

    const { POST } = await import('@/app/api/ai/resource-optimizer/team-composition/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Internal server error')
  })
})
