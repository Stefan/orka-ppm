// Costbook TypeScript Interfaces and Data Models
// Phase 1: Core financial tracking with real Supabase integration

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  CHF = 'CHF',
  JPY = 'JPY'
}

export enum ProjectStatus {
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum POStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  ISSUED = 'issued',
  RECEIVED = 'received',
  CANCELLED = 'cancelled'
}

export enum ActualStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

export interface Project {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  budget: number
  currency: Currency
  start_date: string
  end_date: string
  project_manager?: string
  client_id?: string
  created_at: string
  updated_at: string
}

export interface Commitment {
  id: string
  project_id: string
  po_number: string
  vendor_id: string
  vendor_name: string
  description: string
  amount: number
  currency: Currency
  status: POStatus
  issue_date: string
  delivery_date?: string
  created_at: string
  updated_at: string
}

export interface Actual {
  id: string
  project_id: string
  commitment_id?: string
  po_number?: string
  vendor_id: string
  vendor_name: string
  description: string
  amount: number
  currency: Currency
  status: ActualStatus
  invoice_date: string
  payment_date?: string
  created_at: string
  updated_at: string
}

export interface ProjectWithFinancials {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  budget: number
  currency: Currency
  start_date: string
  end_date: string
  project_manager?: string
  client_id?: string
  created_at: string
  updated_at: string

  // Calculated financial fields
  total_commitments: number
  total_actuals: number
  total_spend: number
  variance: number
  spend_percentage: number
  health_score: number // 0-100 scale
  eac?: number // Phase 2: Estimate at Completion
}

export interface KPIMetrics {
  total_budget: number
  total_commitments: number
  total_actuals: number
  total_spend: number
  net_variance: number
  over_budget_count: number
  under_budget_count: number
}

// Currency conversion constants (hardcoded for Phase 1)
export const EXCHANGE_RATES: Record<Currency, Record<Currency, number>> = {
  [Currency.USD]: {
    [Currency.USD]: 1.0,
    [Currency.EUR]: 0.85,
    [Currency.GBP]: 0.73,
    [Currency.CHF]: 0.92,
    [Currency.JPY]: 110.0
  },
  [Currency.EUR]: {
    [Currency.USD]: 1.18,
    [Currency.EUR]: 1.0,
    [Currency.GBP]: 0.86,
    [Currency.CHF]: 1.08,
    [Currency.JPY]: 129.4
  },
  [Currency.GBP]: {
    [Currency.USD]: 1.37,
    [Currency.EUR]: 1.16,
    [Currency.GBP]: 1.0,
    [Currency.CHF]: 1.26,
    [Currency.JPY]: 150.6
  },
  [Currency.CHF]: {
    [Currency.USD]: 1.09,
    [Currency.EUR]: 0.93,
    [Currency.GBP]: 0.79,
    [Currency.CHF]: 1.0,
    [Currency.JPY]: 119.6
  },
  [Currency.JPY]: {
    [Currency.USD]: 0.0091,
    [Currency.EUR]: 0.0077,
    [Currency.GBP]: 0.0066,
    [Currency.CHF]: 0.0084,
    [Currency.JPY]: 1.0
  }
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  [Currency.USD]: '$',
  [Currency.EUR]: '€',
  [Currency.GBP]: '£',
  [Currency.CHF]: 'CHF',
  [Currency.JPY]: '¥'
}

// Transaction types for unified processing (Phase 2)
export interface Transaction {
  id: string
  project_id: string
  type: 'commitment' | 'actual'
  amount: number
  currency: Currency
  vendor_name: string
  description: string
  date: string
  po_number?: string
  status: POStatus | ActualStatus
}

// Hierarchy types for CES/WBS (Phase 2)
export interface HierarchyNode {
  id: string
  name: string
  level: number
  parent_id?: string
  total_budget: number
  total_spend: number
  variance: number
  children: HierarchyNode[]
}

// Rundown Profile types (Phase 2)
export interface RundownProfile {
  id: string
  project_id: string
  month: string // YYYYMM format
  planned_value: number
  actual_value: number
  predicted_value: number
  profile_type: 'planned' | 'actual' | 'predicted'
  scenario_name: string
  created_at: string
  updated_at: string
}

