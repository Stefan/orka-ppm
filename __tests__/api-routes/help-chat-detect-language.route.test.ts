/**
 * API Route Tests: Help Chat Detect Language
 * POST /api/help-chat/detect-language
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/help-chat/detect-language', () => {
  it('returns 200 and detected language for English', async () => {
    const { POST } = await import('@/app/api/help-chat/detect-language/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/detect-language',
      method: 'POST',
      body: { content: 'Hello, please help me with the dashboard and the project.' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(obj.language).toBeDefined()
    expect(typeof obj.confidence).toBe('number')
    expect(Array.isArray(obj.supportedLanguages)).toBe(true)
  })

  it('returns 200 for German content', async () => {
    const { POST } = await import('@/app/api/help-chat/detect-language/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/detect-language',
      method: 'POST',
      body: { content: 'Hallo, bitte hilf mir mit dem Dashboard und dem Projekt.' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(['en', 'de', 'es', 'fr', 'it']).toContain(obj.language)
  })

  it('returns 400 when content missing', async () => {
    const { POST } = await import('@/app/api/help-chat/detect-language/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/detect-language',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('Missing required field')
  })

  it('returns 500 on invalid body', async () => {
    const { POST } = await import('@/app/api/help-chat/detect-language/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/detect-language',
      method: 'POST',
      body: 'not json',
    })
    const response = await POST(request as any)

    expect(response.status).toBe(500)
  })
})
