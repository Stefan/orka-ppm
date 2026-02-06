/**
 * API Route Tests: Features Update (webhook)
 * POST /api/features/update - requires FEATURES_WEBHOOK_SECRET, returns ok
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/features/update', () => {
  const origEnv = process.env

  afterEach(() => {
    process.env.FEATURES_WEBHOOK_SECRET = origEnv.FEATURES_WEBHOOK_SECRET
  })

  it('returns 401 when FEATURES_WEBHOOK_SECRET is set and auth header is missing', async () => {
    process.env.FEATURES_WEBHOOK_SECRET = 'secret123'

    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/update',
      method: 'POST',
      body: {},
    })

    const { POST } = await import('@/app/api/features/update/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Unauthorized')
  })

  it('returns 200 when x-webhook-secret matches', async () => {
    process.env.FEATURES_WEBHOOK_SECRET = 'secret123'

    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/update',
      method: 'POST',
      body: { ref: 'refs/heads/main', repository: { full_name: 'org/repo' } },
      headers: { 'x-webhook-secret': 'secret123' },
    })

    const { POST } = await import('@/app/api/features/update/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).ok).toBe(true)
    expect((data as Record<string, unknown>).message).toBe('Webhook received')
  })

  it('returns 200 when Authorization Bearer matches FEATURES_WEBHOOK_SECRET', async () => {
    process.env.FEATURES_WEBHOOK_SECRET = 'bearer-secret'
    jest.resetModules()

    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/update',
      method: 'POST',
      body: {},
      headers: { Authorization: 'Bearer bearer-secret' },
    })

    const { POST } = await import('@/app/api/features/update/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).ok).toBe(true)
  })
})
