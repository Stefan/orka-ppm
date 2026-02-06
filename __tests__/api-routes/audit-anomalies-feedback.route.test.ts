/**
 * API Route Tests: Audit Anomaly Feedback
 * POST /api/audit/anomalies/[id]/feedback
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('POST /api/audit/anomalies/[id]/feedback', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/audit/anomalies/anom-1/feedback',
      method: 'POST',
      body: { is_false_positive: false },
    })

    const { POST } = await import('@/app/api/audit/anomalies/[id]/feedback/route')
    const response = await POST(request as any, { params: { id: 'anom-1' } })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization header missing')
  })

  it('returns 200 and success when auth and params are present', async () => {
    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/audit/anomalies/anom-1/feedback',
      'token',
      { method: 'POST', body: { is_false_positive: true } }
    )

    const { POST } = await import('@/app/api/audit/anomalies/[id]/feedback/route')
    const response = await POST(request as any, { params: { id: 'anom-1' } })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
    expect((data as Record<string, unknown>).anomaly_id).toBe('anom-1')
    expect((data as Record<string, unknown>).feedback_recorded).toBe(true)
  })
})
