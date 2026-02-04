/**
 * API Route Tests: V1 Costbook Rows
 * GET /api/v1/costbook/rows (Supabase: projects, commitments, actuals)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

function createSupabaseMock(projectsResult: { data: unknown[] | null; error: { message: string } | null }) {
  const chainWithThen = (result: { data: unknown[] | null; error: { message: string } | null }) => ({
    select: () => ({
      order: () => ({
        then: (resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => void) =>
          resolve(result),
      }),
      in: () => ({
        then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data: [] }),
      }),
    }),
  })
  return {
    from: (_table: string) => chainWithThen(projectsResult),
  }
}

const createClientMock = jest.fn(() =>
  createSupabaseMock({ data: [], error: null })
)

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))

describe('GET /api/v1/costbook/rows', () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey
    jest.resetModules()
    createClientMock.mockImplementation(() =>
      createSupabaseMock({ data: [], error: null })
    )
  })

  it('returns 503 when Supabase is not configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''

    const { GET } = await import('@/app/api/v1/costbook/rows/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/costbook/rows',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(503)
    expect((data as Record<string, unknown>).error).toContain('Server configuration')
    expect((data as Record<string, unknown>).rows).toEqual([])
    expect((data as Record<string, unknown>).count).toBe(0)
  })

  it('returns 200 with empty rows when no projects', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
    createClientMock.mockReturnValueOnce(
      createSupabaseMock({ data: [], error: null })
    )

    const { GET } = await import('@/app/api/v1/costbook/rows/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/costbook/rows',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).rows).toEqual([])
    expect((data as Record<string, unknown>).count).toBe(0)
  })

  it('returns 400 when projects query errors', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
    createClientMock.mockReturnValueOnce(
      createSupabaseMock({ data: null, error: { message: 'DB error' } })
    )

    const { GET } = await import('@/app/api/v1/costbook/rows/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/costbook/rows',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('DB error')
    expect((data as Record<string, unknown>).rows).toEqual([])
    expect((data as Record<string, unknown>).count).toBe(0)
  })
})
