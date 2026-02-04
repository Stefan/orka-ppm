/**
 * API Route Tests: Audit Dashboard Stats
 * GET /api/audit/dashboard/stats
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/audit/dashboard/stats', () => {
  it('returns 401 when no auth header', async () => {
    const { GET } = await import('@/app/api/audit/dashboard/stats/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/audit/dashboard/stats',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization header missing')
  })

  it('returns 200 with mock stats when authorized', async () => {
    const { GET } = await import('@/app/api/audit/dashboard/stats/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/audit/dashboard/stats')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).total_events_24h).toBe(42)
    expect((data as Record<string, unknown>).event_volume_chart).toBeDefined()
    expect((data as Record<string, unknown>).system_health).toBeDefined()
  })
})
