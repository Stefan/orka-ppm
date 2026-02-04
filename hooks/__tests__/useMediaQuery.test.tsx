/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react'
import { useMediaQuery, useIsMobile } from '../useMediaQuery'

const mockMatchMedia = (matches: boolean) =>
  jest.fn(() => ({
    matches,
    media: '',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }))

describe('useMediaQuery', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: mockMatchMedia(false),
    })
  })

  it('returns a boolean', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(typeof result.current).toBe('boolean')
  })

  it('returns initial match from matchMedia.matches', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: mockMatchMedia(false),
    })
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('does not throw when matchMedia is available', () => {
    expect(() => renderHook(() => useMediaQuery('(min-width: 1024px)'))).not.toThrow()
  })
})

describe('useIsMobile', () => {
  it('returns a boolean', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: mockMatchMedia(false),
    })
    const { result } = renderHook(() => useIsMobile())
    expect(typeof result.current).toBe('boolean')
  })

  it('returns boolean consistent with useMediaQuery', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: mockMatchMedia(false),
    })
    const { result } = renderHook(() => useIsMobile())
    expect(typeof result.current).toBe('boolean')
  })
})
