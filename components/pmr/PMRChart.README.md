# PMR Chart Component

Enhanced interactive chart component specifically designed for Project Monthly Reports (PMR). Extends the base `InteractiveChart` component with PMR-specific features including AI insight overlays, drill-down capabilities, and export functionality.

## Features

- **PMR-Specific Chart Types**: Budget variance, schedule performance, risk heatmap, resource utilization, and cost performance
- **AI Insight Overlays**: Display AI-generated insights directly on chart data points
- **Drill-Down Capabilities**: Interactive exploration of chart data with detailed views
- **Export Functionality**: Export charts in multiple formats (PNG, SVG, PDF, JSON, CSV) for PMR reports
- **Status Indicators**: Visual indicators for critical, at-risk, and on-track data points
- **Expanded View**: Full-screen chart view for detailed analysis
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Installation

The component is part of the PMR component library and can be imported from the PMR index:

```typescript
import { PMRChart } from '@/components/pmr'
```

## Usage

### Basic Example

```typescript
import { PMRChart, PMRChartDataPoint } from '@/components/pmr'

const data: PMRChartDataPoint[] = [
  {
    name: 'Labor',
    value: 560000,
    baseline: 500000,
    variance: 12,
    status: 'at-risk',
    aiInsights: [/* AI insights */]
  },
  // ... more data points
]

function MyComponent() {
  return (
    <PMRChart
      type="budget-variance"
      data={data}
      title="Budget Variance Analysis"
      showAIInsights={true}
      enableDrillDown={true}
      enableExport={true}
    />
  )
}
```

### Chart Types

#### Budget Variance

Visualizes budget performance across categories with variance indicators:

```typescript
<PMRChart
  type="budget-variance"
  data={budgetData}
  title="Budget Variance Analysis"
  showAIInsights={true}
/>
```

#### Schedule Performance

Tracks schedule performance index (SPI) over time:

```typescript
<PMRChart
  type="schedule-performance"
  data={scheduleData}
  title="Schedule Performance Index"
  showAIInsights={true}
/>
```

#### Risk Heatmap

Displays risk scores with color-coded severity:

```typescript
<PMRChart
  type="risk-heatmap"
  data={riskData}
  title="Risk Heatmap"
  showAIInsights={true}
/>
```

#### Resource Utilization

Shows resource allocation and utilization rates:

```typescript
<PMRChart
  type="resource-utilization"
  data={resourceData}
  title="Resource Utilization"
  showAIInsights={true}
/>
```

#### Cost Performance

Tracks cost performance index (CPI) over time:

```typescript
<PMRChart
  type="cost-performance"
  data={costData}
  title="Cost Performance Index"
  showAIInsights={true}
/>
```

## Data Generation Utilities

The library includes utility functions for generating PMR chart data:

### Budget Variance Data

```typescript
import { generateBudgetVarianceData } from '@/components/pmr'

const budgetData = generateBudgetVarianceData(
  [
    { category: 'Labor', planned: 500000, actual: 560000, forecast: 580000 },
    { category: 'Materials', planned: 200000, actual: 195000, forecast: 198000 }
  ],
  aiInsights // Optional AI insights array
)
```

### Schedule Performance Data

```typescript
import { generateSchedulePerformanceData } from '@/components/pmr'

const scheduleData = generateSchedulePerformanceData(
  [
    { period: 'Q1 2024', plannedProgress: 25, actualProgress: 23, spi: 0.92 },
    { period: 'Q2 2024', plannedProgress: 50, actualProgress: 45, spi: 0.90 }
  ],
  aiInsights
)
```

### Risk Heatmap Data

```typescript
import { generateRiskHeatmapData } from '@/components/pmr'

const riskData = generateRiskHeatmapData(
  [
    { riskCategory: 'Technical', probability: 70, impact: 85, mitigationStatus: 'in-progress' },
    { riskCategory: 'Schedule', probability: 60, impact: 75, mitigationStatus: 'planned' }
  ],
  aiInsights
)
```

### Resource Utilization Data

```typescript
import { generateResourceUtilizationData } from '@/components/pmr'

const resourceData = generateResourceUtilizationData(
  [
    { resourceName: 'Senior Engineers', allocated: 80, utilized: 92, capacity: 100 },
    { resourceName: 'Junior Engineers', allocated: 70, utilized: 68, capacity: 100 }
  ],
  aiInsights
)
```

