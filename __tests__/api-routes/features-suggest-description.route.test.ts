/**
 * API Route Tests: Features Suggest Description
 * POST /api/features/suggest-description - 400 when name missing, 200 with fallback or AI description
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/features/suggest-description', () => {
  const origEnv = process.env
  const originalFetch = global.fetch

  afterEach(() => {
    process.env.OPENAI_API_KEY = origEnv.OPENAI_API_KEY
    global.fetch = originalFetch
  })

  it('returns 400 when name is missing', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/suggest-description',
      method: 'POST',
      body: {},
    })

    const { POST } = await import('@/app/api/features/suggest-description/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('name required')
  })

  it('returns 200 with fallback description when OPENAI_API_KEY is not set', async () => {
    const prev = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/suggest-description',
      method: 'POST',
      body: { name: 'My Feature' },
    })

    const { POST } = await import('@/app/api/features/suggest-description/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).description).toContain('My Feature')
    expect((data as Record<string, unknown>).description).toContain('PPM feature')

    process.env.OPENAI_API_KEY = prev
  })

  it('returns 200 with AI description when OPENAI_API_KEY is set and fetch succeeds', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '  A short PPM feature description.  ' } }],
      }),
    }) as typeof fetch

    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/suggest-description',
      method: 'POST',
      body: { name: 'Reports' },
    })

    const { POST } = await import('@/app/api/features/suggest-description/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).description).toBe('A short PPM feature description.')
  })
})
