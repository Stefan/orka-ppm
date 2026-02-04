/**
 * API Route Tests: Project Scenarios
 * GET/POST /api/projects/[projectId]/scenarios
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

const mockParams = (projectId: string) => Promise.resolve({ projectId })

describe('GET /api/projects/[projectId]/scenarios', () => {
  it('returns 200 and data when backend succeeds', async () => {
    const mockData = [{ id: 's1', name: 'Scenario 1' }]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { GET } = await import('@/app/api/projects/[projectId]/scenarios/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/p1/scenarios')
    const response = await GET(request as any, { params: mockParams('p1') })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toEqual(mockData)
  })

  it('returns backend status when backend fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Unauthorized'),
    })

    const { GET } = await import('@/app/api/projects/[projectId]/scenarios/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/p1/scenarios')
    const response = await GET(request as any, { params: mockParams('p1') })

    expect(response.status).toBe(401)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { GET } = await import('@/app/api/projects/[projectId]/scenarios/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/p1/scenarios')
    const response = await GET(request as any, { params: mockParams('p1') })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to get scenarios')
  })
})

describe('POST /api/projects/[projectId]/scenarios', () => {
  it('returns 201 and data when backend succeeds', async () => {
    const mockCreated = { id: 's2', name: 'New Scenario' }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCreated),
    })

    const { POST } = await import('@/app/api/projects/[projectId]/scenarios/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/p1/scenarios', 'token', {
      method: 'POST',
      body: { name: 'New Scenario', description: 'Desc' },
    })
    const response = await POST(request as any, { params: mockParams('p1') })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(201)
    expect(data).toEqual(mockCreated)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { POST } = await import('@/app/api/projects/[projectId]/scenarios/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/p1/scenarios', 't', {
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any, { params: mockParams('p1') })
    expect(response.status).toBe(500)
  })
})
