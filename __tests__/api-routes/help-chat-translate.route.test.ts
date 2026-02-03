/**
 * API Route Tests: Help Chat Translate
 * POST /api/help-chat/translate
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/help-chat/translate', () => {
  it('returns 400 when content is missing', async () => {
    const { POST } = await import('@/app/api/help-chat/translate/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/translate',
      method: 'POST',
      body: { targetLanguage: 'es' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toMatch(/content and targetLanguage/)
  })

  it('returns 400 when targetLanguage is missing', async () => {
    const { POST } = await import('@/app/api/help-chat/translate/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/translate',
      method: 'POST',
      body: { content: 'Hello' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toMatch(/content and targetLanguage/)
  })

  it('returns 200 and translated text for known phrase in es', async () => {
    const { POST } = await import('@/app/api/help-chat/translate/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/translate',
      method: 'POST',
      body: { content: 'Dashboard Optimization', targetLanguage: 'es' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(obj.translatedText).toBe('Optimización del Panel')
    expect(obj.sourceLanguage).toBe('en')
    expect(obj.targetLanguage).toBe('es')
    expect(obj.confidence).toBe(0.95)
    expect(obj.timestamp).toBeDefined()
  })

  it('returns 200 and original content when no translation exists', async () => {
    const { POST } = await import('@/app/api/help-chat/translate/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/translate',
      method: 'POST',
      body: { content: 'Unknown phrase', targetLanguage: 'es' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(obj.translatedText).toBe('Unknown phrase')
    expect(obj.confidence).toBe(0.1)
  })

  it('returns 500 when body is invalid JSON', async () => {
    const { POST } = await import('@/app/api/help-chat/translate/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/translate',
      method: 'POST',
      body: 'not json',
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to translate content')
  })
})
