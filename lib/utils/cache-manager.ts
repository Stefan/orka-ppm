/**
 * Cache Manager Utility
 * Provides client-side interface for managing service worker caches
 */

export interface CacheStats {
  apiCacheSize: number;
  staticCacheSize: number;
  imageCacheSize: number;
  totalSize: number;
}

/**
 * Clear API cache through service worker
 */
export async function clearApiCache(): Promise<void> {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_API_CACHE',
    });
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  if (!('caches' in window)) {
    return {
      apiCacheSize: 0,
      staticCacheSize: 0,
      imageCacheSize: 0,
      totalSize: 0,
    };
  }

  const cacheNames = await caches.keys();
  let apiCacheSize = 0;
  let staticCacheSize = 0;
  let imageCacheSize = 0;

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    if (cacheName.includes('api')) {
      apiCacheSize += keys.length;
    } else if (cacheName.includes('image')) {
      imageCacheSize += keys.length;
    } else {
      staticCacheSize += keys.length;
    }
  }

  return {
    apiCacheSize,
    staticCacheSize,
    imageCacheSize,
    totalSize: apiCacheSize + staticCacheSize + imageCacheSize,
  };
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}

/**
 * Preload critical resources into cache
 */
export async function preloadCriticalResources(urls: string[]): Promise<void> {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_URLS',
      payload: urls,
    });
  }
}

/**
 * Check if service worker is active and caching is available
 */
export function isCachingAvailable(): boolean {
  return (
    'serviceWorker' in navigator &&
    'caches' in window &&
    navigator.serviceWorker.controller !== null
  );
}

/**
 * Register service worker update handler
 */
export function registerServiceWorkerUpdateHandler(
  onUpdate: () => void
): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      onUpdate();
    });
  }
}

/**
 * Force service worker update
 */
export async function updateServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
    }
  }
}
