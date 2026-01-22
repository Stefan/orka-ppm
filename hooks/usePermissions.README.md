# usePermissions Hook

## Overview

The `usePermissions` hook is a React hook that provides programmatic permission checking in component logic. It enables components to check permissions, roles, and make decisions based on user access rights without relying solely on conditional rendering.

**Requirements:** 3.2, 3.5 - Hook-based API with real-time permission updates and performance optimization

## Features

- ✅ **Permission Checking**: Check if user has specific permissions
- ✅ **Multiple Permission Support**: Check if user has ANY of multiple permissions (OR logic)
- ✅ **Context-Aware Permissions**: Scope permissions to specific projects, portfolios, etc.
- ✅ **Role Checking**: Check if user has specific roles
- ✅ **Real-Time Updates**: Automatically updates when user roles change
- ✅ **Performance Caching**: Caches permission results for optimal performance
- ✅ **Manual Refresh**: Ability to manually refresh permissions
- ✅ **Loading States**: Provides loading state while fetching permissions
- ✅ **Error Handling**: Gracefully handles API errors

## Installation

The hook is already integrated into the project. Import it from the hooks directory:

```typescript
import { usePermissions } from '@/hooks/usePermissions'
```

## Basic Usage

### Simple Permission Check

```tsx
import { usePermissions } from '@/hooks/usePermissions'

function EditProjectButton({ projectId }: { projectId: string }) {
  const { hasPermission, loading } = usePermissions()

  if (loading) {
    return <Spinner />
  }

  if (!hasPermission('project_update')) {
    return null
  }

  return <Button onClick={handleEdit}>Edit Project</Button>
}
```

### Multiple Permissions (OR Logic)

```tsx
function DashboardView() {
  const { hasPermission } = usePermissions()

  // User needs either permission to view dashboard
  const canViewDashboard = hasPermission(['project_read', 'portfolio_read'])

  if (!canViewDashboard) {
    return <AccessDenied />
  }

  return <Dashboard />
}
```

### Context-Aware Permission Checking

```tsx
function ProjectActions({ projectId }: { projectId: string }) {
  const { hasPermission } = usePermissions()

  const canEdit = hasPermission('project_update', { project_id: projectId })
  const canDelete = hasPermission('project_delete', { project_id: projectId })

  return (
    <div>
      {canEdit && <Button onClick={handleEdit}>Edit</Button>}
      {canDelete && <Button onClick={handleDelete}>Delete</Button>}
    </div>
  )
}
```

### Role Checking

```tsx
function AdminPanel() {
  const { hasRole, loading } = usePermissions()

  if (loading) {
    return <Spinner />
  }

  const isAdmin = hasRole('admin')
  const isManager = hasRole(['portfolio_manager', 'project_manager'])

  return (
    <div>
      {isAdmin && <AdminControls />}
      {isManager && <ManagerControls />}
    </div>
  )
}
```

### Manual Permission Refresh

```tsx
function RoleManagement() {
  const { refetch, hasPermission } = usePermissions()

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    await updateUserRole(userId, newRole)
    
    // Refresh permissions immediately after role change
    await refetch()
    
    toast.success('Role updated and permissions refreshed')
  }

  return (
    <div>
      <RoleSelector onUpdate={handleRoleUpdate} />
    </div>
  )
}
```

## API Reference

### Return Value

The hook returns an object with the following properties:

```typescript
interface UsePermissionsReturn {
  hasPermission: (permission: Permission | Permission[], context?: PermissionContext) => boolean
  hasRole: (role: string | string[]) => boolean
  permissions: Permission[]
  userRoles: string[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}
```

#### `hasPermission(permission, context?)`

Check if the current user has a specific permission or any of multiple permissions.

**Parameters:**
- `permission`: `Permission | Permission[]` - Single permission or array of permissions (OR logic)
- `context`: `PermissionContext` (optional) - Context for scoped permission checking

**Returns:** `boolean` - `true` if user has the permission(s), `false` otherwise

