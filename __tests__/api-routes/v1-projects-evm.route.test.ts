/**
 * API Route Tests: V1 Projects EVM
 * GET /api/v1/projects/[projectId]/evm
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('GET /api/v1/projects/[projectId]/evm', () => {
  it('returns 400 when projectId is missing', async () => {
    const { GET } = await import('@/app/api/v1/projects/[projectId]/evm/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/projects/evm',
      method: 'GET',
    })
    const response = await GET(request as any, {
      params: Promise.resolve({ projectId: '' }),
    })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toBe('projectId required')
  })

  it('returns 200 with stub EVM metrics', async () => {
    const { GET } = await import('@/app/api/v1/projects/[projectId]/evm/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/v1/projects/p1/evm',
      method: 'GET',
    })
    const response = await GET(request as any, {
      params: Promise.resolve({ projectId: 'p1' }),
    })
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).cpi).toBe(1.0)
    expect((data as Record<string, unknown>).spi).toBe(1.0)
    expect((data as Record<string, unknown>).tcpi).toBe(1.0)
    expect((data as Record<string, unknown>).vac).toBe(0)
    expect((data as Record<string, unknown>).cv).toBe(0)
    expect((data as Record<string, unknown>).sv).toBe(0)
    expect((data as Record<string, unknown>).bac).toBe(0)
    expect((data as Record<string, unknown>).eac).toBe(0)
    expect((data as Record<string, unknown>).etc).toBe(0)
  })
})
