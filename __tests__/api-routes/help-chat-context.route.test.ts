/**
 * API Route Tests: Help Chat Context
 * POST /api/help-chat/context - contextual help by path
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/help-chat/context', () => {
  it('returns 200 and dashboard help when context is /dashboards', async () => {
    const { POST } = await import('@/app/api/help-chat/context/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/context',
      method: 'POST',
      body: { context: '/dashboards' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toBeDefined()
    const obj = data as Record<string, unknown>
    expect(obj.context).toBe('/dashboards')
    expect(obj.help).toBeDefined()
    const help = obj.help as Record<string, unknown>
    expect(help.title).toBe('Dashboard Help')
    expect(Array.isArray(help.quickActions)).toBe(true)
    expect(Array.isArray(help.tips)).toBe(true)
    expect(obj.timestamp).toBeDefined()
  })

  it('returns 200 and projects help when context is /projects', async () => {
    const { POST } = await import('@/app/api/help-chat/context/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/context',
      method: 'POST',
      body: { context: '/projects' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    const help = obj.help as Record<string, unknown>
    expect(help.title).toBe('Projects Help')
  })

  it('returns 200 and general help for unknown context', async () => {
    const { POST } = await import('@/app/api/help-chat/context/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/context',
      method: 'POST',
      body: { context: '/unknown' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    const help = obj.help as Record<string, unknown>
    expect(help.title).toBe('General Help')
  })

  it('returns 500 when body is invalid JSON', async () => {
    const { POST } = await import('@/app/api/help-chat/context/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/context',
      method: 'POST',
      body: 'not json',
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to get contextual help')
  })
})
