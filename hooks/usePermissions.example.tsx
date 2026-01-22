/**
 * usePermissions Hook - Usage Examples
 * 
 * This file demonstrates various usage patterns for the usePermissions hook.
 * These examples show how to use the hook for permission checking, role checking,
 * and implementing dynamic UI behavior based on user permissions.
 * 
 * Requirements: 3.2, 3.5 - Hook-based API with real-time updates
 */

'use client'

import React, { useState } from 'react'
import { usePermissions } from './usePermissions'
import type { Permission } from '@/types/rbac'

// ============================================================================
// Example 1: Basic Permission Check
// ============================================================================

export function EditProjectButton({ projectId }: { projectId: string }) {
  const { hasPermission, loading } = usePermissions()

  if (loading) {
    return <button disabled>Loading...</button>
  }

  if (!hasPermission('project_update')) {
    return null // Don't show button if user lacks permission
  }

  return (
    <button onClick={() => console.log('Edit project', projectId)}>
      Edit Project
    </button>
  )
}

// ============================================================================
// Example 2: Multiple Permissions (OR Logic)
// ============================================================================

export function DashboardView() {
  const { hasPermission, loading } = usePermissions()

  if (loading) {
    return <div>Loading dashboard...</div>
  }

  // User needs either permission to view dashboard
  const canViewDashboard = hasPermission(['project_read', 'portfolio_read'])

  if (!canViewDashboard) {
    return <div>You don't have permission to view the dashboard</div>
  }

  return (
    <div>
      <h1>Dashboard</h1>
      {/* Dashboard content */}
    </div>
  )
}

// ============================================================================
// Example 3: Context-Aware Permission Checking
// ============================================================================

export function ProjectActions({ projectId }: { projectId: string }) {
  const { hasPermission } = usePermissions()

  // Note: Context-aware checks rely on cache populated by PermissionGuard
  // For initial checks, use PermissionGuard component
  const canEdit = hasPermission('project_update', { project_id: projectId })
  const canDelete = hasPermission('project_delete', { project_id: projectId })

  return (
    <div className="flex gap-2">
      {canEdit && (
        <button onClick={() => console.log('Edit')}>Edit</button>
      )}
      {canDelete && (
        <button onClick={() => console.log('Delete')}>Delete</button>
      )}
    </div>
  )
}

// ============================================================================
// Example 4: Role Checking
// ============================================================================

export function AdminPanel() {
  const { hasRole, loading } = usePermissions()

  if (loading) {
    return <div>Loading...</div>
  }

  const isAdmin = hasRole('admin')
  const isManager = hasRole(['portfolio_manager', 'project_manager'])

  return (
    <div>
      <h2>Control Panel</h2>
      
      {isAdmin && (
        <section>
          <h3>Admin Controls</h3>
          <button>Manage Users</button>
          <button>System Settings</button>
        </section>
      )}
      
      {isManager && (
        <section>
          <h3>Manager Controls</h3>
          <button>Manage Projects</button>
          <button>View Reports</button>
        </section>
      )}
    </div>
  )
}

// ============================================================================
// Example 5: Enabling/Disabling Actions
// ============================================================================

export function ActionButtons({ projectId }: { projectId: string }) {
  const { hasPermission } = usePermissions()

  const canEdit = hasPermission('project_update', { project_id: projectId })
  const canDelete = hasPermission('project_delete', { project_id: projectId })
  const canExport = hasPermission('data_export')

  return (
    <div className="flex gap-2">
      <button 
        disabled={!canEdit}
        onClick={() => console.log('Edit')}
        className={!canEdit ? 'opacity-50 cursor-not-allowed' : ''}
      >
        Edit
      </button>
      
      <button 
        disabled={!canDelete}
        onClick={() => console.log('Delete')}
        className={!canDelete ? 'opacity-50 cursor-not-allowed' : ''}
      >
        Delete
      </button>
      
      <button 
        disabled={!canExport}
        onClick={() => console.log('Export')}
        className={!canExport ? 'opacity-50 cursor-not-allowed' : ''}
      >
        Export
      </button>
    </div>
  )
}

// ============================================================================
// Example 6: Navigation Logic
// ============================================================================

interface NavItem {
  label: string
  path: string
  visible: boolean
}

