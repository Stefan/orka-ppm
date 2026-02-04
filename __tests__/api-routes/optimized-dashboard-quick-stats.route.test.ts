/**
 * API Route Tests: Optimized Dashboard Quick Stats
 * GET /api/optimized/dashboard/quick-stats (backend + KPI calculation, fallback)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({
            then: (resolve: (v: { data: null; error: { code: string } }) => void) =>
              resolve({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      }),
    }),
  }),
}))

jest.mock('jwt-decode', () => ({
  jwtDecode: () => ({ sub: null }),
}))

describe('GET /api/optimized/dashboard/quick-stats', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })
  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 200 with backend data when backend returns projects', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        { id: '1', name: 'P1', status: 'active', health: 'green', budget: 1000, actual: 700 },
        { id: '2', name: 'P2', status: 'completed', health: 'green', budget: 2000, actual: 2000 },
      ],
    })

    const { GET } = await import('@/app/api/optimized/dashboard/quick-stats/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/optimized/dashboard/quick-stats',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).quick_stats).toBeDefined()
    expect((data as Record<string, unknown>).kpis).toBeDefined()
    expect((data as Record<string, unknown>).quick_stats?.total_projects).toBe(2)
    expect((data as Record<string, unknown>).quick_stats?.active_projects).toBe(1)
    expect((data as Record<string, unknown>).quick_stats?.completed_projects).toBe(1)
    expect(response.headers.get('X-Data-Source')).toBe('backend-real')
  })

  it('returns 200 with fallback when backend returns non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const { GET } = await import('@/app/api/optimized/dashboard/quick-stats/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/optimized/dashboard/quick-stats',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).quick_stats).toBeDefined()
    expect((data as Record<string, unknown>).kpis).toBeDefined()
    expect((data as Record<string, unknown>).recent_activity).toBeDefined()
    expect((data as Record<string, unknown>).charts).toBeDefined()
    expect(response.headers.get('X-Data-Source')).toBe('fallback-mock')
  })

  it('returns 200 with fallback when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/optimized/dashboard/quick-stats/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/optimized/dashboard/quick-stats',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).quick_stats).toBeDefined()
    expect(response.headers.get('X-Data-Source')).toBe('fallback-mock')
  })

  it('forwards Authorization when provided', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    })

    const { GET } = await import('@/app/api/optimized/dashboard/quick-stats/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/optimized/dashboard/quick-stats'
    )
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })
})
