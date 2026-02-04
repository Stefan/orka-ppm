/**
 * API Route Tests: Analytics Performance
 * POST /api/analytics/performance (receive metrics)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/analytics/performance', () => {
  const originalConsoleLog = console.log
  const originalConsoleError = console.error

  beforeEach(() => {
    console.log = jest.fn()
    console.error = jest.fn()
  })
  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  it('returns 200 with success when valid body', async () => {
    const { POST } = await import('@/app/api/analytics/performance/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/analytics/performance',
      method: 'POST',
      body: {
        url: '/dashboard',
        webVitals: { LCP: 1200, FID: 50, CLS: 0.1 },
        longTasks: [],
        timestamp: new Date().toISOString(),
      },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
    expect((data as Record<string, unknown>).message).toBe('Performance metrics received')
  })

  it('returns 200 with minimal body', async () => {
    const { POST } = await import('@/app/api/analytics/performance/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/analytics/performance',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
  })

  it('returns 500 when body is invalid JSON', async () => {
    const { POST } = await import('@/app/api/analytics/performance/route')
    const request = new Request('http://localhost:3000/api/analytics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to process metrics')
    expect((data as Record<string, unknown>).details).toBeDefined()
  })
})
