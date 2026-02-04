/**
 * API Route Tests: CSV Import
 * GET /api/csv-import (status by importId), POST /api/csv-import (upload)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/csv-import', () => {
  it('returns 400 when importId missing', async () => {
    const { GET } = await import('@/app/api/csv-import/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('Missing required parameter: importId')
  })

  it('returns 200 with mock status when importId provided', async () => {
    const { GET } = await import('@/app/api/csv-import/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/csv-import?importId=imp-123',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).importId).toBe('imp-123')
    expect((data as Record<string, unknown>).status).toBe('completed')
    expect((data as Record<string, unknown>).progress).toBeDefined()
    expect((data as Record<string, unknown>).results).toBeDefined()
  })
})

describe('POST /api/csv-import', () => {
  const originalConsoleLog = console.log
  const originalConsoleError = console.error

  beforeEach(() => {
    console.log = jest.fn()
    console.error = jest.fn()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  it('returns 400 when no file provided', async () => {
    const formData = new FormData()
    formData.set('importType', 'projects')

    const { POST } = await import('@/app/api/csv-import/route')
    const request = new Request('http://localhost:3000/api/csv-import', {
      method: 'POST',
      body: formData,
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('No file provided')
  })

  it('returns 400 when importType missing or invalid', async () => {
    const file = new File(['a,b\n1,2'], 'test.csv', { type: 'text/csv' })
    const formData = new FormData()
    formData.set('file', file)
    formData.set('importType', 'invalid')

    const { POST } = await import('@/app/api/csv-import/route')
    const request = new Request('http://localhost:3000/api/csv-import', {
      method: 'POST',
      body: formData,
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('Invalid or missing importType')
  })

  it('returns 400 when file is not CSV', async () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    const formData = new FormData()
    formData.set('file', file)
    formData.set('importType', 'projects')

    const { POST } = await import('@/app/api/csv-import/route')
    const request = new Request('http://localhost:3000/api/csv-import', {
      method: 'POST',
      body: formData,
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('Invalid file type')
  })

  it('returns 400 when file is empty', async () => {
    const file = new File([''], 'empty.csv', { type: 'text/csv' })
    const formData = new FormData()
    formData.set('file', file)
    formData.set('importType', 'projects')

    const { POST } = await import('@/app/api/csv-import/route')
    const request = new Request('http://localhost:3000/api/csv-import', {
      method: 'POST',
      body: formData,
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('File is empty')
  })

  it('returns 202 with importId and message when valid CSV', async () => {
    const file = new File(['name,id\nProject A,1\nProject B,2'], 'projects.csv', {
      type: 'text/csv',
    })
    const formData = new FormData()
    formData.set('file', file)
    formData.set('importType', 'projects')

    const { POST } = await import('@/app/api/csv-import/route')
    const request = new Request('http://localhost:3000/api/csv-import', {
      method: 'POST',
      body: formData,
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(202)
    expect((data as Record<string, unknown>).importId).toMatch(/^import-\d+-[a-z0-9]+$/)
    expect((data as Record<string, unknown>).status).toBe('pending')
    expect((data as Record<string, unknown>).message).toBeDefined()
    expect((data as Record<string, unknown>).estimatedProcessingTime).toBeDefined()
  })

  it('accepts projects, risks, resources, users as importType', async () => {
    const types = ['projects', 'risks', 'resources', 'users'] as const
    for (const importType of types) {
      const file = new File(['h1,h2\nv1,v2'], 'data.csv', { type: 'text/csv' })
      const formData = new FormData()
      formData.set('file', file)
      formData.set('importType', importType)

      const { POST } = await import('@/app/api/csv-import/route')
      const request = new Request('http://localhost:3000/api/csv-import', {
        method: 'POST',
        body: formData,
      })
      const response = await POST(request as any)
      const data = await parseJsonResponse(response)

      expect(response.status).toBe(202)
      expect((data as Record<string, unknown>).importId).toBeDefined()
    }
  })
})
