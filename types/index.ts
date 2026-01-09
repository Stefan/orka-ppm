/**
 * ORKA-PPM Type Definitions
 * Centralized type definitions for the entire application
 */

// Re-export help chat types
export * from './help-chat'

// Base Types
export interface BaseEntity {
  id: string
  created_at: string
  updated_at: string
}

// User Types
export interface User extends BaseEntity {
  email: string
  name?: string
  avatar_url?: string
  role: UserRole
  preferences: UserPreferences
}

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer'

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
  notifications: NotificationSettings
  dashboard: DashboardPreferences
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  inApp: boolean
  frequency: 'immediate' | 'daily' | 'weekly'
}

export interface DashboardPreferences {
  layout: 'grid' | 'list' | 'masonry'
  widgets: string[]
  refreshInterval: number
}

// Project Types
export interface Project extends BaseEntity {
  name: string
  description?: string
  status: ProjectStatus
  priority: ProjectPriority
  start_date: string
  end_date?: string
  budget?: number
  manager_id: string
  team_members: string[]
  progress: number
  health: ProjectHealth
}

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical'
export type ProjectHealth = 'green' | 'yellow' | 'red'

// Resource Types
export interface Resource extends BaseEntity {
  name: string
  email: string
  role?: string
  capacity: number
  availability: number
  hourly_rate?: number
  skills: string[]
  location?: string
  current_projects: string[]
  utilization_percentage: number
  available_hours: number
  allocated_hours: number
  capacity_hours: number
  availability_status: AvailabilityStatus
  can_take_more_work: boolean
}

export type AvailabilityStatus = 'available' | 'partially_allocated' | 'mostly_allocated' | 'fully_allocated'

// Risk Types
export interface Risk extends BaseEntity {
  project_id: string
  project_name?: string
  title: string
  description: string
  category: RiskCategory
  probability: number
  impact: number
  risk_score: number
  status: RiskStatus
  mitigation: string
  owner: string
  due_date: string
}

export type RiskCategory = 'technical' | 'financial' | 'resource' | 'schedule' | 'external'
export type RiskStatus = 'identified' | 'analyzing' | 'mitigating' | 'closed'

// AI Types
export interface AIOptimizationSuggestion {
  type: string
  resource_id: string
  resource_name: string
  match_score?: number
  current_utilization?: number
  available_hours?: number
  matching_skills?: string[]
  recommendation: string
  priority: 'low' | 'medium' | 'high'
  confidence_score?: number
  reasoning?: string
  analysis_time_ms?: number
  conflict_detected?: boolean
  alternative_strategies?: string[]
}

// UI Component Types
export interface ComponentProps {
  className?: string
  children?: React.ReactNode
}

export interface ButtonProps extends ComponentProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export interface InputProps extends ComponentProps {
  type?: string
  value?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
}

export interface CardProps extends ComponentProps {
  variant?: 'default' | 'elevated' | 'interactive'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

// API Types
export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  success: boolean
}

export interface ApiError {
  message: string
  code?: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Form Types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox'
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
}

export interface FormState {
  values: Record<string, unknown>
  errors: Record<string, string>
  touched: Record<string, boolean>
  isSubmitting: boolean
  isValid: boolean
}

// Navigation Types
export interface NavigationItem {
  id: string
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: number
  children?: NavigationItem[]
  permissions?: UserRole[]
}

// Dashboard Types
export interface DashboardWidget {
  id: string
  type: 'metric' | 'chart' | 'table' | 'list'
  title: string
  data: unknown
  size: 'small' | 'medium' | 'large'
  position: { x: number; y: number }
  refreshInterval?: number
}

// Chart Types
export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string | string[]
  borderWidth?: number
}

// Filter Types
export interface FilterOption {
  value: string
  label: string
  count?: number
}

export interface FilterState {
  search: string
  category: string
  status: string
  dateRange: {
    start?: string
    end?: string
  }
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

// Responsive Types
export interface ResponsiveValue<T> {
  mobile: T
  tablet?: T
  desktop?: T
  wide?: T
}

export interface BreakpointConfig {
  mobile: { min: number; max: number }
  tablet: { min: number; max: number }
  desktop: { min: number; max: number }
  wide: { min: number; max: number }
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Event Types
export interface AppEvent {
  type: string
  payload: unknown
  timestamp: string
  user_id?: string
}

export interface AnalyticsEvent extends AppEvent {
  category: 'user_action' | 'system_event' | 'error'
  properties: Record<string, unknown>
}

// Error Types
export interface AppError extends Error {
  code?: string
  statusCode?: number
  context?: Record<string, unknown>
}

// Configuration Types
export interface AppConfig {
  api: {
    baseUrl: string
    timeout: number
  }
  auth: {
    sessionTimeout: number
    refreshThreshold: number
  }
  features: {
    aiOptimization: boolean
    realTimeUpdates: boolean
    offlineMode: boolean
  }
  ui: {
    theme: 'light' | 'dark' | 'auto'
    animations: boolean
    reducedMotion: boolean
  }
}