'use client'

import React from 'react'
import { UserPlus, Calendar, Edit, Trash2, Lock } from 'lucide-react'
import PermissionGuard from '../auth/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import { useTranslations } from '@/lib/i18n/context'
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
  const { t } = useTranslations()
  
  const context: PermissionContext = {}
  if (projectId) context.project_id = projectId
  if (portfolioId) context.portfolio_id = portfolioId
  if (resourceId) context.resource_id = resourceId
  
  // Check if user is viewer (read-only)
  const isViewer = !hasPermission('resource_update', context) && hasPermission('resource_read', context)
  
  const baseClass = 'inline-flex items-center justify-center gap-2 min-h-[44px] text-sm font-medium rounded-xl transition-[background-color,box-shadow] duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'
  const buttonClass = variant === 'compact'
    ? `${baseClass} px-4 py-2.5`
    : `${baseClass} px-4 py-2`

  const primaryButtonClass = variant === 'compact'
    ? `${buttonClass} bg-indigo-600 text-white border border-indigo-700 hover:bg-indigo-500 active:bg-indigo-700 shadow-sm focus:ring-indigo-400 focus:ring-offset-white dark:bg-indigo-500 dark:border-indigo-600 dark:hover:bg-indigo-400 dark:focus:ring-offset-slate-900`
    : `${buttonClass} bg-indigo-600 text-white border border-indigo-700 hover:bg-indigo-500 active:bg-indigo-700`

  const secondaryButtonClass = variant === 'compact'
    ? `${buttonClass} bg-slate-200 text-slate-900 border border-slate-300 hover:bg-slate-300 hover:border-slate-400 active:bg-slate-400 focus:ring-slate-500 focus:ring-offset-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-600 dark:active:bg-slate-500 dark:focus:ring-offset-slate-900`
    : `${buttonClass} bg-slate-200 text-slate-900 border border-slate-300 hover:bg-slate-300 active:bg-slate-400 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-600`

  const dangerButtonClass = variant === 'compact'
    ? `${buttonClass} bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50`
    : `${buttonClass} bg-red-600 text-white hover:bg-red-700`

  return (
    <div className="flex flex-col gap-2">
      {/* Read-only indicator for viewers */}
      {isViewer && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm text-yellow-800 dark:text-yellow-300">
          <Lock className="h-4 w-4" />
          <span>Read-only access - Resource updates require resource_update permission</span>
        </div>
      )}
      
      <div className="flex gap-2 items-center">
        {/* Assign Resource Button */}
        {onAssignResource && (
          <PermissionGuard permission="resource_update" context={context}>
            <button
              onClick={onAssignResource}
              className={primaryButtonClass}
              title="Ressource zuweisen"
              aria-label="Ressource zuweisen"
            >
              <UserPlus className="h-4 w-4 shrink-0" />
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
              title="Ressource planen"
              aria-label="Ressource planen"
            >
              <Calendar className="h-4 w-4 shrink-0" />
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
              title="Zuteilung bearbeiten"
              aria-label="Zuteilung bearbeiten"
            >
              <Edit className="h-4 w-4 shrink-0" />
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
              title="Ressource entfernen"
              aria-label="Ressource entfernen"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              {variant === 'default' && <span>Remove</span>}
            </button>
          </PermissionGuard>
        )}
      </div>
    </div>
  )
}

export default ResourceActionButtons