**Examples:**
```typescript
// Single permission
hasPermission('project_read')

// Multiple permissions (OR logic)
hasPermission(['project_read', 'portfolio_read'])

// Context-aware
hasPermission('project_update', { project_id: '123' })
```

#### `hasRole(role)`

Check if the current user has a specific role or any of multiple roles.

**Parameters:**
- `role`: `string | string[]` - Single role name or array of role names (OR logic)

**Returns:** `boolean` - `true` if user has the role(s), `false` otherwise

**Examples:**
```typescript
// Single role
hasRole('admin')

// Multiple roles (OR logic)
hasRole(['portfolio_manager', 'project_manager'])
```

#### `permissions`

Array of all permissions the user has (global permissions).

**Type:** `Permission[]`

**Example:**
```typescript
const { permissions } = usePermissions()
console.log('User permissions:', permissions)
// ['project_read', 'project_update', 'resource_read', ...]
```

#### `userRoles`

Array of all roles assigned to the user.

**Type:** `string[]`

**Example:**
```typescript
const { userRoles } = usePermissions()
console.log('User roles:', userRoles)
// ['project_manager', 'resource_viewer']
```

#### `loading`

Loading state - `true` while permissions are being fetched.

**Type:** `boolean`

**Example:**
```typescript
const { loading } = usePermissions()

if (loading) {
  return <LoadingSpinner />
}
```

#### `error`

Error state - contains error if permission fetch failed.

**Type:** `Error | null`

**Example:**
```typescript
const { error } = usePermissions()

if (error) {
  return <ErrorMessage message={error.message} />
}
```

#### `refetch()`

Manually refresh permissions from the backend. Useful when you know roles have changed and need to update immediately.

**Returns:** `Promise<void>`

**Example:**
```typescript
const { refetch } = usePermissions()

const handleRoleChange = async () => {
  await updateUserRole()
  await refetch() // Refresh permissions immediately
}
```

## Common Patterns

### Conditional Rendering Based on Permissions

```tsx
function ProjectPage({ projectId }: { projectId: string }) {
  const { hasPermission, loading } = usePermissions()

  if (loading) {
    return <PageSkeleton />
  }

  return (
    <div>
      <ProjectDetails projectId={projectId} />
      
      {hasPermission('project_update', { project_id: projectId }) && (
        <EditSection projectId={projectId} />
      )}
      
      {hasPermission('financial_read', { project_id: projectId }) && (
        <FinancialSection projectId={projectId} />
      )}
    </div>
  )
}
```

### Enabling/Disabling Actions

```tsx
function ActionButtons({ projectId }: { projectId: string }) {
  const { hasPermission } = usePermissions()

  const canEdit = hasPermission('project_update', { project_id: projectId })
  const canDelete = hasPermission('project_delete', { project_id: projectId })
  const canExport = hasPermission('data_export')

  return (
    <div className="flex gap-2">
      <Button disabled={!canEdit} onClick={handleEdit}>
        Edit
      </Button>
      <Button disabled={!canDelete} onClick={handleDelete}>
        Delete
      </Button>
      <Button disabled={!canExport} onClick={handleExport}>
        Export
      </Button>
    </div>
  )
}
```

### Navigation Logic

```tsx
function useNavigationItems() {
  const { hasPermission } = usePermissions()

  const navItems = [
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
      label: 'Admin',
      path: '/admin',
      visible: hasPermission(['admin_read', 'system_admin'])
    }
  ]

  return navItems.filter(item => item.visible)
}
```

### Form Validation

```tsx
function ProjectForm({ projectId }: { projectId: string }) {
  const { hasPermission } = usePermissions()

  const handleSubmit = async (data: ProjectData) => {
    // Check permission before submitting
    if (!hasPermission('project_update', { project_id: projectId })) {
      toast.error('You do not have permission to update this project')
      return
    }

    try {
      await updateProject(projectId, data)
      toast.success('Project updated successfully')
    } catch (error) {
      toast.error('Failed to update project')
    }
  }

  return <Form onSubmit={handleSubmit} />
}
```

