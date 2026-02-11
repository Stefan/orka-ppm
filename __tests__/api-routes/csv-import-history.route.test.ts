/**
 * API Route Tests: CSV Import History
 * GET /api/csv-import/history, DELETE /api/csv-import/history
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

const mockHistoryPayload = (overrides: Record<string, unknown> = {}) => ({
  data: [] as Array<Record<string, unknown>>,
  pagination: { limit: 50, offset: 0 },
  summary: { totalImports: 0, completed: 0, failed: 0 },
  ...overrides,
})

describe('GET /api/csv-import/history', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHistoryPayload(),
    }) as jest.Mock
  })

  it('returns 200 with data, pagination and summary', async () => {
    const { GET } = await import('@/app/api/csv-import/history/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import/history',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).data).toBeDefined()
    expect(Array.isArray((data as Record<string, unknown>).data)).toBe(true)
    expect((data as Record<string, unknown>).pagination).toBeDefined()
    expect((data as Record<string, unknown>).pagination).toMatchObject({
      limit: 50,
      offset: 0,
    })
    expect((data as Record<string, unknown>).summary).toBeDefined()
    expect((data as Record<string, unknown>).summary).toHaveProperty('totalImports')
    expect((data as Record<string, unknown>).summary).toHaveProperty('completed')
    expect((data as Record<string, unknown>).summary).toHaveProperty('failed')
  })

  it('filters by userId when provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHistoryPayload({ data: [{ userId: 'user-123' }, { userId: 'user-123' }] }),
    }) as jest.Mock
    const { GET } = await import('@/app/api/csv-import/history/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import/history?userId=user-123',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const items = (data as Record<string, unknown>).data as Array<Record<string, unknown>>
    items.forEach((item) => expect(item.userId).toBe('user-123'))
  })

  it('filters by status when provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHistoryPayload({ data: [{ status: 'completed' }, { status: 'completed' }] }),
    }) as jest.Mock
    const { GET } = await import('@/app/api/csv-import/history/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import/history?status=completed',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const items = (data as Record<string, unknown>).data as Array<Record<string, unknown>>
    items.forEach((item) => expect(item.status).toBe('completed'))
  })

  it('filters by importType when provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHistoryPayload({ data: [{ importType: 'projects' }, { importType: 'projects' }] }),
    }) as jest.Mock
    const { GET } = await import('@/app/api/csv-import/history/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import/history?importType=projects',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const items = (data as Record<string, unknown>).data as Array<Record<string, unknown>>
    items.forEach((item) => expect(item.importType).toBe('projects'))
  })

  it('applies limit and offset', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHistoryPayload({ pagination: { limit: 2, offset: 1 }, data: [{ id: '1' }] }),
    }) as jest.Mock
    const { GET } = await import('@/app/api/csv-import/history/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import/history?limit=2&offset=1',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).pagination).toMatchObject({
      limit: 2,
      offset: 1,
    })
    const items = (data as Record<string, unknown>).data as unknown[]
    expect(items.length).toBeLessThanOrEqual(2)
  })
})

describe('DELETE /api/csv-import/history', () => {
  it('returns 400 when importId missing', async () => {
    const { DELETE } = await import('@/app/api/csv-import/history/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import/history',
      method: 'DELETE',
    })
    const response = await DELETE(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('Missing required parameter: importId')
  })

  it('returns 501 when delete is requested (not implemented)', async () => {
    const { DELETE } = await import('@/app/api/csv-import/history/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import/history?importId=non-existent-id',
      method: 'DELETE',
    })
    const response = await DELETE(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(501)
    expect((data as Record<string, unknown>).error).toBe('Import history deletion is not implemented')
  })

  it('returns 501 for any delete (backend has no delete endpoint)', async () => {
    const { DELETE } = await import('@/app/api/csv-import/history/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import/history?importId=import-004',
      method: 'DELETE',
    })
    const response = await DELETE(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(501)
    expect((data as Record<string, unknown>).error).toBe('Import history deletion is not implemented')
  })
})
