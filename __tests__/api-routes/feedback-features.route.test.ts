/**
 * API Route Tests: Feedback Features
 * GET/POST /api/feedback/features (proxies to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/feedback/features', () => {
  it('returns 200 and data when backend succeeds', async () => {
    const mockData = [{ id: '1', title: 'Feature 1', votes: 5 }]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { GET } = await import('@/app/api/feedback/features/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/feedback/features',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toEqual(mockData)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { GET } = await import('@/app/api/feedback/features/route')
    const request = createMockNextRequest({ url: 'http://localhost:3000/api/feedback/features', method: 'GET' })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to get features')
  })
})

describe('POST /api/feedback/features', () => {
  it('returns 201 and data when backend succeeds', async () => {
    const mockCreated = { id: 'new-1', title: 'New Feature', votes: 0 }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCreated),
    })

    const { POST } = await import('@/app/api/feedback/features/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/feedback/features',
      method: 'POST',
      body: { title: 'New Feature', description: 'Description' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(201)
    expect(data).toEqual(mockCreated)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { POST } = await import('@/app/api/feedback/features/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/feedback/features',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    expect(response.status).toBe(500)
  })
})
