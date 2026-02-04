/**
 * Unit tests for usePerformanceMonitoring hook
 */

import { renderHook, act } from '@testing-library/react'
import { usePerformanceMonitoring } from '../usePerformanceMonitoring'

jest.mock('web-vitals', () => ({
  onCLS: (cb: (m: { value: number; rating: string }) => void) => {
    cb({ value: 0.1, rating: 'good' })
  },
  onLCP: (cb: (m: { value: number; rating: string }) => void) => {
    cb({ value: 1200, rating: 'good' })
  },
  onTTFB: (cb: (m: { value: number; rating: string }) => void) => {
    cb({ value: 200, rating: 'good' })
  },
  onINP: (cb: (m: { value: number; rating: string }) => void) => {
    cb({ value: 50, rating: 'good' })
  },
  onFCP: (cb: (m: { value: number; rating: string }) => void) => {
    cb({ value: 800, rating: 'good' })
  },
}))

describe('usePerformanceMonitoring', () => {
  beforeAll(() => {
    if (typeof performance !== 'undefined' && !(performance as any).getEntriesByType) {
      (performance as any).getEntriesByType = () => []
    }
  })
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns isMonitoring and core functions', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ enabled: false })
    )
    expect(result.current.isMonitoring).toBeDefined()
    expect(typeof result.current.recordMetric).toBe('function')
    expect(typeof result.current.recordCustomMetric).toBe('function')
    expect(typeof result.current.generateReport).toBe('function')
    expect(typeof result.current.sendReport).toBe('function')
  })

  it('when enabled=false does not record metrics', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ enabled: false })
    )
    result.current.recordMetric('test.metric', 42)
    const report = result.current.generateReport()
    expect(report.metrics).toHaveLength(0)
  })

  it('when enabled=true records metrics via recordMetric', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ enabled: true })
    )
    act(() => {
      result.current.recordMetric('custom.metric', 100, { tag: 'a' })
    })
    const report = result.current.generateReport()
    expect(report.metrics.length).toBeGreaterThanOrEqual(1)
    const custom = report.metrics.find((m) => m.name === 'custom.metric')
    expect(custom).toBeDefined()
    expect(custom?.value).toBe(100)
    expect(custom?.tags?.tag).toBe('a')
  })

  it('recordCustomMetric stores in customMetrics', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ enabled: true })
    )
    act(() => {
      result.current.recordCustomMetric('my_key', 99)
    })
    const report = result.current.generateReport()
    expect(report.customMetrics.my_key).toBe(99)
  })

  it('generateReport includes webVitals, resourceTiming, longTasks', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ enabled: true })
    )
    const report = result.current.generateReport()
    expect(report.webVitals).toBeDefined()
    expect(report.resourceTiming).toBeDefined()
    expect(report.resourceTiming.totalResources).toBeDefined()
    expect(report.longTasks).toBeDefined()
    expect(Array.isArray(report.longTasks)).toBe(true)
  })

  it('measureSync records duration and returns value', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ enabled: true })
    )
    let out: number = 0
    act(() => {
      out = result.current.measureSync('sync.op', () => 42)
    })
    expect(out).toBe(42)
    const report = result.current.generateReport()
    const m = report.metrics.find((x) => x.name === 'sync.op')
    expect(m).toBeDefined()
    expect(typeof m?.value).toBe('number')
  })

  it('measureAsync records duration and returns resolved value', async () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ enabled: true })
    )
    let out: number = 0
    await act(async () => {
      out = await result.current.measureAsync('async.op', async () => 100)
    })
    expect(out).toBe(100)
    const report = result.current.generateReport()
    const m = report.metrics.find((x) => x.name === 'async.op')
    expect(m).toBeDefined()
  })

  it('PMR helpers record metrics', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ enabled: true })
    )
    act(() => {
      result.current.recordReportLoadTime('r1', 50)
      result.current.recordSectionRenderTime('s1', 10)
      result.current.recordAPICall('/api/projects', 80, 200)
    })
    const report = result.current.generateReport()
    expect(report.metrics.some((m) => m.name === 'pmr.report.load_time')).toBe(true)
    expect(report.metrics.some((m) => m.name === 'pmr.section.render_time')).toBe(true)
    expect(report.metrics.some((m) => m.name === 'pmr.api.call')).toBe(true)
    expect(report.customMetrics.last_report_load_time).toBe(50)
  })

  it('calls onReport when sendReport runs', async () => {
    const onReport = jest.fn()
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ enabled: true, onReport })
    )
    act(() => {
      result.current.recordMetric('x', 1)
    })
    await act(async () => {
      await result.current.sendReport()
    })
    expect(onReport).toHaveBeenCalledWith(
      expect.objectContaining({
        metrics: expect.any(Array),
        webVitals: expect.any(Object),
      })
    )
  })
})
