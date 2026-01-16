# Resource Preloading Guide

## Overview

Resource preloading is a performance optimization technique that tells the browser to fetch critical resources early, before they're actually needed. This reduces load times and improves user experience.

## What Gets Preloaded

### Automatic Preloading (Next.js)

Next.js automatically handles:
- **Fonts**: Via `next/font/google` with automatic optimization
- **CSS**: Critical CSS is inlined, rest is code-split
- **JavaScript**: Code splitting and automatic chunk preloading
- **Images**: Via `next/image` with automatic optimization

### Manual Preloading (Our Implementation)

We manually preload:
- **API Server**: Preconnect to `https://orka-ppm.onrender.com`
- **Supabase**: DNS prefetch for faster connection
- **Critical Icons**: `/icon.svg` and `/apple-touch-icon.png`

## Using the Resource Preloader

### Preload Images

```typescript
import { preloadImage } from '@/lib/utils/resource-preloader'

// Preload a critical image
preloadImage('/hero-banner.jpg', 'image/jpeg')

// Preload an SVG icon
preloadImage('/logo.svg', 'image/svg+xml')
```

### Preload Fonts

```typescript
import { preloadFont } from '@/lib/utils/resource-preloader'

// Preload a custom font
preloadFont('/fonts/custom-font.woff2', 'font/woff2')
```

### Prefetch API Data

```typescript
import { prefetchData } from '@/lib/utils/resource-preloader'

// Prefetch data for faster navigation
prefetchData('/api/dashboard/quick-stats')
prefetchData('/api/resources')
```

### Preload Page Resources

```typescript
import { preloadPageResources } from '@/lib/utils/resource-preloader'

// Preload all resources for a specific page
preloadPageResources('dashboard')
preloadPageResources('resources')
preloadPageResources('risks')
preloadPageResources('scenarios')
```

### Preconnect to External Domains

```typescript
import { preconnectDomain, dnsPrefetch } from '@/lib/utils/resource-preloader'

// Preconnect to an external API
preconnectDomain('https://api.example.com', true)

// DNS prefetch for faster connection
dnsPrefetch('https://cdn.example.com')
```

## React Hook Usage

```typescript
import { useResourcePreloader } from '@/lib/utils/resource-preloader'

function MyComponent() {
  const { prefetchData, preloadImage } = useResourcePreloader()
  
  useEffect(() => {
    // Prefetch data when component mounts
    prefetchData('/api/my-data')
    
    // Preload critical images
    preloadImage('/critical-image.jpg')
  }, [])
  
  return <div>...</div>
}
```

## Resource Hints Explained

### Preconnect

Establishes early connection to external domains:
```html
<link rel="preconnect" href="https://api.example.com" crossorigin>
```

**Use for:**
- API servers
- CDNs
- External services you'll definitely use

**Impact:** Saves ~100-500ms on first request

### DNS Prefetch

Resolves DNS early:
```html
<link rel="dns-prefetch" href="https://cdn.example.com">
```

**Use for:**
- External resources you might use
- Third-party services
- Analytics domains

**Impact:** Saves ~20-120ms on first request

### Preload

Fetches resources early:
```html
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>
```

**Use for:**
- Critical fonts
- Above-the-fold images
- Critical CSS/JS

**Impact:** Saves ~100-300ms on resource load

### Prefetch

Fetches resources for future navigation:
```html
<link rel="prefetch" href="/next-page-data.json">
```

**Use for:**
- Next page data
- Likely navigation targets
- Background resources

**Impact:** Instant navigation when prefetched

## Best Practices

### 1. Prioritize Critical Resources

Only preload resources that are:
- Above the fold
- Needed for initial render
- Critical for user interaction

### 2. Don't Over-Preload

Too many preload hints can:
- Waste bandwidth
- Delay other resources
- Hurt performance

**Rule of thumb:** Preload ≤5 resources per page

### 3. Use Appropriate Hints

- **Preconnect**: For domains you'll definitely use
- **DNS Prefetch**: For domains you might use
- **Preload**: For critical resources
- **Prefetch**: For future navigation

### 4. Monitor Performance

Use Lighthouse to verify:
- Preload hints are working
- No wasted preloads
- LCP improvements

## Performance Impact

### Before Optimization
- LCP: 3076-4429ms
- No resource preloading
- Sequential resource loading

### After Optimization
- Target LCP: ≤2500ms
- Critical resources preloaded
- Parallel resource loading
- Faster API connections

## Common Patterns

### Dashboard Page

```typescript
// Preload dashboard resources on app mount
useEffect(() => {
  preloadPageResources('dashboard')
}, [])
```

### Navigation Prefetch

```typescript
// Prefetch next page data on hover
<Link 
  href="/resources"
  onMouseEnter={() => prefetchData('/api/resources')}
>
  Resources
</Link>
```

### Conditional Preloading

```typescript
// Only preload if user is likely to navigate
if (userRole === 'admin') {
  preloadPageResources('admin')
}
```

## Troubleshooting

### Preload Not Working

1. Check browser DevTools → Network tab
2. Look for "Initiator" column showing "preload"
3. Verify resource is fetched early

### Too Many Preloads

1. Run Lighthouse audit
2. Check for "Preload key requests" warning
3. Remove non-critical preloads

### CORS Errors

Add `crossOrigin="anonymous"` for:
- Fonts
- External images
- API requests

```typescript
preloadFont('/font.woff2', 'font/woff2')
// Automatically adds crossOrigin="anonymous"
```

## Testing

### Manual Testing

1. Open Chrome DevTools → Network tab
2. Reload page
3. Check "Initiator" column for preloaded resources
4. Verify resources load early

### Lighthouse Audit

```bash
npm run lighthouse
```

Check for:
- "Preload key requests" (should be green)
- "Eliminate render-blocking resources" (should be green)
- LCP ≤2500ms

### Performance Monitoring

```typescript
// Log preload performance
performance.getEntriesByType('resource')
  .filter(entry => entry.initiatorType === 'link')
  .forEach(entry => {
    console.log(`Preloaded: ${entry.name} in ${entry.duration}ms`)
  })
```

## Resources

- [MDN: Preloading Content](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload)
- [Web.dev: Resource Hints](https://web.dev/preconnect-and-dns-prefetch/)
- [Next.js: Font Optimization](https://nextjs.org/docs/basic-features/font-optimization)
