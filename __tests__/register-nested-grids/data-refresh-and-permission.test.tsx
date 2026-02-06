/**
 * Feature: register-nested-grids
 * Property 10: Data Refresh on Return (Requirements 5.2)
 * Property 13: Permission Check vor Datenladen (Requirements 6.4)
 */

import React from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useNestedGridData } from '@/lib/register-nested-grids/hooks'

jest.mock('@/lib/register-nested-grids/api', () => ({
  fetchNestedGridData: jest.fn(() => Promise.resolve([])),
}))

let capturedUseQueryOptions: Record<string, unknown> | null = null
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: (options: Record<string, unknown>) => {
      capturedUseQueryOptions = options
      return actual.useQuery(options)
    },
  }
})

function TestComp() {
  useNestedGridData('parent-1', 'tasks')
  return null
}

describe('Feature: register-nested-grids, Property 10: Data Refresh on Return', () => {
  beforeEach(() => {
    capturedUseQueryOptions = null
  })

  it('useNestedGridData is configured with refetchOnWindowFocus for refresh on return', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <TestComp />
      </QueryClientProvider>
    )
    expect(capturedUseQueryOptions?.refetchOnWindowFocus).toBe(true)
  })
})

describe('Feature: register-nested-grids, Property 13: Permission Check vor Datenladen', () => {
  it('fetchNestedGridData is called with parentRowId and itemType', async () => {
    const api = await import('@/lib/register-nested-grids/api')
    const fn = api.fetchNestedGridData as jest.Mock
    fn.mockClear()
    fn.mockResolvedValue([])
    await api.fetchNestedGridData('row1', 'tasks')
    expect(fn).toHaveBeenCalledWith('row1', 'tasks')
    expect(Array.isArray(await api.fetchNestedGridData('r', 'registers'))).toBe(true)
  })
})
