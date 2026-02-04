/**
 * API Route Tests: Help Chat Preferences
 * GET/PUT /api/help-chat/preferences
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/help-chat/preferences', () => {
  it('returns 200 and default preferences for anonymous', async () => {
    const { GET } = await import('@/app/api/help-chat/preferences/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/preferences',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const prefs = data as Record<string, unknown>
    expect(prefs.language).toBe('en')
    expect(prefs.proactiveTipsEnabled).toBe(true)
    expect(prefs.contextualHelpEnabled).toBe(true)
    expect(prefs.lastUpdated).toBeDefined()
  })

  it('returns 200 and preferences for userId from query', async () => {
    const { GET } = await import('@/app/api/help-chat/preferences/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/preferences?userId=user-1',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const prefs = data as Record<string, unknown>
    expect(prefs.language).toBeDefined()
  })
})

describe('PUT /api/help-chat/preferences', () => {
  it('returns 200 and updated preferences', async () => {
    const { PUT } = await import('@/app/api/help-chat/preferences/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/preferences',
      method: 'PUT',
      body: { language: 'de', proactiveTipsEnabled: false },
    })
    const response = await PUT(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(obj.success).toBe(true)
    const prefs = (obj.preferences as Record<string, unknown>)
    expect(prefs.language).toBe('de')
    expect(prefs.proactiveTipsEnabled).toBe(false)
    expect(prefs.lastUpdated).toBeDefined()
  })

  it('returns 500 on invalid body', async () => {
    const { PUT } = await import('@/app/api/help-chat/preferences/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/preferences',
      method: 'PUT',
      body: 'not json',
    })
    const response = await PUT(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    const obj = data as Record<string, unknown>
    expect(obj.error).toBe('Failed to update preferences')
  })
})
