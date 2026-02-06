/**
 * API Route Tests: AI Resource Optimizer Apply
 * POST /api/ai/resource-optimizer/apply/[suggestionId] - proxy to backend
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('POST /api/ai/resource-optimizer/apply/[suggestionId]', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 200 and forwards backend response', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ applied: true, suggestion_id: 's1' }),
    }) as typeof fetch

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/ai/resource-optimizer/apply/s1',
      'token',
      { method: 'POST', body: {} }
    )

    const { POST } = await import('@/app/api/ai/resource-optimizer/apply/[suggestionId]/route')
    const response = await POST(request as any, { params: Promise.resolve({ suggestionId: 's1' }) })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).applied).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai/resource-optimizer/apply/s1'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns backend status when backend returns 400', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Invalid suggestion' }),
    }) as typeof fetch

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/ai/resource-optimizer/apply/s1',
      'token',
      { method: 'POST', body: {} }
    )

    const { POST } = await import('@/app/api/ai/resource-optimizer/apply/[suggestionId]/route')
    const response = await POST(request as any, { params: Promise.resolve({ suggestionId: 's1' }) })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('Invalid suggestion')
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error')) as typeof fetch

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/ai/resource-optimizer/apply/s1',
      'token',
      { method: 'POST', body: {} }
    )

    const { POST } = await import('@/app/api/ai/resource-optimizer/apply/[suggestionId]/route')
    const response = await POST(request as any, { params: Promise.resolve({ suggestionId: 's1' }) })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Internal server error')
  })
})
