# Enhanced PMR API Client

Type-safe API client for Enhanced Project Monthly Report (PMR) features with built-in error handling, caching, and retry mechanisms.

## Features

- ✅ **Type-Safe**: Full TypeScript support with comprehensive type definitions
- ✅ **Error Handling**: Automatic error handling with custom PMRAPIError class
- ✅ **Caching**: Built-in caching for frequently accessed data with configurable TTL
- ✅ **Retry Logic**: Automatic retry on network failures with exponential backoff
- ✅ **Batch Operations**: Support for batch updates and validations
- ✅ **Real-time Collaboration**: WebSocket-ready collaboration session management

## Installation

```typescript
import { pmrAPI } from '@/lib/pmr-api'
// or import specific functions
import { generatePMR, getPMRReport } from '@/lib/pmr-api'
```

## Usage Examples

### Generate a New PMR Report

```typescript
const report = await pmrAPI.generatePMR({
  project_id: 'project-123',
  report_month: '2024-01',
  report_year: 2024,
  template_id: 'template-456',
  title: 'January 2024 PMR',
  include_ai_insights: true,
  include_monte_carlo: true
})

console.log(`Report ${report.id} is ${report.status}`)
```

### Retrieve a PMR Report

```typescript
// Basic retrieval
const report = await pmrAPI.getPMRReport('report-123')

// With options
const reportWithInsights = await pmrAPI.getPMRReport('report-123', {
  includeInsights: true,
  includeCollaboration: true
})
```

### Update a Section

```typescript
const updatedSection = await pmrAPI.updatePMRSection(
  'report-123',
  'executive-summary',
  {
    title: 'Executive Summary',
    content: 'Updated content...',
    metrics: { budget_utilization: 0.85 }
  },
  'merge' // or 'replace'
)
```

### Chat-Based Editing

```typescript
const response = await pmrAPI.chatEditPMR('report-123', {
  message: 'Update the executive summary to highlight recent achievements',
  context: {
    current_section: 'executive_summary',
    user_role: 'project_manager'
  }
})

console.log(response.response) // AI response
console.log(response.changes_applied) // Applied changes
```

### Generate AI Insights

```typescript
const insights = await pmrAPI.generateAIInsights('report-123', {
  insight_types: ['prediction', 'recommendation'],
  categories: ['budget', 'schedule', 'risk'],
  context: {
    focus_areas: ['cost_optimization'],
    time_horizon: '3_months'
  }
})

insights.forEach(insight => {
  console.log(`${insight.title}: ${insight.confidence_score}`)
})
```

### Run Monte Carlo Analysis

```typescript
const results = await pmrAPI.runMonteCarloAnalysis('report-123', {
  analysis_type: 'budget_variance',
  iterations: 10000,
  confidence_levels: [0.5, 0.8, 0.95],
  parameters: {
    budget_uncertainty: 0.15,
    schedule_uncertainty: 0.20
  }
})

console.log(`P50: ${results.results.budget_completion.p50}`)
```

### Export Report

```typescript
// Start export
const exportJob = await pmrAPI.exportPMR('report-123', {
  format: 'pdf',
  template_id: 'template-789',
  options: {
    include_charts: true,
    include_raw_data: false,
    branding: {
      logo_url: 'https://company.com/logo.png',
      color_scheme: 'corporate_blue'
    }
  }
})

// Check status
const status = await pmrAPI.getExportJobStatus('report-123', exportJob.id)

// Download when ready
if (status.status === 'completed') {
  await pmrAPI.downloadExport('report-123', exportJob.id, 'pmr-report.pdf')
}
```

### List Templates

```typescript
// All templates
const templates = await pmrAPI.listPMRTemplates()

// Filtered templates
const executiveTemplates = await pmrAPI.listPMRTemplates({
  template_type: 'executive',
  is_public: true
})

// AI-suggested templates
const suggestions = await pmrAPI.getAISuggestedTemplates(
  'project-123',
  'technology',
  'software'
)
```

### Collaboration

```typescript
// Start collaboration session
const session = await pmrAPI.startCollaborationSession(
  'report-123',
  ['user1@example.com', 'user2@example.com'],
  {
    'user1@example.com': 'edit',
    'user2@example.com': 'comment'
  }
)

// Get session details
const sessionDetails = await pmrAPI.getCollaborationSession(
  'report-123',
  session.session_id
)

// End session
await pmrAPI.endCollaborationSession('report-123', session.session_id)
```

### Batch Operations

```typescript
// Batch update sections
const updatedSections = await pmrAPI.batchUpdateSections('report-123', [
  { section_id: 'section-1', content: { text: 'Content 1' } },
  { section_id: 'section-2', content: { text: 'Content 2' } }
])

// Batch validate insights
const validatedInsights = await pmrAPI.batchValidateInsights('report-123', [
  { insight_id: 'insight-1', is_valid: true, notes: 'Confirmed' },
  { insight_id: 'insight-2', is_valid: false, notes: 'Needs review' }
])
```

## Cache Management

```typescript
// Check if report is cached
if (pmrAPI.isReportCached('report-123')) {
  console.log('Report is in cache')
}

// Invalidate specific report cache
pmrAPI.invalidateReportCache('report-123')

// Clear all PMR cache
pmrAPI.clearPMRCache()
```

## Error Handling

```typescript
import { PMRAPIError } from '@/lib/pmr-api'

try {
  const report = await pmrAPI.getPMRReport('invalid-id')
} catch (error) {
  if (error instanceof PMRAPIError) {
    console.error(`API Error: ${error.message}`)
    console.error(`Status: ${error.status}`)
    console.error(`Code: ${error.code}`)
    console.error(`Details:`, error.details)
  }
}
```

## Configuration

The API client uses the following default configuration:

```typescript
{
  baseUrl: '/api/reports/pmr',
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  retryAttempts: 3,
  retryDelay: 1000 // 1 second
}
```

## Caching Strategy

- **GET requests**: Cached by default with 2-5 minute TTL
- **POST/PUT/DELETE**: Never cached, invalidate related caches
- **Lists**: 1 minute TTL
- **Individual reports**: 2 minutes TTL
- **Templates**: 10 minutes TTL

## Retry Logic

The client automatically retries failed requests with exponential backoff:

- **Retryable errors**: Network errors, 5xx server errors, 408 timeout
- **Non-retryable errors**: 4xx client errors (except 408)
- **Max attempts**: 3 (configurable)
- **Backoff**: Exponential (1s, 2s, 4s)

## Type Definitions

All types are imported from `components/pmr/types.ts`:

- `PMRReport`: Complete report structure
- `PMRSection`: Report section
- `AIInsight`: AI-generated insight
- `MonteCarloResults`: Monte Carlo analysis results
- `ExportJob`: Export job status
- `PMRTemplate`: Report template
- `CollaborationSession`: Collaboration session
- `ChatEditRequest/Response`: Chat editing

## Best Practices

1. **Use caching wisely**: Don't disable cache unless necessary
2. **Handle errors**: Always wrap API calls in try-catch
3. **Batch operations**: Use batch methods for multiple updates
4. **Invalidate cache**: Manually invalidate after external changes
5. **Monitor performance**: Check cache hit rates and response times

## Testing

```typescript
import { pmrAPI, clearPMRCache } from '@/lib/pmr-api'

beforeEach(() => {
  clearPMRCache()
})

test('should generate PMR report', async () => {
  const report = await pmrAPI.generatePMR({
    // ... request data
  })
  expect(report.id).toBeDefined()
})
```

## API Reference

See the [Backend API Specification](.kiro/specs/enhanced-pmr-feature/backend-api-spec.md) for complete API endpoint documentation.
