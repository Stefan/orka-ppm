/**
 * Types for shareable project URLs feature
 */

export enum SharePermissionLevel {
  VIEW_ONLY = 'view_only',
  LIMITED_DATA = 'limited_data',
  FULL_PROJECT = 'full_project'
}

export interface ShareLink {
  id: string
  project_id: string
  token: string
  share_url: string
  permission_level: SharePermissionLevel
  expires_at: string
  is_active: boolean
  custom_message?: string
  access_count: number
  last_accessed_at?: string
  created_at: string
  created_by: string
}

export interface CreateShareLinkRequest {
  project_id: string
  permission_level: SharePermissionLevel
  expiry_duration_days: number
  custom_message?: string
}

export interface ShareAnalytics {
  total_accesses: number
  unique_visitors: number
  access_by_day: Array<{ date: string; count: number }>
  geographic_distribution: Array<{ country: string; count: number }>
  most_viewed_sections: Array<{ section: string; count: number }>
  average_session_duration: number
  suspicious_activity_count: number
}

export interface ShareLinkFormData {
  permission_level: SharePermissionLevel
  expiry_duration_days: number
  custom_message: string
}

export interface FilteredProjectData {
  id: string
  name: string
  description?: string
  status: string
  progress_percentage?: number
  start_date?: string
  end_date?: string
  // Conditional fields based on permission level
  milestones?: Array<{
    id: string
    name: string
    due_date: string
    status: string
    description?: string
  }>
  team_members?: Array<{
    id: string
    name: string
    role: string
    email?: string
  }>
  documents?: Array<{
    id: string
    name: string
    type: string
    uploaded_at: string
    size?: number
  }>
  timeline?: {
    phases: Array<{
      name: string
      start_date: string
      end_date: string
      status: string
    }>
  }
}
