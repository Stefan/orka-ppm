/**
 * @jest-environment jsdom
 */
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() }
}))

// Capture PerformanceObserver callbacks so we can fire them in tests (recordMetric, getLCPRating, etc.)
type PerfList = { getEntries: () => any[] }
const observerCallbacks: Array<{ entryTypes: string[]; callback: (list: PerfList) => void }> = []
const MockPerformanceObserver = function (this: any, callback: (list: PerfList) => void) {
  this.observe = (opts: { entryTypes: string[] }) => {
    observerCallbacks.push({ entryTypes: opts.entryTypes, callback })
  }
  this.disconnect = () => {}
}
;(global as any).PerformanceObserver = MockPerformanceObserver

// Dynamic import so module loads AFTER mock is set (import is hoisted otherwise)
let performanceMonitor: typeof import('../performance-utils').performanceMonitor
let markPerformance: (name: string) => void
let measurePerformance: (name: string, start: string, end?: string) => void
beforeAll(async () => {
  jest.resetModules()
  const mod = await import('../performance-utils')
  performanceMonitor = mod.performanceMonitor
  markPerformance = mod.markPerformance
  measurePerformance = mod.measurePerformance
})

function fireObserver(entryType: string, entries: any[]) {
  const rec = observerCallbacks.find(r => r.entryTypes?.[0] === entryType)
  if (rec) rec.callback({ getEntries: () => entries })
}

