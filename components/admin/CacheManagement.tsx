/**
 * Cache Management Component
 * Admin interface for managing service worker caches
 */

'use client';

import { useCacheManager } from '@/hooks/useCacheManager';

export function CacheManagement() {
  const {
    cacheStats,
    isAvailable,
    isLoading,
    clearApiCache,
    clearAllCaches,
    refreshStats,
  } = useCacheManager();

  if (!isAvailable) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">
          Service Worker caching is not available in this browser or context.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Cache Statistics
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-sm text-gray-600">API Cache</p>
            <p className="text-2xl font-bold text-blue-600">
              {cacheStats.apiCacheSize}
            </p>
            <p className="text-xs text-gray-500">cached requests</p>
          </div>
          
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-sm text-gray-600">Static Assets</p>
            <p className="text-2xl font-bold text-green-600">
              {cacheStats.staticCacheSize}
            </p>
            <p className="text-xs text-gray-500">cached files</p>
          </div>
          
          <div className="rounded-lg bg-purple-50 p-4">
            <p className="text-sm text-gray-600">Images</p>
            <p className="text-2xl font-bold text-purple-600">
              {cacheStats.imageCacheSize}
            </p>
            <p className="text-xs text-gray-500">cached images</p>
          </div>
          
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">
              {cacheStats.totalSize}
            </p>
            <p className="text-xs text-gray-500">total cached items</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={refreshStats}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh Stats'}
          </button>
          
          <button
            onClick={clearApiCache}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Clear API Cache
          </button>
          
          <button
            onClick={clearAllCaches}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Clear All Caches
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          Cache Strategy
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• API requests: Network-first with 5-minute cache</li>
          <li>• Static assets: Cache-first for instant loading</li>
          <li>• Images: Cache-first with 30-day expiration</li>
          <li>• Fonts: Cache-first with 1-year expiration</li>
        </ul>
      </div>
    </div>
  );
}