export function useNavigationItems(): NavItem[] {
  const { hasPermission } = usePermissions()

  return [
    {
      label: 'Portfolios',
      path: '/portfolios',
      visible: hasPermission('portfolio_read')
    },
    {
      label: 'Projects',
      path: '/projects',
      visible: hasPermission('project_read')
    },
    {
      label: 'Resources',
      path: '/resources',
      visible: hasPermission('resource_read')
    },
    {
      label: 'Financial',
      path: '/financial',
      visible: hasPermission('financial_read')
    },
    {
      label: 'Admin',
      path: '/admin',
      visible: hasPermission(['admin_read', 'system_admin'])
    }
  ].filter(item => item.visible)
}

export function Navigation() {
  const navItems = useNavigationItems()

  return (
    <nav>
      <ul>
        {navItems.map(item => (
          <li key={item.path}>
            <a href={item.path}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ============================================================================
// Example 7: Form Validation
// ============================================================================

interface ProjectFormData {
  name: string
  description: string
  budget: number
}

export function ProjectForm({ projectId }: { projectId: string }) {
  const { hasPermission } = usePermissions()
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    budget: 0
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check permission before submitting
    if (!hasPermission('project_update', { project_id: projectId })) {
      alert('You do not have permission to update this project')
      return
    }

    try {
      // Submit form data
      console.log('Submitting:', formData)
      alert('Project updated successfully')
    } catch (error) {
      alert('Failed to update project')
    }
  }

  const canEdit = hasPermission('project_update', { project_id: projectId })

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.name}
        onChange={e => setFormData({ ...formData, name: e.target.value })}
        disabled={!canEdit}
      />
      
      <textarea
        value={formData.description}
        onChange={e => setFormData({ ...formData, description: e.target.value })}
        disabled={!canEdit}
      />
      
      <input
        type="number"
        value={formData.budget}
        onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })}
        disabled={!canEdit}
      />
      
      <button type="submit" disabled={!canEdit}>
        Save Changes
      </button>
    </form>
  )
}

// ============================================================================
// Example 8: Dynamic Feature Flags
// ============================================================================

export function FeaturePanel() {
  const { hasPermission } = usePermissions()

  const features = {
    aiOptimization: hasPermission('ai_resource_optimize'),
    simulation: hasPermission('simulation_run'),
    advancedReports: hasPermission('pmr_ai_insights'),
    dataImport: hasPermission('data_import')
  }

  return (
    <div>
      <h2>Available Features</h2>
      
      {features.aiOptimization && (
        <section>
          <h3>AI Optimization</h3>
          <button>Optimize Resources</button>
        </section>
      )}
      
      {features.simulation && (
        <section>
          <h3>Monte Carlo Simulation</h3>
          <button>Run Simulation</button>
        </section>
      )}
      
      {features.advancedReports && (
        <section>
          <h3>AI Insights</h3>
          <button>Generate Insights</button>
        </section>
      )}
      
      {features.dataImport && (
        <section>
          <h3>Data Import</h3>
          <button>Import Data</button>
        </section>
      )}
    </div>
  )
}

// ============================================================================
// Example 9: Manual Permission Refresh
// ============================================================================

