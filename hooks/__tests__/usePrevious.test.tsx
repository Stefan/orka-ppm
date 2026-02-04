/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react'
import { usePrevious, useCompare } from '../usePrevious'

describe('usePrevious', () => {
  it('returns undefined on first render', () => {
    const { result } = renderHook(() => usePrevious(1))
    expect(result.current).toBeUndefined()
  })

  it('returns previous value after update', () => {
    const { result, rerender } = renderHook<number | undefined, number>(
      (value) => usePrevious(value),
      { initialProps: 1 }
    )
    expect(result.current).toBeUndefined()
    rerender(2)
    expect(result.current).toBe(1)
    rerender(3)
    expect(result.current).toBe(2)
  })
})

describe('useCompare', () => {
  it('returns result of compare when provided', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useCompare(value, (prev, curr) => prev === curr),
      { initialProps: { value: 1 } }
    )
    rerender({ value: 2 })
    expect(result.current).toBe(false)
    rerender({ value: 2 })
    expect(result.current).toBe(true)
  })

  it('returns prev !== value when no compare', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useCompare(value),
      { initialProps: { value: 1 } }
    )
    rerender({ value: 2 })
    expect(result.current).toBe(true)
    rerender({ value: 2 })
    expect(result.current).toBe(false)
  })
})
