/**
 * API Route Tests: Help Chat Tips
 * GET/POST /api/help-chat/tips
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/help-chat/tips', () => {
  it('returns 200 and tips for default context', async () => {
    const { GET } = await import('@/app/api/help-chat/tips/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/tips',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toBeDefined()
    const obj = data as Record<string, unknown>
    expect(Array.isArray(obj.tips)).toBe(true)
    expect(obj.context).toBe('/dashboards')
    expect(obj.timestamp).toBeDefined()
  })

  it('returns 200 and filtered tips for context query', async () => {
    const { GET } = await import('@/app/api/help-chat/tips/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/tips?context=/dashboards',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(obj.context).toBe('/dashboards')
    expect((obj.tips as unknown[]).length).toBeGreaterThanOrEqual(0)
  })
})

describe('POST /api/help-chat/tips', () => {
  it('returns 200 and contextual tips', async () => {
    const { POST } = await import('@/app/api/help-chat/tips/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/tips',
      method: 'POST',
      body: { context: '/dashboards' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(Array.isArray(obj.tips)).toBe(true)
    expect((obj.tips as unknown[]).length).toBeLessThanOrEqual(3)
    expect(obj.context).toBe('/dashboards')
    expect(obj.timestamp).toBeDefined()
  })

  it('returns 500 when body is invalid JSON', async () => {
    const { POST } = await import('@/app/api/help-chat/tips/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/tips',
      method: 'POST',
      body: 'not json',
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to fetch proactive tips')
  })
})
