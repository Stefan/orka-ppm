/**
 * ActionButtonGroup Component Usage Examples
 * 
 * This file demonstrates various ways to use the ActionButtonGroup component
 * for implementing permission-based action button groups.
 */

import React from 'react'
import { ActionButtonGroup, ActionButton } from './ActionButtonGroup'
import { Edit, Trash2, Eye, Download, Upload, Save, X, Check } from 'lucide-react'

// ============================================================================
// Example 1: Basic Action Button Group
// ============================================================================

export function BasicActionGroupExample({ projectId }: { projectId: string }) {
  const actions: ActionButton[] = [
    {
      id: 'view',
      label: 'View',
      permission: 'project_read',
      onClick: () => console.log('Viewing project...'),
      variant: 'secondary'
    },
    {
      id: 'edit',
      label: 'Edit',
      permission: 'project_update',
      onClick: () => console.log('Editing project...'),
      variant: 'primary'
    },
    {
      id: 'delete',
      label: 'Delete',
      permission: 'project_delete',
      onClick: () => console.log('Deleting project...'),
      variant: 'danger',
      unauthorizedBehavior: 'hide'
    }
  ]

  return (
    <ActionButtonGroup
      actions={actions}
      context={{ project_id: projectId }}
    />
  )
}

// ============================================================================
// Example 2: Vertical Button Group
// ============================================================================

export function VerticalActionGroupExample({ projectId }: { projectId: string }) {
  const actions: ActionButton[] = [
    {
      id: 'view',
      label: 'View Details',
      icon: <Eye className="h-4 w-4" />,
      permission: 'project_read',
      onClick: () => console.log('Viewing project...'),
      variant: 'outline'
    },
    {
      id: 'edit',
      label: 'Edit Project',
      icon: <Edit className="h-4 w-4" />,
      permission: 'project_update',
      onClick: () => console.log('Editing project...'),
      variant: 'primary'
    },
    {
      id: 'export',
      label: 'Export Data',
      icon: <Download className="h-4 w-4" />,
      permission: 'pmr_export',
      onClick: () => console.log('Exporting data...'),
      variant: 'secondary'
    },
    {
      id: 'delete',
      label: 'Delete Project',
      icon: <Trash2 className="h-4 w-4" />,
      permission: 'project_delete',
      onClick: () => console.log('Deleting project...'),
      variant: 'danger',
      unauthorizedBehavior: 'hide'
    }
  ]

  return (
    <ActionButtonGroup
      actions={actions}
      context={{ project_id: projectId }}
      direction="vertical"
      spacing="loose"
    />
  )
}

// ============================================================================
// Example 3: Toolbar with Icons
// ============================================================================

export function ToolbarActionGroupExample({ projectId }: { projectId: string }) {
  const actions: ActionButton[] = [
    {
      id: 'save',
      label: 'Save',
      icon: <Save className="h-4 w-4" />,
      permission: 'project_update',
      onClick: () => console.log('Saving changes...'),
      variant: 'success'
    },
    {
      id: 'export',
      label: 'Export',
      icon: <Download className="h-4 w-4" />,
      permission: 'pmr_export',
      onClick: () => console.log('Exporting...'),
      variant: 'secondary'
    },
    {
      id: 'import',
      label: 'Import',
      icon: <Upload className="h-4 w-4" />,
      permission: 'data_import',
      onClick: () => console.log('Importing...'),
      variant: 'secondary'
    }
  ]

  return (
    <div className="border-b pb-4 mb-4">
      <ActionButtonGroup
        actions={actions}
        context={{ project_id: projectId }}
        spacing="tight"
      />
    </div>
  )
}

// ============================================================================
// Example 4: Card Footer Actions
// ============================================================================

