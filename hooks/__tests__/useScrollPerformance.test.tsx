/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useScrollPerformance } from '../useScrollPerformance'

const mockGetScrollMetrics = jest.fn(() => [])
const mockGetPerformanceSummary = jest.fn(() => ({
  avgSpeed: 0,
  maxSpeed: 0,
  totalEvents: 0,
  smoothnessScore: 100,
}))
const mockClearMetrics = jest.fn()
const mockInitializeScrollMonitoring = jest.fn(() => () => {})

jest.mock('../../lib/utils/scroll-performance', () => ({
  ScrollPerformanceManager: jest.fn().mockImplementation(() => ({
    getScrollMetrics: mockGetScrollMetrics,
    getPerformanceSummary: mockGetPerformanceSummary,
    clearMetrics: mockClearMetrics,
    initializeScrollMonitoring: mockInitializeScrollMonitoring,
  })),
  scrollPerformanceManager: {},
}))

describe('useScrollPerformance', () => {
  beforeEach(() => {
    mockGetScrollMetrics.mockReturnValue([])
    mockGetPerformanceSummary.mockReturnValue({
      avgSpeed: 0,
      maxSpeed: 0,
      totalEvents: 0,
      smoothnessScore: 100,
    })
    mockClearMetrics.mockClear()
    mockInitializeScrollMonitoring.mockReturnValue(() => {})
  })

  it('returns expected shape', () => {
    const { result } = renderHook(() => useScrollPerformance({}))

    expect(result.current.scrollMetrics).toEqual([])
    expect(result.current.performanceSummary).toEqual({
      avgSpeed: 0,
      maxSpeed: 0,
      totalEvents: 0,
      smoothnessScore: 100,
    })
    expect(result.current.isScrolling).toBe(false)
    expect(typeof result.current.scrollToTop).toBe('function')
    expect(typeof result.current.scrollToBottom).toBe('function')
    expect(typeof result.current.scrollToElement).toBe('function')
    expect(typeof result.current.clearMetrics).toBe('function')
  })

  it('clearMetrics calls manager clearMetrics and clears scrollMetrics state', () => {
    const { result } = renderHook(() => useScrollPerformance({}))

    act(() => {
      result.current.clearMetrics()
    })

    expect(mockClearMetrics).toHaveBeenCalled()
    expect(result.current.scrollMetrics).toEqual([])
  })

  it('scrollToTop does not throw when elementRef is null', () => {
    const { result } = renderHook(() => useScrollPerformance({}))
    expect(() => result.current.scrollToTop()).not.toThrow()
  })

  it('scrollToBottom does not throw when elementRef is null', () => {
    const { result } = renderHook(() => useScrollPerformance({}))
    expect(() => result.current.scrollToBottom()).not.toThrow()
  })

  it('scrollToElement does nothing when container ref is null', () => {
    const { result } = renderHook(() => useScrollPerformance({}))
    const div = document.createElement('div')
    expect(() => result.current.scrollToElement(div)).not.toThrow()
  })
})
