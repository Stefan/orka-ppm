/**
 * API Route Tests: Features Sync
 * POST /api/features/sync - webhook auth, Supabase, crawlProjectDocs
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

const mockFrom = jest.fn(() => ({
  select: () => Promise.resolve({ data: [], error: null }),
  insert: () => Promise.resolve({ data: null, error: null }),
}))
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))
jest.mock('@/lib/features/crawl-docs', () => ({
  crawlProjectDocs: () => ({ specs: [{ name: 'TestSpec', description: null, link: null, icon: null }] }),
}))

describe('POST /api/features/sync', () => {
  const origEnv = process.env

  afterEach(() => {
    process.env.FEATURES_WEBHOOK_SECRET = origEnv.FEATURES_WEBHOOK_SECRET
    process.env.NEXT_PUBLIC_SUPABASE_URL = origEnv.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_URL = origEnv.SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = origEnv.SUPABASE_SERVICE_ROLE_KEY
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  it('returns 401 when FEATURES_WEBHOOK_SECRET is set and auth is missing', async () => {
    process.env.FEATURES_WEBHOOK_SECRET = 'secret'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
    jest.resetModules()

    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/sync',
      method: 'POST',
      body: {},
    })

    const { POST } = await import('@/app/api/features/sync/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(401)
    expect((data as Record<string, unknown>).error).toBe('Unauthorized')
  })

  it('returns 500 when Supabase env is missing', async () => {
    process.env.FEATURES_WEBHOOK_SECRET = ''
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    jest.resetModules()

    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/sync',
      method: 'POST',
      body: { dry_run: true },
      headers: { 'x-webhook-secret': 'any' },
    })

    const { POST } = await import('@/app/api/features/sync/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(500)
    expect((data as Record<string, unknown>).error).toBe('Missing Supabase configuration')
  })

  it('returns 200 with dry_run when auth and Supabase env are set', async () => {
    process.env.FEATURES_WEBHOOK_SECRET = 'sync-secret'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    jest.resetModules()

    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/sync',
      method: 'POST',
      body: { dry_run: true },
      headers: { 'x-webhook-secret': 'sync-secret' },
    })

    const { POST } = await import('@/app/api/features/sync/route')
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).ok).toBe(true)
    expect((data as Record<string, unknown>).dry_run).toBe(true)
  })
})