export function CardFooterActionsExample({ 
  projectId, 
  projectName 
}: { 
  projectId: string
  projectName: string 
}) {
  const actions: ActionButton[] = [
    {
      id: 'view',
      label: 'View',
      permission: 'project_read',
      onClick: () => console.log('Viewing project...'),
      variant: 'outline'
    },
    {
      id: 'edit',
      label: 'Edit',
      permission: 'project_update',
      onClick: () => console.log('Editing project...'),
      variant: 'primary'
    },
    {
      id: 'delete',
      label: 'Delete',
      permission: 'project_delete',
      onClick: () => console.log('Deleting project...'),
      variant: 'danger',
      unauthorizedBehavior: 'hide'
    }
  ]

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-4">
        <h3 className="text-lg font-semibold">{projectName}</h3>
        <p className="text-gray-600 dark:text-slate-400 mt-2">Project details and description...</p>
      </div>
      
      <div className="bg-gray-50 dark:bg-slate-800/50 px-4 py-3 border-t">
        <ActionButtonGroup
          actions={actions}
          context={{ project_id: projectId }}
          spacing="normal"
        />
      </div>
    </div>
  )
}

// ============================================================================
// Example 5: Modal Actions
// ============================================================================

export function ModalActionsExample({ 
  projectId,
  onClose 
}: { 
  projectId: string
  onClose: () => void 
}) {
  const [isSaving, setIsSaving] = React.useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate save operation
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    onClose()
  }

  const actions: ActionButton[] = [
    {
      id: 'cancel',
      label: 'Cancel',
      icon: <X className="h-4 w-4" />,
      permission: 'project_read', // Everyone who can view can cancel
      onClick: onClose,
      variant: 'outline'
    },
    {
      id: 'save',
      label: 'Save Changes',
      icon: <Check className="h-4 w-4" />,
      permission: 'project_update',
      onClick: handleSave,
      variant: 'primary'
    }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Edit Project</h2>
        
        <div className="mb-6">
          <p>Modal content goes here...</p>
        </div>
        
        <ActionButtonGroup
          actions={actions}
          context={{ project_id: projectId }}
          loading={isSaving}
          className="justify-end"
        />
      </div>
    </div>
  )
}

// ============================================================================
// Example 6: Different Contexts for Different Buttons
// ============================================================================

export function MixedContextActionsExample({ 
  projectId,
  portfolioId 
}: { 
  projectId: string
  portfolioId: string 
}) {
  const actions: ActionButton[] = [
    {
      id: 'edit-project',
      label: 'Edit Project',
      permission: 'project_update',
      context: { project_id: projectId }, // Project-specific context
      onClick: () => console.log('Editing project...'),
      variant: 'primary'
    },
    {
      id: 'edit-portfolio',
      label: 'Edit Portfolio',
      permission: 'portfolio_update',
      context: { portfolio_id: portfolioId }, // Portfolio-specific context
      onClick: () => console.log('Editing portfolio...'),
      variant: 'secondary'
    },
    {
      id: 'manage-resources',
      label: 'Manage Resources',
      permission: 'resource_allocate',
      // Uses shared context from ActionButtonGroup
      onClick: () => console.log('Managing resources...'),
      variant: 'secondary'
    }
  ]

  return (
    <ActionButtonGroup
      actions={actions}
      context={{ project_id: projectId }} // Shared context for buttons without specific context
    />
  )
}

// ============================================================================
// Example 7: Financial Actions with Multiple Permissions
// ============================================================================

export function FinancialActionsExample({ projectId }: { projectId: string }) {
  const actions: ActionButton[] = [
    {
      id: 'view-budget',
      label: 'View Budget',
      icon: <Eye className="h-4 w-4" />,
      permission: 'financial_read',
      onClick: () => console.log('Viewing budget...'),
      variant: 'outline'
    },
    {
      id: 'update-budget',
      label: 'Update Budget',
      icon: <Edit className="h-4 w-4" />,
      // User needs EITHER financial_update OR admin_update
      permission: ['financial_update', 'admin_update'],
      onClick: () => console.log('Updating budget...'),
      variant: 'primary'
    },
    {
      id: 'export-financial',
      label: 'Export Report',
      icon: <Download className="h-4 w-4" />,
      permission: 'financial_read',
      onClick: () => console.log('Exporting financial report...'),
      variant: 'secondary'
    }
  ]

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Financial Management</h3>
      
      <ActionButtonGroup
        actions={actions}
        context={{ project_id: projectId }}
        spacing="normal"
      />
    </div>
  )
}

