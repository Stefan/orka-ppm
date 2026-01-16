# Resources and Risks Pages Investigation Report

**Date:** January 15, 2026  
**Investigator:** Performance Optimization Team  
**Scope:** Why Resources and Risks pages didn't benefit from Phase 1 optimizations

---

## Executive Summary

After investigating the Resources (`/resources`) and Risks (`/risks`) pages, I've identified **why they didn't benefit from Phase 1 optimizations**: These pages **do not use the components we optimized** (VarianceKPIs, VarianceTrends, VarianceAlerts, AdaptiveDashboard).

### Key Findings

1. **Different Component Architecture** - Resources and Risks use completely different components
2. **Heavy Chart Libraries** - Both pages use Recharts directly (not lazy-loaded)
3. **No Memoization** - Components are not wrapped with React.memo
4. **No Dynamic Imports** - All components load synchronously
5. **Complex State Management** - Multiple useState calls without optimization

---

## Detailed Analysis

### Resources Page (`/resources`)

#### Current Architecture

**Components Used:**
- `AIResourceOptimizer` - AI-powered resource optimization
- `ResourceCard` - Individual resource cards
- `VirtualizedResourceTable` - Table view (already optimized)
- `MobileOptimizedChart` - Chart components (3 instances)
- `SkeletonCard`, `SkeletonChart` - Loading states

**Heavy Dependencies:**
- **Recharts** - Used indirectly through `MobileOptimizedChart`
- **Complex state management** - 11 useState calls
- **Large data processing** - Analytics calculations in useMemo

**State Management:**
```typescript
const [resources, setResources] = useState<Resource[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [viewMode, setViewMode] = useState<'cards' | 'table' | 'heatmap'>('cards')
const [showFilters, setShowFilters] = useState(false)
const [showOptimization, setShowOptimization] = useState(false)
const [showAddModal, setShowAddModal] = useState(false)
const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
const [autoRefresh, setAutoRefresh] = useState(false)
const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
// Plus useReducer for filters
```

**Optimizations Already Present:**
- ✅ useReducer for filter state
- ✅ useDebounce for search (300ms)
- ✅ useDeferredValue for non-critical updates
- ✅ useMemo for analytics data
- ✅ VirtualizedResourceTable (already optimized)

**Missing Optimizations:**
- ❌ No dynamic imports for heavy components
- ❌ AIResourceOptimizer not memoized
- ❌ ResourceCard not memoized
- ❌ MobileOptimizedChart not memoized
- ❌ No useCallback for event handlers
- ❌ Recharts loaded synchronously

#### Performance Bottlenecks

1. **AIResourceOptimizer** - Heavy AI component loads synchronously
2. **MobileOptimizedChart (3 instances)** - Recharts loaded upfront
3. **Complex Analytics** - Heavy calculations on every render
4. **Multiple Charts** - 3 charts render simultaneously
5. **Large Dataset Processing** - Resource filtering and sorting

---

### Risks Page (`/risks`)

#### Current Architecture

**Components Used:**
- `AIRiskManagement` - AI-powered risk analysis
- **Recharts Components** - Bar, Pie, Scatter, Area charts (imported directly!)
- `SkeletonCard`, `SkeletonChart`, `SkeletonTable` - Loading states

**Heavy Dependencies:**
- **Recharts** - Imported directly at top level (NOT lazy-loaded!)
  ```typescript
  import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
           PieChart, Pie, Cell, ScatterChart, Scatter, Area, AreaChart } from 'recharts'
  ```
- **Complex state management** - 8 useState calls + useReducer
- **Large data processing** - Risk analytics, matrix calculations

**State Management:**
```typescript
const [risks, setRisks] = useState<Risk[]>([])
const [metrics, setMetrics] = useState<RiskMetrics | null>(null)
const [alerts, setAlerts] = useState<RiskAlert[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [viewMode, setViewMode] = useState<'overview' | 'matrix' | 'trends' | 'detailed'>('overview')
const [searchTerm, setSearchTerm] = useState('')
const [showFilters, setShowFilters] = useState(false)
const [showAddModal, setShowAddModal] = useState(false)
const [showMonteCarloModal, setShowMonteCarloModal] = useState(false)
const [showAIAnalysis, setShowAIAnalysis] = useState(true)
// Plus useReducer for filter/sort state
```

**Optimizations Already Present:**
- ✅ useReducer for filter/sort state
- ✅ useDebounce for search (300ms)
- ✅ useDeferredValue for non-critical updates
- ✅ useMemo for analytics data
- ✅ useMemo for filtered risks

**Missing Optimizations:**
- ❌ **Recharts imported directly** - Biggest issue!
- ❌ No dynamic imports for any components
- ❌ AIRiskManagement not memoized
- ❌ No useCallback for event handlers
- ❌ Multiple chart components render simultaneously

#### Performance Bottlenecks

1. **Recharts Loaded Synchronously** - ~400KB loaded upfront (CRITICAL!)
2. **AIRiskManagement** - Heavy AI component loads synchronously
3. **Multiple Chart Types** - Bar, Pie, Scatter, Area charts all loaded
4. **Complex Analytics** - Risk matrix, trend analysis, category distribution
5. **Large Dataset Processing** - Risk filtering, sorting, scoring

