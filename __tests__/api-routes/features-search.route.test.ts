/**
 * API Route Tests: Features Search
 * GET /api/features/search?q=... (Supabase feature_catalog search)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

const mockFrom = jest.fn()
const mockSelect = jest.fn()
const mockOrder = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

function addNextUrl(req: Request) {
  Object.defineProperty(req, 'nextUrl', { value: new URL(req.url), configurable: true })
  return req as Request & { nextUrl: URL }
}

describe('GET /api/features/search', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    }
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        order: mockOrder,
      }),
    })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns ids empty when q is missing', async () => {
    const { GET } = await import('@/app/api/features/search/route')
    const request = addNextUrl(createMockNextRequest({
      url: 'http://localhost:3000/api/features/search',
      method: 'GET',
    }))
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).ids).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns ids empty when q is empty string', async () => {
    const { GET } = await import('@/app/api/features/search/route')
    const request = addNextUrl(createMockNextRequest({
      url: 'http://localhost:3000/api/features/search?q=',
      method: 'GET',
    }))
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).ids).toEqual([])
  })

  it('returns ids empty when Supabase env is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
    jest.resetModules()

    const { GET } = await import('@/app/api/features/search/route')
    const request = addNextUrl(createMockNextRequest({
      url: 'http://localhost:3000/api/features/search?q=import',
      method: 'GET',
    }))
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).ids).toEqual([])
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('returns matched feature ids when Supabase returns data', async () => {
    const features = [
      { id: 'import-builder', name: 'Import Builder', description: 'CSV import', link: '/import' },
      { id: 'other', name: 'Other', description: 'Other feature', link: null },
    ]
    mockOrder.mockResolvedValue({ data: features })

    const { GET } = await import('@/app/api/features/search/route')
    const request = addNextUrl(createMockNextRequest({
      url: 'http://localhost:3000/api/features/search?q=import',
      method: 'GET',
    }))
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).ids).toEqual(['import-builder'])
    expect(mockFrom).toHaveBeenCalledWith('feature_catalog')
    expect(mockSelect).toHaveBeenCalledWith('id, name, description, link')
    expect(mockOrder).toHaveBeenCalledWith('name')
  })

  it('returns empty ids when Supabase returns no features', async () => {
    mockOrder.mockResolvedValue({ data: null })

    const { GET } = await import('@/app/api/features/search/route')
    const request = addNextUrl(createMockNextRequest({
      url: 'http://localhost:3000/api/features/search?q=foo',
      method: 'GET',
    }))
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).ids).toEqual([])
  })
})
