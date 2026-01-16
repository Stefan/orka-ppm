# Web Workers Usage Examples

## Example 1: Monte Carlo Simulation in a Component

```typescript
'use client'

import { useState } from 'react'
import { useMonteCarloWorker } from '@/hooks'

export function MonteCarloSimulator() {
  const { runSimulation, isRunning, progress, result, error } = useMonteCarloWorker({
    onProgress: (p) => console.log(`Progress: ${p.percentage.toFixed(1)}%`),
    onComplete: (r) => console.log('Simulation complete!', r)
  })

  const handleRunSimulation = async () => {
    await runSimulation({
      risks: [
        {
          id: 'risk-1',
          name: 'Cost Overrun',
          category: 'FINANCIAL',
          impactType: 'COST',
          baselineImpact: 100000,
          probabilityDistribution: {
            distributionType: 'NORMAL',
            parameters: { mean: 1.2, stdDev: 0.3 }
          }
        },
        {
          id: 'risk-2',
          name: 'Schedule Delay',
          category: 'SCHEDULE',
          impactType: 'SCHEDULE',
          baselineImpact: 30,
          probabilityDistribution: {
            distributionType: 'TRIANGULAR',
            parameters: { min: 0.8, mode: 1.0, max: 1.5 }
          }
        }
      ],
      iterations: 50000,
      baselineCosts: {
        labor: 500000,
        materials: 300000,
        equipment: 200000
      }
    })
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Monte Carlo Simulation</h2>
      
      <button
        onClick={handleRunSimulation}
        disabled={isRunning}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {isRunning ? 'Running...' : 'Run Simulation'}
      </button>

      {isRunning && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {progress.current.toLocaleString()} / {progress.total.toLocaleString()} iterations
          </p>
        </div>
      )}

      {result && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">Cost Statistics</h3>
            <p>Mean: ${result.statistics.cost.mean.toLocaleString()}</p>
            <p>Median: ${result.statistics.cost.median.toLocaleString()}</p>
            <p>P90: ${result.statistics.cost.p90.toLocaleString()}</p>
            <p>P95: ${result.statistics.cost.p95.toLocaleString()}</p>
          </div>
          
          <div className="p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">Schedule Statistics</h3>
            <p>Mean: {result.statistics.schedule.mean.toFixed(1)} days</p>
            <p>Median: {result.statistics.schedule.median.toFixed(1)} days</p>
            <p>P90: {result.statistics.schedule.p90.toFixed(1)} days</p>
            <p>P95: {result.statistics.schedule.p95.toFixed(1)} days</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-800 rounded">
          Error: {error.message}
        </div>
      )}
    </div>
  )
}
```

## Example 2: Large Dataset Processing

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useDataProcessor } from '@/hooks'

interface Project {
  id: string
  name: string
  status: 'active' | 'completed' | 'on-hold'
  budget: number
  spent: number
  startDate: string
}

export function ProjectDataTable({ projects }: { projects: Project[] }) {
  const { filter, sort, search, isProcessing } = useDataProcessor()
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(projects)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    processData()
  }, [searchQuery, statusFilter, projects])

  const processData = async () => {
    let result = projects

    // Apply search (offloaded to worker)
    if (searchQuery) {
      const searched = await search(result, searchQuery, ['name', 'id'])
      if (searched) result = searched
    }

    // Apply status filter (offloaded to worker)
    if (statusFilter !== 'all') {
      const filtered = await filter(
        result,
        (project) => project.status === statusFilter
      )
      if (filtered) result = filtered
    }

    // Sort by budget (offloaded to worker)
    const sorted = await sort(result, (a, b) => b.budget - a.budget)
    if (sorted) result = sorted

    setFilteredProjects(result)
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded flex-1"
        />
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="on-hold">On Hold</option>
        </select>
      </div>

      {isProcessing && (
        <div className="text-center py-4 text-gray-600">
          Processing data...
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-right">Budget</th>
            <th className="p-2 text-right">Spent</th>
          </tr>
        </thead>
        <tbody>
          {filteredProjects.map((project) => (
            <tr key={project.id} className="border-b">
              <td className="p-2">{project.name}</td>
              <td className="p-2">{project.status}</td>
              <td className="p-2 text-right">${project.budget.toLocaleString()}</td>
              <td className="p-2 text-right">${project.spent.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

## Example 3: Batch Data Transformation

```typescript
import { dataProcessorWorker } from '@/lib/workers'

async function processLargeDataset(rawData: any[]) {
  // Perform multiple operations in a single worker call
  const processed = await dataProcessorWorker.batchTransform(rawData, [
    // Step 1: Filter out inactive items
    {
      type: 'filter',
      predicate: 'item.active === true'
    },
    // Step 2: Sort by date
    {
      type: 'sort',
      compareFn: 'new Date(b.date) - new Date(a.date)',
      direction: 'desc'
    },
    // Step 3: Transform to add computed fields
    {
      type: 'transform',
      transformFn: `({
        ...item,
        utilization: (item.spent / item.budget) * 100,
        daysRemaining: Math.ceil((new Date(item.endDate) - new Date()) / (1000 * 60 * 60 * 24))
      })`
    }
  ])

  return processed
}
```

## Example 4: Data Normalization for Charts

```typescript
import { dataProcessorWorker } from '@/lib/workers'

async function prepareChartData(metrics: any[]) {
  // Normalize multiple fields for consistent chart scaling
  const normalized = await dataProcessorWorker.normalize(
    metrics,
    ['performance', 'efficiency', 'quality'],
    'minmax' // Scale to 0-1 range
  )

  return normalized.map(item => ({
    name: item.name,
    performance: item.performance_normalized * 100,
    efficiency: item.efficiency_normalized * 100,
    quality: item.quality_normalized * 100
  }))
}
```

## Example 5: Deduplication and Merging

```typescript
import { dataProcessorWorker } from '@/lib/workers'

async function consolidateData(
  dataset1: any[],
  dataset2: any[],
  dataset3: any[]
) {
  // Merge datasets on common key
  const merged = await dataProcessorWorker.merge(
    [dataset1, dataset2, dataset3],
    'projectId'
  )

  // Remove duplicates based on multiple fields
  const deduplicated = await dataProcessorWorker.deduplicate(
    merged,
    ['projectId', 'timestamp']
  )

  return deduplicated
}
```

## Performance Considerations

### When to Use Workers

✅ **Use workers for:**
- Operations taking >50ms
- Processing >1000 items
- Complex calculations (Monte Carlo, statistics)
- Heavy data transformations
- Sorting/filtering large datasets

❌ **Don't use workers for:**
- Simple operations (<50ms)
- Small datasets (<100 items)
- Operations requiring DOM access
- Frequent small operations (overhead > benefit)

### Optimization Tips

1. **Batch operations**: Combine multiple operations to reduce message passing
2. **Reuse workers**: Workers are singletons, no need to create/destroy
3. **Progress feedback**: Use callbacks for long operations
4. **Error handling**: Always wrap in try-catch
5. **Fallback**: Check support and provide main-thread fallback

```typescript
// Good: Batch operations
const result = await dataProcessorWorker.batchTransform(data, operations)

// Bad: Multiple separate calls
const filtered = await dataProcessorWorker.filter(data, predicate)
const sorted = await dataProcessorWorker.sort(filtered, compareFn)
const transformed = await dataProcessorWorker.transform(sorted, transformFn)
```