// ============================================================================
// Example 8: Admin Panel Actions
// ============================================================================

export function AdminPanelActionsExample() {
  const actions: ActionButton[] = [
    {
      id: 'manage-users',
      label: 'Manage Users',
      permission: 'user_manage',
      onClick: () => console.log('Managing users...'),
      variant: 'primary'
    },
    {
      id: 'manage-roles',
      label: 'Manage Roles',
      permission: 'role_manage',
      onClick: () => console.log('Managing roles...'),
      variant: 'primary'
    },
    {
      id: 'system-settings',
      label: 'System Settings',
      permission: 'system_admin',
      onClick: () => console.log('Opening system settings...'),
      variant: 'secondary'
    },
    {
      id: 'import-data',
      label: 'Import Data',
      icon: <Upload className="h-4 w-4" />,
      permission: 'data_import',
      onClick: () => console.log('Importing data...'),
      variant: 'secondary'
    }
  ]

  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Administration</h2>
      
      <ActionButtonGroup
        actions={actions}
        direction="vertical"
        spacing="normal"
      />
    </div>
  )
}

// ============================================================================
// Example 9: Resource Management Actions
// ============================================================================

export function ResourceManagementActionsExample({ resourceId }: { resourceId: string }) {
  const actions: ActionButton[] = [
    {
      id: 'view',
      label: 'View',
      permission: 'resource_read',
      onClick: () => console.log('Viewing resource...'),
      variant: 'outline'
    },
    {
      id: 'edit',
      label: 'Edit',
      permission: 'resource_update',
      onClick: () => console.log('Editing resource...'),
      variant: 'primary'
    },
    {
      id: 'allocate',
      label: 'Allocate',
      permission: 'resource_allocate',
      onClick: () => console.log('Allocating resource...'),
      variant: 'success'
    },
    {
      id: 'delete',
      label: 'Delete',
      permission: 'resource_delete',
      onClick: () => console.log('Deleting resource...'),
      variant: 'danger',
      unauthorizedBehavior: 'hide'
    }
  ]

  return (
    <ActionButtonGroup
      actions={actions}
      context={{ resource_id: resourceId }}
      spacing="tight"
    />
  )
}

// ============================================================================
// Example 10: PMR Actions with Collaboration
// ============================================================================

export function PMRActionsExample({ projectId }: { projectId: string }) {
  const actions: ActionButton[] = [
    {
      id: 'view',
      label: 'View PMR',
      permission: 'pmr_read',
      onClick: () => console.log('Viewing PMR...'),
      variant: 'outline'
    },
    {
      id: 'edit',
      label: 'Edit PMR',
      permission: 'pmr_update',
      onClick: () => console.log('Editing PMR...'),
      variant: 'primary'
    },
    {
      id: 'collaborate',
      label: 'Collaborate',
      permission: 'pmr_collaborate',
      onClick: () => console.log('Opening collaboration...'),
      variant: 'secondary'
    },
    {
      id: 'ai-insights',
      label: 'AI Insights',
      permission: 'pmr_ai_insights',
      onClick: () => console.log('Generating AI insights...'),
      variant: 'secondary'
    },
    {
      id: 'export',
      label: 'Export',
      icon: <Download className="h-4 w-4" />,
      permission: 'pmr_export',
      onClick: () => console.log('Exporting PMR...'),
      variant: 'secondary'
    },
    {
      id: 'approve',
      label: 'Approve',
      icon: <Check className="h-4 w-4" />,
      permission: 'pmr_approve',
      onClick: () => console.log('Approving PMR...'),
      variant: 'success'
    }
  ]

  return (
    <div className="border-t pt-4 mt-4">
      <ActionButtonGroup
        actions={actions}
        context={{ project_id: projectId }}
        spacing="normal"
      />
    </div>
  )
}
