/**
 * API contract tests: Help-Chat query response
 * Enterprise Test Strategy - Section 3 (Phase 2)
 * Validates consumer expectations for Help-Chat API response shape.
 */

import { validateHelpQueryResponse } from './schemas'

const validHelpResponse = {
  response: 'You can create a project from the Projects page.',
  sessionId: 'session-abc',
  sources: [],
  confidence: 0.9,
  responseTimeMs: 150,
}

describe('Contract: Help-Chat Query API', () => {
  it('accepts valid help query response', () => {
    const res = validateHelpQueryResponse(validHelpResponse)
    expect(res.valid).toBe(true)
  })

  it('accepts response with optional fields', () => {
    const res = validateHelpQueryResponse({
      ...validHelpResponse,
      proactiveTips: [],
      suggestedActions: [],
      isCached: false,
    })
    expect(res.valid).toBe(true)
  })

  it('rejects non-object', () => {
    const res = validateHelpQueryResponse(null)
    expect(res.valid).toBe(false)
  })

  it('rejects missing response', () => {
    const res = validateHelpQueryResponse({
      sessionId: 's',
      sources: [],
      confidence: 0.8,
      responseTimeMs: 100,
    })
    expect(res.valid).toBe(false)
    if (!res.valid) expect(res.errors.some((e) => e.includes('response'))).toBe(true)
  })

  it('rejects wrong type for confidence', () => {
    const res = validateHelpQueryResponse({
      ...validHelpResponse,
      confidence: 'high',
    })
    expect(res.valid).toBe(false)
  })

  it('rejects wrong type for sources', () => {
    const res = validateHelpQueryResponse({
      ...validHelpResponse,
      sources: {},
    })
    expect(res.valid).toBe(false)
  })
})
