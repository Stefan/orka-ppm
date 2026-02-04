/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useWindowSize, useBreakpoint } from '../useWindowSize'

describe('useWindowSize', () => {
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true })
  })

  it('returns current window dimensions', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })

    const { result } = renderHook(() => useWindowSize())

    expect(result.current.width).toBe(1024)
    expect(result.current.height).toBe(768)
  })

  it('updates on resize event', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true })

    const { result } = renderHook(() => useWindowSize())

    expect(result.current.width).toBe(800)
    expect(result.current.height).toBe(600)

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 900, writable: true })
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.width).toBe(1200)
    expect(result.current.height).toBe(900)
  })
})

describe('useBreakpoint', () => {
  it('returns breakpoint flags based on width', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true })

    const { result } = renderHook(() => useBreakpoint())

    expect(result.current.width).toBe(500)
    expect(result.current.isMobile).toBe(true)
    expect(result.current.isTablet).toBe(false)
    expect(result.current.isDesktop).toBe(false)
  })

  it('isTablet at 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true })

    const { result } = renderHook(() => useBreakpoint())

    expect(result.current.isMobile).toBe(false)
    expect(result.current.isTablet).toBe(true)
    expect(result.current.isDesktop).toBe(false)
  })

  it('isDesktop at 1024', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1100, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true })

    const { result } = renderHook(() => useBreakpoint())

    expect(result.current.isDesktop).toBe(true)
    expect(result.current.isLarge).toBe(false)
  })
})
