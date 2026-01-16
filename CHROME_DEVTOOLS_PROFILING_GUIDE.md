# Chrome DevTools Performance Profiling Guide

This guide will help you manually profile your application using Chrome DevTools to identify LCP bottlenecks.

---

## Quick Start (5 Minutes)

### Step 1: Build Production Version

```bash
# Build the production version
npm run build

# Start the production server
npm run start
```

Wait for the server to start (you should see "ready on http://localhost:3000")

### Step 2: Open Chrome DevTools

1. Open Chrome browser
2. Navigate to `http://localhost:3000`
3. Press **F12** (Windows/Linux) or **Cmd+Option+I** (Mac)
4. Click on the **Performance** tab

### Step 3: Record Performance Profile

1. Click the **Record** button (⚫ circle icon) or press **Cmd+E** (Mac) / **Ctrl+E** (Windows)
2. **Refresh the page** (Cmd+R / Ctrl+R) to capture the full page load
3. Wait for the page to fully load (3-5 seconds)
4. Click the **Stop** button (⏹ square icon) or press **Cmd+E** / **Ctrl+E** again

### Step 4: Analyze the Results

Chrome DevTools will show you a detailed performance timeline. Look for:

#### 🎯 LCP (Largest Contentful Paint)
- Look for the **LCP** marker in the timeline (blue flag)
- Click on it to see which element is the LCP
- Check the timing: when did it start loading vs when did it render?

#### 🔴 Long Tasks (Total Blocking Time)
- Red bars in the timeline indicate long tasks (>50ms)
- These contribute to TBT and slow down interactivity
- Click on them to see what JavaScript is running

#### 📦 Network Waterfall
- Scroll down to the **Network** section
- Look for render-blocking resources (CSS, JS)
- Check if resources are loading in parallel or sequentially

#### 🎨 Rendering
- Look for **Layout** and **Paint** events
- Check for layout thrashing (multiple layouts in quick succession)
- Identify expensive paint operations

---

## Detailed Analysis

### Finding the LCP Element

1. In the Performance timeline, find the **LCP** marker (blue flag with "LCP" text)
2. Click on it to highlight the LCP element
3. The element will be shown in the **Summary** panel at the bottom
4. Note:
   - What type of element is it? (image, text, div, etc.)
   - When did it start loading?
   - When did it finish rendering?
   - What blocked it from rendering earlier?

### Identifying Render-Blocking Resources

1. Look at the **Network** section in the timeline
2. Find resources that:
   - Load early in the page load
   - Have a long duration
   - Block other resources from loading
3. Common culprits:
   - CSS files (especially large ones)
   - JavaScript files loaded in `<head>` without `async`/`defer`
   - Web fonts

### Analyzing JavaScript Execution

1. Look at the **Main** thread in the timeline
2. Find long yellow bars (JavaScript execution)
3. Click on them to see the call stack
4. Look for:
   - Long-running functions (>50ms)
   - Repeated function calls
   - Expensive operations (DOM manipulation, calculations)

### Checking Layout and Paint

1. Look for purple bars (Layout) and green bars (Paint)
2. Multiple layouts in quick succession = layout thrashing
3. Large paint areas = expensive rendering
4. Click on events to see details

---

## Common LCP Issues & Solutions

### Issue 1: LCP Element is an Image

**Symptoms:**
- LCP marker points to an `<img>` element
- Image loads late in the waterfall
- Large image file size

**Solutions:**
```typescript
// Use Next.js Image with priority
import Image from 'next/image'

<Image
  src="/hero-image.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority // This preloads the image
  placeholder="blur" // Shows blur while loading
/>
```

### Issue 2: LCP Element is Text Blocked by Fonts

**Symptoms:**
- LCP marker points to text element
- Text appears late due to font loading
- FOIT (Flash of Invisible Text) or FOUT (Flash of Unstyled Text)

**Solutions:**
```html
<!-- Preload critical fonts -->
<link
  rel="preload"
  href="/fonts/inter-var.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>

<!-- Use font-display: swap -->
<style>
  @font-face {
    font-family: 'Inter';
    src: url('/fonts/inter-var.woff2') format('woff2');
    font-display: swap; /* Show fallback font immediately */
  }
</style>
```

### Issue 3: LCP Element Blocked by CSS

**Symptoms:**
- LCP element exists in HTML but doesn't render
- CSS files loading slowly
- Render-blocking stylesheets

**Solutions:**
```html
<!-- Inline critical CSS -->
<style>
  /* Critical above-the-fold styles */
  .hero { display: flex; min-height: 100vh; }
  .hero-title { font-size: 3rem; font-weight: bold; }
</style>

<!-- Defer non-critical CSS -->
<link
  rel="preload"
  href="/styles/non-critical.css"
  as="style"
  onload="this.onload=null;this.rel='stylesheet'"
/>
```

### Issue 4: LCP Element Blocked by JavaScript

**Symptoms:**
- LCP element rendered by JavaScript
- Long JavaScript execution before render
- Large JavaScript bundles

**Solutions:**
```typescript
// Use dynamic imports
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false // Don't render on server if not needed
})

// Defer non-critical scripts
<script src="/analytics.js" defer></script>
```

