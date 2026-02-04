/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useRoutePrefetch, useAutoPrefetch } from '../useRoutePrefetch'

const mockPrefetch = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: mockPrefetch,
  }),
}))

describe('useRoutePrefetch', () => {
  beforeEach(() => {
    mockPrefetch.mockClear()
  })

  it('returns prefetch and prefetchMultiple', () => {
    const { result } = renderHook(() => useRoutePrefetch())
    expect(typeof result.current.prefetch).toBe('function')
    expect(typeof result.current.prefetchMultiple).toBe('function')
  })

  it('prefetch calls router.prefetch', () => {
    const { result } = renderHook(() => useRoutePrefetch())
    act(() => {
      result.current.prefetch('/dashboard')
    })
    expect(mockPrefetch).toHaveBeenCalledWith('/dashboard')
  })

  it('prefetchMultiple calls prefetch for each href', () => {
    const { result } = renderHook(() => useRoutePrefetch())
    act(() => {
      result.current.prefetchMultiple(['/a', '/b'])
    })
    expect(mockPrefetch).toHaveBeenCalledTimes(2)
    expect(mockPrefetch).toHaveBeenCalledWith('/a')
    expect(mockPrefetch).toHaveBeenCalledWith('/b')
  })

  it('prefetch catches and logs on error', () => {
    mockPrefetch.mockImplementation(() => {
      throw new Error('prefetch failed')
    })
    const spy = jest.spyOn(console, 'warn').mockImplementation()
    const { result } = renderHook(() => useRoutePrefetch())
    act(() => {
      result.current.prefetch('/fail')
    })
    expect(spy).toHaveBeenCalledWith('Failed to prefetch route: /fail', expect.any(Error))
    spy.mockRestore()
  })
})

describe('useAutoPrefetch', () => {
  beforeEach(() => {
    mockPrefetch.mockClear()
  })

  it('prefetches paths on mount when delay is 0', () => {
    renderHook(() => useAutoPrefetch(['/page1', '/page2'], 0))
    expect(mockPrefetch).toHaveBeenCalledWith('/page1')
    expect(mockPrefetch).toHaveBeenCalledWith('/page2')
  })

  it('prefetches after delay when delay > 0', () => {
    jest.useFakeTimers()
    renderHook(() => useAutoPrefetch(['/delayed'], 100))
    expect(mockPrefetch).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(mockPrefetch).toHaveBeenCalledWith('/delayed')
    jest.useRealTimers()
  })
})
