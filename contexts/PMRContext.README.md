# PMR Context and State Management

Centralized state management for Enhanced Project Monthly Report (PMR) features with support for real-time collaboration, optimistic updates, and offline functionality.

## Overview

The PMR Context provides a comprehensive state management solution for the Enhanced PMR feature, including:

- **Report Operations**: Load, create, update, and delete reports
- **Section Management**: CRUD operations for report sections
- **AI Insights**: Generate, validate, and filter AI-generated insights
- **Monte Carlo Analysis**: Run and manage predictive simulations
- **Chat-Based Editing**: Natural language report editing
- **Export Management**: Multi-format export with progress tracking
- **Collaboration**: Real-time multi-user editing support
- **Optimistic Updates**: Instant UI feedback with automatic sync
- **Offline Support**: Queue changes when offline, sync when online
- **Error Recovery**: Automatic retry with exponential backoff

## Installation

The PMR Context is already integrated into the application. To use it in your components:

```tsx
import { PMRProvider, usePMRContext } from '@/contexts/PMRContext'
import { usePMRContext as useEnhancedPMRContext } from '@/hooks/usePMRContext'
```

## Basic Usage

### 1. Wrap Your App with PMRProvider

```tsx
import { PMRProvider } from '@/contexts/PMRContext'

function App() {
  return (
    <PMRProvider apiBaseUrl="/api">
      <YourComponents />
    </PMRProvider>
  )
}
```

### 2. Access Context in Components

```tsx
import { usePMRContext } from '@/contexts/PMRContext'

function MyComponent() {
  const { state, actions } = usePMRContext()
  
  // Access state
  const report = state.currentReport
  const isLoading = state.isLoading
  
  // Call actions
  useEffect(() => {
    actions.loadReport('report-id')
  }, [])
  
  return <div>{report?.title}</div>
}
```

### 3. Use Enhanced Hook for Utilities

```tsx
import { usePMRContext } from '@/hooks/usePMRContext'

function MyComponent() {
  const {
    hasReport,
    sections,
    getHighPriorityInsights,
    updateSectionDebounced
  } = usePMRContext()
  
  // Use convenient utilities
  const insights = getHighPriorityInsights()
  
  return <div>...</div>
}
```

## State Structure

```typescript
interface PMRContextState {
  currentReport: PMRReport | null          // Currently loaded report
  isLoading: boolean                       // Loading state
  isSaving: boolean                        // Saving state
  error: string | null                     // Error message
  collaborationSession: CollaborationSession | null  // Active collaboration
  exportJobs: ExportJob[]                  // Export job queue
  pendingChanges: Map<string, any>         // Offline change queue
  lastSyncTime: Date | null                // Last successful sync
  isOnline: boolean                        // Network status
}
```

## Available Actions

### Report Operations

```typescript
// Load a report
await actions.loadReport(reportId: string)

// Create a new report
const reportId = await actions.createReport(request: PMRGenerationRequest)

// Update report metadata
await actions.updateReport(updates: Partial<PMRReport>)

// Delete a report
await actions.deleteReport(reportId: string)
```

### Section Operations

```typescript
// Update a section (with optimistic updates)
await actions.updateSection(sectionId: string, content: any)

// Add a new section
await actions.addSection(section: Omit<PMRSection, 'last_modified' | 'modified_by'>)

// Remove a section
await actions.removeSection(sectionId: string)

// Reorder sections
await actions.reorderSections(sectionIds: string[])
```

### AI Insights

```typescript
// Generate insights for specific categories
await actions.generateInsights(categories?: string[])

// Validate an insight
await actions.validateInsight(insightId: string, isValid: boolean, notes?: string)

// Provide feedback
await actions.provideFeedback(insightId: string, feedback: 'helpful' | 'not_helpful')

// Filter insights
const filtered = actions.filterInsights(filters: InsightFilters)
```

### Monte Carlo Analysis

```typescript
// Run Monte Carlo simulation
await actions.runMonteCarloAnalysis(params: any)
```

### Chat-Based Editing

```typescript
// Send a chat edit request
const response = await actions.sendChatEdit({
  message: "Update the executive summary to highlight recent achievements",
  context: { currentSection: 'executive_summary' }
})
```

### Export Operations

```typescript
// Export report
const jobId = await actions.exportReport(
  format: 'pdf' | 'excel' | 'slides' | 'word',
  options?: any
)

// Check export status
const job = await actions.getExportStatus(jobId: string)

// Cancel export
await actions.cancelExport(jobId: string)
```

### Collaboration

```typescript
// Start collaboration session
await actions.startCollaboration(participants: string[])

// End collaboration
await actions.endCollaboration()
```

### Error Handling

```typescript
// Clear error
actions.clearError()

// Retry last failed operation
await actions.retryLastOperation()
```

### Optimistic Updates

```typescript
// Apply optimistic update (instant UI feedback)
actions.applyOptimisticUpdate(sectionId: string, content: any)

// Revert optimistic update
actions.revertOptimisticUpdate(sectionId: string)
```

## Enhanced Hook Utilities

The `usePMRContext` hook from `@/hooks/usePMRContext` provides additional utilities:

