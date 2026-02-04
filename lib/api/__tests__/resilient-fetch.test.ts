/**
 * Unit tests for lib/api/resilient-fetch.ts
 * @jest-environment node
 */

import { resilientFetch, batchResilientFetch, type ResilientFetchOptions } from '../resilient-fetch'

describe('resilientFetch', () => {
  it('returns data and no error when fetch succeeds', async () => {
    const data = { id: 1, name: 'test' }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    })

    const result = await resilientFetch<typeof data>('/api/test')

    expect(result.data).toEqual(data)
    expect(result.error).toBeNull()
    expect(result.isFromFallback).toBe(false)
    expect(result.status).toBe(200)
  })

  it('returns error when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const result = await resilientFetch('/api/test', { retries: 0 })

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error?.message).toContain('404')
  })

  it('returns fallback data when fetch fails and fallbackData is provided', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const fallback = { default: true }
    const result = await resilientFetch('/api/test', {
      retries: 0,
      fallbackData: fallback,
    })

    expect(result.data).toEqual(fallback)
    expect(result.isFromFallback).toBe(true)
    expect(result.error).not.toBeNull()
  })

  it('retries on failure when retries > 0', async () => {
    let calls = 0
    global.fetch = jest.fn().mockImplementation(() => {
      calls++
      if (calls < 2) return Promise.reject(new Error('fail'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      })
    })

    const result = await resilientFetch('/api/test', {
      retries: 2,
      retryDelay: 10,
    })

    expect(calls).toBe(2)
    expect(result.data).toEqual({ ok: true })
    expect(result.error).toBeNull()
  })
})

describe('batchResilientFetch', () => {
  it('returns results for each key', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: 1 }),
    })

    const results = await batchResilientFetch({
      a: { url: '/api/a' },
      b: { url: '/api/b' },
    })

    expect(results.a.data).toEqual({ value: 1 })
    expect(results.b.data).toEqual({ value: 1 })
    expect(results.a.error).toBeNull()
    expect(results.b.error).toBeNull()
  })
})