export function RoleManagement() {
  const { refetch, hasPermission, userRoles } = usePermissions()
  const [updating, setUpdating] = useState(false)

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    setUpdating(true)
    
    try {
      // Update user role via API
      console.log('Updating role for user', userId, 'to', newRole)
      
      // Refresh permissions immediately after role change
      await refetch()
      
      alert('Role updated and permissions refreshed')
    } catch (error) {
      alert('Failed to update role')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div>
      <h2>Role Management</h2>
      
      <div>
        <h3>Your Current Roles</h3>
        <ul>
          {userRoles.map(role => (
            <li key={role}>{role}</li>
          ))}
        </ul>
      </div>
      
      {hasPermission('role_manage') && (
        <div>
          <h3>Manage Roles</h3>
          <button 
            onClick={() => handleRoleUpdate('user-123', 'admin')}
            disabled={updating}
          >
            {updating ? 'Updating...' : 'Update Role'}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Example 10: Error Handling
// ============================================================================

export function PermissionAwareComponent() {
  const { hasPermission, loading, error } = usePermissions()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        <span className="ml-2">Loading permissions...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4">
        <h3 className="text-red-800 font-semibold">Failed to load permissions</h3>
        <p className="text-red-600">{error.message}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      {hasPermission('project_read') && (
        <div>
          <h2>Projects</h2>
          {/* Project list */}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Example 11: Combining with PermissionGuard
// ============================================================================

import { PermissionGuard } from '@/components/auth/PermissionGuard'

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const { hasPermission, loading } = usePermissions()

  if (loading) {
    return <div>Loading...</div>
  }

  // Use hook for logic decisions
  const canManageProject = hasPermission('project_update', { project_id: projectId })
  const showFinancials = hasPermission('financial_read', { project_id: projectId })

  return (
    <div>
      {/* Use PermissionGuard for conditional rendering */}
      <PermissionGuard permission="project_read" context={{ project_id: projectId }}>
        <section>
          <h2>Project Overview</h2>
          {/* Project details */}
        </section>
      </PermissionGuard>

      {/* Use hook for dynamic behavior */}
      <section>
        <h2>Actions</h2>
        <button disabled={!canManageProject}>
          {canManageProject ? 'Edit Project' : 'View Only'}
        </button>
      </section>

      {/* Combine both approaches */}
      {showFinancials && (
        <PermissionGuard permission="financial_read" context={{ project_id: projectId }}>
          <section>
            <h2>Financial Details</h2>
            {/* Financial information */}
          </section>
        </PermissionGuard>
      )}
    </div>
  )
}

// ============================================================================
// Example 12: Permission-Based Routing
// ============================================================================

export function usePermissionBasedRedirect() {
  const { hasPermission, loading } = usePermissions()

  const getDefaultRoute = (): string => {
    if (loading) return '/loading'

    if (hasPermission('admin_read')) return '/admin'
    if (hasPermission('portfolio_read')) return '/portfolios'
    if (hasPermission('project_read')) return '/projects'
    
    return '/access-denied'
  }

  return { defaultRoute: getDefaultRoute(), loading }
}

export function HomePage() {
  const { defaultRoute, loading } = usePermissionBasedRedirect()

  if (loading) {
    return <div>Loading...</div>
  }

  // Redirect to appropriate page based on permissions
  if (typeof window !== 'undefined') {
    window.location.href = defaultRoute
  }

  return null
}

// ============================================================================
// Example 13: Permission List Display
// ============================================================================

export function UserPermissionsDisplay() {
  const { permissions, userRoles, loading } = usePermissions()

  if (loading) {
    return <div>Loading permissions...</div>
  }

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-lg font-semibold">Your Roles</h3>
        <ul className="list-disc list-inside">
          {userRoles.map(role => (
            <li key={role} className="text-gray-700">
              {role}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Your Permissions</h3>
        <div className="grid grid-cols-2 gap-2">
          {permissions.map(permission => (
            <div key={permission} className="bg-gray-100 px-3 py-1 rounded text-sm">
              {permission}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ============================================================================
// Example 14: Conditional Menu Items
// ============================================================================

interface MenuItem {
  id: string
  label: string
  icon: string
  action: () => void
  requiredPermission: Permission | Permission[]
}

export function ContextMenu({ projectId }: { projectId: string }) {
  const { hasPermission } = usePermissions()

  const menuItems: MenuItem[] = [
    {
      id: 'view',
      label: 'View Details',
      icon: '👁️',
      action: () => console.log('View'),
      requiredPermission: 'project_read'
    },
    {
      id: 'edit',
      label: 'Edit Project',
      icon: '✏️',
      action: () => console.log('Edit'),
      requiredPermission: 'project_update'
    },
    {
      id: 'delete',
      label: 'Delete Project',
      icon: '🗑️',
      action: () => console.log('Delete'),
      requiredPermission: 'project_delete'
    },
    {
      id: 'export',
      label: 'Export Data',
      icon: '📤',
      action: () => console.log('Export'),
      requiredPermission: 'data_export'
    }
  ]

  const visibleItems = menuItems.filter(item => 
    hasPermission(item.requiredPermission, { project_id: projectId })
  )

  return (
    <div className="bg-white shadow-lg rounded-lg p-2">
      {visibleItems.map(item => (
        <button
          key={item.id}
          onClick={item.action}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

// ============================================================================
// Example 15: Real-Time Permission Updates
// ============================================================================

export function RealTimePermissionDemo() {
  const { permissions, userRoles, refetch } = usePermissions()
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Simulate real-time updates
  const simulateRoleChange = async () => {
    console.log('Simulating role change...')
    
    // In a real app, this would be triggered by a WebSocket event
    // or a server-sent event when roles change
    await refetch()
    
    setLastUpdate(new Date())
  }

  return (
    <div className="space-y-4">
      <div>
        <h3>Current Permissions</h3>
        <p>Roles: {userRoles.join(', ')}</p>
        <p>Permissions: {permissions.length}</p>
        <p>Last Updated: {lastUpdate.toLocaleTimeString()}</p>
      </div>

      <button 
        onClick={simulateRoleChange}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Simulate Role Change
      </button>
    </div>
  )
}
