# PermissionGuard Component

## Overview

The `PermissionGuard` component is a React component that provides role-based access control (RBAC) for UI elements. It conditionally renders its children based on user permissions, integrating seamlessly with the backend RBAC system.

**Requirements:** 3.1 - UI Component Permission Enforcement

## Features

- ✅ **Single Permission Checking**: Check if user has a specific permission
- ✅ **Multiple Permission Checking**: Check if user has ANY of multiple permissions (OR logic)
- ✅ **Context-Aware Permissions**: Scope permissions to specific projects, portfolios, or organizations
- ✅ **Fallback Rendering**: Show alternative content when user lacks permission
- ✅ **Loading States**: Display loading indicators while permissions are being checked
- ✅ **Automatic Re-checking**: Automatically re-checks permissions when props change
- ✅ **Error Handling**: Gracefully handles API errors and network failures

## Installation

The component is already integrated into the project. Import it from the auth components:

```typescript
import { PermissionGuard } from '@/components/auth'
```

## Basic Usage

### Single Permission Check

```tsx
<PermissionGuard permission="project_read">
  <ProjectDashboard />
</PermissionGuard>
```

### Multiple Permissions (OR Logic)

When an array of permissions is provided, the user needs ANY of them to access the content:

```tsx
<PermissionGuard permission={["project_read", "portfolio_read"]}>
  <DashboardContent />
</PermissionGuard>
```

### With Fallback Content

```tsx
<PermissionGuard 
  permission="financial_read"
  fallback={<div>You don't have permission to view financial data</div>}
>
  <FinancialReport />
</PermissionGuard>
```

### Context-Aware Permissions

Check permissions within a specific scope (project, portfolio, etc.):

```tsx
<PermissionGuard 
  permission="project_update"
  context={{ project_id: projectId }}
>
  <EditProjectButton />
</PermissionGuard>
```

### With Loading State

```tsx
<PermissionGuard 
  permission="admin_read"
  loadingFallback={<LoadingSpinner />}
  fallback={<AccessDenied />}
>
  <AdminPanel />
</PermissionGuard>
```

## API Reference

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `permission` | `Permission \| Permission[]` | Yes | Single permission or array of permissions to check |
| `context` | `PermissionContext` | No | Context for scoped permission checking |
| `fallback` | `ReactNode` | No | Content to render when user lacks permission |
| `loadingFallback` | `ReactNode` | No | Content to render while checking permissions |
| `children` | `ReactNode` | Yes | Content to render when user has permission |

### Permission Type

The `Permission` type includes all available permissions from the backend:

```typescript
type Permission = 
  // Portfolio permissions
  | 'portfolio_create' | 'portfolio_read' | 'portfolio_update' | 'portfolio_delete'
  // Project permissions
  | 'project_create' | 'project_read' | 'project_update' | 'project_delete'
  // Resource permissions
  | 'resource_create' | 'resource_read' | 'resource_update' | 'resource_delete' | 'resource_allocate'
  // Financial permissions
  | 'financial_read' | 'financial_create' | 'financial_update' | 'financial_delete' | 'budget_alert_manage'
  // Admin permissions
  | 'user_manage' | 'role_manage' | 'admin_read' | 'admin_update' | 'admin_delete' | 'system_admin'
  // ... and more (see types/rbac.ts for complete list)
```

### PermissionContext Type

```typescript
interface PermissionContext {
  project_id?: string
  portfolio_id?: string
  resource_id?: string
  organization_id?: string
}
```

## Common Patterns

### Action Buttons

```tsx
<div className="flex gap-2">
  <PermissionGuard permission="project_read" context={{ project_id }}>
    <Button>View</Button>
  </PermissionGuard>
  
  <PermissionGuard permission="project_update" context={{ project_id }}>
    <Button>Edit</Button>
  </PermissionGuard>
  
  <PermissionGuard permission="project_delete" context={{ project_id }}>
    <Button variant="danger">Delete</Button>
  </PermissionGuard>
</div>
```

### Navigation Menu

```tsx
<nav>
  <PermissionGuard permission="portfolio_read">
    <NavItem href="/portfolios">Portfolios</NavItem>
  </PermissionGuard>
  
  <PermissionGuard permission="project_read">
    <NavItem href="/projects">Projects</NavItem>
  </PermissionGuard>
  
  <PermissionGuard permission={["admin_read", "system_admin"]}>
    <NavItem href="/admin">Admin</NavItem>
  </PermissionGuard>
</nav>
```

### Nested Permission Checks

```tsx
<PermissionGuard permission="portfolio_read" context={{ portfolio_id }}>
  <Card>
    <h3>Portfolio Details</h3>
    
    <PermissionGuard permission="portfolio_update" context={{ portfolio_id }}>
      <Button>Edit Portfolio</Button>
    </PermissionGuard>
    
    <PermissionGuard permission="project_create" context={{ portfolio_id }}>
      <Button>Add Project</Button>
    </PermissionGuard>
  </Card>
</PermissionGuard>
```

