# SAP PO Breakdown Management Components

This directory contains frontend components for the SAP PO Breakdown Management system, enabling import, management, and analysis of hierarchical Purchase Order cost structures.

## Components

### POBreakdownTreeView

Hierarchical tree view component for displaying and managing PO breakdown structures.

**Features:**
- Expandable/collapsible tree structure with visual hierarchy indicators
- Drag-and-drop reordering for custom structure management
- Financial data display (planned, actual, variance)
- Status indicators (on-track, at-risk, critical)
- Action buttons for add, edit, and delete operations
- Automatic total calculations
- Circular reference prevention
- Depth limit enforcement (default: 10 levels)

**Requirements:** 2.6, 4.2

**Usage:**
```tsx
import { POBreakdownTreeView } from '@/components/sap-po'

<POBreakdownTreeView
  data={poBreakdownItems}
  onItemClick={(item) => console.log('Clicked:', item)}
  onItemEdit={(item) => handleEdit(item)}
  onItemDelete={(item) => handleDelete(item)}
  onItemAdd={(parent) => handleAdd(parent)}
  onItemMove={(itemId, newParentId, position) => handleMove(itemId, newParentId, position)}
  enableDragDrop={true}
  enableActions={true}
  maxDepth={10}
/>
```

### POImportExportInterface

File upload and export configuration interface for SAP PO data.

**Features:**
- Dual-mode interface (import/export)
- Drag-and-drop file upload with progress tracking
- Support for CSV, Excel (XLS/XLSX) formats
- Real-time import progress indication
- Detailed error reporting with line-by-line feedback
- Export format selection (CSV, Excel, JSON)
- Export configuration options (hierarchy, financials, custom fields)
- Filter options for targeted exports
- Copy errors to clipboard functionality

**Requirements:** 1.5, 9.6

**Usage:**
```tsx
import { POImportExportInterface } from '@/components/sap-po'

<POImportExportInterface
  projectId={projectId}
  onImportComplete={(result) => {
    if (result.success) {
      console.log('Import successful:', result.successful_records)
    } else {
      console.error('Import failed:', result.errors)
    }
  }}
  onExportComplete={(success) => {
    if (success) {
      console.log('Export completed')
    }
  }}
/>
```

### POFinancialDashboard

Financial analysis dashboard with variance visualization and budget alerts.

**Features:**
- Financial summary cards (planned, actual, variance, status)
- Budget alert display with severity indicators
- Variance visualization charts by category
- Financial overview charts
- Trend analysis with direction indicators
- Threshold configuration interface
- Alert detail modals with recommended actions
- Email notification settings
- Critical alert count badges

**Requirements:** 3.4, 3.5, 5.6

**Usage:**
```tsx
import { POFinancialDashboard } from '@/components/sap-po'

<POFinancialDashboard
  projectId={projectId}
  financialSummary={financialSummary}
  varianceData={varianceData}
  budgetAlerts={budgetAlerts}
  onThresholdUpdate={(config) => {
    console.log('Threshold updated:', config)
  }}
  onAlertDismiss={(alertId) => {
    console.log('Alert dismissed:', alertId)
  }}
/>
```

## Data Interfaces

### POBreakdownItem
```typescript
interface POBreakdownItem {
  id: string
  name: string
  code?: string
  sap_po_number?: string
  hierarchy_level: number
  parent_breakdown_id?: string
  planned_amount: number
  committed_amount: number
  actual_amount: number
  remaining_amount: number
  currency: string
  breakdown_type: string
  category?: string
  status?: 'on-track' | 'at-risk' | 'critical'
  children?: POBreakdownItem[]
  variance_percentage?: number
}
```

### FinancialSummary
```typescript
interface FinancialSummary {
  total_planned: number
  total_committed: number
  total_actual: number
  total_remaining: number
  variance_amount: number
  variance_percentage: number
  currency: string
  by_category: Record<string, {
    planned: number
    actual: number
    variance: number
  }>
  by_status: Record<string, number>
}
```

### VarianceData
```typescript
interface VarianceData {
  planned_vs_actual: number
  planned_vs_committed: number
  committed_vs_actual: number
  variance_percentage: number
  variance_status: 'on_track' | 'minor_variance' | 'significant_variance' | 'critical_variance'
  trend_direction: 'improving' | 'stable' | 'deteriorating'
}
```

### BudgetAlert
```typescript
interface BudgetAlert {
  id: string
  breakdown_id: string
  breakdown_name: string
  alert_type: 'budget_exceeded' | 'commitment_exceeded' | 'negative_variance' | 'trend_deteriorating'
  severity: 'low' | 'medium' | 'high' | 'critical'
  threshold_exceeded: number
  current_variance: number
  message: string
  recommended_actions: string[]
  created_at: string
}
```

## API Integration

All components integrate with the FastAPI backend endpoints:

- **Import:** `POST /api/v1/projects/{project_id}/po-breakdowns/import`
- **Export:** `GET /api/v1/projects/{project_id}/po-breakdowns/export`
- **Hierarchy:** `GET /api/v1/projects/{project_id}/po-hierarchy`
- **Move Item:** `POST /api/v1/po-breakdowns/{breakdown_id}/move`
- **Variance:** `GET /api/v1/projects/{project_id}/po-variance`
- **Threshold Config:** `GET/POST /api/v1/projects/{project_id}/po-threshold-config`

## Testing

All components have comprehensive test coverage:

```bash
npm test -- components/sap-po
```

Test files:
- `__tests__/POBreakdownTreeView.test.tsx`
- `__tests__/POImportExportInterface.test.tsx`
- `__tests__/POFinancialDashboard.test.tsx`

## Dependencies

- React 18+
- react-dropzone (file upload)
- lucide-react (icons)
- @/components/ui (UI components)
- @/components/charts/InteractiveChart (chart visualization)
- @/lib/design-system (utility functions)

## Styling

Components use Tailwind CSS for styling with the project's design system utilities. All components are responsive and support mobile devices.

## Accessibility

- Keyboard navigation support
- ARIA labels and roles
- Screen reader friendly
- Focus management
- Color contrast compliance

## Performance

- Optimized rendering with React.memo
- Efficient tree traversal algorithms
- Lazy loading for large datasets
- Debounced search and filter operations
- Virtual scrolling for large lists (when applicable)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)
