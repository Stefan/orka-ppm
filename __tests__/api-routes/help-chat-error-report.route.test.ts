/**
 * API Route Tests: Help Chat Error Report
 * POST /api/help-chat/error-report
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/help-chat/error-report', () => {
  it('returns 200 and reportId on success', async () => {
    const { POST } = await import('@/app/api/help-chat/error-report/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/error-report',
      method: 'POST',
      body: {
        error: { message: 'Test error', stack: 'at fn', code: 'ERR_TEST' },
        context: { page: '/help' },
        timestamp: new Date().toISOString(),
      },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(obj.success).toBe(true)
    expect((obj.reportId as string).startsWith('error-')).toBe(true)
    expect(obj.message).toBeDefined()
  })

  it('returns 200 with minimal body', async () => {
    const { POST } = await import('@/app/api/help-chat/error-report/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/error-report',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
  })

  it('returns 500 on invalid body', async () => {
    const { POST } = await import('@/app/api/help-chat/error-report/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/error-report',
      method: 'POST',
      body: 'not json',
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Failed to process error report')
  })
})
