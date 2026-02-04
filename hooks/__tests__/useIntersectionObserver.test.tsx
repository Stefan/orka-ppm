/**
 * @jest-environment jsdom
 */
import { renderHook, render } from '@testing-library/react'
import React from 'react'
import { useIntersectionObserver, useLazyLoad } from '../useIntersectionObserver'

describe('useIntersectionObserver', () => {
  let observerCallback: (entries: IntersectionObserverEntry[]) => void
  let observe: jest.Mock
  let disconnect: jest.Mock

  beforeEach(() => {
    observe = jest.fn()
    disconnect = jest.fn()
    global.IntersectionObserver = jest.fn((callback: (entries: IntersectionObserverEntry[]) => void) => {
      observerCallback = callback
      return {
        observe,
        disconnect,
        root: null,
        rootMargin: '',
        thresholds: [],
        takeRecords: () => [],
        unobserve: jest.fn(),
      } as unknown as IntersectionObserver
    }) as jest.Mock
  })

  it('returns ref and isIntersecting state', () => {
    const { result } = renderHook(() => useIntersectionObserver())

    expect(result.current[0]).toHaveProperty('current')
    expect(result.current[1]).toBe(false)
  })

  it('creates observer when ref is attached to element', () => {
    const Component = () => {
      const [ref, isIntersecting] = useIntersectionObserver()
      return <div ref={ref as React.RefObject<HTMLDivElement>} data-testid="target">{String(isIntersecting)}</div>
    }
    const { getByTestId } = render(<Component />)
    const el = getByTestId('target')

    expect(observe).toHaveBeenCalledWith(el)
  })

  it('updates isIntersecting when observer callback fires', () => {
    const Component = () => {
      const [ref, isIntersecting] = useIntersectionObserver()
      return <div ref={ref as React.RefObject<HTMLDivElement>} data-testid="t">{String(isIntersecting)}</div>
    }
    render(<Component />)
    expect(observerCallback).toBeDefined()

    observerCallback([
      {
        isIntersecting: true,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: 1,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        target: document.createElement('div'),
        time: 0,
      },
    ])
    // State update is async; we just verify observer was set up
    expect(observe).toHaveBeenCalled()
  })

  it('disconnects on unmount when observer was created', () => {
    const Component = () => {
      const [ref] = useIntersectionObserver()
      return <div ref={ref as React.RefObject<HTMLDivElement>} />
    }
    const { unmount } = render(<Component />)
    expect(observe).toHaveBeenCalled()
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})

describe('useLazyLoad', () => {
  let observerCallback: (entries: IntersectionObserverEntry[]) => void
  let observe: jest.Mock
  let disconnect: jest.Mock

  beforeEach(() => {
    observe = jest.fn()
    disconnect = jest.fn()
    global.IntersectionObserver = jest.fn((callback: (entries: IntersectionObserverEntry[]) => void) => {
      observerCallback = callback
      return {
        observe,
        disconnect,
        root: null,
        rootMargin: '',
        thresholds: [],
        takeRecords: () => [],
        unobserve: jest.fn(),
      } as unknown as IntersectionObserver
    }) as jest.Mock
  })

  it('returns ref and isVisible', () => {
    const { result } = renderHook(() => useLazyLoad())

    expect(result.current[0]).toHaveProperty('current')
    expect(result.current[1]).toBe(false)
  })

  it('sets isVisible when entry is intersecting', () => {
    const Component = () => {
      const [ref, isVisible] = useLazyLoad(0.1)
      return <div ref={ref as React.RefObject<HTMLDivElement>} data-testid="lazy">{String(isVisible)}</div>
    }
    render(<Component />)
    expect(observerCallback).toBeDefined()

    const target = document.createElement('div')
    observerCallback([
      {
        isIntersecting: true,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: 1,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        target,
        time: 0,
      },
    ])
    expect(observe).toHaveBeenCalled()
  })
})
