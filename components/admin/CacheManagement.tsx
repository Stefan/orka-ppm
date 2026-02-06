/**
 * Cache Management Component
 * Admin interface for managing service worker caches
 */

'use client';

import { useCacheManager } from '@/hooks/useCacheManager';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

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
      <Card padding="md" border className="bg-warning-50 border-warning-200">
        <p className="text-sm text-warning-800">
          Service Worker caching is not available in this browser or context.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card padding="md" border>
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">
          Cache Statistics
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card padding="md" className="bg-primary-50">
            <p className="text-sm text-neutral-600">API Cache</p>
            <p className="text-2xl font-bold text-primary-600">
              {cacheStats.apiCacheSize}
            </p>
            <p className="text-xs text-neutral-500">cached requests</p>
          </Card>
          
          <Card padding="md" className="bg-success-50">
            <p className="text-sm text-neutral-600">Static Assets</p>
            <p className="text-2xl font-bold text-success-600">
              {cacheStats.staticCacheSize}
            </p>
            <p className="text-xs text-neutral-500">cached files</p>
          </Card>
          
          <Card padding="md" className="bg-purple-50">
            <p className="text-sm text-neutral-600">Images</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {cacheStats.imageCacheSize}
            </p>
            <p className="text-xs text-neutral-500">cached images</p>
          </Card>
          
          <Card padding="md" className="bg-neutral-50">
            <p className="text-sm text-neutral-600">Total</p>
            <p className="text-2xl font-bold text-neutral-900">
              {cacheStats.totalSize}
            </p>
            <p className="text-xs text-neutral-500">total cached items</p>
          </Card>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={refreshStats}
            disabled={isLoading}
            variant="secondary"
            size="sm"
          >
            {isLoading ? 'Loading...' : 'Refresh Stats'}
          </Button>
          
          <Button
            onClick={clearApiCache}
            disabled={isLoading}
            variant="primary"
            size="sm"
          >
            Clear API Cache
          </Button>
          
          <Button
            onClick={clearAllCaches}
            disabled={isLoading}
            variant="primary"
            size="sm"
            className="bg-error-600 hover:bg-error-700"
          >
            Clear All Caches
          </Button>
        </div>
      </Card>

      <Card padding="md" border className="bg-primary-50 border-primary-200">
        <h4 className="text-sm font-semibold text-primary-900 mb-2">
          Cache Strategy
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• API requests: Network-first with 5-minute cache</li>
          <li>• Static assets: Cache-first for instant loading</li>
          <li>• Images: Cache-first with 30-day expiration</li>
          <li>• Fonts: Cache-first with 1-year expiration</li>
        </ul>
      </Card>
    </div>
  );
}
