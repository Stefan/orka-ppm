# Monte Carlo Analysis Component - Architecture

## Component Hierarchy

```
MonteCarloAnalysisComponent
│
├── Header Section
│   ├── Title & Description
│   ├── Action Buttons
│   │   ├── Configure Button
│   │   ├── Compare Scenarios Button (conditional)
│   │   └── Run Simulation Button
│   └── Connection Status (if real-time)
│
├── Progress Bar (conditional - when running)
│   ├── Progress Percentage
│   └── Visual Progress Indicator
│
├── Error Display (conditional)
│   └── Error Message with Icon
│
├── Configuration Panel (conditional - when showSettings)
│   ├── Panel Header
│   ├── Basic Parameters
│   │   ├── Iterations Input
│   │   ├── Confidence Level Select
│   │   └── Analysis Types Checkboxes
│   ├── Advanced Parameters (collapsible)
│   │   ├── Budget Uncertainty Input
│   │   ├── Schedule Uncertainty Input
│   │   └── Resource Availability Input
│   └── Action Buttons
│       ├── Save as Scenario
│       ├── Cancel
│       └── Apply & Run
│
├── Results Summary (conditional - when results exist)
│   ├── Budget Analysis Card
│   │   ├── Status Badge
│   │   ├── Expected Cost
│   │   ├── Variance Percentage
│   │   └── P95 Cost
│   ├── Schedule Analysis Card
│   │   ├── Status Badge
│   │   ├── Expected Duration
│   │   ├── Variance Percentage
│   │   └── P95 Duration
│   ├── Resource Analysis Card
│   │   ├── Resource Count Badge
│   │   ├── Conflict Risk
│   │   └── Recommendations
│   └── Simulation Info Card
│       ├── Iterations
│       ├── Confidence Level
│       ├── Processing Time
│       └── Generated Timestamp
│
├── Interactive Visualizations (conditional - when results exist)
│   ├── Chart Visibility Controls
│   │   └── Toggle Buttons for Each Chart
│   ├── Distribution Chart (conditional)
│   │   ├── Chart Header
│   │   └── InteractiveChart (Bar)
│   ├── Percentile Comparison Chart (conditional)
│   │   ├── Chart Header
│   │   └── InteractiveChart (Line)
│   └── Risk Contributions Chart (conditional)
│       ├── Chart Header
│       └── InteractiveChart (Bar)
│
├── Scenario Comparison (conditional - when showScenarioComparison)
│   ├── Panel Header
│   ├── Scenario Grid
│   │   └── Scenario Cards (multiple)
│   │       ├── Scenario Name
│   │       ├── Selection Checkbox
│   │       ├── Parameter Summary
│   │       └── Action Buttons (Load, Delete)
│   └── Comparison Summary (when 2+ selected)
│
├── Export Options (conditional - when results exist)
│   ├── Section Header
│   ├── Export Buttons
│   │   ├── Export as JSON
│   │   ├── Export as CSV
│   │   └── Export as PDF
│   └── Export Info Panel
│
├── Empty State (conditional - no results, not running)
│   ├── Icon
│   ├── Message
│   └── Configure Button
│
└── Saved Scenarios List (conditional - scenarios exist, not comparing)
    ├── Section Header
    ├── Scenario Buttons (first 5)
    └── View All Button (if more than 5)
```

## State Management

```typescript
// Component State
{
  // Configuration
  params: MonteCarloParams
  showSettings: boolean
  showAdvanced: boolean
  
  // Simulation
  simulationResults: MonteCarloResults | undefined
  isRunning: boolean
  progress: number
  error: string | null
  
  // Scenarios
  scenarios: ScenarioConfig[]
  selectedScenarios: string[]
  showScenarioComparison: boolean
  
  // UI
  visibleCharts: {
    distribution: boolean
    percentiles: boolean
    riskContributions: boolean
    timeline: boolean
  }
}
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interactions                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Component State Updates                    │
│  • Parameter changes                                         │
│  • UI state toggles                                          │
│  • Scenario management                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Simulation Trigger                        │
│  handleRunSimulation() → onRunSimulation(params)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend API Call                        │
│  POST /api/reports/pmr/{id}/monte-carlo                     │
│  Body: { iterations, confidence_level, analysis_types, ... }│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Monte Carlo Service                        │
│  • Fetch project data                                        │
│  • Create risk models                                        │
│  • Run simulation                                            │
│  • Calculate statistics                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Response                              │
│  MonteCarloResults {                                         │
│    iterations, confidence_level,                             │
│    results: { budget_analysis, schedule_analysis, ... }      │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Results State Update                        │
│  setSimulationResults(results)                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Chart Data Preparation                        │
│  prepareChartData() → {                                      │
│    distributionData,                                         │
│    percentileData,                                           │
│    riskContributionsData                                     │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    UI Re-render                              │
│  • Summary cards with metrics                                │
│  • Interactive charts                                        │
│  • Export options                                            │
└─────────────────────────────────────────────────────────────┘
```

