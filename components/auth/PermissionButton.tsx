'use client'

import React, { ButtonHTMLAttributes, ReactNode } from 'react'
import { useEnhancedAuth } from '@/app/providers/EnhancedAuthProvider'
import type { Permission, PermissionContext } from '@/types/rbac'

/**
 * Props for the PermissionButton component
 * 
 * Requirements: 3.4 - Action Button Permission Control
 */
export interface PermissionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /**
   * Required permission(s) to enable this button.
   * Can be a single permission string or an array of permissions.
   * When an array is provided, ANY of the permissions will enable the button (OR logic).
   */
  permission: Permission | Permission[]
  
  /**
   * Optional context for scoped permission checking.
   * Allows checking permissions within specific projects, portfolios, etc.
   */
  context?: PermissionContext
  
  /**
   * Button content
   */
  children: ReactNode
  
  /**
   * Behavior when user lacks permission.
   * - 'disable': Button is rendered but disabled (default)
   * - 'hide': Button is not rendered at all
   */
  unauthorizedBehavior?: 'disable' | 'hide'
  
  /**
   * Optional tooltip text to show when button is disabled due to lack of permission
   */
  unauthorizedTooltip?: string
  
  /**
   * Optional loading state content while permissions are being checked
   */
  loadingContent?: ReactNode
  
  /**
   * Force disabled state regardless of permissions
   * Useful for form validation or other business logic
   */
  forceDisabled?: boolean
}

/**
 * PermissionButton Component
 * 
 * A React button component that automatically controls its enabled/disabled state
 * or visibility based on user permissions. Integrates with the EnhancedAuthProvider
 * to provide fast, cached permission checking.
 * 
 * Features:
 * - Automatic permission-based button state control
 * - Context-aware permission evaluation (project, portfolio, organization scopes)
 * - Configurable behavior (disable vs hide) for unauthorized access
 * - Loading state support
 * - Tooltip support for disabled state
 * - All standard button props supported
 * - Automatic permission cache for performance
 * 
 * Requirements: 3.4 - Disable or hide buttons for unauthorized operations
 * 
 * @example
 * // Basic usage - button disabled if user lacks permission
 * <PermissionButton 
 *   permission="project_update"
 *   onClick={handleEdit}
 * >
 *   Edit Project
 * </PermissionButton>
 * 
 * @example
 * // Hide button if user lacks permission
 * <PermissionButton 
 *   permission="project_delete"
 *   unauthorizedBehavior="hide"
 *   onClick={handleDelete}
 * >
 *   Delete Project
 * </PermissionButton>
 * 
 * @example
 * // Context-aware permission check
 * <PermissionButton 
 *   permission="project_update"
 *   context={{ project_id: projectId }}
 *   unauthorizedTooltip="You don't have permission to edit this project"
 *   onClick={handleEdit}
 * >
 *   Edit Project
 * </PermissionButton>
 * 
 * @example
 * // Multiple permissions (OR logic)
 * <PermissionButton 
 *   permission={["financial_read", "financial_update"]}
 *   onClick={handleBudget}
 * >
 *   Manage Budget
 * </PermissionButton>
 * 
 * @example
 * // With force disabled for form validation
 * <PermissionButton 
 *   permission="project_create"
 *   forceDisabled={!isFormValid}
 *   onClick={handleSubmit}
 * >
 *   Create Project
 * </PermissionButton>
 */
export const PermissionButton: React.FC<PermissionButtonProps> = ({
  permission,
  context,
  children,
  unauthorizedBehavior = 'disable',
  unauthorizedTooltip,
  loadingContent,
  forceDisabled = false,
  className,
  onClick,
  ...buttonProps
}) => {
  const { hasPermission, loading } = useEnhancedAuth()

  // Show loading state while checking permissions
  if (loading) {
    if (loadingContent) {
      return <>{loadingContent}</>
    }
    // Render disabled button during loading
    return (
      <button
        {...buttonProps}
        disabled={true}
        className={className}
      >
        {children}
      </button>
    )
  }

  // Check permission using the enhanced auth provider
  const granted = hasPermission(permission, context)

  // Hide button if user lacks permission and behavior is 'hide'
  if (!granted && unauthorizedBehavior === 'hide') {
    return null
  }

  // Determine if button should be disabled
  const isDisabled = forceDisabled || !granted

  // Render button with appropriate state
  return (
    <button
      {...buttonProps}
      disabled={isDisabled}
      className={className}
      onClick={isDisabled ? undefined : onClick}
      title={!granted && unauthorizedTooltip ? unauthorizedTooltip : buttonProps.title}
      aria-disabled={isDisabled}
    >
      {children}
    </button>
  )
}

export default PermissionButton