### Cost Performance Data

```typescript
import { generateCostPerformanceData } from '@/components/pmr'

const costData = generateCostPerformanceData(
  [
    { period: 'Jan 2024', budgetedCost: 100000, actualCost: 105000, earnedValue: 98000 },
    { period: 'Feb 2024', budgetedCost: 100000, actualCost: 102000, earnedValue: 95000 }
  ],
  aiInsights
)
```

## Props

### PMRChartProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `PMRChartType` | Required | Type of PMR chart to display |
| `data` | `PMRChartDataPoint[]` | Required | Chart data points with AI insights |
| `title` | `string` | Optional | Chart title |
| `height` | `number` | `400` | Chart height in pixels |
| `showAIInsights` | `boolean` | `true` | Show AI insight indicators |
| `enableDrillDown` | `boolean` | `true` | Enable drill-down functionality |
| `enableExport` | `boolean` | `true` | Enable export functionality |
| `className` | `string` | `''` | Additional CSS classes |
| `onDataPointClick` | `(dataPoint: PMRChartDataPoint) => void` | Optional | Callback when data point is clicked |
| `onExport` | `(format: string) => void` | Optional | Callback when export is triggered |

### PMRChartDataPoint

```typescript
interface PMRChartDataPoint {
  name: string                    // Data point name/label
  value: number                   // Primary value
  baseline?: number               // Baseline/planned value
  forecast?: number               // Forecasted value
  variance?: number               // Variance percentage
  status?: 'on-track' | 'at-risk' | 'critical'  // Status indicator
  aiInsights?: AIInsight[]        // Associated AI insights
  metadata?: Record<string, any>  // Additional metadata
}
```

## AI Insights Integration

AI insights are displayed as overlays on the chart and can be viewed in detail by clicking on data points:

```typescript
const aiInsight: AIInsight = {
  id: '1',
  type: 'alert',
  category: 'budget',
  title: 'Budget Overrun Alert',
  content: 'Labor costs are trending 12% over budget.',
  confidence_score: 0.89,
  supporting_data: { category: 'Labor' },
  recommended_actions: [
    'Review current resource assignments',
    'Consider hiring freeze for non-critical positions'
  ],
  priority: 'high',
  generated_at: new Date().toISOString(),
  validated: false
}
```

## Export Functionality

Charts can be exported in multiple formats:

- **PNG**: High-resolution raster image
- **SVG**: Vector graphics for scalability
- **PDF**: Document format (currently exports as high-quality PNG)
- **JSON**: Raw data with metadata
- **CSV**: Tabular data format

```typescript
const handleExport = (format: 'png' | 'svg' | 'pdf' | 'json' | 'csv') => {
  console.log('Exporting chart as:', format)
  // Export logic handled by component
}

<PMRChart
  type="budget-variance"
  data={data}
  enableExport={true}
  onExport={handleExport}
/>
```

## Report Integration

Use the `formatForPMRReport` utility to generate report summaries:

```typescript
import { formatForPMRReport } from '@/components/pmr'

const reportData = formatForPMRReport('budget-variance', budgetData)

console.log(reportData.summary)           // Executive summary
console.log(reportData.keyMetrics)        // Key performance metrics
console.log(reportData.insights)          // All AI insights
console.log(reportData.recommendations)   // Recommended actions
```

## Styling

The component uses Tailwind CSS for styling and can be customized with the `className` prop:

```typescript
<PMRChart
  type="budget-variance"
  data={data}
  className="shadow-lg rounded-xl"
/>
```

## Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- High contrast color schemes
- Responsive touch targets

## Performance

- Optimized rendering for large datasets
- Lazy loading of AI insight overlays
- Efficient data transformation
- Memoized calculations

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Examples

See `PMRChart.example.tsx` for a complete working example with all chart types and features.

## Related Components

- `InteractiveChart`: Base chart component
- `AIInsightsPanel`: AI insights display panel
- `PMRExportManager`: Export management component
- `MonteCarloAnalysisComponent`: Monte Carlo simulation component

## License

Part of the Enhanced PMR feature suite.
