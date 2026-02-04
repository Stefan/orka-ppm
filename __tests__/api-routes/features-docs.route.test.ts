/**
 * API Route Tests: Features Docs
 * GET /api/features/docs (serves tree from JSON or crawls)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

const mockTreeJson = JSON.stringify({
  sections: [{ id: 's1', title: 'Section 1' }],
  routes: [{ id: 'r1', title: 'Route 1' }],
  specs: [{ id: 'sp1', title: 'Spec 1' }],
  docs: [{ id: 'd1', title: 'Doc 1' }],
})

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}))

describe('GET /api/features/docs', () => {
  beforeEach(() => {
    jest.resetModules()
    const fs = require('fs')
    fs.existsSync.mockReturnValue(false)
    fs.readFileSync.mockImplementation(() => mockTreeJson)
  })

  it('returns 200 with sections, routes, specs, docs when tree file exists (fast path)', async () => {
    const fs = require('fs')
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(mockTreeJson)

    const { GET } = await import('@/app/api/features/docs/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/docs',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).sections).toEqual([{ id: 's1', title: 'Section 1' }])
    expect((data as Record<string, unknown>).routes).toEqual([{ id: 'r1', title: 'Route 1' }])
    expect((data as Record<string, unknown>).specs).toBeDefined()
    expect((data as Record<string, unknown>).docs).toBeDefined()
    expect((data as Record<string, unknown>).all).toBeDefined()
  })

  it('deduplicates routes by id when tree file exists', async () => {
    const fs = require('fs')
    const dupJson = JSON.stringify({
      sections: [],
      routes: [{ id: 'r1' }, { id: 'r1' }, { id: 'r2' }],
      specs: [],
      docs: [],
    })
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(dupJson)

    const { GET } = await import('@/app/api/features/docs/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/features/docs',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const routes = (data as Record<string, unknown>).routes as { id: string }[]
    expect(routes).toHaveLength(2)
    expect(routes.map((r) => r.id)).toEqual(['r1', 'r2'])
  })
})
