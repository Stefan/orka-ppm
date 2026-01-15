# PMRExportManager Component

## Overview

The `PMRExportManager` component provides a comprehensive interface for exporting Enhanced PMR reports in multiple formats with customizable templates and branding options. It includes export queue management with progress tracking and a download interface.

## Features

- **Multi-Format Export**: Support for PDF, Excel, PowerPoint, and Word formats
- **Template Selection**: Choose from predefined templates or use default formatting
- **Branding Customization**: Add company logos, names, and color schemes
- **Section Selection**: Choose which report sections to include in the export
- **Export Options**: Configure chart inclusion, raw data, and other export settings
- **Queue Management**: Track multiple export jobs with real-time status updates
- **Progress Tracking**: Visual indicators for queued, processing, completed, and failed exports
- **Download Interface**: Easy access to completed exports with file management

## Installation

The component is part of the PMR components package:

```typescript
import { PMRExportManager } from '@/components/pmr'
```

## Props

### PMRExportManagerProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `reportId` | `string` | Yes | Unique identifier for the PMR report |
| `report` | `PMRReport` | No | Full report object with sections and metadata |
| `availableFormats` | `ExportFormat[]` | No | Array of available export formats (default: all) |
| `templates` | `ExportTemplate[]` | No | Array of export templates |
| `exportJobs` | `ExportJob[]` | No | Array of current export jobs |
| `onExport` | `(config: ExportConfig) => Promise<void>` | Yes | Callback when export is initiated |
| `onDownload` | `(jobId: string) => void` | Yes | Callback when download is requested |
| `onCancelExport` | `(jobId: string) => void` | No | Callback to cancel a processing export |
| `onDeleteExport` | `(jobId: string) => void` | No | Callback to delete an export job |
| `className` | `string` | No | Additional CSS classes |

## Types

### ExportFormat

```typescript
type ExportFormat = 'pdf' | 'excel' | 'powerpoint' | 'word'
```

### ExportConfig

```typescript
interface ExportConfig {
  format: ExportFormat
  templateId?: string
  options: {
    includeCharts: boolean
    includeRawData: boolean
    includeSections: string[]
    branding?: {
      logoUrl?: string
      colorScheme?: 'corporate_blue' | 'professional_gray' | 'modern_green'
      companyName?: string
    }
  }
}
```

### ExportTemplate

```typescript
interface ExportTemplate {
  id: string
  name: string
  description: string
  format: ExportFormat
  previewUrl?: string
  isDefault: boolean
}
```

## Usage Examples

### Basic Usage

```typescript
import { PMRExportManager } from '@/components/pmr'
import { useState } from 'react'

function MyComponent() {
  const [exportJobs, setExportJobs] = useState([])

  const handleExport = async (config) => {
    // Call your API to initiate export
    const response = await fetch(`/api/reports/${reportId}/export`, {
      method: 'POST',
      body: JSON.stringify(config)
    })
    const data = await response.json()
    
    // Add job to queue
    setExportJobs(prev => [...prev, data.job])
  }

  const handleDownload = (jobId) => {
    // Trigger download
    window.open(`/api/exports/${jobId}/download`, '_blank')
  }

  return (
    <PMRExportManager
      reportId="report-123"
      report={myReport}
      exportJobs={exportJobs}
      onExport={handleExport}
      onDownload={handleDownload}
    />
  )
}
```

### With Templates

```typescript
const templates = [
  {
    id: 'executive',
    name: 'Executive Dashboard',
    description: 'High-level overview for executives',
    format: 'pdf',
    isDefault: true
  },
  {
    id: 'detailed',
    name: 'Detailed Analysis',
    description: 'Comprehensive report with all data',
    format: 'pdf',
    isDefault: false
  }
]

<PMRExportManager
  reportId="report-123"
  report={myReport}
  templates={templates}
  exportJobs={exportJobs}
  onExport={handleExport}
  onDownload={handleDownload}
/>
```

### With Full Features

