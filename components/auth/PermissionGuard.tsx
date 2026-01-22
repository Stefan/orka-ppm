'use client'

import React, { ReactNode } from 'react'
import { useEnhancedAuth } from '@/app/providers/EnhancedAuthProvider'
import type { Permission, PermissionContext } from '@/types/rbac'

/**
 * Props for the PermissionGuard component
 * 
 * Requirements: 3.1 - UI Component Permission Enforcement
 */
export interface PermissionGuardProps {
  /**
   * Required permission(s) to render children.
   * Can be a single permission string or an array of permissions.
   * When an array is provided, ANY of the permissions will grant access (OR logic).
   */
  permission: Permission | Permission[]
  
  /**
   * Optional context for scoped permission checking.
   * Allows checking permissions within specific projects, portfolios, etc.
   */
  context?: PermissionContext
  
  /**
   * Optional fallback content to render when user lacks permission.
   * If not provided, nothing will be rendered.
   */
  fallback?: ReactNode
  
  /**
   * Content to render when user has the required permission(s).
   */
  children: ReactNode
  
  /**
   * Optional loading state content while permissions are being checked.
   * If not provided, nothing will be rendered during loading.
   */
  loadingFallback?: ReactNode
}

/**
 * PermissionGuard Component
 * 
 * A React component that conditionally renders its children based on user permissions.
 * Integrates with the EnhancedAuthProvider to provide fast, cached permission checking.
 * 
 * Features:
 * - Single or multiple permission checking (OR logic for arrays)
 * - Context-aware permission evaluation (project, portfolio, organization scopes)
 * - Fallback rendering for unauthorized access
 * - Loading state support
 * - Automatic permission cache for performance
 * 
 * Requirements: 3.1 - Implement React component for conditional rendering based on permissions
 * 
 * @example
 * // Single permission check
 * <PermissionGuard permission="project_update">
 *   <EditProjectButton />
 * </PermissionGuard>
 * 
 * @example
 * // Multiple permissions (OR logic)
 * <PermissionGuard permission={["project_read", "portfolio_read"]}>
 *   <ProjectDashboard />
 * </PermissionGuard>
 * 
 * @example
 * // Context-aware permission check
 * <PermissionGuard 
 *   permission="project_update" 
 *   context={{ project_id: projectId }}
 *   fallback={<div>You don't have permission to edit this project</div>}
 * >
 *   <EditProjectForm />
 * </PermissionGuard>
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  context,
  fallback = null,
  children,
  loadingFallback = null
}) => {
  const { hasPermission, loading } = useEnhancedAuth()

  // Show loading state while checking permissions
  if (loading) {
    return <>{loadingFallback}</>
  }

  // Check permission using the enhanced auth provider
  const granted = hasPermission(permission, context)

  // Render children if user has permission, otherwise render fallback
  if (granted) {
    return <>{children}</>
  }

  return <>{fallback}</>
}

export default PermissionGuard
