/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    expect(result.current).toBe('initial')
  })

  it('updates after delay when value changes', () => {
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

  it('does not update before delay has passed', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 1000 } }
    )
    rerender({ value: 'b', delay: 1000 })
    act(() => {
      jest.advanceTimersByTime(999)
    })
    expect(result.current).toBe('a')
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('b')
  })

  it('cancels previous timeout when value changes again within delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'x', delay: 500 } }
    )
    rerender({ value: 'y', delay: 500 })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    rerender({ value: 'z', delay: 500 })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe('z')
  })

  it('works with number values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 300 } }
    )
    expect(result.current).toBe(0)
    rerender({ value: 42, delay: 300 })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(result.current).toBe(42)
  })
})
