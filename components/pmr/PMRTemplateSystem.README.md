# PMR Template System

## Overview

The PMR Template System provides a comprehensive solution for managing, selecting, and customizing Project Monthly Report templates with AI-powered suggestions and recommendations.

## Components

### 1. PMRTemplateSelector

Main component for browsing and selecting PMR templates.

**Features:**
- Template browsing with grid/list views
- Advanced filtering (type, industry, rating, public/private)
- AI-suggested templates based on project context
- Search functionality
- Template rating and feedback
- Template preview and customization
- Template creation and management

**Usage:**
```tsx
import { PMRTemplateSelector } from '@/components/pmr'

<PMRTemplateSelector
  templates={templates}
  selectedTemplateId={selectedId}
  projectType="executive"
  industryFocus="construction"
  onSelectTemplate={(id) => console.log('Selected:', id)}
  onPreviewTemplate={(id) => console.log('Preview:', id)}
  onCustomizeTemplate={(id) => console.log('Customize:', id)}
  onRateTemplate={async (id, rating) => {
    // Submit rating to API
  }}
  isLoading={false}
/>
```

**Props:**
- `templates`: Array of PMRTemplate objects
- `selectedTemplateId`: Currently selected template ID
- `projectType`: Project type for AI suggestions
- `industryFocus`: Industry focus for AI suggestions
- `onSelectTemplate`: Callback when template is selected
- `onCreateTemplate`: Optional callback for creating new templates
- `onUpdateTemplate`: Optional callback for updating templates
- `onDeleteTemplate`: Optional callback for deleting templates
- `onRateTemplate`: Optional callback for rating templates
- `onPreviewTemplate`: Optional callback for previewing templates
- `onCustomizeTemplate`: Optional callback for customizing templates
- `isLoading`: Loading state
- `className`: Additional CSS classes

### 2. PMRTemplatePreview

Modal component for previewing template details.

**Features:**
- Full template information display
- Section breakdown with requirements
- Default metrics visualization
- Export format support
- AI capabilities overview
- Usage statistics
- Quick actions (select, customize)

**Usage:**
```tsx
import { PMRTemplatePreview } from '@/components/pmr'

<PMRTemplatePreview
  template={template}
  onClose={() => setPreviewTemplate(null)}
  onSelect={() => handleSelectTemplate(template.id)}
  onCustomize={() => handleCustomizeTemplate(template.id)}
/>
```

**Props:**
- `template`: PMRTemplate object to preview
- `onClose`: Callback to close the preview
- `onSelect`: Optional callback to select the template
- `onCustomize`: Optional callback to customize the template

### 3. PMRTemplateCustomizer

Modal component for customizing template structure and content.

**Features:**
- Template name and description editing
- Section management (add, remove, reorder)
- Section configuration (title, description, required flag)
- Default metrics management
- AI-powered suggestions for sections and metrics
- Drag-and-drop section reordering
- Real-time validation

**Usage:**
```tsx
import { PMRTemplateCustomizer } from '@/components/pmr'

<PMRTemplateCustomizer
  template={template}
  onSave={async (customized) => {
    await updateTemplate(template.id, customized)
  }}
  onClose={() => setCustomizeTemplate(null)}
  onGetAISuggestions={async (context) => {
    return await getAISuggestions(template.id)
  }}
/>
```

**Props:**
- `template`: PMRTemplate object to customize
- `onSave`: Callback to save customized template
- `onClose`: Callback to close the customizer
- `onGetAISuggestions`: Optional callback to get AI suggestions

## Hook: usePMRTemplates

Custom React hook for managing PMR templates with API integration.

**Features:**
- Automatic template fetching
- Template CRUD operations
- Template rating
- AI suggestions retrieval
- Error handling
- Loading states

**Usage:**
```tsx
import { usePMRTemplates } from '@/hooks/usePMRTemplates'

const {
  templates,
  isLoading,
  error,
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  rateTemplate,
  getAISuggestions
} = usePMRTemplates({
  projectType: 'executive',
  industryFocus: 'construction',
  autoFetch: true
})
```

**Options:**
- `projectType`: Filter templates by project type
- `industryFocus`: Filter templates by industry
- `autoFetch`: Automatically fetch templates on mount (default: true)

