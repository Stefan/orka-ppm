/**
 * API Route Tests: Features (Feature Flags)
 * GET /api/features
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

const origEnv = process.env

describe('GET /api/features', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = origEnv.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_URL = origEnv.SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    process.env.SUPABASE_ANON_KEY = origEnv.SUPABASE_ANON_KEY
  })

  it('returns 200 and default flags when Supabase env is missing', async () => {
    jest.resetModules()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_ANON_KEY

    const { GET } = await import('@/app/api/features/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const obj = data as Record<string, unknown>
    const flags = obj.flags as Array<{ name: string; enabled: boolean }>
    expect(Array.isArray(flags)).toBe(true)
    expect(flags.length).toBeGreaterThan(0)
    expect(flags.some(f => f.name === 'costbook_phase1')).toBe(true)
    expect(flags.some(f => f.name === 'enhanced_pmr')).toBe(true)
  })
})
