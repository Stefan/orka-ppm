# Service Worker Caching Implementation

## Overview

This document describes the service worker caching implementation for the ORKA-PPM application, which provides offline support and faster load times through intelligent caching strategies.

## Implementation Details

### 1. Workbox Configuration (next.config.ts)

The application uses Workbox (via next-pwa) to implement sophisticated caching strategies:

#### API Caching (Network-First)
- **Pattern**: `/api/*`
- **Strategy**: Network-First with 5-minute cache
- **Cache Name**: `api-cache`
- **Max Entries**: 50
- **Expiration**: 5 minutes
- **Timeout**: 10 seconds

This ensures fresh data while providing offline fallback.

#### Dashboard Data Caching (Network-First)
- **Pattern**: `/api/(dashboards|projects|resources|risks)/*`
- **Cache Name**: `dashboard-data-cache`
- **Max Entries**: 30
- **Expiration**: 5 minutes
- **Timeout**: 10 seconds

Specialized caching for critical dashboard data.

#### Static Assets (Cache-First)

**Images**:
- **Pattern**: `.png|.jpg|.jpeg|.svg|.gif|.webp|.avif|.ico`
- **Cache Name**: `image-cache`
- **Max Entries**: 100
- **Expiration**: 30 days

**Fonts**:
- **Pattern**: `.woff|.woff2|.ttf|.eot|.otf`
- **Cache Name**: `font-cache`
- **Max Entries**: 20
- **Expiration**: 1 year

**CSS/JavaScript**:
- **Pattern**: `.css|.js`
- **Cache Name**: `static-resources`
- **Max Entries**: 60
- **Expiration**: 7 days

**Next.js Static Assets**:
- **Pattern**: `/_next/static/*`
- **Cache Name**: `next-static-cache`
- **Max Entries**: 100
- **Expiration**: 1 year

**Next.js Images**:
- **Pattern**: `/_next/image?*`
- **Cache Name**: `next-image-cache`
- **Max Entries**: 100
- **Expiration**: 30 days

### 2. Custom Service Worker (public/sw.js)

The custom service worker extends Workbox functionality with:

#### Cache Management
- Multiple cache stores for different resource types
- Automatic cleanup of expired cache entries
- Timestamp-based expiration tracking

#### API Request Handling
- Network-first strategy with intelligent fallback
- 5-minute cache expiration for API responses
- Automatic cache timestamp management
- Graceful error handling when offline

#### Static Asset Handling
- Cache-first strategy for instant loading
- Separate caches for images, fonts, and other static resources
- Long-term caching for immutable assets

#### Background Sync
- Offline form submission support
- Automatic retry when connection is restored
- IndexedDB integration for offline data storage

#### Push Notifications
- Push notification support for project updates
- Notification click handling
- Custom notification actions

### 3. Cache Manager Utility (lib/utils/cache-manager.ts)

Client-side utility for managing caches:

```typescript
// Clear API cache
await clearApiCache();

// Get cache statistics
const stats = await getCacheStats();

// Clear all caches
await clearAllCaches();

// Preload critical resources
await preloadCriticalResources(['/api/projects', '/api/dashboards']);

// Check if caching is available
const isAvailable = isCachingAvailable();

// Update service worker
await updateServiceWorker();
```

### 4. React Hook (hooks/useCacheManager.ts)

React hook for easy cache management in components:

```typescript
const {
  cacheStats,
  isAvailable,
  isLoading,
  clearApiCache,
  clearAllCaches,
  preloadResources,
  updateServiceWorker,
  refreshStats,
} = useCacheManager();
```

### 5. Admin Component (components/admin/CacheManagement.tsx)

UI component for cache management:
- Display cache statistics
- Clear API cache
- Clear all caches
- Refresh statistics
- Visual feedback for cache operations

## Benefits

### Performance Improvements
- **Instant Loading**: Static assets load instantly from cache
- **Reduced Network Requests**: Cached resources don't require network calls
- **Faster API Responses**: Cached API responses serve as fallback
- **Reduced Bandwidth**: Less data transferred over network

### Offline Support
- **Offline Navigation**: Core pages work offline
- **Cached API Data**: Previously loaded data available offline
- **Background Sync**: Form submissions queued when offline
- **Graceful Degradation**: Clear error messages when data unavailable

### User Experience
- **Faster Page Loads**: Reduced LCP (Largest Contentful Paint)
- **Smoother Navigation**: Instant page transitions
- **Reliable Performance**: Consistent experience regardless of network
- **Progressive Enhancement**: Works better with service worker, still functional without

## Cache Strategies Explained

### Network-First (API Requests)
1. Try to fetch from network
2. If successful, cache the response and return it
3. If network fails, serve from cache
4. If no cache, return error

**Best for**: Dynamic data that changes frequently but needs offline fallback

### Cache-First (Static Assets)
1. Check cache first
2. If found in cache, return immediately
3. If not in cache, fetch from network
4. Cache the response for future use

**Best for**: Static resources that rarely change (images, fonts, CSS, JS)

## Monitoring and Debugging

### Check Service Worker Status
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg);
});
```

### View Caches
```javascript
caches.keys().then(names => {
  console.log('Cache names:', names);
});
```

### Clear Specific Cache
```javascript
caches.delete('api-cache');
```

### View Cache Contents
```javascript
caches.open('api-cache').then(cache => {
  cache.keys().then(keys => {
    console.log('Cached requests:', keys);
  });
});
```

## Testing

### Test Offline Functionality
1. Open DevTools → Application → Service Workers
2. Check "Offline" checkbox
3. Navigate the application
4. Verify cached pages and data load correctly

### Test Cache Expiration
1. Load a page with API data
2. Wait 5+ minutes
3. Go offline
4. Refresh the page
5. Verify expired cache is not served

### Test Cache-First Strategy
1. Load a page with images
2. Open DevTools → Network
3. Refresh the page
4. Verify images load from service worker (not network)

## Configuration

### Adjust Cache Expiration
Edit `next.config.ts`:
```typescript
expiration: {
  maxAgeSeconds: 10 * 60, // 10 minutes instead of 5
}
```

### Adjust Cache Size
Edit `next.config.ts`:
```typescript
expiration: {
  maxEntries: 100, // Increase from 50
}
```

### Add New Cache Pattern
Edit `next.config.ts`:
```typescript
{
  urlPattern: /^https?:\/\/.*\/custom-api\/.*/i,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'custom-cache',
    expiration: {
      maxEntries: 20,
      maxAgeSeconds: 5 * 60,
    },
  },
}
```

## Troubleshooting

### Service Worker Not Updating
1. Unregister old service worker
2. Clear all caches
3. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
4. Verify new service worker is active

### Cache Not Working
1. Check if service worker is registered
2. Verify HTTPS (required for service workers)
3. Check browser console for errors
4. Verify cache patterns match your URLs

### Stale Data Being Served
1. Clear API cache using cache manager
2. Verify cache expiration is set correctly
3. Check timestamp-based expiration logic
4. Force service worker update

## Future Enhancements

- [ ] Add cache versioning for better updates
- [ ] Implement cache warming on app load
- [ ] Add cache analytics and monitoring
- [ ] Implement selective cache invalidation
- [ ] Add cache compression for larger payloads
- [ ] Implement cache prioritization
- [ ] Add cache preloading based on user behavior
