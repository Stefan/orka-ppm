/**
 * API Route Tests: V1 ERP Sync
 * POST /api/v1/erp/sync (enterpriseFetch to backend)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

const mockEnterpriseFetch = jest.fn()

jest.mock('@/lib/enterprise/api-client', () => ({
  enterpriseFetch: (...args: unknown[]) => mockEnterpriseFetch(...args),
}))

describe('POST /api/v1/erp/sync', () => {
  const origApiUrl = process.env.NEXT_PUBLIC_API_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = origApiUrl
    jest.resetModules()
    mockEnterpriseFetch.mockReset()
  })

  it('returns 503 when API_URL is not configured', async () => {
    process.env.NEXT_PUBLIC_API_URL = ''
    process.env.API_URL = ''

    const { POST } = await import('@/app/api/v1/erp/sync/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/erp/sync',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(503)
    expect((data as Record<string, unknown>).error).toBe('Backend not configured')
    expect(mockEnterpriseFetch).not.toHaveBeenCalled()
  })

  it('returns 200 and forwards backend response when sync succeeds', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
    mockEnterpriseFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ synced: true, records: 10 }),
    })

    const { POST } = await import('@/app/api/v1/erp/sync/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/erp/sync',
      method: 'POST',
      body: { adapter: 'csv', entity: 'commitments' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).synced).toBe(true)
    expect((data as Record<string, unknown>).records).toBe(10)
    expect(mockEnterpriseFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/erp/sync'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    )
  })

  it('forwards Authorization header', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
    mockEnterpriseFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    })

    const { POST } = await import('@/app/api/v1/erp/sync/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/erp/sync',
      method: 'POST',
      body: {},
      headers: { Authorization: 'Bearer token' },
    })
    await POST(request as any)

    expect(mockEnterpriseFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    )
  })

  it('uses default adapter and entity when body empty', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
    mockEnterpriseFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    })

    const { POST } = await import('@/app/api/v1/erp/sync/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/erp/sync',
      method: 'POST',
      body: {},
    })
    await POST(request as any)

    const callBody = JSON.parse(mockEnterpriseFetch.mock.calls[0][1].body)
    expect(callBody.adapter).toBe('csv')
    expect(callBody.entity).toBe('commitments')
  })

  it('returns backend status when backend returns error', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
    mockEnterpriseFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid entity' }),
    })

    const { POST } = await import('@/app/api/v1/erp/sync/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/erp/sync',
      method: 'POST',
      body: { entity: 'invalid' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('Invalid entity')
  })

  it('returns 500 when enterpriseFetch throws', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
    mockEnterpriseFetch.mockRejectedValueOnce(new Error('Network error'))

    const { POST } = await import('@/app/api/v1/erp/sync/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/erp/sync',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Network error')
  })
})
