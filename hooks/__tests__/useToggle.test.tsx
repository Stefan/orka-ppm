/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useToggle, useMultiToggle } from '../useToggle'

describe('useToggle', () => {
  it('returns initial value', () => {
    const { result } = renderHook(() => useToggle(false))
    expect(result.current[0]).toBe(false)
  })

  it('returns true when initial true', () => {
    const { result } = renderHook(() => useToggle(true))
    expect(result.current[0]).toBe(true)
  })

  it('toggle flips value', () => {
    const { result } = renderHook(() => useToggle(false))
    act(() => { result.current[1]() })
    expect(result.current[0]).toBe(true)
    act(() => { result.current[1]() })
    expect(result.current[0]).toBe(false)
  })

  it('setToggle with boolean sets value', () => {
    const { result } = renderHook(() => useToggle(false))
    act(() => { result.current[2](true) })
    expect(result.current[0]).toBe(true)
    act(() => { result.current[2](false) })
    expect(result.current[0]).toBe(false)
  })

  it('setToggle without arg toggles', () => {
    const { result } = renderHook(() => useToggle(false))
    act(() => { result.current[2]() })
    expect(result.current[0]).toBe(true)
  })
})

describe('useMultiToggle', () => {
  it('initializes with keys and optional initial values', () => {
    const { result } = renderHook(() =>
      useMultiToggle(['a', 'b'], { a: true })
    )
    expect(result.current[0].a).toBe(true)
    expect(result.current[0].b).toBe(false)
  })

  it('toggle flips one key', () => {
    const { result } = renderHook(() => useMultiToggle(['a', 'b']))
    act(() => { result.current[1]('a') })
    expect(result.current[0].a).toBe(true)
    expect(result.current[0].b).toBe(false)
    act(() => { result.current[1]('a') })
    expect(result.current[0].a).toBe(false)
  })

  it('setToggle with boolean sets key', () => {
    const { result } = renderHook(() => useMultiToggle(['a']))
    act(() => { result.current[2]('a', true) })
    expect(result.current[0].a).toBe(true)
  })
})
