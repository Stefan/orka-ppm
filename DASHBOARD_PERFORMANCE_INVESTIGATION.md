# Dashboard Performance Investigation Report

**Date:** January 15, 2026  
**Investigator:** Performance Optimization Team  
**Scope:** Dashboard pages (/dashboards, /resources, /risks)

---

## Executive Summary

After running Lighthouse CI tests and performing deep code profiling, we've identified **6 high-severity and 5 medium-severity performance bottlenecks** causing LCP values to exceed 4 seconds on dashboard pages.

### Key Findings

1. **No Component Memoization** - 5 heavy components re-render unnecessarily
2. **No Code Splitting** - All JavaScript loads upfront (~850KB of heavy dependencies)
3. **Excessive State Variables** - 11 useState calls causing frequent re-renders
4. **Heavy Dependencies** - Recharts (~400KB), TipTap (~200KB), and others not lazy-loaded

### Impact on Metrics

| Issue | Impact on LCP | Impact on TBT |
|-------|---------------|---------------|
| No memoization | +200-400ms | +30-50ms |
| No code splitting | +500-800ms | +100-150ms |
| Heavy dependencies | +300-500ms | +50-80ms |
| Excessive re-renders | +100-200ms | +40-60ms |
| **Total Estimated** | **+1,100-1,900ms** | **+220-340ms** |

---

## Detailed Analysis

### 1. Component Optimization Issues (HIGH SEVERITY)

#### Problem
Five critical components are not wrapped with `React.memo`, causing them to re-render on every parent state change:

1. **VarianceKPIs** - Displays budget variance metrics
2. **VarianceTrends** - Renders trend charts (uses Recharts)
3. **VarianceAlerts** - Shows budget alerts list
4. **AdaptiveDashboard** - AI-enhanced dashboard layout
5. **VirtualizedProjectList** - Project list with virtual scrolling

#### Impact
- Each parent state change triggers re-renders of all child components
- With 11 state variables, this creates a cascade of unnecessary renders
- Recharts re-initialization is particularly expensive (~50-100ms per render)

#### Evidence
```typescript
// Current implementation (app/dashboards/page.tsx)
<VarianceKPIs session={session} selectedCurrency="USD" />
<VarianceTrends session={session} selectedCurrency="USD" />
<VarianceAlerts session={session} onAlertCount={setVarianceAlertCount} />
```

No memoization detected in component definitions.

#### Solution
Wrap components with `React.memo` and add proper prop comparison:

```typescript
export default React.memo(VarianceKPIs, (prevProps, nextProps) => {
  return prevProps.session?.access_token === nextProps.session?.access_token &&
         prevProps.selectedCurrency === nextProps.selectedCurrency;
});
```

**Estimated Impact:** Reduce TBT by 30-50ms, improve perceived performance

---

### 2. Code Splitting Issues (HIGH SEVERITY)

#### Problem
No dynamic imports detected in the dashboard page. All code loads synchronously:

- Recharts library (~400KB) loads even if charts aren't visible
- TipTap editor (~200KB) loads for features not immediately needed
- React-markdown (~100KB) loads upfront
- Html2canvas (~150KB) loads for screenshot features

**Total unnecessary initial load: ~850KB**

#### Impact
- Increases initial bundle size significantly
- Delays Time to Interactive (TTI)
- Directly increases LCP by 500-800ms

#### Evidence
```typescript
// Current implementation
import VarianceKPIs from './components/VarianceKPIs'
import VarianceTrends from './components/VarianceTrends'
import VarianceAlerts from './components/VarianceAlerts'
```

All imports are static, no `next/dynamic` usage.

#### Solution
Use Next.js dynamic imports with loading states:

```typescript
import dynamic from 'next/dynamic';

const VarianceKPIs = dynamic(() => import('./components/VarianceKPIs'), {
  loading: () => <SkeletonCard variant="stat" />,
  ssr: false // Client-side only if not needed for SEO
});

const VarianceTrends = dynamic(() => import('./components/VarianceTrends'), {
  loading: () => <SkeletonChart variant="line" />,
  ssr: false
});
```

**Estimated Impact:** Reduce initial bundle by 200-400KB, improve LCP by 500-800ms

---

### 3. State Management Issues (MEDIUM SEVERITY)

#### Problem
Dashboard uses 11 separate `useState` calls:

```typescript
const [quickStats, setQuickStats] = useState<QuickStats | null>(null)
const [kpis, setKPIs] = useState<KPIs | null>(null)
const [recentProjects, setRecentProjects] = useState<Project[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
const [varianceAlertCount, setVarianceAlertCount] = useState(0)
const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([])
const [dashboardLayout, setDashboardLayout] = useState<'grid' | 'masonry' | 'list'>('grid')
const [showAdaptiveDashboard, setShowAdaptiveDashboard] = useState(false)
```

