'use client'

import React from 'react'
import { Plus, Upload, Download, Edit, Lock } from 'lucide-react'
import PermissionGuard from '../auth/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import type { PermissionContext } from '@/types/rbac'

interface FinancialActionButtonsProps {
  projectId?: string
  portfolioId?: string
  onAddTransaction?: () => void
  onImportData?: () => void
  onExportReport?: () => void
  onEditBudget?: () => void
  variant?: 'default' | 'compact'
}

/**
 * FinancialActionButtons Component
 * 
 * Displays action buttons for financial management with role-based access control.
 * Shows read-only indicators for users with viewer permissions.
 * 
 * Requirements: 14.2 - Add role-based controls to financial management pages
 * 
 * @example
 * <FinancialActionButtons
 *   projectId={project.id}
 *   onAddTransaction={handleAdd}
 *   onEditBudget={handleEdit}
 * />
 */
export const FinancialActionButtons: React.FC<FinancialActionButtonsProps> = ({
  projectId,
  portfolioId,
  onAddTransaction,
  onImportData,
  onExportReport,
  onEditBudget,
  variant = 'default'
}) => {
  const { hasPermission } = usePermissions()
  
  const context: PermissionContext = {}
  if (projectId) context.project_id = projectId
  if (portfolioId) context.portfolio_id = portfolioId
  
  // Check if user is viewer (read-only)
  const isViewer = !hasPermission('financial_update', context) && hasPermission('financial_read', context)
  
  const buttonClass = variant === 'compact'
    ? 'p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 transition-colors'
    : 'px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2'
  
  const primaryButtonClass = variant === 'compact'
    ? `${buttonClass} text-blue-600 dark:text-blue-400 hover:bg-blue-50`
    : `${buttonClass} bg-blue-600 text-white hover:bg-blue-700`
  
  const secondaryButtonClass = variant === 'compact'
    ? `${buttonClass} text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700`
    : `${buttonClass} bg-gray-200 text-gray-700 dark:text-slate-300 hover:bg-gray-300`

  return (
    <div className="flex flex-col gap-2">
      {/* Read-only indicator for viewers */}
      {isViewer && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm text-yellow-800 dark:text-yellow-300">
          <Lock className="h-4 w-4" />
          <span>Read-only access - Financial updates require financial_update permission</span>
        </div>
      )}
      
      <div className={`flex ${variant === 'compact' ? 'gap-1' : 'gap-2'} items-center`}>
        {/* Add Transaction Button */}
        {onAddTransaction && (
          <PermissionGuard permission="financial_update" context={context}>
            <button
              onClick={onAddTransaction}
              className={primaryButtonClass}
              title="Add Transaction"
            >
              <Plus className="h-4 w-4" />
              {variant === 'default' && <span>Add Transaction</span>}
            </button>
          </PermissionGuard>
        )}

        {/* Import Data Button */}
        {onImportData && (
          <PermissionGuard permission="financial_update" context={context}>
            <button
              onClick={onImportData}
              className={secondaryButtonClass}
              title="Import Financial Data"
            >
              <Upload className="h-4 w-4" />
              {variant === 'default' && <span>Import</span>}
            </button>
          </PermissionGuard>
        )}

        {/* Export Report Button - Available to all with read access */}
        {onExportReport && (
          <PermissionGuard permission="financial_read" context={context}>
            <button
              onClick={onExportReport}
              className={secondaryButtonClass}
              title="Export Financial Report"
            >
              <Download className="h-4 w-4" />
              {variant === 'default' && <span>Export</span>}
            </button>
          </PermissionGuard>
        )}

        {/* Edit Budget Button */}
        {onEditBudget && (
          <PermissionGuard permission="financial_update" context={context}>
            <button
              onClick={onEditBudget}
              className={secondaryButtonClass}
              title="Edit Budget"
            >
              <Edit className="h-4 w-4" />
              {variant === 'default' && <span>Edit Budget</span>}
            </button>
          </PermissionGuard>
        )}
      </div>
    </div>
  )
}

export default FinancialActionButtons