**Returns:**
- `templates`: Array of PMRTemplate objects
- `isLoading`: Loading state
- `error`: Error object if any
- `fetchTemplates`: Function to manually fetch templates
- `createTemplate`: Function to create a new template
- `updateTemplate`: Function to update an existing template
- `deleteTemplate`: Function to delete a template
- `rateTemplate`: Function to rate a template
- `getAISuggestions`: Function to get AI suggestions for a template

## Data Types

### PMRTemplate

```typescript
interface PMRTemplate {
  id: string
  name: string
  description?: string
  template_type: 'executive' | 'technical' | 'financial' | 'custom'
  industry_focus?: string
  sections: Array<{
    section_id: string
    title: string
    description?: string
    required: boolean
    ai_suggestions?: Record<string, any>
  }>
  default_metrics: string[]
  ai_suggestions: Record<string, any>
  branding_config: Record<string, any>
  export_formats: string[]
  is_public: boolean
  created_by: string
  organization_id?: string
  usage_count: number
  rating?: number
  created_at: string
  updated_at: string
}
```

## AI Features

### AI-Suggested Templates

The system automatically suggests templates based on:
- Project type matching
- Industry focus alignment
- Template ratings and usage statistics
- Historical project patterns

Templates are ranked and displayed in a special "AI Recommended" section.

### AI-Powered Customization

When customizing templates, users can request AI suggestions for:
- Additional sections based on project context
- Relevant metrics for the project type
- Section descriptions and requirements
- Best practices from similar projects

## Integration Example

Complete integration example showing all components working together:

```tsx
import React, { useState } from 'react'
import {
  PMRTemplateSelector,
  PMRTemplatePreview,
  PMRTemplateCustomizer
} from '@/components/pmr'
import { usePMRTemplates } from '@/hooks/usePMRTemplates'

export default function PMRTemplateManagement() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>()
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [customizeTemplate, setCustomizeTemplate] = useState(null)

  const {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    rateTemplate,
    getAISuggestions
  } = usePMRTemplates({
    projectType: 'executive',
    industryFocus: 'construction'
  })

  return (
    <div>
      <PMRTemplateSelector
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={setSelectedTemplateId}
        onPreviewTemplate={(id) => {
          const template = templates.find(t => t.id === id)
          setPreviewTemplate(template)
        }}
        onCustomizeTemplate={(id) => {
          const template = templates.find(t => t.id === id)
          setCustomizeTemplate(template)
        }}
        onRateTemplate={rateTemplate}
        isLoading={isLoading}
      />

      {previewTemplate && (
        <PMRTemplatePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onSelect={() => {
            setSelectedTemplateId(previewTemplate.id)
            setPreviewTemplate(null)
          }}
        />
      )}

      {customizeTemplate && (
        <PMRTemplateCustomizer
          template={customizeTemplate}
          onSave={async (customized) => {
            await updateTemplate(customizeTemplate.id, customized)
            setCustomizeTemplate(null)
          }}
          onClose={() => setCustomizeTemplate(null)}
          onGetAISuggestions={getAISuggestions}
        />
      )}
    </div>
  )
}
```

## API Endpoints

The template system expects the following API endpoints:

### GET /reports/pmr/templates
Fetch all templates with optional filters
- Query params: `template_type`, `industry`
- Returns: Array of PMRTemplate objects

### POST /reports/pmr/templates
Create a new template
- Body: Partial PMRTemplate object
- Returns: Created PMRTemplate object

### PUT /reports/pmr/templates/:id
Update an existing template
- Body: Partial PMRTemplate object
- Returns: Updated PMRTemplate object

### DELETE /reports/pmr/templates/:id
Delete a template
- Returns: Success confirmation

### POST /reports/pmr/templates/:id/rate
Rate a template
- Body: `{ rating: number }`
- Returns: Success confirmation

### GET /reports/pmr/templates/:id/ai-suggestions
Get AI suggestions for a template
- Query params: `project_type`
- Returns: AI suggestions object

## Styling

All components use Tailwind CSS for styling and are fully responsive. They follow the existing design system patterns used in other PMR components.

## Accessibility

- Keyboard navigation support
- ARIA labels and roles
- Focus management in modals
- Screen reader friendly

## Performance Considerations

- Lazy loading of template previews
- Optimistic UI updates for ratings
- Debounced search input
- Memoized filtered results
- Efficient re-rendering with React.memo where appropriate

## Future Enhancements

- Template versioning
- Template sharing and collaboration
- Template marketplace
- Advanced AI recommendations based on project outcomes
- Template analytics and insights
- Bulk template operations
- Template import/export