#### Impact
- Each state update triggers a re-render
- Related state changes cause multiple re-renders
- No `useCallback` for event handlers (0 detected)
- Causes unnecessary re-renders of child components

#### Solution
Consolidate related state using `useReducer`:

```typescript
type DashboardState = {
  data: {
    quickStats: QuickStats | null;
    kpis: KPIs | null;
    recentProjects: Project[];
  };
  ui: {
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
    layout: 'grid' | 'masonry' | 'list';
    showAdaptiveDashboard: boolean;
  };
  widgets: DashboardWidget[];
  varianceAlertCount: number;
};

const [state, dispatch] = useReducer(dashboardReducer, initialState);
```

Add `useCallback` for event handlers:

```typescript
const handleRefresh = useCallback(async () => {
  // refresh logic
}, [session]);

const handleLayoutChange = useCallback((layout) => {
  // layout change logic
}, [preferences]);
```

**Estimated Impact:** Reduce re-renders by 20-30%, improve TBT by 40-60ms

---

### 4. Heavy Dependencies (MEDIUM SEVERITY)

#### Problem
Four heavy dependencies are loaded synchronously:

| Dependency | Size | Usage | Load Strategy |
|------------|------|-------|---------------|
| recharts | ~400KB | Charts | Synchronous |
| @tiptap/react | ~200KB | Rich text | Synchronous |
| react-markdown | ~100KB | Markdown | Synchronous |
| html2canvas | ~150KB | Screenshots | Synchronous |

**Total: ~850KB loaded upfront**

#### Impact
- Increases initial bundle size
- Delays JavaScript parsing and execution
- Contributes to high LCP and TBT

#### Solution
1. **Lazy load Recharts** - Only load when charts are visible
2. **Lazy load TipTap** - Only load when editor is opened
3. **Lazy load react-markdown** - Only load for help content
4. **Lazy load html2canvas** - Only load when screenshot is requested

```typescript
// Lazy load heavy dependencies
const Recharts = dynamic(() => import('recharts'), {
  loading: () => <SkeletonChart />,
  ssr: false
});

const TipTap = dynamic(() => import('@tiptap/react'), {
  loading: () => <div>Loading editor...</div>,
  ssr: false
});
```

**Estimated Impact:** Reduce initial bundle by 400-600KB, improve LCP by 300-500ms

---

### 5. Data Fetching Analysis (OPTIMIZED ✓)

#### Current Implementation
The data fetching strategy is **already well-optimized**:

✅ **Parallel Requests** - Uses `Promise.all` for independent fetches  
✅ **Response Caching** - 30-second TTL cache implemented  
✅ **Request Deduplication** - Prevents duplicate simultaneous requests  
✅ **Progressive Loading** - Critical data loads first, secondary data in background

#### Evidence
```typescript
// lib/api/dashboard-loader.ts
export async function loadDashboardData(
  accessToken: string,
  onCriticalDataLoaded?: (data: { quickStats: QuickStats; kpis: KPIs }) => void,
  onSecondaryDataLoaded?: (projects: Project[]) => void
): Promise<DashboardData> {
  // Load critical data first
  const criticalData = await loadCriticalData(accessToken)
  
  // Notify caller that critical data is ready
  if (onCriticalDataLoaded) {
    onCriticalDataLoaded(criticalData)
  }

  // Load secondary data in background
  const projectsPromise = loadSecondaryData(accessToken)
  // ...
}
```

#### Recommendation
No changes needed for data fetching. This is working as intended.

---

## Root Cause Summary

### Why LCP is High (2,927ms - 4,140ms)

1. **Large Initial Bundle** (500-800ms impact)
   - All JavaScript loads synchronously
   - Heavy dependencies not code-split
   - No lazy loading for non-critical features

2. **Slow Component Initialization** (200-400ms impact)
   - Heavy components re-render unnecessarily
   - Recharts initialization is expensive
   - No memoization to prevent re-renders

3. **JavaScript Execution Time** (300-500ms impact)
   - Heavy dependencies parsed upfront
   - Complex component trees
   - Multiple state updates triggering cascading renders

4. **Render Blocking** (100-200ms impact)
   - Synchronous component loading
   - No progressive enhancement
   - All features load before first paint

### Why TBT is High (317-371ms)

1. **Unnecessary Re-renders** (30-50ms impact)
   - No component memoization
   - Excessive state variables
   - No useCallback for handlers

2. **Heavy Computations** (50-80ms impact)
   - Chart rendering on every update
   - Complex data transformations
   - No memoization of expensive calculations

3. **Large Bundle Parsing** (100-150ms impact)
   - Heavy dependencies block main thread
   - No code splitting
   - Synchronous script execution

---

## Priority Action Plan

### Phase 1: Quick Wins (1-2 days)