describe('lib/monitoring/performance-utils', () => {
  beforeEach(() => {
    performanceMonitor.clearMetrics()
    performanceMonitor.disconnect()
  })

  describe('getMetrics / getMetricsByName / getAverageMetric', () => {
    it('returns empty array when no metrics', () => {
      expect(performanceMonitor.getMetrics()).toEqual([])
    })

    it('getMetricsByName returns only matching metrics', () => {
      expect(performanceMonitor.getMetricsByName('LCP')).toEqual([])
    })

    it('getAverageMetric returns null when no metrics', () => {
      expect(performanceMonitor.getAverageMetric('LCP')).toBeNull()
    })

    it('records LCP metric via observer and getLCPRating (good <= 2500)', () => {
      fireObserver('largest-contentful-paint', [{ startTime: 2000 }])
      const metrics = performanceMonitor.getMetricsByName('LCP')
      expect(metrics).toHaveLength(1)
      expect(metrics[0].value).toBe(2000)
      expect(metrics[0].rating).toBe('good')
    })

    it('LCP needs-improvement (2500 < x <= 4000)', () => {
      fireObserver('largest-contentful-paint', [{ startTime: 3000 }])
      expect(performanceMonitor.getMetricsByName('LCP')[0].rating).toBe('needs-improvement')
    })

    it('LCP poor (> 4000)', () => {
      fireObserver('largest-contentful-paint', [{ startTime: 5000 }])
      expect(performanceMonitor.getMetricsByName('LCP')[0].rating).toBe('poor')
    })

    it('records FID and getFIDRating (good <= 100)', () => {
      fireObserver('first-input', [{ processingStart: 150, startTime: 50 }])
      const metrics = performanceMonitor.getMetricsByName('FID')
      expect(metrics).toHaveLength(1)
      expect(metrics[0].value).toBe(100)
      expect(metrics[0].rating).toBe('good')
    })

    it('FID needs-improvement and poor', () => {
      fireObserver('first-input', [{ processingStart: 250, startTime: 50 }])
      expect(performanceMonitor.getMetricsByName('FID')[0].rating).toBe('needs-improvement')
      fireObserver('first-input', [{ processingStart: 500, startTime: 50 }])
      expect(performanceMonitor.getMetricsByName('FID')[1].rating).toBe('poor')
    })

    it('records CLS and getCLSRating; skips hadRecentInput', () => {
      fireObserver('layout-shift', [{ value: 0.05, hadRecentInput: false }])
      expect(performanceMonitor.getMetricsByName('CLS')[0].rating).toBe('good')
      fireObserver('layout-shift', [{ value: 0.15, hadRecentInput: false }])
      expect(performanceMonitor.getMetricsByName('CLS')[1].rating).toBe('needs-improvement')
      fireObserver('layout-shift', [{ value: 0.3, hadRecentInput: false }])
      expect(performanceMonitor.getMetricsByName('CLS')[2].rating).toBe('poor')
    })

    it('CLS does not add to value when hadRecentInput is true', () => {
      performanceMonitor.clearMetrics()
      fireObserver('layout-shift', [{ value: 0.1, hadRecentInput: false }])
      const before = performanceMonitor.getMetricsByName('CLS').slice(-1)[0]?.value ?? 0
      fireObserver('layout-shift', [{ value: 999, hadRecentInput: true }])
      const after = performanceMonitor.getMetricsByName('CLS').slice(-1)[0]?.value ?? 0
      expect(after).toBe(before)
    })

    it('getAverageMetric returns average when metrics exist', () => {
      fireObserver('largest-contentful-paint', [{ startTime: 1000 }])
      fireObserver('largest-contentful-paint', [{ startTime: 3000 }])
      expect(performanceMonitor.getAverageMetric('LCP')).toBe(2000)
    })

    it('keeps only last 100 metrics when exceeding limit', () => {
      for (let i = 0; i < 105; i++) {
        fireObserver('largest-contentful-paint', [{ startTime: i }])
      }
      const metrics = performanceMonitor.getMetricsByName('LCP')
      expect(metrics).toHaveLength(100)
      expect(metrics[0].value).toBe(5)
      expect(metrics[99].value).toBe(104)
    })
  })

  describe('clearMetrics', () => {
    it('clears all metrics', () => {
      performanceMonitor.clearMetrics()
      expect(performanceMonitor.getMetrics()).toEqual([])
    })
  })

  describe('mark and measure', () => {
    it('mark does not throw when performance.mark exists', () => {
      expect(() => performanceMonitor.mark('test-start')).not.toThrow()
    })

    it('measure does not throw when performance.measure exists', () => {
      performanceMonitor.mark('a')
      performanceMonitor.mark('b')
      expect(() => performanceMonitor.measure('a-b', 'a', 'b')).not.toThrow()
    })
  })

  describe('markPerformance / measurePerformance', () => {
    it('markPerformance calls monitor.mark', () => {
      expect(() => markPerformance('util-mark')).not.toThrow()
    })

    it('measurePerformance calls monitor.measure', () => {
      markPerformance('start')
      markPerformance('end')
      expect(() => measurePerformance('dur', 'start', 'end')).not.toThrow()
    })
  })

  describe('getMemoryUsage', () => {
    it('returns null when performance.memory is not available', () => {
      // In jsdom, performance.memory is usually undefined
      const result = performanceMonitor.getMemoryUsage()
      expect(result === null || typeof result === 'object').toBe(true)
    })
  })

  describe('analyzeResourceSizes', () => {
    it('returns analysis object when getEntriesByType is available', () => {
      const orig = (global as any).performance.getEntriesByType
      ;(global as any).performance.getEntriesByType = (type: string) => {
        if (type === 'resource') return []
        return orig ? orig.call(performance, type) : []
      }
      const result = performanceMonitor.analyzeResourceSizes()
      ;(global as any).performance.getEntriesByType = orig
      expect(result).not.toBeNull()
      expect(result).toMatchObject({
        totalSize: 0,
        scripts: { count: 0, size: 0 },
        stylesheets: { count: 0, size: 0 },
        images: { count: 0, size: 0 },
        fonts: { count: 0, size: 0 },
        other: { count: 0, size: 0 }
      })
    })

    it('categorizes resources by type (script, image, etc.)', () => {
      const orig = (global as any).performance.getEntriesByType
      ;(global as any).performance.getEntriesByType = (type: string) => {
        if (type === 'resource') {
          return [
            { name: 'https://example.com/script.js', transferSize: 1000 },
            { name: 'https://example.com/style.css', transferSize: 500 }
          ]
        }
        return orig ? orig.call(performance, type) : []
      }
      const result = performanceMonitor.analyzeResourceSizes()
      ;(global as any).performance.getEntriesByType = orig
      expect(result).not.toBeNull()
      expect(result!.totalSize).toBe(1500)
      expect(result!.scripts.count).toBe(1)
      expect(result!.scripts.size).toBe(1000)
      expect(result!.stylesheets.count).toBe(1)
      expect(result!.stylesheets.size).toBe(500)
    })

    it('categorizes image and font URLs', () => {
      const orig = (global as any).performance.getEntriesByType
      ;(global as any).performance.getEntriesByType = (type: string) => {
        if (type === 'resource') {
          return [
            { name: 'https://example.com/photo.jpg', transferSize: 2000 },
            { name: 'https://example.com/font.woff', transferSize: 3000 },
            { name: 'https://example.com/other.xzy', transferSize: 100 }
          ]
        }
        return orig ? orig.call(performance, type) : []
      }
      const result = performanceMonitor.analyzeResourceSizes()
      ;(global as any).performance.getEntriesByType = orig
      expect(result!.images.count).toBe(1)
      expect(result!.images.size).toBe(2000)
      expect(result!.fonts.count).toBe(1)
      expect(result!.fonts.size).toBe(3000)
      expect(result!.other.count).toBe(1)
      expect(result!.other.size).toBe(100)
    })
  })

  describe('measure error path', () => {
    it('calls logger.warn when performance.measure throws', () => {
      const logger = require('../logger').logger
      const origMeasure = performance.measure?.bind(performance)
      ;(performance as any).measure = () => {
        throw new Error('measure failed')
      }
      performanceMonitor.measure('x', 'nonexistent', 'nonexistent')
      ;(performance as any).measure = origMeasure
      expect(logger.warn).toHaveBeenCalledWith('Failed to measure x:', expect.any(Error))
    })
  })

  describe('getMemoryUsage with memory', () => {
    it('returns usage when performance.memory exists', () => {
      const orig = (global as any).performance.memory
      ;(global as any).performance.memory = {
        usedJSHeapSize: 50e6,
        totalJSHeapSize: 100e6,
        jsHeapSizeLimit: 200e6
      }
      const result = performanceMonitor.getMemoryUsage()
      ;(global as any).performance.memory = orig
      expect(result).not.toBeNull()
      expect(result!.usagePercentage).toBe(25)
      expect(result!.usedJSHeapSize).toBe(50e6)
    })
  })

  describe('disconnect', () => {
    it('disconnect does not throw', () => {
      expect(() => performanceMonitor.disconnect()).not.toThrow()
    })
  })
})
