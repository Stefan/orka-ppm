'use client'

import React from 'react'
import { UserPlus, Calendar, Edit, Trash2, Lock } from 'lucide-react'
import PermissionGuard from '../auth/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import type { PermissionContext } from '@/types/rbac'

interface ResourceActionButtonsProps {
  projectId?: string
  portfolioId?: string
  resourceId?: string
  onAssignResource?: () => void
  onScheduleResource?: () => void
  onEditAllocation?: () => void
  onRemoveResource?: () => void
  variant?: 'default' | 'compact'
}

/**
 * ResourceActionButtons Component
 * 
 * Displays action buttons for resource management with role-based access control.
 * Enforces manager scope restrictions and viewer read-only access.
 * 
 * Requirements: 14.2 - Add role-based controls to resource management pages
 * 
 * @example
 * <ResourceActionButtons
 *   projectId={project.id}
 *   onAssignResource={handleAssign}
 *   onEditAllocation={handleEdit}
 * />
 */
export const ResourceActionButtons: React.FC<ResourceActionButtonsProps> = ({
  projectId,
  portfolioId,
  resourceId,
  onAssignResource,
  onScheduleResource,
  onEditAllocation,
  onRemoveResource,
  variant = 'default'
}) => {
  const { hasPermission } = usePermissions()
  
  const context: PermissionContext = {}
  if (projectId) context.project_id = projectId
  if (portfolioId) context.portfolio_id = portfolioId
  if (resourceId) context.resource_id = resourceId
  
  // Check if user is viewer (read-only)
  const isViewer = !hasPermission('resource_update', context) && hasPermission('resource_read', context)
  
  const buttonClass = variant === 'compact'
    ? 'p-2 rounded hover:bg-gray-100 transition-colors'
    : 'px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2'
  
  const primaryButtonClass = variant === 'compact'
    ? `${buttonClass} text-blue-600 hover:bg-blue-50`
    : `${buttonClass} bg-blue-600 text-white hover:bg-blue-700`
  
  const secondaryButtonClass = variant === 'compact'
    ? `${buttonClass} text-gray-600 hover:bg-gray-100`
    : `${buttonClass} bg-gray-200 text-gray-700 hover:bg-gray-300`
  
  const dangerButtonClass = variant === 'compact'
    ? `${buttonClass} text-red-600 hover:bg-red-50`
    : `${buttonClass} bg-red-600 text-white hover:bg-red-700`

  return (
    <div className="flex flex-col gap-2">
      {/* Read-only indicator for viewers */}
      {isViewer && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
          <Lock className="h-4 w-4" />
          <span>Read-only access - Resource updates require resource_update permission</span>
        </div>
      )}
      
      <div className={`flex ${variant === 'compact' ? 'gap-1' : 'gap-2'} items-center`}>
        {/* Assign Resource Button */}
        {onAssignResource && (
          <PermissionGuard permission="resource_update" context={context}>
            <button
              onClick={onAssignResource}
              className={primaryButtonClass}
              title="Assign Resource"
            >
              <UserPlus className="h-4 w-4" />
              {variant === 'default' && <span>Assign</span>}
            </button>
          </PermissionGuard>
        )}

        {/* Schedule Resource Button */}
        {onScheduleResource && (
          <PermissionGuard permission="resource_update" context={context}>
            <button
              onClick={onScheduleResource}
              className={secondaryButtonClass}
              title="Schedule Resource"
            >
              <Calendar className="h-4 w-4" />
              {variant === 'default' && <span>Schedule</span>}
            </button>
          </PermissionGuard>
        )}

        {/* Edit Allocation Button */}
        {onEditAllocation && (
          <PermissionGuard permission="resource_update" context={context}>
            <button
              onClick={onEditAllocation}
              className={secondaryButtonClass}
              title="Edit Allocation"
            >
              <Edit className="h-4 w-4" />
              {variant === 'default' && <span>Edit</span>}
            </button>
          </PermissionGuard>
        )}

        {/* Remove Resource Button */}
        {onRemoveResource && (
          <PermissionGuard permission="resource_update" context={context}>
            <button
              onClick={onRemoveResource}
              className={dangerButtonClass}
              title="Remove Resource"
            >
              <Trash2 className="h-4 w-4" />
              {variant === 'default' && <span>Remove</span>}
            </button>
          </PermissionGuard>
        )}
      </div>
    </div>
  )
}

export default ResourceActionButtons