**Goal:** Reduce LCP by 500-800ms, TBT by 50-80ms

1. ✅ **Add React.memo to Heavy Components** (2 hours)
   - Wrap VarianceKPIs, VarianceTrends, VarianceAlerts
   - Add proper prop comparison functions
   - Test for re-render reduction

2. ✅ **Implement Dynamic Imports** (4 hours)
   - Use next/dynamic for chart components
   - Add loading skeletons
   - Test bundle size reduction

3. ✅ **Add useCallback for Event Handlers** (1 hour)
   - Wrap refresh, layout change, widget update handlers
   - Prevent unnecessary re-renders

**Expected Results:**
- LCP: 2,400-3,300ms (improvement of 500-800ms)
- TBT: 240-290ms (improvement of 50-80ms)

### Phase 2: State Optimization (2-3 days)

**Goal:** Reduce re-renders by 20-30%

1. ✅ **Consolidate State with useReducer** (4 hours)
   - Group related state variables
   - Implement reducer logic
   - Update component to use dispatch

2. ✅ **Add useMemo for Expensive Calculations** (2 hours)
   - Memoize health percentages
   - Memoize widget generation
   - Memoize filtered/sorted lists

**Expected Results:**
- TBT: 200-250ms (additional improvement of 40-60ms)
- Smoother interactions

### Phase 3: Bundle Optimization (3-4 days)

**Goal:** Reduce initial bundle by 400-600KB

1. ✅ **Lazy Load Heavy Dependencies** (6 hours)
   - Implement lazy loading for Recharts
   - Lazy load TipTap editor
   - Lazy load markdown renderer
   - Lazy load html2canvas

2. ✅ **Add Resource Hints** (1 hour)
   - Add preconnect for API endpoints
   - Add dns-prefetch for external resources
   - Add preload for critical fonts

**Expected Results:**
- LCP: 2,000-2,500ms (additional improvement of 300-500ms)
- Initial bundle: Reduced by 400-600KB

---

## Success Metrics

### Target Metrics (After All Optimizations)

| Metric | Current | Target | Expected After Phase 1 | Expected After Phase 3 |
|--------|---------|--------|-------------------------|------------------------|
| **Home LCP** | 2,927ms | ≤2,500ms | 2,400ms ✓ | 2,000ms ✓ |
| **Dashboard LCP** | 4,135ms | ≤2,500ms | 3,300ms | 2,400ms ✓ |
| **Resources LCP** | 4,134ms | ≤2,500ms | 3,300ms | 2,400ms ✓ |
| **Risks LCP** | 4,140ms | ≤2,500ms | 3,300ms | 2,400ms ✓ |
| **TBT** | 317-371ms | ≤300ms | 240-290ms ✓ | 200-250ms ✓ |
| **Performance Score** | 0.76 | ≥0.8 | 0.78 | 0.82 ✓ |

---

## Testing Strategy

### After Each Phase

1. **Run Lighthouse CI**
   ```bash
   npm run lighthouse:ci
   ```

2. **Profile with Chrome DevTools**
   - Record Performance profile
   - Check for long tasks (>50ms)
   - Verify component re-renders reduced

3. **Test on Real Devices**
   - Test on actual mobile devices
   - Verify improvements on slow 3G
   - Check battery impact

4. **Monitor Production**
   - Use Vercel Analytics
   - Track Core Web Vitals
   - Monitor error rates

---

## Conclusion

The dashboard performance issues are **well-understood and fixable**. The primary bottlenecks are:

1. **Lack of component memoization** - Causing unnecessary re-renders
2. **No code splitting** - Loading all JavaScript upfront
3. **Heavy dependencies** - Not lazy-loaded

By implementing the three-phase action plan, we can achieve:
- ✅ LCP ≤2,500ms on all pages
- ✅ TBT ≤300ms consistently
- ✅ Performance Score ≥0.8

**Recommended Next Step:** Begin Phase 1 (Quick Wins) immediately. These changes are low-risk, high-impact, and can be completed in 1-2 days.

---

## Appendix

### Tools Used

- Lighthouse CI v0.15.1
- Custom performance profiling script
- Chrome DevTools Performance tab
- Next.js Build Analyzer

### References

- [CHECKPOINT_4_LCP_MEASUREMENT_REPORT.md](./CHECKPOINT_4_LCP_MEASUREMENT_REPORT.md)
- [DASHBOARD_PERFORMANCE_PROFILE.md](./DASHBOARD_PERFORMANCE_PROFILE.md)
- [DASHBOARD_PERFORMANCE_PROFILE.json](./DASHBOARD_PERFORMANCE_PROFILE.json)

### Team Contacts

- Performance Lead: [Your Name]
- Frontend Lead: [Frontend Lead]
- DevOps: [DevOps Contact]
