/**
 * Unit tests for useDebounce hook
 */

import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

jest.useFakeTimers()

describe('useDebounce', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    expect(result.current).toBe('initial')
  })

  it('updates debounced value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 500 } }
    )
    expect(result.current).toBe('first')

    rerender({ value: 'second', delay: 500 })
    expect(result.current).toBe('first')

    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe('second')
  })

  it('cancels previous timeout when value changes quickly', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 1000 } }
    )
    rerender({ value: 'b', delay: 1000 })
    rerender({ value: 'c', delay: 1000 })

    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe('a')

    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe('c')
  })

  it('works with number values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 200 } }
    )
    rerender({ value: 42, delay: 200 })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current).toBe(42)
  })
})
