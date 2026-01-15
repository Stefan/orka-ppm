# PMR Editor Component

## Overview

The PMR Editor is a rich text editing component built with TipTap that provides interactive editing capabilities for Project Monthly Reports (PMR). It includes section-based organization, AI suggestions, collaborative editing indicators, and conflict resolution.

## Features

### 1. Rich Text Editing
- **TipTap Integration**: Full-featured rich text editor with formatting toolbar
- **Formatting Options**: Bold, italic, code, headings (H1-H3), lists (bullet/ordered), blockquotes
- **History**: Undo/redo functionality
- **Character Count**: Real-time word and character counting
- **Placeholder**: Contextual placeholder text for empty sections

### 2. Section-Based Organization
- **Collapsible Sections**: Each report section can be expanded/collapsed independently
- **Section Metadata**: Displays last modified time, modified by user, and AI generation status
- **Confidence Scores**: Shows AI confidence scores for AI-generated sections
- **Section Navigation**: Easy navigation between different report sections

### 3. AI Suggestions
- **Request Suggestions**: Get AI-powered content suggestions for any section
- **Confidence Scoring**: Each suggestion includes a confidence score
- **Preview**: Preview suggested content before applying
- **Multiple Suggestions**: Display multiple AI suggestions per section

### 4. Collaborative Editing
- **Real-time Indicators**: Shows active collaborators editing each section
- **User Presence**: Displays number of active collaborators
- **Cursor Tracking**: Support for collaborative cursor positions (infrastructure ready)
- **Conflict Detection**: Identifies and displays editing conflicts
- **Conflict Resolution**: UI for resolving simultaneous edit conflicts

### 5. View Modes
- **Edit Mode**: Full editing capabilities with toolbar
- **Preview Mode**: Read-only preview of the report
- **Toggle**: Easy switching between edit and preview modes

### 6. Auto-Save
- **Unsaved Changes Indicator**: Visual indicator when changes haven't been saved
- **Save Button**: Disabled when no changes, enabled when edits are made
- **Section Save**: Individual section save capability
- **Loading States**: Visual feedback during save operations

## Component Props

```typescript
interface PMREditorProps {
  report: PMRReport                                    // The report to edit
  onSave: (report: PMRReport) => void                 // Save handler
  onSectionUpdate: (sectionId: string, content: any) => void  // Section update handler
  onRequestAISuggestion: (sectionId: string, context: string) => Promise<AISuggestion[]>  // AI suggestion handler
  collaborationSession?: CollaborationSession          // Optional collaboration session
  onCollaborationEvent?: (event: any) => void         // Optional collaboration event handler
  isReadOnly?: boolean                                 // Read-only mode flag
  className?: string                                   // Additional CSS classes
}
```

## Usage Example

```typescript
import { PMREditor } from '@/components/pmr'

function ReportPage() {
  const [report, setReport] = useState<PMRReport>(/* ... */)

  const handleSave = async (updatedReport: PMRReport) => {
    // Save report to backend
    await api.saveReport(updatedReport)
  }

  const handleSectionUpdate = (sectionId: string, content: any) => {
    // Update section content
    setReport(prev => ({
      ...prev,
      sections: prev.sections.map(s => 
        s.section_id === sectionId ? { ...s, content } : s
      )
    }))
  }

  const handleRequestSuggestions = async (sectionId: string, context: string) => {
    // Request AI suggestions
    return await api.getAISuggestions(sectionId, context)
  }

  return (
    <PMREditor
      report={report}
      onSave={handleSave}
      onSectionUpdate={handleSectionUpdate}
      onRequestAISuggestion={handleRequestSuggestions}
    />
  )
}
```

## Styling

The component uses Tailwind CSS for styling and includes custom TipTap editor styles in `app/globals.css`. The editor is fully responsive and works on mobile devices.

### Custom Styles
- Prose styling for rich text content
- Collaborative cursor indicators
- Conflict warning banners
- AI suggestion panels
- Section expansion animations

## Dependencies

- `@tiptap/react`: Core TipTap React integration
- `@tiptap/starter-kit`: Basic editor extensions
- `@tiptap/extension-placeholder`: Placeholder text
- `@tiptap/extension-character-count`: Character/word counting
- `@tiptap/extension-highlight`: Text highlighting
- `@tiptap/extension-task-list`: Task list support
- `@tiptap/extension-task-item`: Task items
- `lucide-react`: Icons

## Testing

The component includes comprehensive unit tests covering:
- Basic rendering
- Section expansion/collapse
- View mode switching
- AI suggestion requests
- Collaboration indicators
- Conflict detection
- Read-only mode
- Character/word counting

Run tests with:
```bash
npm test -- components/pmr/__tests__/PMREditor.test.tsx
```

## Future Enhancements

1. **Real-time Collaboration**: Full WebSocket integration for live collaborative editing
2. **Comments**: Inline commenting system
3. **Version History**: Visual diff and version comparison
4. **Export Preview**: Preview how the report will look in different export formats
5. **Keyboard Shortcuts**: Additional keyboard shortcuts for power users
6. **Drag & Drop**: Reorder sections via drag and drop
7. **Templates**: Apply section templates
8. **Mentions**: @mention other users in comments

## Architecture

The component follows a modular architecture:

```
PMREditor (Main Component)
├── EditorToolbar (Formatting toolbar)
├── SectionEditor (Individual section editor)
│   ├── Section Header (Collapsible header with metadata)
│   ├── Conflict Warning (If conflicts exist)
│   ├── Collaborator Indicators (Active editors)
│   ├── TipTap Editor (Rich text editor)
│   ├── AI Suggestions Panel (AI-generated suggestions)
│   └── Section Actions (Save, request suggestions)
└── View Mode Toggle (Edit/Preview switch)
```

## Performance Considerations

- **Lazy Loading**: Sections are rendered on-demand when expanded
- **Memoization**: Uses React.useMemo and useCallback for optimization
- **Debouncing**: Auto-save is debounced to prevent excessive API calls
- **Virtual Scrolling**: For reports with many sections (future enhancement)

## Accessibility

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus management
- Screen reader friendly

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)
