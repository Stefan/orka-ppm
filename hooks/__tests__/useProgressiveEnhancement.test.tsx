/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react'
import {
  useFeatureSupport,
  useLayoutFallback,
  useAnimationFallback,
  useProgressiveEnhancement,
  useFeatureCheck,
  useProgressiveClasses,
} from '../useProgressiveEnhancement'

const mockDetectFeatureSupport = jest.fn()
const mockGetLayoutFallback = jest.fn()
const mockGetAnimationFallback = jest.fn()
const mockInitializeProgressiveEnhancement = jest.fn()

jest.mock('@/lib/utils/progressive-enhancement', () => ({
  detectFeatureSupport: (...args: unknown[]) => mockDetectFeatureSupport(...args),
  getLayoutFallback: (...args: unknown[]) => mockGetLayoutFallback(...args),
  getAnimationFallback: (...args: unknown[]) => mockGetAnimationFallback(...args),
  initializeProgressiveEnhancement: (...args: unknown[]) => mockInitializeProgressiveEnhancement(...args),
}))

const defaultFeatures = {
  css: {
    grid: true,
    flexbox: true,
    customProperties: true,
    transforms: true,
    transitions: true,
    animations: true,
    backdropFilter: true,
    clipPath: true,
    objectFit: true,
  },
  js: {
    intersectionObserver: true,
    resizeObserver: true,
    mutationObserver: true,
    fetch: true,
    promises: true,
    asyncAwait: true,
    modules: true,
    webWorkers: true,
  },
}

describe('useProgressiveEnhancement', () => {
  beforeEach(() => {
    mockDetectFeatureSupport.mockReturnValue(defaultFeatures)
    mockGetLayoutFallback.mockImplementation((x: string) => x as 'grid' | 'flexbox' | 'float')
    mockGetAnimationFallback.mockImplementation((x: string) => x as 'css' | 'js' | 'static')
    mockInitializeProgressiveEnhancement.mockReturnValue(undefined)
  })

  describe('useFeatureSupport', () => {
    it('returns feature support from detectFeatureSupport', () => {
      const { result } = renderHook(() => useFeatureSupport())
      expect(mockDetectFeatureSupport).toHaveBeenCalled()
      expect(result.current.css.grid).toBe(true)
      expect(result.current.js.fetch).toBe(true)
    })
  })

  describe('useLayoutFallback', () => {
    it('returns layout from getLayoutFallback', () => {
      mockGetLayoutFallback.mockReturnValue('grid')
      const { result } = renderHook(() => useLayoutFallback('grid'))
      expect(mockGetLayoutFallback).toHaveBeenCalledWith('grid')
      expect(result.current).toBe('grid')
    })

    it('updates when preferredLayout changes', () => {
      mockGetLayoutFallback.mockReturnValue('flexbox')
      const { result, rerender } = renderHook(
        ({ layout }: { layout: 'grid' | 'flexbox' }) => useLayoutFallback(layout),
        { initialProps: { layout: 'grid' as const } }
      )
      mockGetLayoutFallback.mockReturnValue('flexbox')
      rerender({ layout: 'flexbox' })
      expect(result.current).toBe('flexbox')
    })
  })

  describe('useAnimationFallback', () => {
    it('returns fallback from getAnimationFallback', () => {
      mockGetAnimationFallback.mockReturnValue('css')
      const { result } = renderHook(() => useAnimationFallback('css'))
      expect(mockGetAnimationFallback).toHaveBeenCalledWith('css')
      expect(result.current).toBe('css')
    })
  })

  describe('useProgressiveEnhancement', () => {
    it('calls initializeProgressiveEnhancement on mount', () => {
      renderHook(() => useProgressiveEnhancement())
      expect(mockInitializeProgressiveEnhancement).toHaveBeenCalledTimes(1)
    })
  })

  describe('useFeatureCheck', () => {
    it('returns css feature support', () => {
      const { result } = renderHook(() => useFeatureCheck('grid', 'css'))
      expect(result.current).toBe(true)
    })

    it('returns js feature support', () => {
      const { result } = renderHook(() => useFeatureCheck('fetch', 'js'))
      expect(result.current).toBe(true)
    })
  })

  describe('useProgressiveClasses', () => {
    it('returns class string based on feature support', () => {
      const { result } = renderHook(() => useProgressiveClasses())
      expect(typeof result.current).toBe('string')
      expect(result.current).toContain('supports-grid')
    })
  })
})
