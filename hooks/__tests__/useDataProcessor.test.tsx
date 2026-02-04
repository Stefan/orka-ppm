/**
 * Unit tests for useDataProcessor hook
 * Mocks @/lib/workers dataProcessorWorker
 */

const mockFilter = jest.fn()
const mockSort = jest.fn()
const mockTransform = jest.fn()
const mockSearch = jest.fn()
const mockDeduplicate = jest.fn()
const mockNormalize = jest.fn()

jest.mock('@/lib/workers', () => ({
  dataProcessorWorker: {
    filter: (...args: unknown[]) => mockFilter(...args),
    sort: (...args: unknown[]) => mockSort(...args),
    transform: (...args: unknown[]) => mockTransform(...args),
    search: (...args: unknown[]) => mockSearch(...args),
    deduplicate: (...args: unknown[]) => mockDeduplicate(...args),
    normalize: (...args: unknown[]) => mockNormalize(...args),
  },
}))

import { renderHook, act, waitFor } from '@testing-library/react'
import { useDataProcessor } from '../useDataProcessor'

describe('useDataProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns isProcessing false and error null initially', () => {
    mockFilter.mockResolvedValue([])
    const { result } = renderHook(() => useDataProcessor())
    expect(result.current.isProcessing).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('filter calls worker and returns result', async () => {
    const items = [1, 2, 3]
    const filtered = [2]
    mockFilter.mockResolvedValue(filtered)

    const { result } = renderHook(() => useDataProcessor())

    let out: number[] | null = null
    await act(async () => {
      out = await result.current.filter(items, (x) => x === 2)
    })

    expect(mockFilter).toHaveBeenCalledWith(items, expect.any(Function))
    expect(out).toEqual(filtered)
  })

  it('sort calls worker with direction', async () => {
    const items = [3, 1, 2]
    mockSort.mockResolvedValue([1, 2, 3])

    const { result } = renderHook(() => useDataProcessor())

    await act(async () => {
      await result.current.sort(items, (a, b) => a - b, 'asc')
    })

    expect(mockSort).toHaveBeenCalledWith(items, expect.any(Function), 'asc')
  })

  it('transform calls worker', async () => {
    const items = [1, 2]
    mockTransform.mockResolvedValue(['a', 'b'])

    const { result } = renderHook(() => useDataProcessor())

    await act(async () => {
      await result.current.transform(items, (x) => String(x))
    })

    expect(mockTransform).toHaveBeenCalledWith(items, expect.any(Function))
  })

  it('search calls worker', async () => {
    mockSearch.mockResolvedValue([])

    const { result } = renderHook(() => useDataProcessor())

    await act(async () => {
      await result.current.search([{ name: 'x' }], 'x', ['name'])
    })

    expect(mockSearch).toHaveBeenCalledWith([{ name: 'x' }], 'x', ['name'])
  })

  it('deduplicate calls worker', async () => {
    mockDeduplicate.mockResolvedValue([])

    const { result } = renderHook(() => useDataProcessor())

    await act(async () => {
      await result.current.deduplicate([], ['id'])
    })

    expect(mockDeduplicate).toHaveBeenCalledWith([], ['id'])
  })

  it('normalize calls worker with method', async () => {
    mockNormalize.mockResolvedValue([])

    const { result } = renderHook(() => useDataProcessor())

    await act(async () => {
      await result.current.normalize([], ['value'], 'zscore')
    })

    expect(mockNormalize).toHaveBeenCalledWith([], ['value'], 'zscore')
  })

  it('sets error and returns null when worker throws', async () => {
    mockFilter.mockRejectedValue(new Error('worker error'))

    const { result } = renderHook(() => useDataProcessor())

    let out: unknown = undefined
    await act(async () => {
      out = await result.current.filter([1, 2], () => true)
    })

    expect(out).toBeNull()
    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
      expect(result.current.error?.message).toContain('worker error')
    })
  })

  it('exposes isSupported from Worker', () => {
    const { result } = renderHook(() => useDataProcessor())
    expect(typeof result.current.isSupported).toBe('boolean')
  })
})
