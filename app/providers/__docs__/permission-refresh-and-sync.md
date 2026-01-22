# Permission Refresh and Synchronization

This document describes the permission refresh and synchronization capabilities added to the EnhancedAuthProvider in task 7.2.

## Overview

The EnhancedAuthProvider now includes comprehensive permission refresh and synchronization features that ensure user permissions are always up-to-date across the application. These features address Requirement 2.2: "WHEN user roles change, THE Auth_Integration SHALL update the user's session to reflect new permissions."

## Features

### 1. Manual Permission Refresh

The `refreshPermissions()` method allows components to manually trigger a permission refresh. This is useful when:
- A role assignment has been made and you want to immediately reflect the changes
- You need to re-validate permissions after a specific action
- You want to ensure permissions are current before performing a sensitive operation

**Usage:**

```typescript
import { useEnhancedAuth } from '@/app/providers/EnhancedAuthProvider'

function MyComponent() {
  const { refreshPermissions, loading } = useEnhancedAuth()

  const handleRoleUpdate = async () => {
    // Update role via API
    await updateUserRole(userId, newRole)
    
    // Manually refresh permissions
    await refreshPermissions()
  }

  return (
    <button onClick={handleRoleUpdate} disabled={loading}>
      Update Role
    </button>
  )
}
```

**Implementation Details:**
- Checks if a user is logged in before attempting refresh
- Fetches fresh role and permission data from the database
- Updates the auth context with new permissions
- Clears the permission cache to ensure fresh checks
- Provides detailed logging for debugging

### 2. Automatic Permission Synchronization

The EnhancedAuthProvider automatically subscribes to real-time changes in the `user_roles` table using Supabase's real-time features. When a role assignment changes, permissions are automatically refreshed without requiring manual intervention.

**How it works:**

1. When a user logs in, the provider subscribes to changes in the `user_roles` table for that user
2. When any change occurs (INSERT, UPDATE, DELETE), the subscription callback is triggered
3. The provider automatically calls `refreshPermissions()` to fetch updated permissions
4. All components using the auth context automatically re-render with new permissions
5. The permission cache is cleared to ensure fresh permission checks

**Subscription Status Handling:**

The provider handles various subscription statuses:
- `SUBSCRIBED`: Successfully connected to real-time updates
- `CHANNEL_ERROR`: Connection error, sets error state for UI notification
- `TIMED_OUT`: Subscription timeout, sets error state for retry

**Error Handling:**

If permission refresh fails during a role change:
- The error is caught and logged
- The error state is updated so UI can show notifications
- The user can manually retry by calling `refreshPermissions()`

**Usage:**

No explicit code is needed - synchronization happens automatically. However, you can monitor for errors:

```typescript
import { useEnhancedAuth } from '@/app/providers/EnhancedAuthProvider'

function PermissionStatusIndicator() {
  const { error, userPermissions } = useEnhancedAuth()

  if (error) {
    return (
      <div className="error">
        Permission sync error: {error.message}
      </div>
    )
  }

  return <div>Permissions: {userPermissions.length}</div>
}
```

### 3. Permission Context Sharing

The `preloadPermissionsForContext()` method allows components to preload and cache permissions for a specific context (e.g., a project or portfolio). This optimizes performance by:
- Caching permission checks for the same context
- Reducing redundant permission evaluations
- Enabling efficient permission checks across multiple components

**Usage:**

```typescript
import { useEnhancedAuth } from '@/app/providers/EnhancedAuthProvider'
import type { PermissionContext } from '@/types/rbac'

function ProjectDashboard({ projectId }: { projectId: string }) {
  const { preloadPermissionsForContext, hasPermission } = useEnhancedAuth()

  // Preload permissions for this project
  useEffect(() => {
    const context: PermissionContext = { project_id: projectId }
    preloadPermissionsForContext(context)
  }, [projectId, preloadPermissionsForContext])

  // Child components can now efficiently check permissions
  const context: PermissionContext = { project_id: projectId }
  const canEdit = hasPermission('project_update', context)

  return (
    <div>
      {canEdit && <button>Edit Project</button>}
    </div>
  )
}
```

