# Dynamic Imports Implementation

## Overview

This document describes the implementation of dynamic imports (code splitting) to reduce initial bundle size and improve performance.

## Implementation Strategy

### 1. Centralized Lazy Loading

Created `components/lazy-components.ts` as a central location for all dynamically imported components. This provides:

- **Consistent loading states** across all lazy-loaded components
- **Better maintainability** - all dynamic imports in one place
- **Type safety** with TypeScript
- **SSR control** - disable SSR for components that don't need it

### 2. Component Categories for Lazy Loading

#### Chart Components (~400 KB total)
- `LazyMobileOptimizedChart` - Mobile-optimized charts
- `LazyInteractiveChart` - Interactive chart components
- `LazyRealTimeChart` - Real-time data visualization
- `LazyPMRChart` - PMR-specific charts

**Why**: Recharts library is heavy (~200-400 KB). Charts are often below the fold and don't need immediate loading.

#### PMR Editor (~500 KB with extensions)
- `LazyPMREditor` - Rich text editor with TipTap

**Why**: TipTap with all extensions is ~500 KB. Only needed on PMR pages.

#### AI Components (~300 KB)
- `LazyAIResourceOptimizer` - AI resource optimization
- `LazyAIRiskManagement` - AI risk analysis
- `LazyPredictiveAnalyticsDashboard` - Predictive analytics
- `LazyFloatingAIAssistant` - AI assistant widget

**Why**: AI components contain heavy logic and are feature-specific.

#### PMR Collaboration (~200 KB)
- `LazyAIInsightsPanel` - AI insights panel
- `LazyCollaborationPanel` - Real-time collaboration
- `LazyMonteCarloAnalysisComponent` - Monte Carlo analysis

**Why**: Collaboration features are only used on specific pages.

#### Other Heavy Components
- `LazyMonteCarloVisualization` - Monte Carlo simulations
- `LazyAdaptiveDashboard` - Adaptive dashboard UI
- `LazyHelpChat` - Help chat with markdown rendering
- `LazyDeviceManager` - Device management
- `LazyOfflineSyncStatus` - Offline sync features

### 3. Webpack Bundle Splitting Configuration

Updated `next.config.ts` with optimized `splitChunks` configuration:

```typescript
splitChunks: {
  chunks: 'all',
  cacheGroups: {
    react: {
      // React + React-DOM in separate chunk
      priority: 40,
      name: 'react-vendor'
    },
    charts: {
      // Recharts + D3 in separate chunk
      priority: 30,
      name: 'charts-vendor'
    },
    editor: {
      // TipTap editor in separate chunk
      priority: 30,
      name: 'editor-vendor'
    },
    supabase: {
      // Supabase client in separate chunk
      priority: 25,
      name: 'supabase-vendor'
    },
    icons: {
      // Lucide icons in separate chunk
      priority: 20,
      name: 'icons-vendor'
    },
    vendor: {
      // Other vendor libraries
      priority: 10,
      name: 'vendor'
    },
    common: {
      // Common code shared across pages
      minChunks: 2,
      priority: 5
    }
  }
}
```

## Usage Guide

### How to Use Lazy Components

Instead of:
```typescript
import MobileOptimizedChart from './charts/MobileOptimizedChart'
```

Use:
```typescript
import { LazyMobileOptimizedChart } from './lazy-components'

// In your component:
<LazyMobileOptimizedChart {...props} />
```

### When to Use Dynamic Imports

✅ **DO use dynamic imports for:**
- Heavy chart libraries (recharts, d3)
- Rich text editors (TipTap)
- Below-the-fold components
- Feature-specific components (AI, collaboration)
- Components with heavy dependencies
- Components that don't need SSR

❌ **DON'T use dynamic imports for:**
- Critical above-the-fold content
- Small components (<10 KB)
- Components needed for initial render
- Layout components
- Navigation components

### Loading States

All lazy components use a consistent loading fallback:

```typescript
const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)
```

You can customize loading states per component if needed:

```typescript
export const LazyCustomComponent = dynamic(
  () => import('./CustomComponent'),
  {
    loading: () => <CustomLoadingState />,
    ssr: false
  }
)
```

