/**
 * ORKA-PPM Type Definitions
 * Enhanced with mobile-first design system types
 */

import React from 'react'

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
  accessibility: AccessibilitySettings
}

export interface AccessibilitySettings {
  highContrast: boolean
  reducedMotion: boolean
  fontSize: 'small' | 'medium' | 'large'
  screenReader: boolean
  keyboardNavigation: boolean
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

// Enhanced Design System Types

// Color System Types
export type ColorScale = {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950?: string
}

export type ColorVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'gray'

// Typography Types
export type FontSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
export type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold'
export type LineHeight = 'tight' | 'normal' | 'relaxed'

// Spacing Types
export type Spacing = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'

// Breakpoint Types
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

// Touch Target Types
export type TouchTargetSize = 'minimum' | 'comfortable' | 'large' | 'xlarge'

// Component Size Types
export type ComponentSize = 'sm' | 'md' | 'lg' | 'xl'

// Component Variant Types
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
export type InputVariant = 'default' | 'error' | 'success' | 'warning'
export type CardVariant = 'default' | 'elevated' | 'interactive' | 'outlined' | 'filled'
export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error'
export type AlertVariant = 'info' | 'success' | 'warning' | 'error'

// Enhanced UI Component Types
export interface ComponentProps {
  className?: string
  children?: React.ReactNode
  id?: string
  'data-testid'?: string
}

export interface ResponsiveProps {
  mobile?: string
  tablet?: string
  desktop?: string
  wide?: string
}

export interface AccessibleProps {
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-expanded'?: boolean
  'aria-hidden'?: boolean
  role?: string
  tabIndex?: number
}

export interface ButtonProps extends ComponentProps, AccessibleProps {
  variant?: ButtonVariant
  size?: ComponentSize
  disabled?: boolean
  loading?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLButtonElement>) => void
  type?: 'button' | 'submit' | 'reset'
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  touchTarget?: TouchTargetSize
}

export interface InputProps extends ComponentProps, AccessibleProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'time' | 'datetime-local'
  value?: string
  defaultValue?: string
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  variant?: InputVariant
  size?: ComponentSize
  error?: string
  helperText?: string
  label?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  autoComplete?: string
  autoFocus?: boolean
  maxLength?: number
  minLength?: number
  pattern?: string
  step?: number
  min?: number
  max?: number
}

export interface TextareaProps extends Omit<InputProps, 'type' | 'leftIcon' | 'rightIcon' | 'onChange' | 'onBlur' | 'onFocus' | 'onKeyDown'> {
  rows?: number
  cols?: number
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
  onChange?: (value: string, event: React.ChangeEvent<HTMLTextAreaElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export interface CardProps extends ComponentProps {
  variant?: CardVariant
  padding?: Spacing
  shadow?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  interactive?: boolean
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
}

export interface ModalProps extends ComponentProps, AccessibleProps {
  isOpen: boolean
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  title?: string
  description?: string
  footer?: React.ReactNode
  initialFocus?: React.RefObject<HTMLElement>
}

export interface SelectProps extends ComponentProps, AccessibleProps {
  value?: string | string[]
  defaultValue?: string | string[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  multiple?: boolean
  variant?: InputVariant
  size?: ComponentSize
  error?: string
  helperText?: string
  label?: string
  options: SelectOption[]
  onChange?: (value: string | string[], event: React.ChangeEvent<HTMLSelectElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLSelectElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLSelectElement>) => void
}

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  group?: string
}

export interface BadgeProps extends ComponentProps {
  variant?: BadgeVariant
  size?: 'sm' | 'md' | 'lg'
  rounded?: boolean
  dot?: boolean
}

export interface AlertProps extends ComponentProps {
  variant?: AlertVariant
  title?: string
  description?: string
  icon?: React.ReactNode
  closable?: boolean
  onClose?: () => void
}

export interface TooltipProps extends ComponentProps {
  content: React.ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  trigger?: 'hover' | 'click' | 'focus'
  delay?: number
  disabled?: boolean
}

// Responsive Design Types
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

// Theme Types
export interface Theme {
  colors: {
    primary: ColorScale
    secondary: ColorScale
    success: ColorScale
    warning: ColorScale
    error: ColorScale
    gray: ColorScale
  }
  typography: {
    fontFamily: {
      sans: string[]
      mono: string[]
    }
    fontSize: Record<FontSize, [string, { lineHeight: string }]>
    fontWeight: Record<FontWeight, string>
  }
  spacing: Record<Spacing, string>
  borderRadius: Record<string, string>
  boxShadow: Record<string, string>
  breakpoints: Record<Breakpoint, string>
  animation: {
    duration: Record<string, string>
    easing: Record<string, string>
  }
}

export interface ThemeConfig {
  theme: 'light' | 'dark' | 'auto'
  primaryColor: ColorVariant
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  fontScale: 'sm' | 'md' | 'lg'
  animations: boolean
  reducedMotion: boolean
}

// Layout Types
export interface LayoutProps extends ComponentProps {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  padding?: Spacing
  margin?: Spacing
  centered?: boolean
}

export interface GridProps extends ComponentProps {
  columns?: ResponsiveValue<number>
  gap?: Spacing
  alignItems?: 'start' | 'center' | 'end' | 'stretch'
  justifyContent?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
}

export interface FlexProps extends ComponentProps {
  direction?: ResponsiveValue<'row' | 'column'>
  wrap?: 'wrap' | 'nowrap' | 'wrap-reverse'
  alignItems?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justifyContent?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  gap?: Spacing
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
  external?: boolean
  disabled?: boolean
}

export interface BreadcrumbItem {
  label: string
  href?: string
  current?: boolean
}

// Dashboard Types
export interface DashboardWidget {
  id: string
  type: 'metric' | 'chart' | 'table' | 'list' | 'ai-insight'
  title: string
  data: unknown
  size: 'small' | 'medium' | 'large'
  position: { x: number; y: number }
  refreshInterval?: number
  aiRecommended?: boolean
  priority?: number
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
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'date' | 'time'
  required?: boolean
  placeholder?: string
  options?: SelectOption[]
  validation?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
    message?: string
  }
  helperText?: string
  disabled?: boolean
  size?: ComponentSize
  variant?: InputVariant
}

export interface FormState {
  values: Record<string, unknown>
  errors: Record<string, string>
  touched: Record<string, boolean>
  isSubmitting: boolean
  isValid: boolean
  isDirty: boolean
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