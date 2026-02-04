/**
 * API Route Tests: AI Help Language Preference
 * GET/POST /api/ai/help/language/preference (proxy to backend)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('GET /api/ai/help/language/preference', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })
  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 200 and forwards backend response', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ language: 'de', locale: 'de-DE' }),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/ai/help/language/preference/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/language/preference',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).language).toBe('de')
    expect((data as Record<string, unknown>).locale).toBe('de-DE')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/ai\/help\/language\/preference$/),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('forwards Authorization when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const { GET } = await import('@/app/api/ai/help/language/preference/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/ai/help/language/preference')
    await GET(request as any)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    const { GET } = await import('@/app/api/ai/help/language/preference/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/language/preference',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to get language preference')
  })
})

describe('POST /api/ai/help/language/preference', () => {
  const originalFetch = global.fetch
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })
  afterEach(() => {
    global.fetch = originalFetch
    console.error = originalConsoleError
  })

  it('returns 200 and forwards backend response', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
      text: async () => '{}',
    })

    const { POST } = await import('@/app/api/ai/help/language/preference/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/language/preference',
      method: 'POST',
      body: { language: 'de' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/ai\/help\/language\/preference$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ language: 'de' }),
      })
    )
  })

  it('returns backend status when backend returns error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Invalid language',
    })

    const { POST } = await import('@/app/api/ai/help/language/preference/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/ai/help/language/preference',
      method: 'POST',
      body: { language: 'xx' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBeDefined()
    expect((data as Record<string, unknown>).details).toBe('Invalid language')
  })

  it('returns 500 when body is invalid JSON', async () => {
    const { POST } = await import('@/app/api/ai/help/language/preference/route')
    const request = new Request('http://localhost:3000/api/ai/help/language/preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid',
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toContain('Failed to update language preference')
  })
})
