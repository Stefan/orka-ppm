/**
 * API Route Tests: Tips
 * GET /api/tips, POST /api/tips (proactive tips with optional context)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/tips', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })
  afterEach(() => {
    console.error = originalConsoleError
  })

  it('returns 200 with tips array and timestamp', async () => {
    const { GET } = await import('@/app/api/tips/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/tips',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).tips).toBeDefined()
    expect(Array.isArray((data as Record<string, unknown>).tips)).toBe(true)
    expect((data as Record<string, unknown>).timestamp).toBeDefined()
    expect((data as Record<string, unknown>).context).toBeNull()
  })

  it('filters by context when context query param provided', async () => {
    const { GET } = await import('@/app/api/tips/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/tips?context=/dashboard',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).context).toBe('/dashboard')
    const tips = (data as Record<string, unknown>).tips as Array<Record<string, unknown>>
    tips.forEach((tip) => {
      expect(tip.context === '/dashboard' || tip.context === 'global').toBe(true)
    })
  })

  it('returns Cache-Control header', async () => {
    const { GET } = await import('@/app/api/tips/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/tips',
      method: 'GET',
    })
    const response = await GET(request as any)

    expect(response.headers.get('Cache-Control')).toContain('max-age=300')
  })
})

describe('POST /api/tips', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })
  afterEach(() => {
    console.error = originalConsoleError
  })

  it('returns 200 with max 3 tips sorted by priority', async () => {
    const { POST } = await import('@/app/api/tips/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/tips',
      method: 'POST',
      body: { context: '/dashboard' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).tips).toBeDefined()
    const tips = (data as Record<string, unknown>).tips as unknown[]
    expect(tips.length).toBeLessThanOrEqual(3)
    expect((data as Record<string, unknown>).context).toBe('/dashboard')
    expect((data as Record<string, unknown>).timestamp).toBeDefined()
  })

  it('returns 200 with tips when body has no context', async () => {
    const { POST } = await import('@/app/api/tips/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/tips',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray((data as Record<string, unknown>).tips)).toBe(true)
  })

  it('returns 500 when body is invalid JSON', async () => {
    const { POST } = await import('@/app/api/tips/route')
    const request = new Request('http://localhost:3000/api/tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json {',
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to fetch proactive tips')
    expect((data as Record<string, unknown>).tips).toEqual([])
  })
})