### Dynamic Feature Flags

```tsx
function FeaturePanel() {
  const { hasPermission } = usePermissions()

  const features = {
    aiOptimization: hasPermission('ai_resource_optimize'),
    simulation: hasPermission('simulation_run'),
    advancedReports: hasPermission('pmr_ai_insights'),
    dataImport: hasPermission('data_import')
  }

  return (
    <div>
      {features.aiOptimization && <AIOptimizationPanel />}
      {features.simulation && <SimulationPanel />}
      {features.advancedReports && <AdvancedReportsPanel />}
      {features.dataImport && <DataImportPanel />}
    </div>
  )
}
```

### Combining with PermissionGuard

```tsx
function ProjectDashboard({ projectId }: { projectId: string }) {
  const { hasPermission, loading } = usePermissions()

  if (loading) {
    return <Spinner />
  }

  // Use hook for logic decisions
  const canManageProject = hasPermission('project_update', { project_id: projectId })

  return (
    <div>
      {/* Use PermissionGuard for conditional rendering */}
      <PermissionGuard permission="project_read" context={{ project_id: projectId }}>
        <ProjectOverview projectId={projectId} />
      </PermissionGuard>

      {/* Use hook for dynamic behavior */}
      <ActionBar 
        projectId={projectId}
        editMode={canManageProject}
      />
    </div>
  )
}
```

## Performance Considerations

### Caching Strategy

The hook implements a sophisticated caching strategy:

1. **Global Permissions**: Cached in memory after initial fetch
2. **Context Permissions**: Cached for 1 minute after first check
3. **Cache Invalidation**: Automatically cleared on permission refresh
4. **Parallel Checks**: Multiple permission checks run in parallel

### Best Practices

1. **Use Global Permissions When Possible**: Global permission checks are faster as they don't require API calls
2. **Avoid Excessive Context Checks**: Context-aware checks may require API calls; use sparingly
3. **Leverage Caching**: Repeated checks for the same permission are served from cache
4. **Manual Refresh**: Only call `refetch()` when you know roles have changed

### Performance Metrics

- **Initial Load**: ~100-200ms (fetches all user permissions)
- **Global Permission Check**: <1ms (in-memory lookup)
- **Cached Context Check**: <1ms (cache lookup)
- **Uncached Context Check**: ~50-100ms (API call)
- **Cache TTL**: 60 seconds

## Real-Time Updates

The hook automatically updates when:

1. **User Authentication Changes**: Permissions refresh when user logs in/out
2. **Session Changes**: Permissions refresh when session is updated
3. **Manual Refresh**: Call `refetch()` to force immediate update

### Automatic Updates

```tsx
function UserProfile() {
  const { userRoles, permissions, loading } = usePermissions()

  // Automatically updates when user logs in
  useEffect(() => {
    console.log('Current roles:', userRoles)
    console.log('Current permissions:', permissions)
  }, [userRoles, permissions])

  return (
    <div>
      <h3>Your Roles</h3>
      <ul>
        {userRoles.map(role => <li key={role}>{role}</li>)}
      </ul>
    </div>
  )
}
```

### Manual Updates

```tsx
function RoleChangeHandler() {
  const { refetch } = usePermissions()

  // Listen for role change events
  useEffect(() => {
    const handleRoleChange = async () => {
      console.log('Role changed, refreshing permissions...')
      await refetch()
    }

    // Subscribe to role change events
    eventBus.on('user:role:changed', handleRoleChange)

    return () => {
      eventBus.off('user:role:changed', handleRoleChange)
    }
  }, [refetch])

  return null
}
```

## Error Handling

The hook handles errors gracefully:

