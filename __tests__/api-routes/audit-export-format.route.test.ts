/**
 * API Route Tests: Audit Export by Format
 * POST /api/audit/export/[format] (csv or pdf, auth required)
 * @jest-environment node
 */

import { createMockNextRequest, createAuthenticatedRequest } from './helpers'

describe('POST /api/audit/export/[format]', () => {
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

  it('returns 401 when no Authorization header', async () => {
    const { POST } = await import('@/app/api/audit/export/[format]/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/audit/export/csv',
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any, { params: { format: 'csv' } })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Authorization header missing')
  })

  it('returns 200 with CSV content and headers when format is csv', async () => {
    const { POST } = await import('@/app/api/audit/export/[format]/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/audit/export/csv', 'token', {
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any, { params: { format: 'csv' } })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('audit-report.csv')
    const text = await response.text()
    expect(text).toContain('id,event_type,user_id,timestamp,severity,category')
  })

  it('returns 200 with PDF content and headers when format is pdf', async () => {
    const { POST } = await import('@/app/api/audit/export/[format]/route')
    const request = createAuthenticatedRequest('http://localhost:3000/api/audit/export/pdf', 'token', {
      method: 'POST',
      body: {},
    })
    const response = await POST(request as any, { params: { format: 'pdf' } })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('audit-report.pdf')
    const text = await response.text()
    expect(text).toContain('%PDF-1.4')
  })
})
