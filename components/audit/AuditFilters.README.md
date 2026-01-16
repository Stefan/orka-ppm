# AuditFilters Component

A comprehensive, feature-rich filter component for audit events with support for date ranges, multi-select filters, user autocomplete, and advanced filtering options.

## Features

- **Date Range Picker**: Select start and end dates using react-datepicker
- **Event Type Multi-Select**: Filter by multiple event types with checkboxes
- **User Selector**: Autocomplete search for filtering by specific users
- **Entity Type Selector**: Filter by entity types (project, resource, risk, etc.)
- **Severity Filter**: Filter by severity levels (info, warning, error, critical)
- **Category Filter**: Filter by AI-generated categories (Security Change, Financial Impact, etc.)
- **Risk Level Filter**: Filter by risk levels (Low, Medium, High, Critical)
- **Anomalies Only**: Toggle to show only anomalous events
- **Collapsible Advanced Filters**: Keep the UI clean with expandable advanced options
- **Filter Reset**: Clear all filters with a single click
- **Active Indicator**: Visual feedback when filters are applied

## Installation

The component requires `react-datepicker`:

```bash
npm install react-datepicker @types/react-datepicker
```

## Basic Usage

```tsx
import { useState } from 'react'
import AuditFilters, { AuditFilters as AuditFiltersType } from '@/components/audit/AuditFilters'

function MyAuditPage() {
  const [filters, setFilters] = useState<AuditFiltersType>({
    dateRange: { start: null, end: null },
    eventTypes: [],
    severity: [],
    categories: [],
    riskLevels: [],
    showAnomaliesOnly: false
  })

  return (
    <AuditFilters
      filters={filters}
      onChange={setFilters}
    />
  )
}
```

## Props

### `filters` (required)
Type: `AuditFilters`

The current filter state. Must include all filter properties:

```typescript
interface AuditFilters {
  dateRange?: {
    start: Date | null
    end: Date | null
  }
  eventTypes?: string[]
  userIds?: string[]
  entityTypes?: string[]
  severity?: string[]
  categories?: string[]
  riskLevels?: string[]
  showAnomaliesOnly?: boolean
}
```

### `onChange` (required)
Type: `(filters: AuditFilters) => void`

Callback function called when any filter changes. Receives the complete updated filter state.

### `availableEventTypes` (optional)
Type: `string[]`
Default: `['user_login', 'user_logout', 'budget_change', 'permission_change', ...]`

Array of event types to display in the event type filter.

### `availableUsers` (optional)
Type: `UserOption[]`
Default: `[]`

Array of users for the autocomplete selector:

```typescript
interface UserOption {
  id: string
  name: string
  email?: string
}
```

### `availableEntityTypes` (optional)
Type: `string[]`
Default: `['project', 'resource', 'risk', 'change_request', 'budget', 'user', 'report']`

Array of entity types to display in the entity type filter.

### `className` (optional)
Type: `string`
Default: `''`

Additional CSS classes to apply to the root element.

### `showAdvancedFilters` (optional)
Type: `boolean`
Default: `true`

Whether to show the advanced filters section (collapsible). Set to `false` for a more compact view.

## Advanced Usage

### With User Autocomplete

```tsx
const availableUsers = [
  { id: '1', name: 'John Doe', email: 'john@example.com' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
]

<AuditFilters
  filters={filters}
  onChange={setFilters}
  availableUsers={availableUsers}
  showAdvancedFilters={true}
/>
```

### With Custom Event Types

```tsx
const customEventTypes = [
  'user_login',
  'budget_change',
  'permission_change',
  'project_created'
]

<AuditFilters
  filters={filters}
  onChange={setFilters}
  availableEventTypes={customEventTypes}
/>
```

### Integration with API

```tsx
const handleFilterChange = async (newFilters: AuditFiltersType) => {
  setFilters(newFilters)
  
  // Build query parameters
  const params = new URLSearchParams()
  
  if (newFilters.dateRange?.start) {
    params.append('start_date', newFilters.dateRange.start.toISOString())
  }
  if (newFilters.dateRange?.end) {
    params.append('end_date', newFilters.dateRange.end.toISOString())
  }
  if (newFilters.eventTypes?.length) {
    params.append('event_types', newFilters.eventTypes.join(','))
  }
  if (newFilters.severity?.length) {
    params.append('severity', newFilters.severity.join(','))
  }
  if (newFilters.categories?.length) {
    params.append('categories', newFilters.categories.join(','))
  }
  if (newFilters.riskLevels?.length) {
    params.append('risk_levels', newFilters.riskLevels.join(','))
  }
  if (newFilters.showAnomaliesOnly) {
    params.append('anomalies_only', 'true')
  }
  
  // Fetch filtered data
  const response = await fetch(`/api/audit/events?${params}`)
  const data = await response.json()
  setAuditEvents(data.events)
}

<AuditFilters
  filters={filters}
  onChange={handleFilterChange}
/>
```

## Styling

The component uses Tailwind CSS classes and follows the existing design system. It includes:

- Responsive grid layouts
- Hover states for interactive elements
- Color-coded severity and risk levels
- Smooth transitions and animations
- Accessible form controls

### Custom Styling

You can add custom classes via the `className` prop:

```tsx
<AuditFilters
  filters={filters}
  onChange={setFilters}
  className="shadow-lg"
/>
```

## Accessibility

The component follows accessibility best practices:

- Semantic HTML with proper labels
- Keyboard navigation support
- ARIA attributes where appropriate
- Focus management
- Screen reader friendly

## Filter Categories

### Severity Levels
- **Info**: Informational events (blue)
- **Warning**: Warning events (yellow)
- **Error**: Error events (orange)
- **Critical**: Critical events (red)

### Categories
- **Security Change**: Permission changes, access control (Shield icon)
- **Financial Impact**: Budget changes, cost updates (Dollar icon)
- **Resource Allocation**: Resource assignments, capacity changes (Users icon)
- **Risk Event**: Risk creation, mitigation actions (Alert icon)
- **Compliance Action**: Audit access, report generation (File icon)

### Risk Levels
- **Low**: Routine operations (green)
- **Medium**: Standard changes (yellow)
- **High**: Significant changes (orange)
- **Critical**: Critical events (red)

## Requirements Validation

This component satisfies the following requirements from the AI-Empowered Audit Trail specification:

- **Requirement 2.5**: Date range filtering
- **Requirement 2.6**: Event type filtering
- **Requirement 2.7**: User, entity type, and severity filtering
- **Requirement 4.9**: Category filtering
- **Requirement 4.10**: Risk level filtering

## Testing

The component includes comprehensive unit tests covering:

- Rendering and display
- Filter interactions
- State management
- User autocomplete
- Reset functionality
- Active filter indicators

Run tests with:

```bash
npm test -- components/audit/__tests__/AuditFilters.test.tsx
```

## Examples

See `AuditFilters.example.tsx` for complete working examples including:

- Basic usage
- Custom event types
- User autocomplete
- Timeline integration
- Compact mode
- API integration

## Browser Support

The component supports all modern browsers:

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

The component is optimized for performance:

- Memoized filter computations
- Efficient re-renders with React hooks
- Debounced user search
- Minimal DOM updates

## License

Part of the Orka PPM v2 project.