## Migration Guide

### Step 1: Identify Heavy Components

Run bundle analyzer to identify large components:
```bash
ANALYZE=true npm run build -- --webpack
```

Open `.next/analyze/client.html` to see bundle composition.

### Step 2: Add to lazy-components.ts

Add new lazy component:
```typescript
export const LazyYourComponent = dynamic(
  () => import('./path/to/YourComponent'),
  {
    loading: () => <LoadingFallback />,
    ssr: false // Set to true if SSR is needed
  }
)
```

### Step 3: Update Imports

Replace direct imports with lazy imports in pages:

**Before:**
```typescript
import YourComponent from '@/components/YourComponent'
```

**After:**
```typescript
import { LazyYourComponent } from '@/components/lazy-components'
```

### Step 4: Test

1. Build the application: `npm run build`
2. Check bundle sizes in build output
3. Test loading states work correctly
4. Verify functionality is unchanged

## Performance Impact

### Before Dynamic Imports
- Total JavaScript: 3.25 MB
- Largest chunk: 1079.48 KB
- Initial load: All components loaded upfront

### After Dynamic Imports (Expected)
- Total JavaScript: 3.25 MB (same total, better split)
- Largest chunk: ~600-700 KB (reduced by ~40%)
- Initial load: Only critical components
- Lazy chunks: Loaded on-demand

### Expected Improvements

1. **Faster Initial Load**
   - Reduced initial bundle by ~500-800 KB
   - Faster Time to Interactive (TTI)
   - Better First Contentful Paint (FCP)

2. **Better Caching**
   - Vendor chunks cached separately
   - Feature chunks only loaded when needed
   - Better cache hit rates on updates

3. **Improved User Experience**
   - Faster page transitions
   - Progressive loading
   - Better perceived performance

## Monitoring

### Bundle Size Monitoring

Check bundle sizes after each build:
```bash
npm run build
```

Look for:
- Individual chunk sizes
- Total bundle size
- Chunk distribution

### Runtime Monitoring

Monitor in production:
- Chunk load times
- Failed chunk loads
- Cache hit rates

Use Vercel Analytics or similar tools to track:
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)

## Best Practices

1. **Group Related Components**
   - Keep related features in same chunk
   - Avoid over-splitting (too many small chunks)

2. **Prioritize Critical Path**
   - Load critical components first
   - Defer non-critical features

3. **Use Prefetching**
   - Prefetch likely-needed chunks
   - Use `<link rel="prefetch">` for next pages

4. **Monitor Performance**
   - Track bundle sizes over time
   - Monitor loading performance
   - Adjust strategy based on data

5. **Test Thoroughly**
   - Test loading states
   - Test error boundaries
   - Test on slow connections

## Troubleshooting

### Issue: Component Not Loading

**Symptoms**: Loading spinner never disappears

**Solutions**:
1. Check import path is correct
2. Verify component exports correctly
3. Check browser console for errors
4. Ensure component doesn't have circular dependencies

### Issue: Hydration Mismatch

**Symptoms**: React hydration errors

**Solutions**:
1. Set `ssr: false` for client-only components
2. Use `useEffect` for client-side only code
3. Ensure loading state matches SSR output

### Issue: Large Bundle Size

**Symptoms**: Chunks still too large

**Solutions**:
1. Check for duplicate dependencies
2. Review webpack bundle analyzer
3. Consider further code splitting
4. Remove unused dependencies

## Future Improvements

1. **Route-Based Code Splitting**
   - Implement per-route bundles
   - Prefetch next likely routes

2. **Component-Level Splitting**
   - Split large components into smaller chunks
   - Lazy load component features

3. **Intelligent Prefetching**
   - Predict user navigation
   - Prefetch based on user behavior

4. **Progressive Enhancement**
   - Load basic features first
   - Enhance with advanced features

## References

- [Next.js Dynamic Imports](https://nextjs.org/docs/advanced-features/dynamic-import)
- [Webpack Code Splitting](https://webpack.js.org/guides/code-splitting/)
- [Web.dev Code Splitting Guide](https://web.dev/reduce-javascript-payloads-with-code-splitting/)
