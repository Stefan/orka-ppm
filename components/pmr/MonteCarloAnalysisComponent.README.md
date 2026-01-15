# Monte Carlo Analysis Component

## Overview

The `MonteCarloAnalysisComponent` provides an interactive interface for running Monte Carlo risk simulations on project data. It includes parameter configuration, real-time preview, interactive visualizations, scenario comparison, and export capabilities.

## Features

### 1. Parameter Configuration
- **Iterations**: Configure the number of simulation runs (1,000 - 100,000)
- **Confidence Level**: Set confidence intervals (90%, 95%, 99%)
- **Analysis Types**: Select budget, schedule, and/or resource analysis
- **Advanced Parameters**: Fine-tune uncertainty percentages and resource availability

### 2. Real-Time Simulation
- Progress tracking during simulation execution
- Live updates of simulation status
- Error handling and recovery

### 3. Interactive Visualizations
- **Probability Distribution**: Histogram showing outcome distribution across percentiles
- **Percentile Comparison**: Line chart comparing budget vs schedule outcomes
- **Risk Contributions**: Bar chart showing top risk contributors
- All charts support filtering, export, and interactive exploration

### 4. Scenario Management
- Save current configuration as named scenarios
- Load and compare multiple scenarios
- Side-by-side scenario comparison
- Delete unwanted scenarios

### 5. Results Summary
- Budget analysis with probability metrics
- Schedule analysis with variance tracking
- Resource analysis with conflict risk assessment
- Simulation metadata and performance info

### 6. Export Capabilities
- Export results as JSON, CSV, or PDF
- Includes complete simulation data and statistics
- Risk contribution analysis
- Confidence intervals and percentiles

## Usage

### Basic Usage

```tsx
import { MonteCarloAnalysisComponent } from '@/components/pmr'

function PMRPage() {
  const [simulationResults, setSimulationResults] = useState<MonteCarloResults>()
  
  const handleRunSimulation = async (params: MonteCarloParams) => {
    const response = await fetch(`/api/reports/pmr/${reportId}/monte-carlo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    
    const results = await response.json()
    setSimulationResults(results)
    return results
  }

  return (
    <MonteCarloAnalysisComponent
      reportId="report-123"
      projectId="project-456"
      projectData={{
        baseline_budget: 1000000,
        current_spend: 450000,
        baseline_duration: 180,
        elapsed_time: 90
      }}
      onRunSimulation={handleRunSimulation}
      simulationResults={simulationResults}
      session={session}
    />
  )
}
```

### With Export Handler

```tsx
const handleExport = (format: 'csv' | 'json' | 'pdf') => {
  // Custom export logic
  fetch(`/api/reports/pmr/${reportId}/monte-carlo/export`, {
    method: 'POST',
    body: JSON.stringify({ format, results: simulationResults })
  })
}

<MonteCarloAnalysisComponent
  reportId={reportId}
  projectId={projectId}
  projectData={projectData}
  onRunSimulation={handleRunSimulation}
  onExportResults={handleExport}
  session={session}
/>
```

### With External Loading State

```tsx
const [isRunning, setIsRunning] = useState(false)

const handleRunSimulation = async (params: MonteCarloParams) => {
  setIsRunning(true)
  try {
    const results = await runSimulation(params)
    return results
  } finally {
    setIsRunning(false)
  }
}

<MonteCarloAnalysisComponent
  reportId={reportId}
  projectId={projectId}
  projectData={projectData}
  onRunSimulation={handleRunSimulation}
  isRunning={isRunning}
  session={session}
/>
```

## Props

### MonteCarloAnalysisProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `reportId` | `string` | Yes | Unique identifier for the PMR report |
| `projectId` | `string` | Yes | Unique identifier for the project |
| `projectData` | `ProjectData` | Yes | Project baseline and current data |
| `onRunSimulation` | `(params: MonteCarloParams) => Promise<MonteCarloResults>` | Yes | Callback to execute simulation |
| `onExportResults` | `(format: 'csv' \| 'json' \| 'pdf') => void` | No | Custom export handler |
| `simulationResults` | `MonteCarloResults` | No | Initial or external simulation results |
| `isRunning` | `boolean` | No | External loading state |
| `session` | `any` | Yes | User session for authentication |

### MonteCarloParams

```typescript
interface MonteCarloParams {
  iterations: number                              // Number of simulation runs
  confidence_level: number                        // Confidence level (0.90, 0.95, 0.99)
  analysis_types: ('budget' | 'schedule' | 'resource')[]  // Types of analysis to run
  budget_uncertainty?: number                     // Budget uncertainty percentage (0-1)
  schedule_uncertainty?: number                   // Schedule uncertainty percentage (0-1)
  resource_availability?: number                  // Resource availability percentage (0-1)
}
```

### ProjectData

```typescript
interface ProjectData {
  baseline_budget: number        // Total project budget
  current_spend: number          // Amount spent to date
  baseline_duration: number      // Planned duration in days
  elapsed_time: number           // Days elapsed
  resource_allocations?: any[]   // Optional resource allocation data
}
```

## Integration with Backend

The component expects the backend to provide a Monte Carlo analysis endpoint:

```
POST /api/reports/pmr/{report_id}/monte-carlo
```

**Request Body:**
```json
{
  "iterations": 10000,
  "confidence_level": 0.95,
  "analysis_types": ["budget", "schedule"],
  "budget_uncertainty": 0.15,
  "schedule_uncertainty": 0.20,
  "resource_availability": 0.90
}
```

**Response:**
```json
{
  "analysis_type": "comprehensive",
  "iterations": 10000,
  "confidence_level": 0.95,
  "results": {
    "budget_analysis": {
      "expected_final_cost": 980000,
      "variance_percentage": -2.0,
      "probability_within_budget": 0.85,
      "percentiles": {
        "p10": 920000,
        "p50": 980000,
        "p90": 1050000,
        "p95": 1080000
      },
      "risk_contributions": [...]
    },
    "schedule_analysis": {...},
    "resource_analysis": {...}
  },
  "processing_time_ms": 1250,
  "generated_at": "2024-01-15T10:30:00Z"
}
```

## Styling

The component uses Tailwind CSS classes and follows the existing design system. All colors and spacing are consistent with other PMR components.

## Accessibility

- Keyboard navigation support
- ARIA labels for interactive elements
- Screen reader friendly
- Focus management
- High contrast mode support

## Performance Considerations

- Lazy loading of chart components
- Optimized re-renders with React.memo and useCallback
- Efficient state management
- Progress tracking for long-running simulations
- Debounced parameter updates

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- React 18+
- Lucide React (icons)
- InteractiveChart component
- PMR types

## Related Components

- `InteractiveChart` - Used for data visualization
- `AIInsightsPanel` - Displays AI-generated insights
- `PMREditor` - Main PMR editing interface
- `MonteCarloVisualization` - Alternative visualization component

## Future Enhancements

- Real-time collaboration on scenario configurations
- Advanced statistical analysis options
- Custom risk distribution modeling
- Integration with project risk register
- Automated scenario generation based on historical data
- Machine learning-based parameter recommendations