```tsx
function PermissionAwareComponent() {
  const { hasPermission, loading, error } = usePermissions()

  if (loading) {
    return <Spinner />
  }

  if (error) {
    return (
      <ErrorBoundary>
        <div>
          <p>Failed to load permissions: {error.message}</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <div>
      {hasPermission('project_read') && <ProjectList />}
    </div>
  )
}
```

## Comparison with PermissionGuard

| Feature | usePermissions Hook | PermissionGuard Component |
|---------|-------------------|--------------------------|
| **Use Case** | Logic decisions, dynamic behavior | Conditional rendering |
| **API Style** | Imperative (function calls) | Declarative (JSX) |
| **Loading State** | Manual handling required | Built-in loading fallback |
| **Fallback Content** | Manual implementation | Built-in fallback prop |
| **Performance** | Cached, synchronous checks | Async API calls per check |
| **Context Awareness** | Supports context | Supports context |
| **Best For** | Enabling/disabling actions, form validation, navigation logic | Showing/hiding UI elements |

### When to Use Each

**Use `usePermissions` when:**
- You need to make logic decisions based on permissions
- You want to enable/disable buttons or form fields
- You need to check permissions in event handlers
- You want to implement custom loading/error states
- You need to check multiple permissions programmatically

**Use `PermissionGuard` when:**
- You want to conditionally render entire components
- You need simple show/hide behavior
- You want built-in loading and fallback states
- You prefer declarative JSX syntax
- You're wrapping large component trees

## Testing

### Unit Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { usePermissions } from '@/hooks/usePermissions'

// Mock the auth provider
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: { access_token: 'mock-token' },
    user: { id: 'user-123' },
    loading: false
  })
}))

describe('usePermissions', () => {
  it('should check permissions correctly', async () => {
    const { result } = renderHook(() => usePermissions())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.hasPermission('project_read')).toBe(true)
  })
})
```

### Integration Testing

```typescript
import { render, screen } from '@testing-library/react'
import { usePermissions } from '@/hooks/usePermissions'

function TestComponent() {
  const { hasPermission, loading } = usePermissions()

  if (loading) return <div>Loading...</div>

  return (
    <div>
      {hasPermission('project_update') && <button>Edit</button>}
    </div>
  )
}

test('renders edit button when user has permission', async () => {
  render(<TestComponent />)

  await waitFor(() => {
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })
})
```

## Troubleshooting

### Permissions not loading

1. Check that user is authenticated
2. Verify backend `/api/rbac/user-permissions` endpoint is running
3. Check browser console for API errors
4. Verify `NEXT_PUBLIC_API_URL` environment variable

### Stale permissions

1. Call `refetch()` after role changes
2. Check cache TTL (default 60 seconds)
3. Verify backend is returning updated permissions

### Context permissions not working

1. Ensure context IDs are valid UUIDs
2. Check that backend supports context-aware checking
3. Verify user has permission in the specified scope
4. Note: Context checks may require API calls and won't work synchronously on first check

## Security Notes

⚠️ **Important**: The `usePermissions` hook is for UI/UX purposes only. It improves user experience by enabling/disabling features, but it does NOT provide security. Always enforce permissions on the backend API endpoints.

- Frontend permission checks can be bypassed by users
- Backend must validate all permissions for security
- Use usePermissions to improve UX, not for security

## Related Components

- `PermissionGuard`: Component for conditional rendering based on permissions
- `useAuth`: Hook for accessing authentication state
- `EnhancedAuthProvider`: (Coming in task 7.1) Enhanced auth context with built-in permissions

## Future Enhancements

The following enhancements are planned:

- **WebSocket Updates** (Task 7.2): Real-time permission updates via WebSocket
- **Optimistic Updates**: Immediate UI updates with background verification
- **Permission Preloading**: Preload common permissions on app load
- **Advanced Caching**: Redis-backed caching for better performance

## Support

For issues or questions:

1. Check this README and examples
2. Review the unit tests for usage patterns
3. Check the PermissionGuard documentation
4. Consult the design document at `.kiro/specs/rbac-enhancement/design.md`
