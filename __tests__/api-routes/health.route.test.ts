/**
 * API Route Tests: Health
 * GET /api/health - success and response schema
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

jest.mock('@/lib/ai-performance-utils', () => ({
  aiPerformanceMonitor: {
    getPerformanceStats: () => ({
      helpChat: { requestCount: 0, averageResponseTime: 0, errorRate: 0, successRate: 100 },
      proactiveTips: { requestCount: 0, averageResponseTime: 0, errorRate: 0, successRate: 100 },
      riskAnalysis: { requestCount: 0, averageResponseTime: 0, errorRate: 0, successRate: 100 },
      monteCarloSimulation: { requestCount: 0, averageResponseTime: 0, errorRate: 0, successRate: 100 },
    }),
  },
}))

describe('GET /api/health', () => {
  it('returns 200 and health schema with status and timestamp', async () => {
    const { GET } = await import('@/app/api/health/route')
    const request = createMockNextRequest({ url: 'http://localhost:3000/api/health', method: 'GET' })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toBeDefined()
    expect(typeof data).toBe('object')
    const obj = data as Record<string, unknown>
    expect(obj.status).toBe('healthy')
    expect(typeof obj.timestamp).toBe('string')
    expect(obj.version).toBeDefined()
    expect(obj.environment).toBeDefined()
    expect(obj.database).toBeDefined()
    expect((obj.database as Record<string, unknown>).status).toBe('connected')
    expect(obj.services).toBeDefined()
  })

  it('response includes ai performance stats', async () => {
    const { GET } = await import('@/app/api/health/route')
    const request = createMockNextRequest({ url: 'http://localhost:3000/api/health', method: 'GET' })
    const response = await GET(request as any)
    const data = (await parseJsonResponse(response)) as Record<string, unknown>

    expect(data.ai).toBeDefined()
    expect((data.ai as Record<string, unknown>).status).toBe('operational')
    expect((data.ai as Record<string, unknown>).performance).toBeDefined()
  })
})
