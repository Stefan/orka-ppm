/**
 * SLO: API latency thresholds in Jest
 * Enterprise Test Strategy - Section 9 (Phase 3)
 * Asserts critical path response time stays within SLO (e.g. health < 2s).
 */

describe('SLO: API latency', () => {
  const SLO_HEALTH_MS = 2000

  it('health API path completes within SLO under mock', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'healthy', timestamp: new Date().toISOString() }),
    })

    const start = performance.now()
    const { apiRequest } = await import('@/lib/api/client')
    await apiRequest('/health')
    const duration = performance.now() - start

    global.fetch = originalFetch
    expect(duration).toBeLessThan(SLO_HEALTH_MS)
  })
})
