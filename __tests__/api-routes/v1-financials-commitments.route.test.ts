/**
 * API Route Tests: V1 Financials Commitments
 * GET /api/v1/financials/commitments (paginated list, Supabase)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

function createSupabaseMock(result: { data: unknown[] | null; error: { message: string } | null }) {
  const chainable = {
    select: () => chainable,
    order: () => chainable,
    limit: () => chainable,
    eq: () => chainable,
    gt: () => chainable,
    then: (resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => void) =>
      resolve(result),
  }
  return {
    from: () => chainable,
  }
}

const createClientMock = jest.fn(() => createSupabaseMock({ data: [], error: null }))
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))

describe('GET /api/v1/financials/commitments', () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey
    jest.resetModules()
    createClientMock.mockImplementation(() => createSupabaseMock({ data: [], error: null }))
  })

  it('returns 503 when Supabase is not configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''

    const { GET } = await import('@/app/api/v1/financials/commitments/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/financials/commitments',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(503)
    expect((data as Record<string, unknown>).error).toContain('Server configuration')
    expect((data as Record<string, unknown>).data).toEqual([])
    expect((data as Record<string, unknown>).next_cursor).toBeNull()
    expect((data as Record<string, unknown>).has_more).toBe(false)
  })

  it('returns 200 with data when Supabase returns rows', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
    const rows = [
      { id: 'c1', project_id: 'p1', total_amount: 1000 },
      { id: 'c2', project_id: 'p1', total_amount: 2000 },
    ]
    createClientMock.mockReturnValueOnce(createSupabaseMock({ data: rows, error: null }))

    const { GET } = await import('@/app/api/v1/financials/commitments/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/financials/commitments',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).data).toEqual(rows)
    expect((data as Record<string, unknown>).has_more).toBe(false)
  })

  it('returns 400 when Supabase query errors', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
    createClientMock.mockReturnValueOnce(
      createSupabaseMock({ data: null, error: { message: 'DB error' } })
    )

    const { GET } = await import('@/app/api/v1/financials/commitments/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/financials/commitments',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('DB error')
    expect((data as Record<string, unknown>).data).toEqual([])
  })
})