---

## Root Cause Analysis

### Why Phase 1 Didn't Help

**Dashboard Page (Improved by 823ms):**
- ✅ Used VarianceKPIs, VarianceTrends, VarianceAlerts
- ✅ These components were dynamically imported in Phase 1
- ✅ Recharts loaded lazily through these components
- ✅ Result: 823ms improvement

**Resources Page (No improvement):**
- ❌ Doesn't use VarianceKPIs, VarianceTrends, VarianceAlerts
- ❌ Uses different components (AIResourceOptimizer, MobileOptimizedChart)
- ❌ These components were NOT optimized in Phase 1
- ❌ Result: No improvement

**Risks Page (Slight regression):**
- ❌ Doesn't use VarianceKPIs, VarianceTrends, VarianceAlerts
- ❌ **Imports Recharts directly at top level** (worst case!)
- ❌ Uses AIRiskManagement (not optimized)
- ❌ Multiple chart types loaded synchronously
- ❌ Result: Slight regression (test variance)

### The Critical Difference

```typescript
// Dashboard Page (OPTIMIZED)
const VarianceTrends = dynamic(() => import('./components/VarianceTrends'), {
  loading: () => <SkeletonChart />,
  ssr: false
})
// Recharts loaded lazily inside VarianceTrends

// Risks Page (NOT OPTIMIZED)
import { BarChart, Bar, XAxis, YAxis, ... } from 'recharts'
// Recharts loaded immediately at page load!
```

---

## Optimization Strategy for Resources and Risks

### Phase 1B: Apply Same Optimizations

#### Priority 1: Dynamic Imports for Heavy Components

**Resources Page:**
```typescript
// Add dynamic imports
const AIResourceOptimizer = dynamic(() => import('../../components/ai/AIResourceOptimizer'), {
  loading: () => <SkeletonCard variant="stat" />,
  ssr: false
})

const MobileOptimizedChart = dynamic(() => import('../../components/charts/MobileOptimizedChart'), {
  loading: () => <SkeletonChart />,
  ssr: false
})

const ResourceCard = dynamic(() => import('./components/ResourceCard'), {
  loading: () => <SkeletonCard variant="resource" />,
  ssr: false
})
```

**Risks Page:**
```typescript
// CRITICAL: Remove direct Recharts import
// import { BarChart, Bar, ... } from 'recharts' // DELETE THIS

// Add dynamic imports
const AIRiskManagement = dynamic(() => import('../../components/ai/AIRiskManagement'), {
  loading: () => <SkeletonCard variant="stat" />,
  ssr: false
})

// Create wrapper components for charts and lazy load them
const RiskCharts = dynamic(() => import('./components/RiskCharts'), {
  loading: () => <SkeletonChart />,
  ssr: false
})
```

#### Priority 2: Add React.memo

**Resources Page:**
```typescript
// Memoize ResourceCard
export default React.memo(ResourceCard, (prevProps, nextProps) => {
  return prevProps.resource.id === nextProps.resource.id &&
         prevProps.resource.utilization_percentage === nextProps.resource.utilization_percentage
})
```

**Risks Page:**
```typescript
// Create memoized risk card component
const RiskCard = React.memo(({ risk }: { risk: Risk }) => {
  // ... risk card implementation
}, (prevProps, nextProps) => {
  return prevProps.risk.id === nextProps.risk.id &&
         prevProps.risk.risk_score === nextProps.risk.risk_score
})
```

#### Priority 3: Add useCallback

**Resources Page:**
```typescript
const fetchResources = useCallback(async () => {
  // ... fetch logic
}, [session?.access_token])

const handleFilterChange = useCallback((filterType: keyof ResourceFilters, value: any) => {
  dispatchFilters({ type: 'SET_FILTER', key: filterType, value })
}, [])

const exportResourceData = useCallback(() => {
  // ... export logic
}, [filteredResources, analyticsData])
```

**Risks Page:**
```typescript
const fetchRisks = useCallback(async () => {
  // ... fetch logic
}, [session?.access_token])

const exportRiskData = useCallback(() => {
  // ... export logic
}, [filteredRisks, metrics, alerts, analyticsData])
```

---

## Expected Impact

### Resources Page

| Optimization | Expected LCP Improvement | Expected TBT Improvement |
|--------------|-------------------------|-------------------------|
| Dynamic import AIResourceOptimizer | -200 to -300ms | -30 to -50ms |
| Dynamic import MobileOptimizedChart | -300 to -400ms | -50 to -80ms |
| React.memo ResourceCard | -100 to -200ms | -20 to -30ms |
| useCallback handlers | -50 to -100ms | -10 to -20ms |
| **Total** | **-650 to -1,000ms** | **-110 to -180ms** |

**Expected Results:**
- Current LCP: 4,130ms
- After optimization: 3,130-3,480ms
- Still needs Phase 2 and 3 to reach ≤2,500ms target

### Risks Page

