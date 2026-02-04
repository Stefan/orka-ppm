/**
 * API Route Tests: Project Budget Variance
 * GET /api/projects/[projectId]/budget-variance
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

const mockParams = (projectId: string) => Promise.resolve({ projectId })

describe('GET /api/projects/[projectId]/budget-variance', () => {
  it('returns 401 when no auth', async () => {
    const { GET } = await import('@/app/api/projects/[projectId]/budget-variance/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/projects/p1/budget-variance',
      method: 'GET',
    })
    const response = await GET(request as any, { params: mockParams('p1') })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toContain('Authorization')
  })

  it('returns 200 and variance when backend returns project', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          name: 'Project A',
          budget: 10000,
          actual_cost: 9500,
          updated_at: '2024-01-01T00:00:00Z',
        }),
    })

    const { GET } = await import('@/app/api/projects/[projectId]/budget-variance/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/p1/budget-variance')
    const response = await GET(request as any, { params: mockParams('p1') })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(obj.project_id).toBe('p1')
    expect(obj.project_name).toBe('Project A')
    expect(obj.budget).toBe(10000)
    expect(obj.actual_cost).toBe(9500)
    expect(obj.variance).toBe(-500)
    expect(obj.currency).toBe('USD')
  })

  it('uses currency query param', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          name: 'P',
          budget: 1000,
          actual_cost: 1000,
          updated_at: null,
        }),
    })

    const { GET } = await import('@/app/api/projects/[projectId]/budget-variance/route')
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/projects/p2/budget-variance?currency=EUR'
    )
    const response = await GET(request as any, { params: mockParams('p2') })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).currency).toBe('EUR')
  })

  it('returns fallback when backend returns non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false })

    const { GET } = await import('@/app/api/projects/[projectId]/budget-variance/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/p3/budget-variance')
    const response = await GET(request as any, { params: mockParams('p3') })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(obj.project_id).toBe('p3')
    expect(obj.project_name).toBe('Unknown Project')
    expect(obj.budget).toBe(0)
  })
})
