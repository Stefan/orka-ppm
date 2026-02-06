/**
 * API Route Tests: Costbook Optimize
 * POST /api/costbook/optimize - returns optimization suggestions
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/costbook/optimize', () => {
  it('returns 200 and suggestions array', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/costbook/optimize',
      method: 'POST',
      body: {},
    })

    const { POST } = await import('@/app/api/costbook/optimize/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    const suggestions = obj.suggestions as Array<Record<string, unknown>>
    expect(Array.isArray(suggestions)).toBe(true)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0]).toHaveProperty('id')
    expect(suggestions[0]).toHaveProperty('description')
    expect(suggestions[0]).toHaveProperty('metric')
  })

  it('accepts body with projectIds and returns suggestions', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/costbook/optimize',
      method: 'POST',
      body: { projectIds: ['p1', 'p2'] },
    })

    const { POST } = await import('@/app/api/costbook/optimize/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).suggestions).toBeDefined()
  })

  it('returns 200 with suggestions when request.json fails (route uses .catch)', async () => {
    const baseRequest = createMockNextRequest({
      url: 'http://localhost:3000/api/costbook/optimize',
      method: 'POST',
      body: {},
    })
    const request = Object.create(baseRequest) as Request
    Object.defineProperty(request, 'json', {
      value: jest.fn().mockRejectedValueOnce(new Error('Parse error')),
      configurable: true,
    })

    const { POST } = await import('@/app/api/costbook/optimize/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).suggestions).toBeDefined()
    expect(Array.isArray((data as Record<string, unknown>).suggestions)).toBe(true)
  })
})
