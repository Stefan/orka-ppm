# Web Workers for Performance Optimization

This directory contains Web Workers for offloading CPU-intensive operations from the main thread, improving UI responsiveness and performance.

## Available Workers

### 1. Monte Carlo Worker (`monte-carlo-worker.ts`)

Handles heavy statistical calculations for Monte Carlo simulations.

**Usage:**

```typescript
import { monteCarloWorker } from '@/lib/workers'

// Run a simulation
const result = await monteCarloWorker.runSimulation(
  {
    risks: [
      {
        id: 'risk-1',
        name: 'Budget Overrun',
        category: 'FINANCIAL',
        impactType: 'COST',
        baselineImpact: 50000,
        probabilityDistribution: {
          distributionType: 'NORMAL',
          parameters: { mean: 1.0, stdDev: 0.2 }
        }
      }
    ],
    iterations: 10000,
    baselineCosts: { labor: 100000, materials: 50000 }
  },
  (progress) => {
    console.log(`Progress: ${progress.percentage.toFixed(1)}%`)
  }
)

console.log('Mean cost:', result.statistics.cost.mean)
console.log('P90 cost:', result.statistics.cost.p90)
```

**Features:**
- Non-blocking Monte Carlo simulations
- Progress callbacks for long-running calculations
- Support for multiple probability distributions
- Statistical analysis (mean, median, percentiles, etc.)

### 2. Data Processor Worker (`data-processor-worker.ts`)

Handles large dataset transformations and processing.

**Usage:**

```typescript
import { dataProcessorWorker } from '@/lib/workers'

// Filter large dataset
const filtered = await dataProcessorWorker.filter(
  largeDataset,
  (item) => item.status === 'active' && item.value > 1000
)

// Sort data
const sorted = await dataProcessorWorker.sort(
  data,
  (a, b) => a.date - b.date,
  'desc'
)

// Aggregate data
const aggregated = await dataProcessorWorker.aggregate({
  items: data,
  groupBy: 'category',
  aggregations: [
    { type: 'sum', name: 'total', field: 'amount' },
    { type: 'avg', name: 'average', field: 'amount' },
    { type: 'count', name: 'count' }
  ]
})

// Batch operations
const processed = await dataProcessorWorker.batchTransform(data, [
  { type: 'filter', predicate: 'item.active === true' },
  { type: 'sort', compareFn: 'a.date - b.date', direction: 'desc' },
  { type: 'transform', transformFn: '({ ...item, processed: true })' }
])

// Deduplicate
const unique = await dataProcessorWorker.deduplicate(data, ['id', 'email'])

// Normalize data
const normalized = await dataProcessorWorker.normalize(
  data,
  ['score', 'rating'],
  'minmax'
)
```

**Features:**
- Filter, sort, aggregate large datasets
- Batch transformations
- Data deduplication
- Dataset merging
- Data normalization (min-max, z-score, decimal)
- Pivot operations

## Performance Benefits

### Before Web Workers
- Heavy calculations block the main thread
- UI becomes unresponsive during processing
- Poor user experience with large datasets

### After Web Workers
- Calculations run in parallel
- UI remains responsive
- Better performance on multi-core systems
- Improved perceived performance

## Browser Support

Web Workers are supported in all modern browsers:
- Chrome 4+
- Firefox 3.5+
- Safari 4+
- Edge (all versions)

Check support before using:

```typescript
import { MonteCarloWorkerManager, DataProcessorWorkerManager } from '@/lib/workers'

if (MonteCarloWorkerManager.isSupported()) {
  // Use workers
} else {
  // Fallback to main thread
}
```

## Best Practices

1. **Use for CPU-intensive tasks**: Workers have overhead, so only use them for operations that take >50ms
2. **Batch operations**: Combine multiple operations to reduce message passing overhead
3. **Clean up**: Terminate workers when no longer needed
4. **Handle errors**: Always wrap worker calls in try-catch blocks
5. **Progress feedback**: Use progress callbacks for long-running operations

## Cleanup

Always terminate workers when they're no longer needed:

```typescript
// When component unmounts or app closes
monteCarloWorker.terminate()
dataProcessorWorker.terminate()
```

## Testing

Workers can be tested using Jest with appropriate mocks:

```typescript
// Mock Worker in tests
global.Worker = jest.fn().mockImplementation(() => ({
  postMessage: jest.fn(),
  terminate: jest.fn(),
  onmessage: null,
  onerror: null
}))
```
