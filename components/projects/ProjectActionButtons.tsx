'use client'

import React from 'react'
import { Edit, Trash2, DollarSign, Users, FileText } from 'lucide-react'
import PermissionGuard from '../auth/PermissionGuard'
import type { PermissionContext } from '@/types/rbac'

interface ProjectActionButtonsProps {
  projectId: string
  onEdit?: () => void
  onDelete?: () => void
  onBudgetUpdate?: () => void
  onResourceManage?: () => void
  onReportGenerate?: () => void
  variant?: 'default' | 'compact'
}

/**
 * ProjectActionButtons Component
 * 
 * Displays action buttons for project management with role-based access control.
 * Each button is only visible if the user has the required permission.
 * 
 * Requirements: 14.2 - Add role-based action buttons to existing pages
 * 
 * @example
 * <ProjectActionButtons
 *   projectId={project.id}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onBudgetUpdate={handleBudgetUpdate}
 * />
 */
export const ProjectActionButtons: React.FC<ProjectActionButtonsProps> = ({
  projectId,
  onEdit,
  onDelete,
  onBudgetUpdate,
  onResourceManage,
  onReportGenerate,
  variant = 'default'
}) => {
  const context: PermissionContext = { project_id: projectId }
  
  const buttonClass = variant === 'compact'
    ? 'p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 transition-colors'
    : 'px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2'
  
  const primaryButtonClass = variant === 'compact'
    ? `${buttonClass} text-blue-600 dark:text-blue-400 hover:bg-blue-50`
    : `${buttonClass} bg-blue-600 text-white hover:bg-blue-700`
  
  const secondaryButtonClass = variant === 'compact'
    ? `${buttonClass} text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700`
    : `${buttonClass} bg-gray-200 text-gray-700 dark:text-slate-300 hover:bg-gray-300`
  
  const dangerButtonClass = variant === 'compact'
    ? `${buttonClass} text-red-600 dark:text-red-400 hover:bg-red-50`
    : `${buttonClass} bg-red-600 text-white hover:bg-red-700`

  return (
    <div className={`flex ${variant === 'compact' ? 'gap-1' : 'gap-2'} items-center`}>
      {/* Edit Project Button */}
      {onEdit && (
        <PermissionGuard permission="project_update" context={context}>
          <button
            onClick={onEdit}
            className={primaryButtonClass}
            title="Edit Project"
          >
            <Edit className="h-4 w-4" />
            {variant === 'default' && <span>Edit</span>}
          </button>
        </PermissionGuard>
      )}

      {/* Budget Update Button */}
      {onBudgetUpdate && (
        <PermissionGuard permission="financial_update" context={context}>
          <button
            onClick={onBudgetUpdate}
            className={secondaryButtonClass}
            title="Update Budget"
          >
            <DollarSign className="h-4 w-4" />
            {variant === 'default' && <span>Budget</span>}
          </button>
        </PermissionGuard>
      )}

      {/* Resource Management Button */}
      {onResourceManage && (
        <PermissionGuard permission="resource_update" context={context}>
          <button
            onClick={onResourceManage}
            className={secondaryButtonClass}
            title="Manage Resources"
          >
            <Users className="h-4 w-4" />
            {variant === 'default' && <span>Resources</span>}
          </button>
        </PermissionGuard>
      )}

      {/* Report Generation Button */}
      {onReportGenerate && (
        <PermissionGuard permission={['report_read', 'analytics_read']} context={context}>
          <button
            onClick={onReportGenerate}
            className={secondaryButtonClass}
            title="Generate Report"
          >
            <FileText className="h-4 w-4" />
            {variant === 'default' && <span>Report</span>}
          </button>
        </PermissionGuard>
      )}

      {/* Delete Project Button */}
      {onDelete && (
        <PermissionGuard permission="project_delete" context={context}>
          <button
            onClick={onDelete}
            className={dangerButtonClass}
            title="Delete Project"
          >
            <Trash2 className="h-4 w-4" />
            {variant === 'default' && <span>Delete</span>}
          </button>
        </PermissionGuard>
      )}
    </div>
  )
}

export default ProjectActionButtons
