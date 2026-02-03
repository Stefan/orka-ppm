/**
 * API contract tests: Health endpoint
 * Enterprise Test Strategy - Section 3 (Phase 2)
 * Validates consumer expectations for Health API response shape.
 */

import { validateHealthResponse } from './schemas'

describe('Contract: Health API', () => {
  it('accepts valid health response with status and timestamp', () => {
    const res = validateHealthResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    })
    expect(res.valid).toBe(true)
  })

  it('accepts health response with extra fields', () => {
    const res = validateHealthResponse({
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00.000Z',
      version: '1.0.0',
      environment: 'test',
      uptime: 123,
    })
    expect(res.valid).toBe(true)
  })

  it('rejects non-object', () => {
    const res = validateHealthResponse(null)
    expect(res.valid).toBe(false)
    if (!res.valid) expect(res.errors).toContain('Health response must be an object')
  })

  it('rejects missing status', () => {
    const res = validateHealthResponse({ timestamp: '2024-01-01T00:00:00Z' })
    expect(res.valid).toBe(false)
    if (!res.valid) expect(res.errors.some((e) => e.includes('status'))).toBe(true)
  })

  it('rejects missing timestamp', () => {
    const res = validateHealthResponse({ status: 'healthy' })
    expect(res.valid).toBe(false)
    if (!res.valid) expect(res.errors.some((e) => e.includes('timestamp'))).toBe(true)
  })
})
