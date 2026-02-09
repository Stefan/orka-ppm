/**
 * API Route Tests: GET /api/programs (proxy to backend)
 * Programs spec Task 4 – response includes alert_count.
 * @jest-environment node
 */

import { createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/programs', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 200 and programs with alert_count when backend returns list', async () => {
    const backendPrograms = [
      {
        id: 'prog-1',
        portfolio_id: 'pf-1',
        name: 'Program A',
        total_budget: 1000,
        total_actual_cost: 800,
        project_count: 2,
        alert_count: 0,
      },
      {
        id: 'prog-2',
        portfolio_id: 'pf-1',
        name: 'Program B',
        total_budget: 500,
        total_actual_cost: 600,
        project_count: 1,
        alert_count: 1,
      },
    ]
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => backendPrograms,
      text: async () => JSON.stringify(backendPrograms),
    })

    const { GET } = await import('@/app/api/programs/route')
    const url = 'http://localhost:3000/api/programs?portfolio_id=pf-1'
    const request = createAuthenticatedRequest(url, 'test-token', { method: 'GET' })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    const list = data as Array<{ id: string; alert_count?: number }>
    expect(list).toHaveLength(2)
    expect(list[0].alert_count).toBe(0)
    expect(list[1].alert_count).toBe(1)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/programs/'),
      expect.any(Object)
    )
  })

  it('returns 400 when portfolio_id is missing', async () => {
    const { GET } = await import('@/app/api/programs/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/programs', 'test-token', {
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as { error?: string }).error).toBeDefined()
  })
})
