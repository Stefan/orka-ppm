/**
 * PMR Help Content Configuration
 * Contextual help content for Enhanced PMR features
 */

import type { HelpContent } from '../components/pmr/ContextualHelp'

export const PMR_HELP_CONTENT: Record<string, HelpContent> = {
  // Editor Help
  editor: {
    title: 'PMR Editor',
    description: 'Create and edit your monthly report sections with rich text formatting and AI assistance.',
    steps: [
      'Click on any section to expand and edit',
      'Use the toolbar for text formatting (bold, italic, headings, lists)',
      'Content auto-saves as you type',
      'Click "Get AI Suggestions" for content recommendations'
    ],
    tips: [
      'Use Ctrl/Cmd + S to manually save',
      'Press Ctrl/Cmd + Z to undo changes',
      'Sections can be reordered by dragging',
      'AI-generated content shows confidence scores'
    ],
    relatedTopics: [
      { title: 'Formatting Guide', href: '/docs/pmr-formatting' },
      { title: 'Keyboard Shortcuts', href: '/docs/pmr-shortcuts' }
    ],
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#using-the-pmr-editor'
  },

  // AI Insights Help
  aiInsights: {
    title: 'AI-Powered Insights',
    description: 'Get intelligent analysis, predictions, and recommendations based on your project data.',
    steps: [
      'Click "Generate Insights" to analyze project data',
      'Review insights by category (Budget, Schedule, Resources, Risk)',
      'Check confidence scores to assess reliability',
      'Click "Validate" to confirm accuracy or "Not Accurate" to provide feedback',
      'Click "Apply" to add insights to your report'
    ],
    tips: [
      'Higher confidence scores (>80%) indicate more reliable insights',
      'Validate insights to improve AI accuracy over time',
      'Generate insights regularly as project data updates',
      'Use filters to focus on specific categories'
    ],
    relatedTopics: [
      { title: 'Understanding Confidence Scores', href: '/docs/pmr-confidence' },
      { title: 'AI Insight Categories', href: '/docs/pmr-insights' }
    ],
    videoUrl: 'https://example.com/videos/pmr-ai-insights',
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#ai-powered-insights'
  },

  // Collaboration Help
  collaboration: {
    title: 'Real-Time Collaboration',
    description: 'Work together with your team on reports in real-time with live editing, comments, and conflict resolution.',
    steps: [
      'See active users in the Collaboration Panel',
      'View color-coded cursors showing where others are editing',
      'Add comments by selecting text and clicking "Comment"',
      'Resolve conflicts when multiple users edit the same content',
      'Use @mentions to notify specific team members'
    ],
    tips: [
      'Green dot = user is active, yellow = away, gray = offline',
      'Conflicts are automatically detected and highlighted',
      'Comments can be resolved once addressed',
      'Coordinate editing times to minimize conflicts'
    ],
    relatedTopics: [
      { title: 'Conflict Resolution Guide', href: '/docs/pmr-conflicts' },
      { title: 'Collaboration Best Practices', href: '/docs/pmr-collaboration' }
    ],
    videoUrl: 'https://example.com/videos/pmr-collaboration',
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#real-time-collaboration'
  },

  // Export Help
  export: {
    title: 'Export Reports',
    description: 'Generate professional reports in multiple formats (PDF, Excel, PowerPoint, Word) with custom branding.',
    steps: [
      'Click the "Export" button in the toolbar',
      'Select your desired format (PDF, Excel, PowerPoint, Word)',
      'Choose a template style',
      'Configure options (sections, charts, branding)',
      'Click "Generate Export" and wait for processing',
      'Download your report when ready'
    ],
    tips: [
      'PDF is best for distribution and printing',
      'Excel includes raw data and charts',
      'PowerPoint creates presentation-ready slides',
      'Word documents are fully editable',
      'Exports are saved in history for re-download'
    ],
    relatedTopics: [
      { title: 'Export Format Comparison', href: '/docs/pmr-export-formats' },
      { title: 'Custom Branding Setup', href: '/docs/pmr-branding' }
    ],
    videoUrl: 'https://example.com/videos/pmr-export',
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#exporting-reports'
  },

  // Templates Help
  templates: {
    title: 'Report Templates',
    description: 'Use pre-configured templates or create custom templates for consistent reporting.',
    steps: [
      'Click "Templates" to browse available options',
      'Preview template structure and sections',
      'Select a template that matches your project type',
      'Customize sections, fields, and branding',
      'Save customizations as a new template for future use'
    ],
    tips: [
      'AI suggests templates based on project type and industry',
      'Rate templates to help others find the best ones',
      'Custom templates can be shared with your team',
      'Templates include section suggestions and formatting'
    ],
    relatedTopics: [
      { title: 'Creating Custom Templates', href: '/docs/pmr-custom-templates' },
      { title: 'Template Best Practices', href: '/docs/pmr-template-best-practices' }
    ],
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#templates-and-customization'
  },

  // Monte Carlo Analysis Help
  monteCarlo: {
    title: 'Monte Carlo Analysis',
    description: 'Run predictive simulations to forecast budget, schedule, and resource outcomes with confidence intervals.',
    steps: [
      'Click "Monte Carlo Analysis" in the insights panel',
      'Configure simulation parameters (iterations, variables)',
      'Select analysis type (Budget, Schedule, Resources)',
      'Run simulation and wait for results',
      'Review probability distributions and confidence intervals',
      'Add results to your report'
    ],
    tips: [
      'More iterations = more accurate results (but slower)',
      'Use historical data for better predictions',
      'Compare multiple scenarios side-by-side',
      'Export results as charts for presentations'
    ],
    relatedTopics: [
      { title: 'Understanding Monte Carlo', href: '/docs/pmr-monte-carlo' },
      { title: 'Simulation Parameters', href: '/docs/pmr-simulation-params' }
    ],
    videoUrl: 'https://example.com/videos/pmr-monte-carlo',
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#monte-carlo-analysis'
  },

  // Section Management Help
  sections: {
    title: 'Managing Sections',
    description: 'Organize your report by adding, removing, reordering, and customizing sections.',
    steps: [
      'Click "+ Add Section" to create a new section',
      'Drag and drop sections to reorder them',
      'Click the trash icon to remove a section',
      'Click section title to rename',
      'Use "Get AI Suggestions" for section content ideas'
    ],
    tips: [
      'Standard sections include Executive Summary, Budget, Schedule, Resources, Risks',
      'Custom sections can be added for project-specific needs',
      'Section order affects report flow and readability',
      'Empty sections show AI content generation prompts'
    ],
    relatedTopics: [
      { title: 'Standard Section Guide', href: '/docs/pmr-standard-sections' },
      { title: 'Custom Sections', href: '/docs/pmr-custom-sections' }
    ],
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#section-management'
  },

  // Confidence Scores Help
  confidenceScores: {
    title: 'AI Confidence Scores',
    description: 'Understand how confident the AI is in its generated content and insights.',
    steps: [
      'Check the confidence percentage shown on AI-generated content',
      'Review supporting data that backs the AI\'s analysis',
      'Validate or reject insights based on your expertise',
      'Provide feedback to improve future AI accuracy'
    ],
    tips: [
      '90-100%: High confidence - Strong data support',
      '70-89%: Medium confidence - Good data support',
      '50-69%: Low confidence - Limited data',
      'Below 50%: Very low - Requires manual verification',
      'Always review AI content regardless of confidence score'
    ],
    relatedTopics: [
      { title: 'How AI Confidence Works', href: '/docs/pmr-ai-confidence' },
      { title: 'Improving AI Accuracy', href: '/docs/pmr-ai-accuracy' }
    ],
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#insight-confidence-scores'
  },

  // Comments Help
  comments: {
    title: 'Comments and Discussions',
    description: 'Add comments to discuss report content with your team and track feedback.',
    steps: [
      'Select text in any section',
      'Click the "Comment" button',
      'Type your comment or question',
      'Use @username to mention specific team members',
      'Click "Post Comment" to add it',
      'Reply to comments to continue discussions',
      'Click "Resolve" when a comment is addressed'
    ],
    tips: [
      'Mentioned users receive notifications',
      'Resolved comments are archived but viewable',
      'Comments are visible to all collaborators',
      'Use comments for feedback instead of direct edits'
    ],
    relatedTopics: [
      { title: 'Collaboration Best Practices', href: '/docs/pmr-collaboration' },
      { title: 'Notification Settings', href: '/docs/pmr-notifications' }
    ],
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#comments-and-discussions'
  },

  // Conflict Resolution Help
  conflicts: {
    title: 'Resolving Editing Conflicts',
    description: 'Handle situations where multiple users edit the same content simultaneously.',
    steps: [
      'System automatically detects conflicting edits',
      'Conflict warning appears on affected sections',
      'Click "Resolve Conflict" to view options',
      'Compare your version with other user\'s version',
      'Choose: Keep yours, Accept theirs, or Merge manually',
      'Click "Resolve" to finalize your decision'
    ],
    tips: [
      'Conflicts are highlighted in red',
      'Review both versions carefully before resolving',
      'Communicate with other users to prevent conflicts',
      'Assign sections to specific users when possible',
      'Use preview mode when not actively editing'
    ],
    relatedTopics: [
      { title: 'Conflict Prevention', href: '/docs/pmr-conflict-prevention' },
      { title: 'Collaboration Strategies', href: '/docs/pmr-collaboration-strategies' }
    ],
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#conflict-resolution'
  },

  // Keyboard Shortcuts Help
  shortcuts: {
    title: 'Keyboard Shortcuts',
    description: 'Speed up your workflow with keyboard shortcuts for common actions.',
    steps: [
      'Press Ctrl/Cmd + B for bold text',
      'Press Ctrl/Cmd + I for italic text',
      'Press Ctrl/Cmd + S to save',
      'Press Ctrl/Cmd + Z to undo',
      'Press Ctrl/Cmd + Shift + Z to redo',
      'Press F1 to open help'
    ],
    tips: [
      'Shortcuts work in the editor when focused',
      'Use Ctrl/Cmd + K for quick search',
      'Press Escape to close modals and tooltips',
      'Tab key navigates between sections'
    ],
    relatedTopics: [
      { title: 'Complete Shortcut List', href: '/docs/pmr-shortcuts' },
      { title: 'Customizing Shortcuts', href: '/docs/pmr-custom-shortcuts' }
    ],
    docsUrl: '/docs/ENHANCED_PMR_USER_GUIDE.md#keyboard-shortcuts'
  }
}

// Helper function to get help content by key
export const getPMRHelpContent = (key: string): HelpContent | undefined => {
  return PMR_HELP_CONTENT[key]
}

// Helper function to search help content
export const searchPMRHelp = (query: string): HelpContent[] => {
  const lowerQuery = query.toLowerCase()
  return Object.values(PMR_HELP_CONTENT).filter(content =>
    content.title.toLowerCase().includes(lowerQuery) ||
    content.description.toLowerCase().includes(lowerQuery)
  )
}

export default PMR_HELP_CONTENT
