/**
 * API Route Tests: V1 Projects Simulations AI Suggestions
 * GET /api/v1/projects/[projectId]/simulations/ai-suggestions
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/v1/projects/[projectId]/simulations/ai-suggestions', () => {
  it('returns 400 when projectId is missing', async () => {
    const { GET } = await import('@/app/api/v1/projects/[projectId]/simulations/ai-suggestions/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/projects/simulations/ai-suggestions',
      method: 'GET',
    })
    const response = await GET(request as any, {
      params: Promise.resolve({ projectId: '' }),
    })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('projectId required')
  })

  it('returns 200 with suggestions array (3-5 presets)', async () => {
    const { GET } = await import('@/app/api/v1/projects/[projectId]/simulations/ai-suggestions/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/projects/p1/simulations/ai-suggestions',
      method: 'GET',
    })
    const response = await GET(request as any, {
      params: Promise.resolve({ projectId: 'p1' }),
    })
    const data = (await parseJsonResponse(response)) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(Array.isArray(data.suggestions)).toBe(true)
    const suggestions = data.suggestions as Array<Record<string, unknown>>
    expect(suggestions.length).toBeGreaterThanOrEqual(3)
    expect(suggestions.length).toBeLessThanOrEqual(5)
    for (const s of suggestions) {
      expect(s).toHaveProperty('id')
      expect(s).toHaveProperty('name')
      expect(s).toHaveProperty('description')
      expect(s).toHaveProperty('params')
      expect(typeof (s.params as Record<string, unknown>).budget_uncertainty).toBe('number')
    }
  })
})
