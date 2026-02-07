export interface Project {
  id: string
  name: string
  budget?: number | null
  actual_cost?: number | null
  status: string
  health: 'green' | 'yellow' | 'red'
}

export interface BudgetVariance {
  project_id: string
  total_planned: number
  total_actual: number
  variance_amount: number
  variance_percentage: number
  currency: string
  categories: Array<{
    category: string
    planned: number
    actual: number
    variance: number
    variance_percentage: number
  }>
  status: string
}

export interface FinancialAlert {
  project_id: string
  project_name: string
  budget: number
  actual_cost: number
  utilization_percentage: number
  variance_amount: number
  alert_level: 'warning' | 'critical'
  message: string
}

export interface FinancialMetrics {
  total_budget: number
  total_actual: number
  total_variance: number
  variance_percentage: number
  projects_over_budget: number
  projects_under_budget: number
  average_budget_utilization: number
  currency_distribution: Record<string, number>
}

export interface TrendProjection {
  month: string
  projected_spending: number
  projected_variance: number
  confidence: number
}

export interface CostAnalysis {
  category: string
  current_month: number
  previous_month: number
  trend: 'up' | 'down' | 'stable'
  percentage_change: number
}

export interface BudgetPerformanceMetrics {
  on_track_projects: number
  at_risk_projects: number
  over_budget_projects: number
  total_savings: number
  total_overruns: number
  efficiency_score: number
}

export interface ComprehensiveFinancialReport {
  report_metadata: {
    generated_at: string
    currency: string
    projects_included: number
    includes_trends: boolean
  }
  summary: {
    total_budget: number
    total_actual: number
    total_variance: number
    variance_percentage: number
    currency: string
  }
  project_analysis: Array<{
    project_id: string
    project_name: string
    budget: number
    actual_cost: number
    variance_amount: number
    variance_percentage: number
    utilization_percentage: number
    status: string
    health: string
  }>
  category_spending: Array<{
    category: string
    total_spending: number
    transaction_count: number
    average_per_transaction: number
  }>
  trend_projections: TrendProjection[]
  risk_indicators: {
    projects_over_budget: number
    projects_at_risk: number
    critical_projects: number
    average_utilization: number
  }
}

export interface CSVImportHistory {
  id: string
  import_type: 'commitments' | 'actuals' | 'projects'
  file_name: string
  file_size: number
  records_processed: number
  records_imported: number
  records_failed: number
  import_status: 'processing' | 'completed' | 'failed'
  error_details: any
  started_at: string
  completed_at?: string
}

export interface CSVUploadResult {
  success: boolean
  records_processed: number
  records_imported: number
  errors: Array<{
    row: number
    field: string
    message: string
  }>
  warnings: Array<{
    row: number
    field: string
    message: string
  }>
  import_id: string
}

export type ViewMode = 'overview' | 'detailed' | 'trends' | 'analysis' | 'csv-import' | 'commitments-actuals' | 'po-breakdown' | 'costbook'

export interface AnalyticsData {
  budgetStatusData: Array<{
    name: string
    value: number
    color: string
  }>
  categoryData: Array<{
    name: string
    planned: number
    actual: number
    variance: number
    variance_percentage: number
    efficiency: number
  }>
  projectPerformanceData: Array<{
    name: string
    budget: number
    actual: number
    variance: number
    variance_percentage: number
    health: string
    efficiency_score: number
  }>
  totalProjects: number
  criticalAlerts: number
  warningAlerts: number
  totalSavings: number
  totalOverruns: number
  avgEfficiency: number
  netVariance: number
}


// PO Breakdown Types
export interface POBreakdown {
  id: string
  project_id: string
  name: string
  code?: string
  sap_po_number?: string
  sap_line_item?: string
  hierarchy_level: number
  parent_breakdown_id?: string
  cost_center?: string
  gl_account?: string
  planned_amount: number
  committed_amount: number
  actual_amount: number
  remaining_amount: number
  currency: string
  breakdown_type: 'sap_standard' | 'custom_hierarchy' | 'cost_center' | 'work_package'
  category?: string
  subcategory?: string
  custom_fields?: Record<string, any>
  tags?: string[]
  notes?: string
  import_batch_id?: string
  import_source?: string
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
  children?: POBreakdown[]
  rollup_data?: {
    planned_amount: number
    committed_amount: number
    actual_amount: number
    child_planned_total: number
    child_committed_total: number
    child_actual_total: number
    children_count: number
  }
}

export interface POBreakdownSummary {
  total_planned: number
  total_committed: number
  total_actual: number
  total_remaining: number
  breakdown_count: number
  hierarchy_levels: number
  currency: string
}

export interface POImportResult {
  success: boolean
  import_batch_id?: string
  total_rows: number
  successful_imports: number
  failed_imports: number
  errors: string[]
  warnings: string[]
  created_breakdowns: string[]
}
