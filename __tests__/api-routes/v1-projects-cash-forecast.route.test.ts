/**
 * API Route Tests: V1 Projects Cash Forecast
 * GET /api/v1/projects/[projectId]/cash-forecast
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/v1/projects/[projectId]/cash-forecast', () => {
  it('returns 400 when projectId is missing', async () => {
    const { GET } = await import('@/app/api/v1/projects/[projectId]/cash-forecast/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/projects/cash-forecast',
      method: 'GET',
    })
    const response = await GET(request as any, {
      params: Promise.resolve({ projectId: '' }),
    })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('projectId required')
  })

  it('returns 200 with stub cash forecast periods', async () => {
    const { GET } = await import('@/app/api/v1/projects/[projectId]/cash-forecast/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/projects/p1/cash-forecast',
      method: 'GET',
    })
    const response = await GET(request as any, {
      params: Promise.resolve({ projectId: 'p1' }),
    })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    const arr = data as Array<Record<string, unknown>>
    expect(arr.length).toBeGreaterThan(0)
    expect(arr[0]).toHaveProperty('period')
    expect(arr[0]).toHaveProperty('planned')
    expect(arr[0]).toHaveProperty('actual')
    expect(arr[0]).toHaveProperty('forecast')
  })
})
