/**
 * API Route Tests: Audit Detect Anomalies
 * POST /api/audit/detect-anomalies - auth required, returns mock anomalies
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest, parseJsonResponse } from './helpers'

describe('POST /api/audit/detect-anomalies', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/audit/detect-anomalies',
      method: 'POST',
      body: {},
    })

    const { POST } = await import('@/app/api/audit/detect-anomalies/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Authorization header missing')
  })

  it('returns 200 and anomalies array when auth is present', async () => {
    const request = createAuthenticatedRequest('http://localhost:3000/api/audit/detect-anomalies', 'token', {
      method: 'POST',
      body: {},
    })

    const { POST } = await import('@/app/api/audit/detect-anomalies/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const anomalies = (data as Record<string, unknown>).anomalies as unknown[]
    expect(Array.isArray(anomalies)).toBe(true)
    expect((data as Record<string, unknown>).total_anomalies).toBeDefined()
    if (anomalies.length > 0) {
      expect(anomalies[0]).toHaveProperty('id')
      expect(anomalies[0]).toHaveProperty('anomaly_type')
    }
  })
})