```typescript
<PMRExportManager
  reportId="report-123"
  report={myReport}
  availableFormats={['pdf', 'excel', 'powerpoint']}
  templates={templates}
  exportJobs={exportJobs}
  onExport={handleExport}
  onDownload={handleDownload}
  onCancelExport={handleCancelExport}
  onDeleteExport={handleDeleteExport}
  className="my-custom-class"
/>
```

## Component Structure

The component consists of two main tabs:

### 1. Configure Export Tab

- **Format Selection**: Visual grid of available export formats
- **Template Selection**: Optional template chooser with descriptions
- **Export Options**: Checkboxes for charts and raw data inclusion
- **Section Selection**: Multi-select list of report sections
- **Branding Configuration**: Company name, logo URL, and color scheme
- **Export Button**: Initiates the export process

### 2. Export Queue Tab

- **Job List**: Shows all export jobs with status
- **Status Indicators**: Visual badges for queued, processing, completed, failed
- **Progress Bars**: Animated progress for processing jobs
- **Action Buttons**: Download, cancel, or delete based on job status
- **File Information**: Size and completion time for finished exports

## Styling

The component uses Tailwind CSS classes and follows the application's design system. Key styling features:

- Responsive grid layouts for format and template selection
- Color-coded status indicators
- Smooth transitions and hover effects
- Loading animations for processing states
- Accessible form controls with proper focus states

## Accessibility

- Keyboard navigation support for all interactive elements
- Proper ARIA labels and roles
- Focus management for modal interactions
- Screen reader friendly status updates
- High contrast mode compatible

## Integration with Backend

The component expects the following API endpoints:

### POST /api/reports/pmr/{reportId}/export

Request:
```json
{
  "format": "pdf",
  "template_id": "template-123",
  "options": {
    "include_charts": true,
    "include_raw_data": false,
    "sections": ["executive_summary", "budget_analysis"],
    "branding": {
      "logo_url": "https://example.com/logo.png",
      "color_scheme": "corporate_blue",
      "company_name": "Acme Corp"
    }
  }
}
```

Response:
```json
{
  "export_job_id": "job-456",
  "status": "queued",
  "estimated_completion": "2024-01-10T15:35:00Z"
}
```

### GET /api/reports/pmr/export/{jobId}/status

Response:
```json
{
  "id": "job-456",
  "status": "completed",
  "download_url": "/downloads/report-123.pdf",
  "file_size": 1024000,
  "completed_at": "2024-01-10T15:35:00Z"
}
```

### GET /api/reports/pmr/export/{jobId}/download

Returns the file as a binary download.

### DELETE /api/reports/pmr/export/{jobId}

Deletes the export job and associated file.

## State Management

The component is controlled, meaning the parent component manages:

- Export jobs array
- Export initiation
- Download handling
- Job cancellation and deletion

This allows for flexible integration with different state management solutions (Redux, Zustand, Context API, etc.).

## Performance Considerations

- Lazy loading of templates and job history
- Optimistic UI updates for better perceived performance
- Debounced section selection for large reports
- Efficient re-rendering with React.memo for job items

## Error Handling

The component handles various error scenarios:

- Failed exports show error messages in the queue
- Network errors during export initiation
- Invalid configuration validation
- Missing required fields

## Future Enhancements

Potential improvements for future versions:

- Drag-and-drop section reordering
- Export preview before generation
- Batch export multiple reports
- Custom template creation interface
- Export scheduling
- Email delivery of completed exports
- Export history with search and filtering

## Related Components

- `PMREditor`: Main report editing interface
- `PMRTemplateSelector`: Standalone template selection
- `AIInsightsPanel`: AI insights that can be included in exports
- `MonteCarloAnalysisComponent`: Analysis results for export

## Support

For issues or questions about the PMRExportManager component, please refer to:

- Component source: `components/pmr/PMRExportManager.tsx`
- Usage examples: `components/pmr/PMRExportManager.example.tsx`
- Type definitions: `components/pmr/types.ts`
- Backend API: `backend/services/export_pipeline_service.py`
