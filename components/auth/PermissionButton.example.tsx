/**
 * PermissionButton Component Usage Examples
 * 
 * This file demonstrates various ways to use the PermissionButton component
 * for implementing permission-based action button controls.
 */

import React from 'react'
import { PermissionButton } from './PermissionButton'
import { Edit, Trash2, Save, Download, Upload, Plus } from 'lucide-react'

// ============================================================================
// Example 1: Basic Permission Button (Disabled when no permission)
// ============================================================================

export function BasicPermissionButtonExample() {
  const handleEdit = () => {
    console.log('Editing project...')
  }

  return (
    <PermissionButton 
      permission="project_update"
      onClick={handleEdit}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      Edit Project
    </PermissionButton>
  )
}

// ============================================================================
// Example 2: Hide Button When No Permission
// ============================================================================

export function HiddenPermissionButtonExample() {
  const handleDelete = () => {
    console.log('Deleting project...')
  }

  return (
    <PermissionButton 
      permission="project_delete"
      unauthorizedBehavior="hide"
      onClick={handleDelete}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      Delete Project
    </PermissionButton>
  )
}

// ============================================================================
// Example 3: Context-Aware Permission Button
// ============================================================================

export function ContextAwareButtonExample({ projectId }: { projectId: string }) {
  const handleEdit = () => {
    console.log(`Editing project ${projectId}...`)
  }

  return (
    <PermissionButton 
      permission="project_update"
      context={{ project_id: projectId }}
      unauthorizedTooltip="You don't have permission to edit this project"
      onClick={handleEdit}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      Edit This Project
    </PermissionButton>
  )
}

// ============================================================================
// Example 4: Multiple Permissions (OR Logic)
// ============================================================================

export function MultiplePermissionsButtonExample() {
  const handleManageBudget = () => {
    console.log('Managing budget...')
  }

  return (
    <PermissionButton 
      // User needs EITHER financial_read OR financial_update
      permission={["financial_read", "financial_update"]}
      onClick={handleManageBudget}
      className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-700"
    >
      Manage Budget
    </PermissionButton>
  )
}

// ============================================================================
// Example 5: Button with Icon
// ============================================================================

export function IconButtonExample() {
  const handleSave = () => {
    console.log('Saving changes...')
  }

  return (
    <PermissionButton 
      permission="project_update"
      onClick={handleSave}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      <Save className="h-4 w-4" />
      Save Changes
    </PermissionButton>
  )
}

// ============================================================================
// Example 6: Button with Force Disabled (Form Validation)
// ============================================================================

export function FormValidationButtonExample() {
  const [formData, setFormData] = React.useState({ name: '', description: '' })
  
  const isFormValid = formData.name.length > 0 && formData.description.length > 0

  const handleSubmit = () => {
    console.log('Creating project...', formData)
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Project Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className="w-full px-3 py-2 border rounded"
      />
      
      <textarea
        placeholder="Project Description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        className="w-full px-3 py-2 border rounded"
      />
      
      <PermissionButton 
        permission="project_create"
        forceDisabled={!isFormValid}
        onClick={handleSubmit}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
      >
        Create Project
      </PermissionButton>
    </div>
  )
}

// ============================================================================
// Example 7: Button Group with Different Permissions
// ============================================================================

export function ButtonGroupExample({ projectId }: { projectId: string }) {
  const handleView = () => console.log('Viewing project...')
  const handleEdit = () => console.log('Editing project...')
  const handleDelete = () => console.log('Deleting project...')

  return (
    <div className="flex gap-2">
      <PermissionButton 
        permission="project_read"
        context={{ project_id: projectId }}
        onClick={handleView}
        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
      >
        View Details
      </PermissionButton>
      
      <PermissionButton 
        permission="project_update"
        context={{ project_id: projectId }}
        onClick={handleEdit}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        <Edit className="h-4 w-4 inline mr-2" />
        Edit
      </PermissionButton>
      
      <PermissionButton 
        permission="project_delete"
        context={{ project_id: projectId }}
        unauthorizedBehavior="hide"
        onClick={handleDelete}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        <Trash2 className="h-4 w-4 inline mr-2" />
        Delete
      </PermissionButton>
    </div>
  )
}

// ============================================================================
// Example 8: Loading State
// ============================================================================

export function LoadingStateButtonExample() {
  const [isLoading, setIsLoading] = React.useState(false)

  const handleExport = async () => {
    setIsLoading(true)
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsLoading(false)
    console.log('Export complete')
  }

  return (
    <PermissionButton 
      permission="pmr_export"
      onClick={handleExport}
      forceDisabled={isLoading}
      className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-700 disabled:bg-gray-300"
      loadingContent={
        <button 
          disabled 
          className="px-4 py-2 bg-gray-300 text-gray-600 dark:text-slate-400 rounded cursor-not-allowed"
        >
          Checking permissions...
        </button>
      }
    >
      {isLoading ? (
        <>
          <span className="animate-spin inline-block mr-2">⏳</span>
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 inline mr-2" />
          Export Report
        </>
      )}
    </PermissionButton>
  )
}

// ============================================================================
// Example 9: Toolbar with Multiple Action Buttons
// ============================================================================

export function ToolbarExample({ projectId }: { projectId: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-slate-700 rounded">
      <h2 className="text-lg font-semibold">Project Actions</h2>
      
      <div className="flex gap-2">
        <PermissionButton 
          permission="project_create"
          onClick={() => console.log('Creating new project...')}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          <Plus className="h-4 w-4 inline mr-1" />
          New
        </PermissionButton>
        
        <PermissionButton 
          permission="project_update"
          context={{ project_id: projectId }}
          onClick={() => console.log('Editing project...')}
          className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
        >
          <Edit className="h-4 w-4 inline mr-1" />
          Edit
        </PermissionButton>
        
        <PermissionButton 
          permission="data_import"
          onClick={() => console.log('Importing data...')}
          className="px-3 py-2 bg-green-700 text-white rounded hover:bg-green-700 text-sm"
        >
          <Upload className="h-4 w-4 inline mr-1" />
          Import
        </PermissionButton>
        
        <PermissionButton 
          permission="pmr_export"
          context={{ project_id: projectId }}
          onClick={() => console.log('Exporting data...')}
          className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
        >
          <Download className="h-4 w-4 inline mr-1" />
          Export
        </PermissionButton>
      </div>
    </div>
  )
}

// ============================================================================
// Example 10: Card with Action Buttons
// ============================================================================

export function ProjectCardExample({ 
  projectId, 
  projectName 
}: { 
  projectId: string
  projectName: string 
}) {
  return (
    <div className="border rounded-lg p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-2">{projectName}</h3>
      <p className="text-gray-600 dark:text-slate-400 mb-4">Project details and description...</p>
      
      <div className="flex gap-2">
        <PermissionButton 
          permission="project_read"
          context={{ project_id: projectId }}
          onClick={() => console.log('Viewing project...')}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          View
        </PermissionButton>
        
        <PermissionButton 
          permission="project_update"
          context={{ project_id: projectId }}
          onClick={() => console.log('Editing project...')}
          className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Edit
        </PermissionButton>
        
        <PermissionButton 
          permission="project_delete"
          context={{ project_id: projectId }}
          unauthorizedBehavior="hide"
          unauthorizedTooltip="You don't have permission to delete this project"
          onClick={() => console.log('Deleting project...')}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </PermissionButton>
      </div>
    </div>
  )
}
