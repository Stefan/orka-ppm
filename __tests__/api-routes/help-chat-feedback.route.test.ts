/**
 * API Route Tests: Help Chat Feedback
 * POST /api/help-chat/feedback
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/help-chat/feedback', () => {
  it('returns 200 and success with feedbackId', async () => {
    const { POST } = await import('@/app/api/help-chat/feedback/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/feedback',
      method: 'POST',
      body: { responseId: 'r1', rating: 5, feedback: 'Great!', sessionId: 's1' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    expect(obj.success).toBe(true)
    expect(obj.feedbackId).toMatch(/^feedback-\d+$/)
    expect(obj.message).toBeDefined()
    expect(obj.timestamp).toBeDefined()
  })

  it('returns 500 on invalid body (non-JSON)', async () => {
    const { POST } = await import('@/app/api/help-chat/feedback/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/help-chat/feedback',
      method: 'POST',
      body: 'not json {',
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    const obj = data as Record<string, unknown>
    expect(obj.error).toBe('Failed to submit feedback')
  })
})