### Issue 5: Slow Server Response (TTFB)

**Symptoms:**
- Long wait time before first byte
- Server processing taking too long
- Database queries blocking response

**Solutions:**
- Implement caching (Redis, CDN)
- Optimize database queries
- Use static generation where possible
- Implement streaming SSR

---

## Automated Profiling Script

We've also created an automated profiling script that you can run:

```bash
# Run automated profiling
node scripts/chrome-devtools-profiling.js
```

This will:
1. Profile all critical pages (home, dashboards, resources, risks)
2. Capture performance traces
3. Measure Web Vitals (LCP, FCP, CLS, TBT)
4. Identify LCP elements
5. Analyze resource loading
6. Generate a detailed report

**Output:**
- `performance-profiles/trace-*.json` - Chrome DevTools trace files
- `performance-profiles/performance-report.md` - Detailed analysis report

You can then load the trace files in Chrome DevTools for manual inspection:
1. Open Chrome DevTools → Performance tab
2. Click "Load profile" button (⬆️ icon)
3. Select a trace file from `performance-profiles/`

---

## Interpreting the Timeline

### Timeline Sections

```
┌─────────────────────────────────────────────────────────────┐
│ FPS (Frames Per Second)                                     │ Green = good, Red = dropped frames
├─────────────────────────────────────────────────────────────┤
│ CPU (Main Thread Activity)                                  │ Yellow = JS, Purple = Layout, Green = Paint
├─────────────────────────────────────────────────────────────┤
│ NET (Network Requests)                                       │ Waterfall of resource loading
├─────────────────────────────────────────────────────────────┤
│ Main (Main Thread)                                          │ Detailed view of JavaScript execution
├─────────────────────────────────────────────────────────────┤
│ Raster (Rasterization)                                      │ Converting vectors to pixels
├─────────────────────────────────────────────────────────────┤
│ GPU (GPU Activity)                                          │ Hardware acceleration
└─────────────────────────────────────────────────────────────┘
```

### Key Markers

- **FCP** (First Contentful Paint) - First text/image rendered
- **LCP** (Largest Contentful Paint) - Largest element rendered
- **DCL** (DOMContentLoaded) - HTML parsed, DOM ready
- **L** (Load) - All resources loaded

### Color Coding

- **Yellow** - JavaScript execution
- **Purple** - Layout (reflow)
- **Green** - Paint (rendering)
- **Blue** - HTML parsing
- **Red** - Long tasks (>50ms)

---

## Performance Checklist

Use this checklist while analyzing the profile:

### LCP Optimization
- [ ] LCP element identified
- [ ] LCP element loads early (not blocked by other resources)
- [ ] LCP element has priority loading (if image)
- [ ] No render-blocking CSS delaying LCP
- [ ] No JavaScript blocking LCP element render
- [ ] Server response time is fast (<200ms TTFB)

### JavaScript Optimization
- [ ] No long tasks (>50ms) during page load
- [ ] JavaScript bundles are code-split
- [ ] Heavy components are lazy-loaded
- [ ] Third-party scripts are deferred
- [ ] Unused JavaScript is removed

### CSS Optimization
- [ ] Critical CSS is inlined
- [ ] Non-critical CSS is deferred
- [ ] No unused CSS rules
- [ ] CSS files are minified and compressed

### Resource Loading
- [ ] Critical resources are preloaded
- [ ] Fonts are preloaded with font-display: swap
- [ ] Images use appropriate formats (WebP/AVIF)
- [ ] Resources load in parallel (not sequentially)
- [ ] CDN is used for static assets

### Rendering
- [ ] No layout thrashing (multiple layouts)
- [ ] Paint operations are efficient
- [ ] No forced synchronous layouts
- [ ] Hardware acceleration is used where appropriate

---

## Next Steps After Profiling

1. **Identify the top 3 bottlenecks** from your profile
2. **Prioritize fixes** based on impact (use the LCP Deep Dive Analysis)
3. **Implement fixes** one at a time
4. **Re-profile** after each fix to validate improvement
5. **Iterate** until LCP ≤2500ms

---

## Troubleshooting

### "Nothing happens when I click Record"
- Make sure you're on the Performance tab (not Console or Network)
- Try refreshing DevTools (close and reopen)
- Check if Chrome is up to date

### "Profile is too large to analyze"
- Record for a shorter duration (3-5 seconds max)
- Disable screenshots in settings (⚙️ icon)
- Close other tabs to free up memory

### "Can't find LCP marker"
- LCP might not have occurred yet (page still loading)
- Try recording for longer (5-10 seconds)
- Check if page has any content (LCP requires visible content)

### "Trace file won't load"
- File might be corrupted
- Try re-recording the profile
- Check file size (should be <100MB)

---

## Resources

- [Chrome DevTools Performance Documentation](https://developer.chrome.com/docs/devtools/performance/)
- [Web Vitals Guide](https://web.dev/vitals/)
- [LCP Optimization Guide](https://web.dev/optimize-lcp/)
- [Performance Budgets](https://web.dev/performance-budgets-101/)

---

**Happy Profiling! 🚀**

Remember: The goal is to identify bottlenecks, not to achieve perfection. Focus on the biggest issues first (LCP > 2500ms) and iterate from there.
