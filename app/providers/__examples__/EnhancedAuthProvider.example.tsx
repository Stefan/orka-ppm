/**
 * EnhancedAuthProvider Usage Examples
 * 
 * This file demonstrates various usage patterns for the EnhancedAuthProvider,
 * including permission refresh, real-time synchronization, and context sharing.
 * 
 * Requirements: 2.2 - Permission refresh and synchronization
 */

import React, { useEffect, useState } from 'react'
import { useEnhancedAuth, usePermissions } from '../EnhancedAuthProvider'
import type { Permission, PermissionContext } from '@/types/rbac'

/**
 * Example 1: Manual Permission Refresh
 * 
 * Demonstrates how to manually refresh permissions after role changes.
 * Useful when you know a role assignment has been made and want to
 * immediately reflect the changes in the UI.
 */
export function RoleManagementPanel() {
  const { refreshPermissions, userRoles, loading } = useEnhancedAuth()
  const [updating, setUpdating] = useState(false)

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    setUpdating(true)
    try {
      // Make API call to update user role
      await fetch(`/api/users/${userId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ role: newRole })
      })

      // Manually refresh permissions to reflect the change
      await refreshPermissions()
      
      console.log('Role updated and permissions refreshed')
    } catch (error) {
      console.error('Failed to update role:', error)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return <div>Loading permissions...</div>
  }

  return (
    <div>
      <h2>Current Roles: {userRoles.join(', ')}</h2>
      <button 
        onClick={() => handleRoleUpdate('user-123', 'admin')}
        disabled={updating}
      >
        {updating ? 'Updating...' : 'Assign Admin Role'}
      </button>
    </div>
  )
}

/**
 * Example 2: Automatic Permission Synchronization
 * 
 * Demonstrates how permissions are automatically synchronized when
 * role changes occur in the database. The EnhancedAuthProvider
 * subscribes to real-time changes and updates permissions automatically.
 */
export function PermissionStatusIndicator() {
  const { userPermissions, loading, error } = useEnhancedAuth()
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Track when permissions change
  useEffect(() => {
    setLastUpdate(new Date())
  }, [userPermissions])

  if (loading) {
    return <div>Loading permissions...</div>
  }

  if (error) {
    return (
      <div className="error">
        <p>Error loading permissions: {error.message}</p>
        <p>Please refresh the page or contact support.</p>
      </div>
    )
  }

  return (
    <div>
      <h3>Your Permissions ({userPermissions.length})</h3>
      <p>Last updated: {lastUpdate.toLocaleTimeString()}</p>
      <ul>
        {userPermissions.map(permission => (
          <li key={permission}>{permission}</li>
        ))}
      </ul>
      <p className="info">
        ℹ️ Permissions are automatically synchronized when your roles change
      </p>
    </div>
  )
}

/**
 * Example 3: Permission Context Sharing
 * 
 * Demonstrates how to preload permissions for a specific context
 * and share them across multiple components. This optimizes performance
 * by caching permission checks for the same context.
 */
export function ProjectDashboard({ projectId }: { projectId: string }) {
  const { preloadPermissionsForContext, loading } = useEnhancedAuth()

  // Preload permissions for this project context
  useEffect(() => {
    if (!loading && projectId) {
      const context: PermissionContext = { project_id: projectId }
      preloadPermissionsForContext(context)
        .then(() => console.log('Permissions preloaded for project:', projectId))
        .catch(err => console.error('Failed to preload permissions:', err))
    }
  }, [projectId, loading, preloadPermissionsForContext])

  return (
    <div>
      <h1>Project Dashboard</h1>
      <ProjectHeader projectId={projectId} />
      <ProjectActions projectId={projectId} />
      <ProjectContent projectId={projectId} />
    </div>
  )
}

/**
 * Child component that benefits from preloaded permissions
 */
function ProjectHeader({ projectId }: { projectId: string }) {
  const { hasPermission } = useEnhancedAuth()
  const context: PermissionContext = { project_id: projectId }

  // This check uses the cached permission from preloadPermissionsForContext
  const canEdit = hasPermission('project_update', context)

  return (
    <div>
      <h2>Project: {projectId}</h2>
      {canEdit && <span className="badge">Editor</span>}
    </div>
  )
}

/**
 * Another child component using the same context
 */
function ProjectActions({ projectId }: { projectId: string }) {
  const { hasPermission } = useEnhancedAuth()
  const context: PermissionContext = { project_id: projectId }

  // These checks also use the cached permissions
  const canUpdate = hasPermission('project_update', context)
  const canDelete = hasPermission('project_delete', context)
  const canManageFinancials = hasPermission('financial_update', context)

  return (
    <div className="actions">
      {canUpdate && <button>Edit Project</button>}
      {canDelete && <button>Delete Project</button>}
      {canManageFinancials && <button>Update Budget</button>}
    </div>
  )
}

/**
 * Yet another child component sharing the same context
 */
function ProjectContent({ projectId }: { projectId: string }) {
  const { hasPermission } = useEnhancedAuth()
  const context: PermissionContext = { project_id: projectId }

  const canViewFinancials = hasPermission('financial_read', context)
  const canViewResources = hasPermission('resource_read', context)

  return (
    <div>
      {canViewFinancials && <FinancialSection projectId={projectId} />}
      {canViewResources && <ResourceSection projectId={projectId} />}
    </div>
  )
}

/**
 * Example 4: Real-time Permission Updates with Notifications
 * 
 * Demonstrates how to show notifications when permissions change
 * due to role updates.
 */
export function PermissionChangeNotifier() {
  const { userPermissions, error } = useEnhancedAuth()
  const [previousPermissions, setPreviousPermissions] = useState<Permission[]>([])
  const [notification, setNotification] = useState<string | null>(null)

  useEffect(() => {
    if (previousPermissions.length > 0 && userPermissions.length > 0) {
      const added = userPermissions.filter(p => !previousPermissions.includes(p))
      const removed = previousPermissions.filter(p => !userPermissions.includes(p))

      if (added.length > 0 || removed.length > 0) {
        let message = 'Your permissions have been updated: '
        if (added.length > 0) {
          message += `Added ${added.length} permission(s). `
        }
        if (removed.length > 0) {
          message += `Removed ${removed.length} permission(s).`
        }
        
        setNotification(message)
        
        // Auto-dismiss notification after 5 seconds
        setTimeout(() => setNotification(null), 5000)
      }
    }

    setPreviousPermissions(userPermissions)
  }, [userPermissions])

  // Show error notifications
  useEffect(() => {
    if (error) {
      setNotification(`Error: ${error.message}`)
      setTimeout(() => setNotification(null), 5000)
    }
  }, [error])

  if (!notification) return null

  return (
    <div className="notification">
      <p>{notification}</p>
      <button onClick={() => setNotification(null)}>Dismiss</button>
    </div>
  )
}

/**
 * Example 5: Multi-Context Permission Checking
 * 
 * Demonstrates how to check permissions across multiple contexts
 * efficiently using preloading.
 */
export function MultiProjectView({ projectIds }: { projectIds: string[] }) {
  const { preloadPermissionsForContext, hasPermission, loading } = useEnhancedAuth()

  // Preload permissions for all projects
  useEffect(() => {
    if (!loading && projectIds.length > 0) {
      Promise.all(
        projectIds.map(projectId =>
          preloadPermissionsForContext({ project_id: projectId })
        )
      ).then(() => {
        console.log('Permissions preloaded for all projects')
      })
    }
  }, [projectIds, loading, preloadPermissionsForContext])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h2>Your Projects</h2>
      {projectIds.map(projectId => {
        const context: PermissionContext = { project_id: projectId }
        const canView = hasPermission('project_read', context)
        const canEdit = hasPermission('project_update', context)

        return (
          <div key={projectId} className="project-card">
            <h3>Project {projectId}</h3>
            <div className="permissions">
              {canView && <span>👁️ View</span>}
              {canEdit && <span>✏️ Edit</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Example 6: Permission Refresh with Loading State
 * 
 * Demonstrates how to show loading state during permission refresh.
 */
export function RefreshablePermissionPanel() {
  const { refreshPermissions, userPermissions, loading } = useEnhancedAuth()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshPermissions()
      console.log('Permissions refreshed successfully')
    } catch (error) {
      console.error('Failed to refresh permissions:', error)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div>
      <div className="header">
        <h3>Your Permissions</h3>
        <button 
          onClick={handleRefresh} 
          disabled={loading || refreshing}
        >
          {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
        </button>
      </div>
      
      {loading ? (
        <div>Loading permissions...</div>
      ) : (
        <ul>
          {userPermissions.map(permission => (
            <li key={permission}>{permission}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Example 7: Conditional Rendering Based on Permission Changes
 * 
 * Demonstrates how components automatically re-render when permissions change.
 */
export function DynamicFeaturePanel() {
  const { hasPermission, loading } = usePermissions()

  if (loading) {
    return <div>Loading features...</div>
  }

  return (
    <div>
      <h2>Available Features</h2>
      
      {/* These sections automatically appear/disappear when permissions change */}
      {hasPermission('project_create') && (
        <section>
          <h3>Project Management</h3>
          <p>You can create and manage projects</p>
        </section>
      )}

      {hasPermission('financial_read') && (
        <section>
          <h3>Financial Dashboard</h3>
          <p>View financial reports and budgets</p>
        </section>
      )}

      {hasPermission('user_manage') && (
        <section>
          <h3>User Administration</h3>
          <p>Manage users and role assignments</p>
        </section>
      )}

      {hasPermission(['ai_rag_query', 'ai_resource_optimize']) && (
        <section>
          <h3>AI Features</h3>
          <p>Access AI-powered insights and optimization</p>
        </section>
      )}
    </div>
  )
}

// Dummy components for the examples
function FinancialSection({ projectId }: { projectId: string }) {
  return <div>Financial data for {projectId}</div>
}

function ResourceSection({ projectId }: { projectId: string }) {
  return <div>Resource allocation for {projectId}</div>
}