**Benefits:**
- Multiple components can check permissions for the same context without redundant evaluations
- Permission checks are cached for 5 minutes (configurable via CACHE_TTL)
- Cache is automatically cleared when permissions are refreshed

## Architecture

### Real-time Subscription Flow

```
User Login
    ↓
Subscribe to user_roles changes
    ↓
Role Change in Database
    ↓
Real-time Event Triggered
    ↓
refreshPermissions() Called
    ↓
Fetch Fresh Permissions
    ↓
Update Auth Context
    ↓
Clear Permission Cache
    ↓
Components Re-render
```

### Permission Cache

The permission cache is an in-memory cache that stores permission check results to minimize redundant checks:

- **Cache Key**: Combination of permission and context (project_id, portfolio_id, etc.)
- **TTL**: 5 minutes (300,000 milliseconds)
- **Invalidation**: Automatic on permission refresh or role change
- **Storage**: In-memory Map for fast access

### Error Handling Strategy

1. **Database Errors**: Caught and logged, error state updated for UI notification
2. **Subscription Errors**: Logged with status information, error state updated
3. **Refresh Errors**: Caught during automatic refresh, error state updated
4. **Network Errors**: Handled by Supabase client, propagated to error state

## Testing

The implementation includes comprehensive tests covering:

1. **Manual Refresh**: Tests that `refreshPermissions()` correctly fetches and updates permissions
2. **Automatic Sync**: Tests that real-time subscription triggers automatic refresh
3. **Context Sharing**: Tests that `preloadPermissionsForContext()` caches permissions correctly
4. **Error Handling**: Tests for subscription errors and refresh failures
5. **Multi-component Sharing**: Tests that cached permissions are shared across components

Run tests with:

```bash
npm test -- app/providers/__tests__/EnhancedAuthProvider.test.tsx
```

## Performance Considerations

### Caching Strategy

- Permission checks are cached for 5 minutes to reduce database queries
- Cache is cleared on permission refresh to ensure consistency
- Context-aware caching allows efficient multi-context permission checks

### Real-time Subscription

- Single subscription per user (not per component)
- Subscription is cleaned up when user logs out
- Efficient filtering at database level using `filter: user_id=eq.{userId}`

### Optimization Tips

1. **Preload Contexts**: Use `preloadPermissionsForContext()` for contexts that will be checked multiple times
2. **Batch Checks**: Check multiple permissions at once using array syntax: `hasPermission(['perm1', 'perm2'])`
3. **Avoid Redundant Refreshes**: Only call `refreshPermissions()` when necessary, as it clears the cache

## Debugging

### Enable Detailed Logging

The implementation includes console logging for debugging:

- Permission refresh attempts
- Real-time subscription status
- Permission preloading
- Error conditions

Check the browser console for messages like:
- "Manually refreshing permissions for user: {userId}"
- "Successfully subscribed to role changes for user: {userId}"
- "Permissions refreshed successfully after role change"
- "Preloaded {count} permissions for context"

### Common Issues

**Issue**: Permissions not updating after role change
- **Check**: Browser console for subscription errors
- **Solution**: Verify Supabase real-time is enabled for the `user_roles` table

**Issue**: Permission checks returning stale results
- **Check**: Cache TTL and last refresh time
- **Solution**: Call `refreshPermissions()` manually or wait for cache expiration

**Issue**: Subscription errors on page load
- **Check**: Network connectivity and Supabase configuration
- **Solution**: Verify Supabase URL and anon key are correct

## Requirements Validation

This implementation satisfies Requirement 2.2:

✅ **Manual Refresh**: `refreshPermissions()` method allows manual updates
✅ **Automatic Sync**: Real-time subscription automatically refreshes on role changes
✅ **Context Sharing**: `preloadPermissionsForContext()` enables efficient context sharing
✅ **Error Handling**: Comprehensive error handling for all failure scenarios
✅ **Testing**: Full test coverage including unit and integration tests

## Future Enhancements

Potential improvements for future iterations:

1. **Exponential Backoff**: Retry failed refreshes with exponential backoff
2. **Offline Support**: Queue permission checks when offline, sync when online
3. **Permission Diff**: Show users exactly which permissions changed
4. **Context-Specific Refresh**: Refresh only permissions for a specific context
5. **Metrics**: Track permission check performance and cache hit rates
