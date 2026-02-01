// Rundown Profile Type Definitions
// Contingency Rundown Profiles for Costbook

/**
 * Profile type variants
 */
export type ProfileType = 'standard' | 'optimistic' | 'pessimistic'

/**
 * Generation status
 */
export type GenerationStatus = 'started' | 'completed' | 'failed' | 'partial'

/**
 * Scenario adjustment type
 */
export type AdjustmentType = 'percentage' | 'absolute'

/**
 * A single rundown profile data point
 */
export interface RundownProfile {
  id: string
  project_id: string
  /** Month in YYYYMM format */
  month: string
  /** Planned cumulative budget value */
  planned_value: number
  /** Actual cumulative spend value */
  actual_value: number
  /** AI-predicted cumulative value (null for past months) */
  predicted_value: number | null
  /** Profile type variant */
  profile_type: ProfileType
  /** Named scenario for what-if analysis */
  scenario_name: string
  created_at: string
  updated_at: string
}

/**
 * Summary of rundown profiles for a project
 */
export interface RundownProfileSummary {
  project_id: string
  project_name: string
  /** Total number of profile data points */
  total_points: number
  /** First month in YYYYMM format */
  start_month: string
  /** Last month in YYYYMM format */
  end_month: string
  /** Current month's planned value */
  current_planned: number
  /** Current month's actual value */
  current_actual: number
  /** Current month's predicted value */
  current_predicted: number | null
  /** Variance (actual - planned) */
  variance: number
  /** Variance percentage */
  variance_percentage: number
  /** Whether project is over budget */
  is_over_budget: boolean
  /** Last profile update timestamp */
  last_updated: string
}

/**
 * Rundown scenario for what-if analysis
 */
export interface RundownScenario {
  id: string
  project_id: string
  name: string
  description?: string
  /** Type of adjustment */
  adjustment_type: AdjustmentType
  /** Adjustment value (percentage or absolute amount) */
  adjustment_value: number
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

/**
 * Generation error details
 */
export interface GenerationError {
  project_id: string
  project_name?: string
  error_type: string
  error_message: string
  timestamp: string
}

/**
 * Result from profile generation
 */
export interface GenerationResult {
  execution_id: string
  status: GenerationStatus
  /** Total projects processed */
  projects_processed: number
  /** Total profiles created/updated */
  profiles_created: number
  /** Number of errors */
  errors_count: number
  /** Execution time in milliseconds */
  execution_time_ms: number
  /** List of errors if any */
  errors: GenerationError[]
  /** Timestamp of execution */
  timestamp: string
}

/**
 * Generation log entry
 */
export interface GenerationLog {
  id: string
  execution_id: string
  project_id?: string
  status: GenerationStatus
  message?: string
  projects_processed: number
  profiles_created: number
  errors_count: number
  execution_time_ms?: number
  created_at: string
}

/**
 * Input for generating rundown profiles
 */
export interface GenerateProfilesInput {
  /** Optional specific project ID (if not provided, generates for all) */
  project_id?: string
  /** Profile types to generate */
  profile_types?: ProfileType[]
  /** Whether to recalculate predictions */
  include_predictions?: boolean
  /** Specific scenario to generate */
  scenario_name?: string
}

/**
 * Query options for fetching profiles
 */
export interface RundownProfilesQuery {
  project_id: string
  profile_type?: ProfileType
  scenario_name?: string
  /** Start month (YYYYMM) */
  from_month?: string
  /** End month (YYYYMM) */
  to_month?: string
}

/**
 * Chart data point for visualization
 */
export interface RundownChartPoint {
  /** Month in YYYYMM format */
  month: string
  /** Month label for display (e.g., "Jan 24") */
  label: string
  /** Planned value */
  planned: number
  /** Actual value */
  actual: number
  /** Predicted value (for future months) */
  predicted: number | null
  /** Whether this is the current month */
  isCurrent: boolean
  /** Whether this is a future month */
  isFuture: boolean
}

/**
 * Prediction analysis result
 */
export interface PredictionAnalysis {
  /** Trend direction */
  trend: 'increasing' | 'stable' | 'decreasing'
  /** Prediction confidence (0-100) */
  confidence: number
  /** Predicted final value at project end */
  predicted_final: number
  /** Variance from planned at project end */
  predicted_variance: number
  /** Whether prediction exceeds planned by threshold */
  exceeds_threshold: boolean
  /** Percentage over planned (if exceeds) */
  threshold_percentage: number
}

/**
 * Rundown profile status for UI
 */
export interface RundownStatus {
  /** Last generation timestamp */
  last_generated?: string
  /** Next scheduled generation */
  next_scheduled?: string
  /** Whether profiles are stale (>24h old) */
  is_stale: boolean
  /** Whether generation is in progress */
  is_generating: boolean
  /** Number of projects with profiles */
  projects_with_profiles: number
  /** Total profile count */
  total_profiles: number
  /** Any active errors */
  has_errors: boolean
  /** Error count */
  error_count: number
}

/**
 * Configuration for rundown generation
 */
export interface RundownConfig {
  /** Cron schedule (default: daily at 02:00 UTC) */
  cron_schedule: string
  /** Number of months to predict ahead */
  prediction_months: number
  /** Threshold for prediction warnings (percentage) */
  warning_threshold: number
  /** Enable real-time updates */
  realtime_enabled: boolean
  /** Debounce time for real-time updates (ms) */
  realtime_debounce_ms: number
}

/**
 * Default configuration values
 */
export const DEFAULT_RUNDOWN_CONFIG: RundownConfig = {
  cron_schedule: '0 2 * * *', // Daily at 02:00 UTC
  prediction_months: 6,
  warning_threshold: 10, // 10% over planned
  realtime_enabled: true,
  realtime_debounce_ms: 2000
}

/**
 * Helper to format month string to display label
 */
export function formatMonthLabel(month: string): string {
  const year = month.substring(2, 4)
  const monthNum = parseInt(month.substring(4, 6), 10)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[monthNum - 1]} ${year}`
}

/**
 * Get current month in YYYYMM format
 */
export function getCurrentMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  return `${year}${month}`
}

/**
 * Compare two YYYYMM month strings
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareMonths(a: string, b: string): number {
  return parseInt(a, 10) - parseInt(b, 10)
}

/**
 * Check if a month is in the future
 */
export function isFutureMonth(month: string): boolean {
  return compareMonths(month, getCurrentMonth()) > 0
}

/**
 * Check if a month is the current month
 */
export function isCurrentMonth(month: string): boolean {
  return month === getCurrentMonth()
}

/**
 * Calculate variance between actual and planned
 */
export function calculateVariance(actual: number, planned: number): {
  absolute: number
  percentage: number
  isOver: boolean
} {
  const absolute = actual - planned
  const percentage = planned !== 0 ? (absolute / planned) * 100 : 0
  return {
    absolute,
    percentage,
    isOver: absolute > 0
  }
}

/**
 * Convert profiles to chart data points
 */
export function profilesToChartData(profiles: RundownProfile[]): RundownChartPoint[] {
  const currentMonth = getCurrentMonth()
  
  return profiles
    .sort((a, b) => compareMonths(a.month, b.month))
    .map(profile => ({
      month: profile.month,
      label: formatMonthLabel(profile.month),
      planned: profile.planned_value,
      actual: profile.actual_value,
      predicted: profile.predicted_value,
      isCurrent: profile.month === currentMonth,
      isFuture: compareMonths(profile.month, currentMonth) > 0
    }))
}
