/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useCacheManager } from '../useCacheManager'

const mockGetCacheStats = jest.fn()
const mockClearApiCache = jest.fn()
const mockClearAllCaches = jest.fn()
const mockPreloadCriticalResources = jest.fn()
const mockUpdateServiceWorker = jest.fn()
const mockIsCachingAvailable = jest.fn()

jest.mock('@/lib/utils/cache-manager', () => ({
  getCacheStats: (...args: unknown[]) => mockGetCacheStats(...args),
  clearApiCache: (...args: unknown[]) => mockClearApiCache(...args),
  clearAllCaches: (...args: unknown[]) => mockClearAllCaches(...args),
  preloadCriticalResources: (...args: unknown[]) => mockPreloadCriticalResources(...args),
  updateServiceWorker: (...args: unknown[]) => mockUpdateServiceWorker(...args),
  isCachingAvailable: () => mockIsCachingAvailable(),
}))

describe('useCacheManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsCachingAvailable.mockReturnValue(true)
    mockGetCacheStats.mockResolvedValue({
      apiCacheSize: 2,
      staticCacheSize: 5,
      imageCacheSize: 1,
      totalSize: 8,
    })
  })

  it('initializes with default cache stats and checks availability', async () => {
    const { result } = renderHook(() => useCacheManager())

    expect(result.current.cacheStats).toEqual({
      apiCacheSize: 0,
      staticCacheSize: 0,
      imageCacheSize: 0,
      totalSize: 0,
    })
    expect(result.current.isAvailable).toBe(true)

    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetCacheStats).toHaveBeenCalled()
    expect(result.current.cacheStats.totalSize).toBe(8)
  })

  it('isAvailable is false when isCachingAvailable returns false', () => {
    mockIsCachingAvailable.mockReturnValue(false)
    const { result } = renderHook(() => useCacheManager())
    expect(result.current.isAvailable).toBe(false)
  })

  it('refreshStats updates cacheStats', async () => {
    const { result } = renderHook(() => useCacheManager())

    await act(async () => {
      await result.current.refreshStats()
    })

    expect(mockGetCacheStats).toHaveBeenCalled()
    expect(result.current.cacheStats.totalSize).toBe(8)
  })

  it('clearApiCache calls clearApiCache and refreshStats when available', async () => {
    mockClearApiCache.mockResolvedValue(undefined)
    const { result } = renderHook(() => useCacheManager())

    await act(async () => {
      await result.current.clearApiCache()
    })

    expect(mockClearApiCache).toHaveBeenCalled()
    expect(mockGetCacheStats).toHaveBeenCalled()
  })

  it('clearAllCaches calls clearAllCaches and refreshStats when available', async () => {
    mockClearAllCaches.mockResolvedValue(undefined)
    const { result } = renderHook(() => useCacheManager())

    await act(async () => {
      await result.current.clearAllCaches()
    })

    expect(mockClearAllCaches).toHaveBeenCalled()
  })

  it('preloadResources calls preloadCriticalResources when available', async () => {
    mockPreloadCriticalResources.mockResolvedValue(undefined)
    const { result } = renderHook(() => useCacheManager())

    await act(async () => {
      await result.current.preloadResources(['/api/health'])
    })

    expect(mockPreloadCriticalResources).toHaveBeenCalledWith(['/api/health'])
  })

  it('updateServiceWorker calls updateServiceWorker when available', async () => {
    mockUpdateServiceWorker.mockResolvedValue(undefined)
    const { result } = renderHook(() => useCacheManager())

    await act(async () => {
      await result.current.updateServiceWorker()
    })

    expect(mockUpdateServiceWorker).toHaveBeenCalled()
  })
})
