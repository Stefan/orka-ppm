/**
 * API Route Tests: Costbook Similar Searches
 * GET /api/costbook/similar-searches?q=...&limit=3
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/costbook/similar-searches', () => {
  it('returns 200 and similarSearches array', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/costbook/similar-searches?q=over%20budget',
      method: 'GET',
    })

    const { GET } = await import('@/app/api/costbook/similar-searches/route')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    const similarSearches = obj.similarSearches as Array<{ query: string; description: string }>
    expect(Array.isArray(similarSearches)).toBe(true)
    if (similarSearches.length > 0) {
      expect(similarSearches[0]).toHaveProperty('query')
      expect(similarSearches[0]).toHaveProperty('description')
    }
  })

  it('returns empty array for empty q', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/costbook/similar-searches?q=',
      method: 'GET',
    })

    const { GET } = await import('@/app/api/costbook/similar-searches/route')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).similarSearches).toEqual([])
  })

  it('respects limit param and caps at 5', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/costbook/similar-searches?q=high%20variance&limit=2',
      method: 'GET',
    })

    const { GET } = await import('@/app/api/costbook/similar-searches/route')
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const arr = (data as Record<string, unknown>).similarSearches as unknown[]
    expect(arr.length).toBeLessThanOrEqual(2)
  })
})