### Conditional Features

```tsx
<div>
  {/* Basic features - available to all project readers */}
  <PermissionGuard permission="project_read">
    <ProjectOverview />
  </PermissionGuard>
  
  {/* Advanced features - only for specific permissions */}
  <PermissionGuard permission="ai_resource_optimize">
    <AIOptimizationPanel />
  </PermissionGuard>
  
  <PermissionGuard permission="simulation_run">
    <MonteCarloSimulation />
  </PermissionGuard>
</div>
```

## How It Works

1. **Authentication Check**: First checks if user is authenticated via `useAuth()` hook
2. **Permission API Call**: Makes API request to `/api/rbac/check-permission` endpoint
3. **Context Handling**: Includes context (project_id, portfolio_id, etc.) in the request if provided
4. **OR Logic**: When multiple permissions are provided, grants access if user has ANY of them
5. **Rendering Decision**: Renders children if permission granted, otherwise renders fallback

## Backend Integration

The component integrates with the backend RBAC system:

- **Endpoint**: `GET /api/rbac/check-permission`
- **Query Parameters**: 
  - `permission`: The permission to check
  - `context`: Optional JSON-encoded context object
- **Headers**: 
  - `Authorization: Bearer <token>`: User's JWT token
- **Response**: 
  ```json
  {
    "has_permission": true,
    "permission": "project_read",
    "context": { "project_id": "..." }
  }
  ```

## Performance Considerations

- **Caching**: The backend caches permission results to minimize database queries
- **Parallel Checks**: When checking multiple permissions, all checks run in parallel
- **Re-checking**: Permissions are re-checked when props change (permission, context, or user)
- **Loading States**: Use `loadingFallback` to provide feedback during permission checks

## Error Handling

The component handles errors gracefully:

- **Network Errors**: Denies access and logs error to console
- **API Errors**: Denies access if API returns non-OK status
- **Malformed Responses**: Denies access if response doesn't match expected format
- **Authentication Errors**: Denies access if user is not authenticated

## Testing

The component includes comprehensive unit tests covering:

- Authentication state handling
- Single and multiple permission checking
- Context-aware permission checking
- Error handling
- Edge cases
- API URL configuration

Run tests with:

```bash
npm test -- components/auth/__tests__/PermissionGuard.test.tsx
```

## Examples

See `PermissionGuard.example.tsx` for comprehensive usage examples including:

1. Basic permission checks
2. Multiple permissions (OR logic)
3. Permission checks with fallback
4. Context-aware permission checks
5. Loading states
6. Nested permission guards
7. Action buttons with permissions
8. Navigation menus with permissions
9. Conditional features
10. Complex permission logic

## Best Practices

1. **Use Specific Permissions**: Use the most specific permission for each action
2. **Provide Fallbacks**: Always provide fallback content for better UX
3. **Context Awareness**: Use context when checking permissions for specific resources
4. **Loading States**: Show loading indicators for better perceived performance
5. **Error Messages**: Provide clear error messages in fallback content
6. **Combine with Backend**: Always enforce permissions on the backend as well
7. **Test Thoroughly**: Test all permission scenarios in your components

## Security Notes

⚠️ **Important**: The `PermissionGuard` component is for UI/UX purposes only. It improves user experience by hiding unauthorized features, but it does NOT provide security. Always enforce permissions on the backend API endpoints.

- Frontend permission checks can be bypassed by users
- Backend must validate all permissions for security
- Use PermissionGuard to improve UX, not for security

## Related Components

- `AuthenticationGuard`: Ensures user is authenticated before rendering content
- `usePermissions` hook: (Coming in task 6.2) Hook for checking permissions in component logic

## Troubleshooting

### Permissions not working

1. Check that user is authenticated
2. Verify permission name matches backend Permission enum
3. Check browser console for API errors
4. Verify `NEXT_PUBLIC_API_URL` environment variable is set correctly

### Always denied access

1. Check that backend RBAC endpoints are running
2. Verify user has the required role assigned
3. Check that role has the required permission
4. Verify JWT token is valid and not expired

### Context not working

1. Ensure context IDs are valid UUIDs
2. Check that user has permission in the specified scope
3. Verify backend context-aware permission checking is implemented

## Future Enhancements

The following enhancements are planned in upcoming tasks:

- **usePermissions Hook** (Task 6.2): React hook for permission checking in component logic
- **RoleBasedNav Component** (Task 6.3): Navigation component with built-in permission filtering
- **Dynamic UI Updates** (Task 6.3): Real-time permission updates when roles change
- **Permission Caching** (Task 13.1): Frontend caching for improved performance

## Support

For issues or questions:

1. Check this README and examples
2. Review the unit tests for usage patterns
3. Check the backend RBAC documentation
4. Consult the design document at `.kiro/specs/rbac-enhancement/design.md`
