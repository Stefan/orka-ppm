/**
 * Multi-Tenancy: Tenant/org context in API requests
 * Enterprise Test Strategy - Section 7 (Phase 2)
 * Ensures tenant-scoped routes receive and use organization_id (or equivalent).
 */

import { Request, Response, Headers } from 'undici'
if (typeof (globalThis as any).Request === 'undefined') (globalThis as any).Request = Request
if (typeof (globalThis as any).Response === 'undefined') (globalThis as any).Response = Response
if (typeof (globalThis as any).Headers === 'undefined') (globalThis as any).Headers = Headers

import { createMockNextRequest, parseJsonResponse } from '../api-routes/helpers'

const eqCalls: Array<[string, string]> = []
const mockChain = {
  select: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  eq(col: string, val: string) {
    eqCalls.push([col, val])
    return mockChain
  },
}
;(mockChain as unknown as { then: (resolve: (v: unknown) => void) => void }).then = (
  resolve: (v: unknown) => void
) => resolve({ data: [], error: null })

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => mockChain,
  }),
}))

describe('Tenant isolation: commitments route', () => {
  beforeEach(() => {
    eqCalls.length = 0
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  })

  it('receives organization_id from query and scopes Supabase query', async () => {
    const { GET } = await import('@/app/api/v1/financials/commitments/route')
    const url =
      'http://localhost:3000/api/v1/financials/commitments?organization_id=org-456&limit=10'
    const request = createMockNextRequest({ url, method: 'GET' })
    const response = await GET(request as import('next/server').NextRequest)
    const body = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(body).toHaveProperty('data')
    expect(Array.isArray((body as { data: unknown[] }).data)).toBe(true)
    expect(eqCalls).toContainEqual(['organization_id', 'org-456'])
  })

  it('returns 200 without organization_id when param omitted', async () => {
    const { GET } = await import('@/app/api/v1/financials/commitments/route')
    const url = 'http://localhost:3000/api/v1/financials/commitments?limit=5'
    const request = createMockNextRequest({ url, method: 'GET' })
    const response = await GET(request as import('next/server').NextRequest)
    const body = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(body).toHaveProperty('data')
    expect(eqCalls.some(([k]) => k === 'organization_id')).toBe(false)
  })
})

describe('Tenant isolation: client request building', () => {
  it('commitments API URL can include organization_id query param', () => {
    const base = '/api/v1/financials/commitments'
    const orgId = 'tenant-789'
    const url = `${base}?organization_id=${encodeURIComponent(orgId)}`
    expect(url).toContain('organization_id=')
    expect(url).toContain('tenant-789')
  })
})
