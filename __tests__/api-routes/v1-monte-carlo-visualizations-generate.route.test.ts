/**
 * API Route Tests: Monte Carlo Visualizations Generate
 * POST /api/v1/monte-carlo/simulations/[simulationId]/visualizations/generate - proxy to backend
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('POST /api/v1/monte-carlo/simulations/[simulationId]/visualizations/generate', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 401 when Authorization header is missing', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/monte-carlo/simulations/sim1/visualizations/generate',
      method: 'POST',
      body: {},
    })

    const { POST } = await import('@/app/api/v1/monte-carlo/simulations/[simulationId]/visualizations/generate/route')
    const response = await POST(request as any, { params: Promise.resolve({ simulationId: 'sim1' }) })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization header required')
  })

  it('returns 200 and forwards backend response', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('7242/ingest')) return Promise.resolve({ ok: true } as Response)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ chart_data: [], type: 'monte_carlo' }),
      } as Response)
    }) as typeof fetch

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/v1/monte-carlo/simulations/sim1/visualizations/generate',
      'token',
      { method: 'POST', body: {} }
    )

    const { POST } = await import('@/app/api/v1/monte-carlo/simulations/[simulationId]/visualizations/generate/route')
    const response = await POST(request as any, { params: Promise.resolve({ simulationId: 'sim1' }) })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).chart_data).toBeDefined()
  })

  it('returns 503 when backend fetch throws', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('7242/ingest')) return Promise.resolve({ ok: true } as Response)
      return Promise.reject(new Error('ECONNREFUSED'))
    }) as typeof fetch

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/v1/monte-carlo/simulations/sim1/visualizations/generate',
      'token',
      { method: 'POST', body: {} }
    )

    const { POST } = await import('@/app/api/v1/monte-carlo/simulations/[simulationId]/visualizations/generate/route')
    const response = await POST(request as any, { params: Promise.resolve({ simulationId: 'sim1' }) })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(503)
    expect((data as Record<string, unknown>).detail).toContain('unavailable')
  })
})