## Key Functions

### 1. handleRunSimulation
```typescript
const handleRunSimulation = async () => {
  setIsRunning(true)
  setError(null)
  setProgress(0)
  
  try {
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90))
    }, 500)
    
    // Call API
    const results = await onRunSimulation(params)
    
    // Update state
    clearInterval(progressInterval)
    setProgress(100)
    setSimulationResults(results)
  } catch (err) {
    setError(err.message)
  } finally {
    setIsRunning(false)
  }
}
```

### 2. prepareChartData
```typescript
const prepareChartData = () => {
  if (!simulationResults) return null
  
  // Extract analysis results
  const budgetAnalysis = simulationResults.results?.budget_analysis
  const scheduleAnalysis = simulationResults.results?.schedule_analysis
  
  // Transform for charts
  return {
    distributionData: transformPercentiles(budgetAnalysis.percentiles),
    percentileData: combinePercentiles(budgetAnalysis, scheduleAnalysis),
    riskContributionsData: transformRiskContributions(budgetAnalysis.risk_contributions)
  }
}
```

### 3. handleSaveScenario
```typescript
const handleSaveScenario = () => {
  const scenarioName = prompt('Enter scenario name:')
  if (!scenarioName) return
  
  const newScenario = {
    id: `scenario_${Date.now()}`,
    name: scenarioName,
    params: { ...params },
    results: simulationResults
  }
  
  setScenarios(prev => [...prev, newScenario])
}
```

### 4. handleExport
```typescript
const handleExport = (format: 'csv' | 'json' | 'pdf') => {
  if (onExportResults) {
    onExportResults(format)
  } else {
    // Default export
    const dataStr = JSON.stringify(simulationResults, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    downloadBlob(blob, `results.${format}`)
  }
}
```

## Integration Points

### Backend API
```
POST /api/reports/pmr/{report_id}/monte-carlo
├── Request: MonteCarloParams
└── Response: MonteCarloResults

POST /api/reports/pmr/{report_id}/monte-carlo/export
├── Request: { format, results }
└── Response: File blob
```

### Component Dependencies
```
MonteCarloAnalysisComponent
├── InteractiveChart (visualization)
├── Lucide React (icons)
├── PMR Types (type definitions)
└── API Client (backend communication)
```

## Responsive Design

### Desktop (≥1024px)
- 4-column grid for summary cards
- 2-column grid for charts
- 3-column grid for scenarios
- Full-width configuration panel

### Tablet (768px - 1023px)
- 2-column grid for summary cards
- 1-column grid for charts
- 2-column grid for scenarios
- Full-width configuration panel

### Mobile (<768px)
- 1-column grid for all elements
- Stacked layout
- Collapsible sections
- Touch-optimized controls

## Performance Optimizations

1. **Memoization**
   - `useCallback` for event handlers
   - `useMemo` for chart data preparation
   - `React.memo` for child components (if needed)

2. **Lazy Loading**
   - Charts rendered only when visible
   - Scenario comparison loaded on demand
   - Configuration panel conditional rendering

3. **State Management**
   - Minimal re-renders
   - Efficient state updates
   - Debounced parameter changes

4. **Data Processing**
   - Client-side chart data transformation
   - Cached scenario data
   - Optimized array operations

## Accessibility Features

1. **Keyboard Navigation**
   - Tab order follows visual flow
   - Enter/Space for button activation
   - Escape to close modals/panels

2. **Screen Readers**
   - ARIA labels on interactive elements
   - Role attributes for semantic structure
   - Live regions for dynamic updates

3. **Visual Indicators**
   - Focus outlines
   - Color contrast ratios (WCAG AA)
   - Status indicators with icons and text

4. **Error Handling**
   - Clear error messages
   - Accessible error announcements
   - Recovery suggestions

## Testing Strategy

### Unit Tests
- Parameter validation
- Chart data transformation
- Scenario management
- Export functionality

### Integration Tests
- API integration
- Chart rendering
- User interactions
- State management

### E2E Tests
- Complete simulation workflow
- Scenario save/load/compare
- Export functionality
- Error handling

## Security Considerations

1. **Authentication**
   - Session token validation
   - API authorization headers

2. **Input Validation**
   - Parameter bounds checking
   - Type validation
   - Sanitization of user inputs

3. **Data Protection**
   - No sensitive data in client state
   - Secure API communication
   - Export data sanitization

## Monitoring & Analytics

### Performance Metrics
- Component render time
- API response time
- Chart rendering time
- User interaction latency

### Usage Analytics
- Simulation runs per user
- Most used parameters
- Scenario creation rate
- Export format preferences

### Error Tracking
- API failures
- Rendering errors
- User-reported issues
- Browser compatibility issues
