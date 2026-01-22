/**
 * RBAC Type Definitions
 * 
 * Type definitions for Role-Based Access Control system.
 * These types mirror the backend Permission enum and PermissionContext model.
 */

/**
 * Permission types matching backend Permission enum
 * Source: backend/auth/rbac.py
 */
export type Permission =
  // Portfolio permissions
  | 'portfolio_create'
  | 'portfolio_read'
  | 'portfolio_update'
  | 'portfolio_delete'
  // Project permissions
  | 'project_create'
  | 'project_read'
  | 'project_update'
  | 'project_delete'
  // Resource permissions
  | 'resource_create'
  | 'resource_read'
  | 'resource_update'
  | 'resource_delete'
  | 'resource_allocate'
  // Financial permissions
  | 'financial_read'
  | 'financial_create'
  | 'financial_update'
  | 'financial_delete'
  | 'budget_alert_manage'
  // Risk and Issue permissions
  | 'risk_create'
  | 'risk_read'
  | 'risk_update'
  | 'risk_delete'
  | 'issue_create'
  | 'issue_read'
  | 'issue_update'
  | 'issue_delete'
  // AI permissions
  | 'ai_rag_query'
  | 'ai_resource_optimize'
  | 'ai_risk_forecast'
  | 'ai_metrics_read'
  // Admin permissions
  | 'user_manage'
  | 'role_manage'
  | 'admin_read'
  | 'admin_update'
  | 'admin_delete'
  | 'system_admin'
  | 'data_import'
  // PMR permissions
  | 'pmr_create'
  | 'pmr_read'
  | 'pmr_update'
  | 'pmr_delete'
  | 'pmr_approve'
  | 'pmr_export'
  | 'pmr_collaborate'
  | 'pmr_ai_insights'
  | 'pmr_template_manage'
  | 'pmr_audit_read'
  // Shareable URL permissions
  | 'shareable_url_create'
  | 'shareable_url_read'
  | 'shareable_url_revoke'
  | 'shareable_url_manage'
  // Monte Carlo simulation permissions
  | 'simulation_run'
  | 'simulation_read'
  | 'simulation_delete'
  | 'simulation_manage'
  // What-If scenario permissions
  | 'scenario_create'
  | 'scenario_read'

/**
 * Permission context for scoped permission checking
 * Mirrors backend PermissionContext model
 */
export interface PermissionContext {
  project_id?: string
  portfolio_id?: string
  resource_id?: string
  organization_id?: string
}

/**
 * User role information
 */
export interface UserRole {
  id: string
  name: string
  permissions: Permission[]
}

/**
 * Effective permissions response from backend
 */
export interface UserPermissions {
  user_id: string
  roles: UserRole[]
  permissions: Permission[]
  effective_permissions: Permission[]
  context_permissions?: Record<string, Permission[]>
}
