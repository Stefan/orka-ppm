/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from '../useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns initial value when key is missing', () => {
    const { result } = renderHook(() => useLocalStorage('key1', 'initial'))
    expect(result.current[0]).toBe('initial')
  })

  it('returns parsed value from localStorage', () => {
    localStorage.setItem('key2', JSON.stringify('stored'))
    const { result } = renderHook(() => useLocalStorage('key2', 'default'))
    expect(result.current[0]).toBe('stored')
  })

  it('setValue updates state and localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('key3', 0))
    act(() => { result.current[1](42) })
    expect(result.current[0]).toBe(42)
    expect(localStorage.getItem('key3')).toBe(JSON.stringify(42))
  })

  it('setValue with function updater', () => {
    const { result } = renderHook(() => useLocalStorage('key4', 10))
    act(() => { result.current[1](prev => prev + 5) })
    expect(result.current[0]).toBe(15)
  })
})