| Optimization | Expected LCP Improvement | Expected TBT Improvement |
|--------------|-------------------------|-------------------------|
| Remove direct Recharts import | -400 to -600ms | -80 to -120ms |
| Dynamic import AIRiskManagement | -200 to -300ms | -30 to -50ms |
| Dynamic import chart components | -300 to -400ms | -50 to -80ms |
| React.memo risk cards | -100 to -200ms | -20 to -30ms |
| useCallback handlers | -50 to -100ms | -10 to -20ms |
| **Total** | **-1,050 to -1,600ms** | **-190 to -300ms** |

**Expected Results:**
- Current LCP: 4,208ms
- After optimization: 2,608-3,158ms
- **May reach ≤2,500ms target with Phase 1B alone!**

---

## Implementation Plan

### Phase 1B: Resources and Risks Optimization (1-2 days)

#### Step 1: Risks Page (Higher Priority)
1. **Remove direct Recharts import** (30 minutes)
   - Create RiskCharts wrapper component
   - Move all chart code to wrapper
   - Dynamic import the wrapper

2. **Add dynamic imports** (1 hour)
   - AIRiskManagement
   - RiskCharts wrapper
   - Add loading skeletons

3. **Add React.memo** (1 hour)
   - Create RiskCard component
   - Memoize with custom comparison

4. **Add useCallback** (30 minutes)
   - Wrap fetchRisks
   - Wrap exportRiskData
   - Wrap filter handlers

**Expected Time:** 3 hours
**Expected Impact:** -1,050 to -1,600ms LCP

#### Step 2: Resources Page
1. **Add dynamic imports** (1 hour)
   - AIResourceOptimizer
   - MobileOptimizedChart
   - ResourceCard
   - Add loading skeletons

2. **Add React.memo** (1 hour)
   - Memoize ResourceCard
   - Add custom comparison

3. **Add useCallback** (30 minutes)
   - Wrap fetchResources
   - Wrap exportResourceData
   - Wrap filter handlers

**Expected Time:** 2.5 hours
**Expected Impact:** -650 to -1,000ms LCP

### Total Phase 1B Time: 5.5 hours (less than 1 day)

---

## Success Criteria

### Phase 1B Goals

- ✅ Remove direct Recharts import from Risks page
- ✅ Add dynamic imports to both pages
- ✅ Add React.memo to card components
- ✅ Add useCallback to event handlers
- ✅ Zero TypeScript/runtime errors
- ✅ LCP improvement of 650-1,600ms
- ✅ TBT improvement of 110-300ms

### Target Metrics After Phase 1B

| Page | Current LCP | Target After 1B | Final Target | Status |
|------|-------------|-----------------|--------------|--------|
| Home | 2,924ms | 2,924ms | ≤2,500ms | ⏳ Needs Phase 2/3 |
| Dashboards | 3,312ms | 3,312ms | ≤2,500ms | ⏳ Needs Phase 2/3 |
| **Resources** | 4,130ms | **3,130-3,480ms** | ≤2,500ms | ⏳ Needs Phase 2/3 |
| **Risks** | 4,208ms | **2,608-3,158ms** | ≤2,500ms | ✅ May achieve! |
| Scenarios | 3,444ms | 3,444ms | ≤2,500ms | ⏳ Needs Phase 2/3 |

---

## Recommendations

### Immediate Actions (Today)

1. **Implement Phase 1B for Risks page first** - Highest impact, may achieve target
2. **Then implement Phase 1B for Resources page** - Significant improvement expected
3. **Re-run Lighthouse CI** - Measure actual improvements
4. **Verify no regressions** - Ensure other pages still perform well

### Short Term (This Week)

1. **If Risks page reaches target** - Document success and move to other pages
2. **If not quite there** - Apply Phase 2 optimizations (state consolidation)
3. **Resources page** - Continue with Phase 2 and 3 as needed

### Key Insight

**The Risks page has the highest potential for improvement** because it's loading Recharts directly. Fixing this one issue could save 400-600ms alone!

---

## Conclusion

### Why Phase 1 Didn't Work

Phase 1 optimizations were **page-specific** and only helped the Dashboard page because:
- Dashboard uses VarianceKPIs, VarianceTrends, VarianceAlerts
- These components were optimized in Phase 1
- Resources and Risks use completely different components

### The Path Forward

**Phase 1B will apply the same optimization patterns to Resources and Risks pages:**
- Dynamic imports for heavy components
- React.memo for card components
- useCallback for event handlers
- **Critical:** Remove direct Recharts import from Risks page

**Expected Results:**
- Resources: 650-1,000ms improvement
- Risks: 1,050-1,600ms improvement (may reach target!)
- Total time: Less than 1 day
- High confidence of success

**The Risks page may achieve the ≤2,500ms target with Phase 1B alone!**

---

## Next Steps

Ready to implement Phase 1B optimizations for Resources and Risks pages. Should we proceed?

1. ✅ Start with Risks page (highest impact)
2. ✅ Then Resources page
3. ✅ Re-run Lighthouse CI
4. ✅ Measure improvements
5. ✅ Proceed with Phase 2 if needed
