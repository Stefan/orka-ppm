/**
 * API Route Tests: POST /api/projects/sync (proxy to backend)
 * Entity-hierarchy spec – target 80% coverage.
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('POST /api/projects/sync [@regression]', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 200 and forwards backend sync result when backend returns ok', async () => {
    const syncResult = { created: [{ id: 'id-1', name: 'P1' }], matched: [] }
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => syncResult,
      text: async () => JSON.stringify(syncResult),
    })

    const { POST } = await import('@/app/api/projects/sync/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/sync', 'test-token', {
      method: 'POST',
      body: { source: 'mock', portfolio_id: '11111111-1111-1111-1111-111111111111', dry_run: true },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as { created: unknown[] }).created).toEqual(syncResult.created)
    expect((data as { matched: unknown[] }).matched).toEqual(syncResult.matched)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects/sync'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
        body: expect.any(String),
      })
    )
  })

  it('forwards backend error status and detail when backend returns 4xx/5xx', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ detail: 'Database service unavailable' }),
    })

    const { POST } = await import('@/app/api/projects/sync/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/sync', 'test-token', {
      method: 'POST',
      body: { source: 'mock', portfolio_id: '11111111-1111-1111-1111-111111111111', dry_run: true },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(503)
    expect((data as { error?: string }).error).toBeDefined()
  })

  it('sends request without Authorization when no auth header', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ created: [], matched: [] }),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/projects/sync/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/projects/sync',
      method: 'POST',
      body: { source: 'mock', portfolio_id: '11111111-1111-1111-1111-111111111111', dry_run: true },
    })
    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      })
    )
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { POST } = await import('@/app/api/projects/sync/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/projects/sync',
      method: 'POST',
      body: { source: 'mock', portfolio_id: '11111111-1111-1111-1111-111111111111', dry_run: true },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as { error?: string }).error).toBeDefined()
  })

  it('parses non-JSON error body and returns detail', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Plain text error',
    })

    const { POST } = await import('@/app/api/projects/sync/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/projects/sync', 'test-token', {
      method: 'POST',
      body: { source: 'mock', portfolio_id: '11111111-1111-1111-1111-111111111111', dry_run: true },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as { error?: string }).error).toBeDefined()
  })
})
