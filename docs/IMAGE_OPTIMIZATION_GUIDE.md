# Image Optimization Guide

## Overview

This guide explains how to use optimized images in the Orka PPM application to achieve better performance and faster load times.

## Image Formats

### Supported Formats (in order of preference)

1. **AVIF** - Best compression, modern browsers
2. **WebP** - Good compression, wide browser support
3. **SVG** - Vector graphics, perfect for icons and logos
4. **PNG** - Lossless, good for small icons (already optimized)

### Current Image Inventory

- **Icons**: All SVG format (optimal, no conversion needed)
- **Apple Touch Icon**: PNG format (180x180, already optimized at 0.67KB)
- **Favicons**: SVG format (optimal)

## Using OptimizedImage Component

### Basic Usage

```tsx
import { OptimizedImage } from '@/components/ui/OptimizedImage'

// Above-the-fold image (visible on initial load)
<OptimizedImage
  src="/hero-image.jpg"
  alt="Hero banner"
  width={1200}
  height={600}
  aboveTheFold={true}
/>

// Below-the-fold image (lazy loaded)
<OptimizedImage
  src="/product-image.jpg"
  alt="Product showcase"
  width={800}
  height={600}
  aboveTheFold={false}
/>
```

### Avatar Images

```tsx
import { OptimizedAvatar } from '@/components/ui/OptimizedImage'

<OptimizedAvatar
  src="/user-avatar.jpg"
  alt="User profile"
  size={40}
  aboveTheFold={false}
/>
```

### Logo Images

```tsx
import { OptimizedLogo } from '@/components/ui/OptimizedImage'

<OptimizedLogo
  src="/company-logo.png"
  alt="Company logo"
  width={200}
  height={50}
  priority={true}
/>
```

## Priority Loading Rules

### When to use `aboveTheFold={true}` or `priority={true}`

✅ **Use priority loading for:**
- Hero images
- Logo in header
- First product image
- Any image visible without scrolling
- Critical UI elements

❌ **Don't use priority loading for:**
- Images below the fold
- Carousel images (except first)
- Modal images
- Lazy-loaded content
- Background images

## Next.js Image Configuration

Our `next.config.ts` is configured with:

```typescript
images: {
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 60,
  unoptimized: false,
}
```

This automatically:
- Converts images to AVIF/WebP
- Generates responsive sizes
- Caches optimized images
- Serves optimal format per browser

## Performance Impact

### Before Optimization
- LCP: 3076-4429ms
- Large PNG images
- No priority loading

### After Optimization
- Target LCP: ≤2500ms
- AVIF/WebP formats (30-50% smaller)
- Priority loading for critical images
- Lazy loading for below-fold images

## Best Practices

### 1. Always Specify Dimensions

```tsx
// ✅ Good - prevents layout shift
<OptimizedImage src="/image.jpg" width={800} height={600} alt="..." />

// ❌ Bad - causes layout shift
<OptimizedImage src="/image.jpg" alt="..." />
```

### 2. Use Descriptive Alt Text

```tsx
// ✅ Good
<OptimizedImage src="/chart.png" alt="Budget variance chart showing 15% increase" />

// ❌ Bad
<OptimizedImage src="/chart.png" alt="chart" />
```

### 3. Optimize Source Images

Before adding images to the project:
- Resize to maximum needed dimensions
- Compress with tools like ImageOptim or Squoosh
- Use appropriate format (SVG for icons, JPG for photos)

### 4. Use SVG for Icons

```tsx
// ✅ Good - SVG scales perfectly
import { Icon } from 'lucide-react'
<Icon className="h-6 w-6" />

// ❌ Avoid - PNG icons don't scale well
<OptimizedImage src="/icon.png" width={24} height={24} />
```

## Testing Image Optimization

### Lighthouse Audit

```bash
npm run lighthouse
```

Check for:
- LCP ≤2500ms
- Properly sized images
- Next-gen formats (AVIF/WebP)
- Lazy loading implemented

### Manual Testing

1. Open Chrome DevTools → Network tab
2. Filter by "Img"
3. Verify:
   - Images are WebP/AVIF format
   - Above-fold images load first
   - Below-fold images lazy load
   - Proper dimensions (no oversized images)

## Troubleshooting

### Images Not Converting to WebP/AVIF

Check that `sharp` is installed:
```bash
npm list sharp
```

If missing:
```bash
npm install sharp
```

### Images Loading Slowly

1. Check image file size (should be <100KB for most images)
2. Verify `priority` prop is used for above-fold images
3. Ensure `loading="lazy"` for below-fold images
4. Check network throttling in DevTools

### Layout Shift Issues

Always specify `width` and `height`:
```tsx
<OptimizedImage
  src="/image.jpg"
  width={800}
  height={600}
  alt="..."
/>
```

## Resources

- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)
- [Web.dev Image Optimization](https://web.dev/fast/#optimize-your-images)
- [Lighthouse Performance Scoring](https://web.dev/performance-scoring/)
