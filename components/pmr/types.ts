/**
 * TypeScript types for Enhanced PMR components
 */

export interface AIInsight {
  id: string
  type: 'prediction' | 'recommendation' | 'alert' | 'summary'
  category: 'budget' | 'schedule' | 'resource' | 'risk' | 'quality'
  title: string
  content: string
  confidence_score: number
  supporting_data: Record<string, any>
  predicted_impact?: string
  recommended_actions: string[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  generated_at: string
  validated: boolean
  validation_notes?: string
  user_feedback?: 'helpful' | 'not_helpful' | null
}

export interface PMRReport {
  id: string
  project_id: string
  title: string
  report_month: string
  report_year: number
  status: 'draft' | 'review' | 'approved' | 'distributed'
  sections: PMRSection[]
  ai_insights: AIInsight[]
  monte_carlo_analysis?: MonteCarloResults
  collaboration_session_id?: string
  real_time_metrics: Record<string, any>
  confidence_scores: Record<string, number>
  template_customizations: Record<string, any>
  generated_by: string
  generated_at: string
  last_modified: string
  version: number
}

export interface PMRSection {
  section_id: string
  title: string
  content: any
  ai_generated: boolean
  confidence_score?: number
  last_modified: string
  modified_by: string
}

export interface MonteCarloResults {
  analysis_type: string
  iterations: number
  results: Record<string, any>
  confidence_intervals: Record<string, Record<string, number>>
  risk_assessment: Record<string, any>
  recommendations: Array<Record<string, any>>
  processing_time_ms: number
  generated_at: string
}

export interface CollaborationSession {
  session_id: string
  report_id: string
  participants: string[]
  active_editors: string[]
  started_at: string
  last_activity: string
  comments: Comment[]
  conflicts: Conflict[]
}

export interface Comment {
  id: string
  user_id: string
  user_name: string
  content: string
  section_id?: string
  position?: { x: number; y: number }
  created_at: string
  resolved: boolean
  resolved_by?: string
  resolved_at?: string
}

export interface Conflict {
  id: string
  section_id: string
  conflicting_users: string[]
  conflict_type: 'simultaneous_edit' | 'version_mismatch' | 'permission_conflict'
  original_content: any
  conflicting_changes: Array<{
    user_id: string
    content: any
    timestamp: string
  }>
  resolution_strategy?: 'merge' | 'overwrite' | 'manual'
  resolved: boolean
  resolved_by?: string
  resolved_at?: string
}

export interface ExportJob {
  id: string
  report_id: string
  export_format: 'pdf' | 'excel' | 'slides' | 'word'
  template_config: Record<string, any>
  export_options: Record<string, any>
  status: 'queued' | 'processing' | 'completed' | 'failed'
  file_url?: string
  file_size?: number
  error_message?: string
  requested_by: string
  started_at: string
  completed_at?: string
}

export interface PMRTemplate {
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

export interface PMRGenerationRequest {
  project_id: string
  report_month: string
  report_year: number
  template_id: string
  title: string
  description?: string
  include_ai_insights: boolean
  include_monte_carlo: boolean
  custom_sections?: Array<Record<string, any>>
}

export interface ChatEditRequest {
  message: string
  session_id?: string
  context?: Record<string, any>
}

export interface ChatEditResponse {
  response: string
  changes_applied: Array<{
    section_id: string
    new_content: any
    change_type: 'update' | 'insert' | 'delete'
  }>
  session_id: string
  suggestions?: Array<Record<string, any>>
  confidence: number
  processing_time_ms: number
}

export interface UserPermissions {
  role: 'viewer' | 'editor' | 'admin'
  can_edit: boolean
  can_validate_insights: boolean
  can_export: boolean
  can_collaborate: boolean
  can_manage_templates: boolean
}

export interface EditContext {
  currentSection: string
  sectionContent: any
  reportData: PMRReport
  userRole: string
}

export interface AISuggestion {
  id: string
  type: 'content' | 'structure' | 'formatting'
  title: string
  description: string
  preview?: string
  confidence: number
  applicable_sections: string[]
}

// Event types for real-time collaboration
export interface CollaborationEvent {
  type: 'section_update' | 'cursor_position' | 'comment_add' | 'user_joined' | 'user_left'
  user_id: string
  timestamp: string
  data: any
}

export interface CursorPosition {
  user_id: string
  user_name: string
  section_id: string
  position: { x: number; y: number }
  color: string
}

// Filter and search types
export interface InsightFilters {
  categories: string[]
  types: string[]
  priorities: string[]
  validated: boolean | null
  minConfidence: number
}

export interface PMRSearchFilters {
  status: string[]
  dateRange: { start: string; end: string }
  projects: string[]
  templates: string[]
  hasAIInsights: boolean | null
}