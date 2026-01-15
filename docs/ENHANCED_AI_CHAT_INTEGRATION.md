# Enhanced AI Chat Integration for PMR

## Overview

The Enhanced AI Chat Integration extends the existing reports page with PMR-specific AI capabilities, enabling interactive report editing, content generation, and intelligent suggestions through natural language commands.

## Features

### 1. PMR Context Awareness
- Tracks current report, project, section, and template context
- Provides context-aware responses and suggestions
- Maintains conversation history with PMR-specific metadata

### 2. PMR-Specific Actions
- **Update Section**: Modify specific report sections with AI assistance
- **Generate Insight**: Create AI-powered insights for budget, schedule, resources, and risks
- **Analyze Data**: Perform data analysis on project metrics
- **Suggest Content**: Get AI suggestions for improving report sections
- **Modify Content**: Request content modifications with natural language
- **Add Visualization**: Request chart and graph additions

### 3. Suggested Changes Management
- AI provides structured change suggestions with:
  - Section identification
  - Change type (add, modify, remove)
  - Content preview
  - Reasoning and confidence score
- Users can apply or reject suggestions individually
- Tracks applied vs pending changes

### 4. Quick Actions
- Pre-configured quick action buttons for common tasks:
  - Summarize project status
  - Identify risks
  - Analyze budget performance
  - Review schedule
  - Suggest improvements

## Usage

### Basic Hook Usage

```typescript
import { useEnhancedAIChat } from '../hooks/useEnhancedAIChat'

function PMREditor() {
  const {
    messages,
    isLoading,
    sendMessage,
    updateContext,
    pendingChanges,
    applySuggestedChange,
    rejectSuggestedChange
  } = useEnhancedAIChat({
    reportId: 'report-123',
    projectId: 'project-456'
  })

  // Send a message
  const handleSendMessage = async () => {
    await sendMessage('Update executive summary with latest data')
  }

  // Apply a suggested change
  const handleApplyChange = (changeId: string) => {
    applySuggestedChange(changeId)
  }

  return (
    // Your UI components
  )
}
```

### Using PMR Actions

```typescript
const {
  updateSection,
  generateInsight,
  analyzeData,
  suggestContent,
  modifyContent
} = useEnhancedAIChat()

// Update a specific section
await updateSection('executive_summary', 'Make it more concise')

// Generate insights
await generateInsight('budget', 'Focus on variance analysis')

// Analyze data
await analyzeData('schedule', 'Identify critical path delays')

// Get content suggestions
await suggestContent('risk_section', 'Include mitigation strategies')

// Modify content
await modifyContent('budget_section', 'Add more detail about overruns')
```

### Quick Actions

```typescript
const { quickActions } = useEnhancedAIChat()

// Use pre-configured quick actions
await quickActions.summarizeProject()
await quickActions.identifyRisks()
await quickActions.analyzeBudget()
await quickActions.reviewSchedule()
await quickActions.suggestImprovements()
```

## Integration with Reports Page

The reports page (`app/reports/page.tsx`) has been extended with:

### PMR Mode Toggle
- Toggle button in header to enable/disable PMR-specific features
- Changes UI to show PMR actions and examples

### PMR Actions Panel
- Collapsible panel with quick action buttons
- Displays pending changes with apply/reject options
- Shows change details including confidence scores

### Enhanced Message Display
- Shows PMR action indicators on messages
- Displays suggested changes inline
- Provides visual feedback for AI actions

### Context-Aware Examples
- Quick example prompts change based on PMR mode
- PMR mode shows report-specific examples
- Standard mode shows general portfolio queries

## API Integration

### Endpoint
```
POST /api/reports/pmr/chat
```

### Request Format
```typescript
{
  message: string
  context: {
    reportId?: string
    projectId?: string
    currentSection?: string
    templateId?: string
    reportStatus?: string
  }
  action?: 'update_section' | 'generate_insight' | 'analyze_data' | 
           'suggest_content' | 'modify_content' | 'add_visualization'
  sessionId?: string
}
```

### Response Format
```typescript
{
  response: string
  action?: string
  actionData?: Record<string, any>
  suggestedChanges?: Array<{
    id: string
    section: string
    changeType: 'add' | 'modify' | 'remove'
    content: string
    reason: string
    confidence: number
    applied: boolean
  }>
  confidence: number
  sources?: Array<{
    type: string
    id: string
    similarity: number
  }>
  sessionId: string
}
```

## State Management

### Hook State
```typescript
{
  messages: EnhancedChatMessage[]
  isLoading: boolean
  error: string | null
  sessionId: string | null
  context: PMRContext
  pendingChanges: SuggestedChange[]
}
```

### Context Updates
```typescript
// Update context as user navigates
updateContext({
  reportId: 'new-report-id',
  currentSection: 'budget_section'
})
```

## Error Handling

The hook provides comprehensive error handling:

```typescript
const { error, clearError } = useEnhancedAIChat()

if (error) {
  // Display error to user
  console.error('Chat error:', error)
  
  // Clear error when ready
  clearError()
}
```

## Testing

Comprehensive test suite covers:
- Hook initialization
- Context updates
- Message sending with PMR context
- Suggested changes handling
- Apply/reject change functionality
- Quick actions
- Error handling
- Message clearing
- Section-specific change filtering

Run tests:
```bash
npm test -- __tests__/enhanced-ai-chat.test.tsx
```

## Best Practices

### 1. Context Management
- Always update context when user navigates to different sections
- Include relevant context for better AI responses
- Clear context when leaving PMR mode

### 2. Change Management
- Review suggested changes before applying
- Provide feedback on applied changes
- Track change history for audit purposes

### 3. Performance
- Debounce rapid message sends
- Cache frequently used responses
- Limit pending changes display to relevant sections

### 4. User Experience
- Show loading states during AI processing
- Provide clear feedback on actions
- Allow users to undo applied changes
- Display confidence scores for transparency

## Future Enhancements

### Planned Features
1. **Real-time Collaboration**: Multi-user editing with live updates
2. **Change History**: Track and revert applied changes
3. **Template Suggestions**: AI-recommended templates based on project type
4. **Batch Operations**: Apply multiple changes at once
5. **Export Integration**: Include AI suggestions in exported reports
6. **Voice Input**: Voice-to-text for hands-free interaction
7. **Smart Notifications**: Proactive suggestions based on report status

### Integration Points
- Connect with Monte Carlo analysis service
- Integrate with export pipeline
- Link to collaboration service
- Sync with template manager

## Troubleshooting

### Common Issues

**Issue**: Messages not sending
- **Solution**: Check authentication token and API endpoint

**Issue**: Suggested changes not appearing
- **Solution**: Verify response format from backend

**Issue**: Context not updating
- **Solution**: Ensure updateContext is called with valid data

**Issue**: Performance degradation
- **Solution**: Clear old messages and limit pending changes

## Support

For issues or questions:
1. Check the test suite for usage examples
2. Review the hook implementation in `hooks/useEnhancedAIChat.ts`
3. Examine the reports page integration in `app/reports/page.tsx`
4. Consult the PMR design document in `.kiro/specs/enhanced-pmr/design.md`

## Related Documentation

- [Enhanced PMR Requirements](../.kiro/specs/enhanced-pmr/requirements.md)
- [Enhanced PMR Design](../.kiro/specs/enhanced-pmr/design.md)
- [Enhanced PMR Tasks](../.kiro/specs/enhanced-pmr-feature/tasks.md)
- [Help Chat Integration](./help-chat-integration.md)
