/**
 * API Route Tests: Features (feature flags)
 * GET /api/features - returns default or Supabase-backed flags
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/features', () => {
  it('returns 200 and flags array', async () => {
    const { GET } = await import('@/app/api/features/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data).toBeDefined()
    const obj = data as Record<string, unknown>
    expect(Array.isArray(obj.flags)).toBe(true)
    const flags = obj.flags as Array<{ name: string; enabled: boolean }>
    expect(flags.length).toBeGreaterThan(0)
    expect(flags.every((f) => typeof f.name === 'string' && typeof f.enabled === 'boolean')).toBe(true)
  })

  it('returns default flags when Supabase not configured (or on error)', async () => {
    const { GET } = await import('@/app/api/features/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const flags = (data as Record<string, unknown>).flags as Array<{ name: string; enabled: boolean }>
    const names = flags.map((f) => f.name)
    expect(names).toContain('costbook_phase1')
    expect(names).toContain('enhanced_pmr')
    expect(names).toContain('csv_import')
  })
})
