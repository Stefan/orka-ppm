/**
 * Enterprise Readiness – Shared types for Phase 1–3
 * Phase 1: Audit, Pagination, Encryption, Rate limiting
 */

// =============================================================================
// Phase 1 – Security & Scalability
// =============================================================================

/** SOX-compliant audit log entry (matches backend and Supabase audit_logs) */
export interface AuditLogEntry {
  id: string
  user_id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'LOGIN' | 'LOGIN_FAILED'
  entity: string
  entity_id: string | null
  old_value: string | null
  new_value: string | null
  timestamp: string
  ip: string | null
  user_agent: string | null
  correlation_id: string | null
  organization_id: string | null
}

export interface AuditLogCreate {
  user_id: string
  action: AuditLogEntry['action']
  entity: string
  entity_id?: string | null
  old_value?: string | null
  new_value?: string | null
  ip?: string | null
  user_agent?: string | null
  correlation_id?: string | null
  organization_id?: string | null
}

/** Cursor-based pagination (preferred for large datasets) */
export interface PaginationCursor {
  cursor?: string | null
  limit: number
  direction?: 'next' | 'prev'
}

/** Offset-based pagination (for admin / exports) */
export interface PaginationOffset {
  offset: number
  limit: number
}

export type PaginationInput = PaginationCursor | PaginationOffset

export function isCursorPagination(p: PaginationInput): p is PaginationCursor {
  return 'cursor' in p || ('limit' in p && !('offset' in p))
}

/** Generic paginated API response */
export interface PaginatedResponse<T> {
  data: T[]
  next_cursor: string | null
  prev_cursor: string | null
  total?: number
  has_more: boolean
}

/** Sensitive fields that are encrypted at rest (application layer) */
export type EncryptedEntityType = 'commitments' | 'actuals' | 'financial_variances'

export interface EncryptedPayload {
  ciphertext: string
  iv: string
  tag: string
  version: number
}

/** Rate limit response headers (from backend) */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': number
  'X-RateLimit-Remaining': number
  'X-RateLimit-Reset': number
  'Retry-After'?: number
}

/** API error with correlation ID for support */
export interface EnterpriseApiError {
  message: string
  code: string
  correlation_id: string | null
  status: number
}

// =============================================================================
// Phase 2 – Integration & Customizability
// =============================================================================

/** ERP adapter type (SAP, CSV, etc.) */
export type ErpAdapterType = 'sap' | 'csv' | 'mock'

/** ERP sync result for commitments/actuals */
export interface ErpSyncResult {
  adapter: ErpAdapterType
  entity: 'commitments' | 'actuals'
  total: number
  inserted: number
  updated: number
  errors: string[]
  synced_at: string
}

/** Workflow node (react-flow compatible) */
export interface WorkflowNode {
  id: string
  type: 'step' | 'condition' | 'start' | 'end'
  position: { x: number; y: number }
  data: { label: string; [key: string]: unknown }
}

/** Workflow edge */
export interface WorkflowEdge {
  id: string
  source: string
  target: string
}

/** Saved column view for registers */
export interface ColumnView {
  id: string
  name: string
  entity: string
  columns: string[]
  order: number
  is_default?: boolean
  user_id?: string
  created_at: string
}

// =============================================================================
// Phase 3 – AI, Analytics & Reliability
// =============================================================================

/** EVM metrics */
export interface EvmMetrics {
  cpi: number
  spi: number
  tcpi: number
  vac: number
  cv: number
  sv: number
  bac?: number
  eac?: number
  etc?: number
}

/** Cash out forecast period */
export interface CashForecastPeriod {
  period: string
  planned: number
  actual: number
  forecast: number
}

/** Phase 3: Real-time presence (Supabase Realtime) */
export interface PresenceUser {
  user_id: string
  email?: string
  online_at: string
}

/** Phase 3: Comment with @-mentions */
export interface Comment {
  id: string
  entity_type: string
  entity_id: string
  user_id: string
  body: string
  mentions: string[]
  created_at: string
}