export interface RundownProfileSummary {
  project_id: string
  total_planned: number
  total_actual: number
  total_predicted: number
  last_updated: string
  scenario_count: number
}

export interface GenerationResult {
  execution_id: string
  projects_processed: number
  profiles_created: number
  errors: GenerationError[]
  execution_time_ms: number
  status: 'success' | 'partial' | 'failed'
}

export interface GenerationError {
  project_id: string
  error_type: string
  error_message: string
  row_number?: number
}

// EVM Metrics (Phase 3)
export interface EVMProject extends ProjectWithFinancials {
  bcws: number // Budgeted Cost of Work Scheduled
  bcwp: number // Budgeted Cost of Work Performed
  acwp: number // Actual Cost of Work Performed
  cpi: number // Cost Performance Index
  spi: number // Schedule Performance Index
  tcpi: number // To-Complete Performance Index
  etc: number // Estimate to Complete
  vac: number // Variance at Completion
}

// Comment system (Phase 3)
export interface Comment {
  id: string
  project_id: string
  user_id: string
  content: string
  mentions: string[]
  created_at: string
  updated_at: string
}

// Vendor scoring (Phase 3)
export interface VendorScore {
  vendor_id: string
  vendor_name: string
  on_time_delivery_rate: number
  cost_variance_percentage: number
  overall_score: number
  last_updated: string
}

// Recommendation system (Phase 3)
export interface Recommendation {
  id: string
  project_id: string
  type: 'budget_reallocation' | 'vendor_optimization' | 'timeline_adjustment'
  title: string
  description: string
  impact_amount: number
  confidence_score: number
  action_required: boolean
  created_at: string
}

// Voice control (Phase 3)
export interface VoiceCommand {
  command: string
  action: string
  parameters: Record<string, any>
  confidence: number
  timestamp: string
}

// Gamification (Phase 3)
export interface Badge {
  id: string
  user_id: string
  badge_type: string
  earned_at: string
  criteria_met: string[]
}

export interface UserStats {
  user_id: string
  badges_earned: number
  projects_managed: number
  cost_variance_improved: number
  last_activity: string
}

// Import/Export types
export interface CSVImportResult {
  success: boolean
  records_processed: number
  records_imported: number
  errors: CSVImportError[]
}

export interface CSVImportError {
  row: number
  column: string
  value: string
  error: string
}

export interface ImportTemplate {
  id: string
  name: string
  description: string
  mappings: Record<string, string>
  created_by: string
  is_shared: boolean
  usage_count: number
  last_used: string
}

// Extended Commitment interface with additional financial tracking fields
export interface ExtendedCommitment extends Commitment {
  total_amount?: number
  po_date?: string
  po_line_nr?: string
  po_line_text?: string
  vendor_description?: string
  requester?: string
  cost_center?: string
  wbs_element?: string
  account_group_level1?: string
  account_subgroup_level2?: string
  account_level3?: string
  custom_fields?: Record<string, unknown>
}

// Extended Actual interface with additional financial tracking fields
export interface ExtendedActual extends Actual {
  po_no?: string
  posting_date?: string
  gl_account?: string
  cost_center?: string
  wbs_element?: string
  item_text?: string
  quantity?: number
  net_due_date?: string
  custom_fields?: Record<string, unknown>
}

// Cost Breakdown Structure - financial tracking columns
export interface CostBreakdownRow {
  approved_budget: number
  eac: number
  variance: number
  open_committed: number
  invoice_value: number
  actual_cost: number
}

// Cash Out Forecast: time bucket + distribution
export interface CashOutForecastBucket {
  period_start: string
  period_end: string
  planned: number
  commitments: number
  actuals: number
}

// Distribution Settings for forecast planning (Phase 2)
export type DistributionProfile = 'linear' | 'custom' | 'ai_generated'

export interface DistributionSettings {
  profile: DistributionProfile
  duration_start: string
  duration_end: string
  granularity: 'week' | 'month'
}

// Distribution Rules Engine (Phase 3)
export type DistributionRuleType = 'automatic' | 'reprofiling' | 'ai_generator'

export interface DistributionRule {
  id: string
  type: DistributionRuleType
  profile: DistributionProfile
  settings: DistributionSettings
}