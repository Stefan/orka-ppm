/**
 * API Route Tests: V1 Column Views
 * GET/POST /api/v1/column-views (Supabase or local fallback)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

function createSupabaseMock(getResult: unknown[], postResult: { data?: unknown; error?: { message: string } | null }) {
  const thenable = { then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data: getResult }) }
  const orderChain = {
    eq: () => ({ eq: () => thenable, then: thenable.then }),
    then: thenable.then,
  }
  return {
    from: () => ({
      select: () => ({ order: () => orderChain }),
      insert: (_row: unknown) => ({
        select: () => ({
          single: () => ({
            then: (resolve: (v: { data?: unknown; error?: { message: string } | null }) => void) =>
              resolve(postResult),
          }),
        }),
      }),
    }),
  }
}

const createClientMock = jest.fn(() =>
  createSupabaseMock([], { data: { id: 'cv1', name: 'View 1', entity: 'projects', columns: ['name'], order: 0 }, error: null })
)
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))

describe('GET /api/v1/column-views', () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey
    jest.resetModules()
  })

  it('returns empty array when Supabase not configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''

    const { GET } = await import('@/app/api/v1/column-views/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/column-views',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect((data as unknown[]).length).toBe(0)
  })

  it('returns views from Supabase when configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
    const views = [
      { id: 'v1', name: 'Default', entity: 'projects', columns: ['name', 'status'], order: 0 },
    ]
    createClientMock.mockReturnValueOnce(
      createSupabaseMock(views, { data: null, error: null })
    )

    const { GET } = await import('@/app/api/v1/column-views/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/column-views',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect((data as any[])[0].name).toBe('Default')
    expect((data as any[])[0].entity).toBe('projects')
  })
})

describe('POST /api/v1/column-views', () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey
    jest.resetModules()
  })

  it('returns 400 when name, entity or columns missing', async () => {
    const { POST } = await import('@/app/api/v1/column-views/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/column-views',
      method: 'POST',
      body: { name: 'My View' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('name, entity, columns required')
  })

  it('returns 400 when columns is not array', async () => {
    const { POST } = await import('@/app/api/v1/column-views/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/column-views',
      method: 'POST',
      body: { name: 'V', entity: 'projects', columns: 'name' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBeDefined()
  })

  it('returns 200 with local fallback when Supabase not configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''

    const { POST } = await import('@/app/api/v1/column-views/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/column-views',
      method: 'POST',
      body: { name: 'Local View', entity: 'projects', columns: ['name', 'status'] },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).id).toBe('local')
    expect((data as Record<string, unknown>).name).toBe('Local View')
    expect((data as Record<string, unknown>).entity).toBe('projects')
    expect((data as Record<string, unknown>).columns).toEqual(['name', 'status'])
  })

  it('returns 200 with created view when Supabase insert succeeds', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
    createClientMock.mockReturnValueOnce(
      createSupabaseMock([], {
        data: {
          id: 'new-id',
          name: 'New View',
          entity: 'projects',
          columns: ['name'],
          order: 0,
          is_default: false,
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    )

    const { POST } = await import('@/app/api/v1/column-views/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/column-views',
      method: 'POST',
      body: { name: 'New View', entity: 'projects', columns: ['name'] },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).id).toBe('new-id')
    expect((data as Record<string, unknown>).name).toBe('New View')
  })
})
