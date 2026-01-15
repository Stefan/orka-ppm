/**
 * Enhanced PMR Components
 * Export all PMR-related components and types
 */

export { default as AIInsightsPanel } from './AIInsightsPanel'
export type { AIInsightsPanelProps } from './AIInsightsPanel'

export { default as PMREditor } from './PMREditor'
export type { PMREditorProps } from './PMREditor'

export { default as CollaborationPanel } from './CollaborationPanel'
export type { CollaborationPanelProps } from './CollaborationPanel'

export { default as CursorTracker } from './CursorTracker'
export type { CursorTrackerProps } from './CursorTracker'

export { default as ConflictResolutionModal } from './ConflictResolutionModal'
export type { ConflictResolutionModalProps } from './ConflictResolutionModal'

export { default as PMRTemplateSelector } from './PMRTemplateSelector'
export type { PMRTemplateSelectorProps } from './PMRTemplateSelector'

export { default as PMRTemplatePreview } from './PMRTemplatePreview'
export type { PMRTemplatePreviewProps } from './PMRTemplatePreview'

export { default as PMRTemplateCustomizer } from './PMRTemplateCustomizer'
export type { PMRTemplateCustomizerProps } from './PMRTemplateCustomizer'

export { default as MonteCarloAnalysisComponent } from './MonteCarloAnalysisComponent'

export { default as PMRExportManager } from './PMRExportManager'
export type { PMRExportManagerProps, ExportConfig, ExportFormat, ExportTemplate } from './PMRExportManager'

// Export all types
export * from './types'

// Re-export commonly used types for convenience
export type {
  AIInsight,
  PMRReport,
  PMRSection,
  MonteCarloResults,
  CollaborationSession,
  ExportJob,
  PMRTemplate,
  UserPermissions,
  EditContext,
  AISuggestion,
  CollaborationEvent,
  CursorPosition,
  Comment,
  Conflict
} from './types'