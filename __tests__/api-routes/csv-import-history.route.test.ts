/**
 * API Route Tests: CSV Import History
 * GET /api/csv-import/history, DELETE /api/csv-import/history
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/csv-import/history', () => {
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

  it('returns 404 when import record not found', async () => {
    const { DELETE } = await import('@/app/api/csv-import/history/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import/history?importId=non-existent-id',
      method: 'DELETE',
    })
    const response = await DELETE(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(404)
    expect((data as Record<string, unknown>).error).toBe('Import record not found')
  })

  it('returns 200 and deletes when importId exists', async () => {
    const { DELETE } = await import('@/app/api/csv-import/history/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import/history?importId=import-004',
      method: 'DELETE',
    })
    const response = await DELETE(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).message).toBe('Import record deleted successfully')
    expect((data as Record<string, unknown>).deletedId).toBe('import-004')
  })
})
