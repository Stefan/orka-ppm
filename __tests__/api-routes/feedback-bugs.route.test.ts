/**
 * API Route Tests: Feedback Bugs
 * GET/POST /api/feedback/bugs (proxies to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/feedback/bugs', () => {
  it('returns 200 and data when backend succeeds', async () => {
    const mockData = [{ id: '1', title: 'Bug 1', status: 'open' }]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { GET } = await import('@/app/api/feedback/bugs/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/feedback/bugs',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toEqual(mockData)
  })

  it('forwards auth header to backend', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })

    const { GET } = await import('@/app/api/feedback/bugs/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/feedback/bugs')
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('returns backend status when backend fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve('Forbidden'),
    })

    const { GET } = await import('@/app/api/feedback/bugs/route')
    const request = createMockNextRequest({ url: 'http://localhost:3000/api/feedback/bugs', method: 'GET' })
    const response = await GET(request as any)

    expect(response.status).toBe(403)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { GET } = await import('@/app/api/feedback/bugs/route')
    const request = createMockNextRequest({ url: 'http://localhost:3000/api/feedback/bugs', method: 'GET' })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to get bugs')
  })
})

describe('POST /api/feedback/bugs', () => {
  it('returns 401 when no auth', async () => {
    const { POST } = await import('@/app/api/feedback/bugs/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/feedback/bugs',
      method: 'POST',
      body: { title: 'Bug', description: 'Desc' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization required')
  })

  it('returns 201 and data when backend succeeds', async () => {
    const mockCreated = { id: 'new-1', title: 'New Bug', status: 'open' }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCreated),
    })

    const { POST } = await import('@/app/api/feedback/bugs/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/feedback/bugs', 'token', {
      method: 'POST',
      body: { title: 'New Bug', description: 'Description' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(201)
    expect(data).toEqual(mockCreated)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { POST } = await import('@/app/api/feedback/bugs/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/feedback/bugs', 't', {
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    expect(response.status).toBe(500)
  })
})