```typescript
const {
  // Computed state
  hasReport,              // boolean: Is a report loaded?
  reportId,               // string | undefined: Current report ID
  isModifying,            // boolean: Is loading or saving?
  hasUnsavedChanges,      // boolean: Are there pending changes?
  canEdit,                // boolean: Can the report be edited?
  isDraft,                // boolean: Is report in draft status?
  isCollaborating,        // boolean: Is collaboration active?
  
  // Getters
  getSection,             // Get section by ID
  sections,               // All sections
  getInsights,            // Get insights with optional filters
  getInsightsByCategory,  // Get insights for a category
  getHighPriorityInsights, // Get high/critical priority insights
  getUnvalidatedInsights, // Get unvalidated insights
  monteCarloResults,      // Monte Carlo analysis results
  activeCollaborators,    // List of active collaborators
  exportJobs,             // All export jobs
  activeExportJobs,       // Active/queued export jobs
  completedExportJobs,    // Completed export jobs
  
  // Enhanced actions
  updateSectionDebounced, // Update with debouncing
  updateSections,         // Batch update multiple sections
  generateCategoryInsights, // Generate insights for categories
  validateInsights,       // Validate multiple insights
  exportWithProgress      // Export with progress callback
} = usePMRContext()
```

## Features

### Optimistic Updates

Changes are applied immediately to the UI and synced to the server in the background:

```typescript
// User sees the change instantly
await actions.updateSection('section-1', { text: 'New content' })
// UI updates immediately, API call happens in background
```

### Offline Support

Changes are queued when offline and automatically synced when connection is restored:

```typescript
// Works offline
await actions.updateSection('section-1', { text: 'Offline edit' })
// Change is queued in pendingChanges

// When online, changes are automatically synced
// state.pendingChanges is cleared after successful sync
```

### Error Recovery

Automatic retry with exponential backoff for network errors:

```typescript
// Network error occurs
await actions.loadReport('report-id')
// Automatically retries up to 3 times with increasing delays

// Manual retry
if (state.error) {
  await actions.retryLastOperation()
}
```

### Real-Time Collaboration

Track active collaborators and manage sessions:

```typescript
// Start collaboration
await actions.startCollaboration(['user2@example.com'])

// Check collaboration status
if (state.collaborationSession) {
  console.log('Active editors:', state.collaborationSession.active_editors)
}

// End collaboration
await actions.endCollaboration()
```

## Best Practices

### 1. Use Enhanced Hook for Computed Values

```typescript
// ❌ Don't compute in component
const hasReport = state.currentReport !== null

// ✅ Use enhanced hook
const { hasReport } = usePMRContext()
```

### 2. Handle Loading and Error States

```typescript
function MyComponent() {
  const { state, actions } = usePMRContext()
  
  if (state.isLoading) return <LoadingSpinner />
  if (state.error) return <ErrorMessage error={state.error} onRetry={actions.retryLastOperation} />
  if (!state.currentReport) return <EmptyState />
  
  return <ReportContent report={state.currentReport} />
}
```

### 3. Use Debounced Updates for Text Input

```typescript
function TextEditor({ sectionId }: { sectionId: string }) {
  const { updateSectionDebounced } = usePMRContext()
  const [text, setText] = useState('')
  
  useEffect(() => {
    const cleanup = updateSectionDebounced(sectionId, { text }, 1000)
    return cleanup
  }, [text])
  
  return <textarea value={text} onChange={e => setText(e.target.value)} />
}
```

### 4. Show Offline Indicator

```typescript
function OfflineIndicator() {
  const { state } = usePMRContext()
  
  if (!state.isOnline) {
    return (
      <div className="offline-banner">
        ⚠️ You're offline. Changes will sync when you're back online.
        {state.pendingChanges.size > 0 && (
          <span> ({state.pendingChanges.size} pending changes)</span>
        )}
      </div>
    )
  }
  
  return null
}
```

### 5. Track Export Progress

```typescript
function ExportButton() {
  const { exportWithProgress } = usePMRContext()
  const [progress, setProgress] = useState(0)
  
  const handleExport = async () => {
    await exportWithProgress('pdf', {}, (p) => setProgress(p))
  }
  
  return (
    <div>
      <button onClick={handleExport}>Export PDF</button>
      {progress > 0 && <progress value={progress} max={100} />}
    </div>
  )
}
```

## Testing

The context includes comprehensive tests. Run them with:

```bash
npm test contexts/__tests__/PMRContext.test.tsx
```

## API Integration

The context expects the following API endpoints:

- `GET /api/reports/pmr/:reportId` - Load report
- `POST /api/reports/pmr/generate` - Create report
- `PATCH /api/reports/pmr/:reportId` - Update report
- `DELETE /api/reports/pmr/:reportId` - Delete report
- `PUT /api/reports/pmr/:reportId/sections/:sectionId` - Update section
- `POST /api/reports/pmr/:reportId/sections` - Add section
- `DELETE /api/reports/pmr/:reportId/sections/:sectionId` - Remove section
- `POST /api/reports/pmr/:reportId/insights/generate` - Generate insights
- `POST /api/reports/pmr/:reportId/monte-carlo` - Run Monte Carlo
- `POST /api/reports/pmr/:reportId/edit/chat` - Chat edit
- `POST /api/reports/pmr/:reportId/export` - Export report
- `POST /api/reports/pmr/:reportId/collaborate` - Start collaboration

## Examples

See `PMRContext.example.tsx` for complete usage examples including:

- Basic report loading
- Section editing with optimistic updates
- AI insights panel
- Export manager
- Chat-based editing
- Collaboration status
- Error recovery

## License

Internal use only - Orka PPM
