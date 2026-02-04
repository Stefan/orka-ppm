/**
 * API Route Tests: Help Chat Translate
 * POST /api/help-chat/translate
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/help-chat/translate', () => {
  it('returns 200 and translated text for known content', async () => {
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
    expect(obj.targetLanguage).toBe('es')
    expect(obj.sourceLanguage).toBe('en')
    expect((obj.confidence as number) > 0.9).toBe(true)
  })

  it('returns 200 and original content when no translation', async () => {
    const { POST } = await import('@/app/api/help-chat/translate/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/translate',
      method: 'POST',
      body: { content: 'Unknown phrase', targetLanguage: 'es' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).translatedText).toBe('Unknown phrase')
  })

  it('returns 400 when content missing', async () => {
    const { POST } = await import('@/app/api/help-chat/translate/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/translate',
      method: 'POST',
      body: { targetLanguage: 'fr' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('Missing required fields')
  })

  it('returns 400 when targetLanguage missing', async () => {
    const { POST } = await import('@/app/api/help-chat/translate/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/translate',
      method: 'POST',
      body: { content: 'Hello' },
    })
    const response = await POST(request as any)

    expect(response.status).toBe(400)
  })

  it('returns 500 on invalid body', async () => {
    const { POST } = await import('@/app/api/help-chat/translate/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/translate',
      method: 'POST',
      body: 'not json',
    })
    const response = await POST(request as any)

    expect(response.status).toBe(500)
  })
})
