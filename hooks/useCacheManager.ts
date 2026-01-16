/**
 * useCacheManager Hook
 * React hook for managing service worker caches
 */

import { useState, useEffect, useCallback } from 'react';
import {
  clearApiCache,
  clearAllCaches,
  getCacheStats,
  isCachingAvailable,
  preloadCriticalResources,
  updateServiceWorker,
  type CacheStats,
} from '@/lib/utils/cache-manager';

export function useCacheManager() {
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    apiCacheSize: 0,
    staticCacheSize: 0,
    imageCacheSize: 0,
    totalSize: 0,
  });
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if caching is available
  useEffect(() => {
    setIsAvailable(isCachingAvailable());
  }, []);

  // Load cache stats
  const loadStats = useCallback(async () => {
    if (!isAvailable) return;

    setIsLoading(true);
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

  // Clear API cache
  const handleClearApiCache = useCallback(async () => {
    if (!isAvailable) return;

    setIsLoading(true);
    try {
      await clearApiCache();
      await loadStats();
    } catch (error) {
      console.error('Failed to clear API cache:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, loadStats]);

  // Clear all caches
  const handleClearAllCaches = useCallback(async () => {
    if (!isAvailable) return;

    setIsLoading(true);
    try {
      await clearAllCaches();
      await loadStats();
    } catch (error) {
      console.error('Failed to clear all caches:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, loadStats]);

  // Preload resources
  const handlePreloadResources = useCallback(
    async (urls: string[]) => {
      if (!isAvailable) return;

      setIsLoading(true);
      try {
        await preloadCriticalResources(urls);
        await loadStats();
      } catch (error) {
        console.error('Failed to preload resources:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [isAvailable, loadStats]
  );

  // Update service worker
  const handleUpdateServiceWorker = useCallback(async () => {
    if (!isAvailable) return;

    setIsLoading(true);
    try {
      await updateServiceWorker();
    } catch (error) {
      console.error('Failed to update service worker:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    cacheStats,
    isAvailable,
    isLoading,
    clearApiCache: handleClearApiCache,
    clearAllCaches: handleClearAllCaches,
    preloadResources: handlePreloadResources,
    updateServiceWorker: handleUpdateServiceWorker,
    refreshStats: loadStats,
  };
}
