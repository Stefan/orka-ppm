'use client'

import React, { ReactNode } from 'react'
import type { Permission, PermissionContext } from '@/types/rbac'
import { PermissionButton, PermissionButtonProps } from './PermissionButton'

/**
 * Action button configuration
 * 
 * Requirements: 3.4 - Action Button Permission Control
 */
export interface ActionButton extends Omit<PermissionButtonProps, 'children'> {
  /**
   * Unique identifier for the action button
   */
  id: string
  
  /**
   * Display label for the button
   */
  label: string
  
  /**
   * Optional icon component to display with the button
   */
  icon?: ReactNode
  
  /**
   * Button variant/style
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline'
}

/**
 * Props for the ActionButtonGroup component
 */
export interface ActionButtonGroupProps {
  /**
   * Array of action buttons to render with permission checks
   */
  actions: ActionButton[]
  
  /**
   * Optional shared context for all buttons in the group.
   * Individual button contexts will override this.
   */
  context?: PermissionContext
  
  /**
   * Optional className for the button group container
   */
  className?: string
  
  /**
   * Layout direction for the button group
   */
  direction?: 'horizontal' | 'vertical'
  
  /**
   * Spacing between buttons
   */
  spacing?: 'tight' | 'normal' | 'loose'
  
  /**
   * Optional loading state for all buttons
   */
  loading?: boolean
}

/**
 * ActionButtonGroup Component
 * 
 * A React component that renders a group of action buttons with automatic
 * permission-based visibility and state control. Each button is individually
 * checked for permissions and rendered accordingly.
 * 
 * Features:
 * - Automatic permission-based button filtering and state control
 * - Shared context for all buttons with individual override capability
 * - Flexible layout options (horizontal/vertical)
 * - Configurable spacing
 * - Loading state support
 * - Consistent styling with variant support
 * 
 * Requirements: 3.4 - Disable or hide buttons for unauthorized operations
 * 
 * @example
 * // Basic usage
 * const actions: ActionButton[] = [
 *   {
 *     id: 'edit',
 *     label: 'Edit',
 *     permission: 'project_update',
 *     onClick: handleEdit,
 *     variant: 'primary'
 *   },
 *   {
 *     id: 'delete',
 *     label: 'Delete',
 *     permission: 'project_delete',
 *     onClick: handleDelete,
 *     variant: 'danger',
 *     unauthorizedBehavior: 'hide'
 *   }
 * ]
 * 
 * <ActionButtonGroup
 *   actions={actions}
 *   context={{ project_id: projectId }}
 * />
 * 
 * @example
 * // Vertical layout with icons
 * const actions: ActionButton[] = [
 *   {
 *     id: 'view',
 *     label: 'View Details',
 *     icon: <EyeIcon />,
 *     permission: 'project_read',
 *     onClick: handleView
 *   },
 *   {
 *     id: 'edit',
 *     label: 'Edit Project',
 *     icon: <EditIcon />,
 *     permission: 'project_update',
 *     onClick: handleEdit
 *   }
 * ]
 * 
 * <ActionButtonGroup
 *   actions={actions}
 *   direction="vertical"
 *   spacing="loose"
 * />
 */
export const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({
  actions,
  context,
  className = '',
  direction = 'horizontal',
  spacing = 'normal',
  loading = false
}) => {
  // Determine spacing class based on direction and spacing prop
  const getSpacingClass = () => {
    const spacingMap = {
      tight: direction === 'horizontal' ? 'gap-1' : 'gap-1',
      normal: direction === 'horizontal' ? 'gap-2' : 'gap-2',
      loose: direction === 'horizontal' ? 'gap-4' : 'gap-4'
    }
    return spacingMap[spacing]
  }

  // Determine layout class based on direction
  const layoutClass = direction === 'horizontal' ? 'flex flex-row' : 'flex flex-col'

  // Get variant-specific classes
  const getVariantClasses = (variant?: ActionButton['variant']) => {
    const baseClasses = 'px-4 py-2 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
    
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed',
      secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-gray-300 disabled:cursor-not-allowed',
      success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed',
      outline: 'bg-transparent border-2 border-gray-600 text-gray-700 hover:bg-gray-50 focus:ring-gray-500 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed'
    }
    
    return `${baseClasses} ${variantClasses[variant || 'primary']}`
  }

  return (
    <div className={`${layoutClass} ${getSpacingClass()} ${className}`}>
      {actions.map((action) => {
        const {
          id,
          label,
          icon,
          variant,
          context: actionContext,
          className: actionClassName,
          ...buttonProps
        } = action

        // Use action-specific context if provided, otherwise use group context
        const effectiveContext = actionContext || context

        return (
          <PermissionButton
            key={id}
            {...buttonProps}
            context={effectiveContext}
            className={`${getVariantClasses(variant)} ${actionClassName || ''}`}
            forceDisabled={loading || buttonProps.forceDisabled}
          >
            {icon && <span className="inline-flex items-center mr-2">{icon}</span>}
            {label}
          </PermissionButton>
        )
      })}
    </div>
  )
}

export default ActionButtonGroup
