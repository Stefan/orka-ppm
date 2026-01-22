# RoleBasedNav Component

## Overview

The `RoleBasedNav` component provides automatic permission-based filtering of navigation menu items. It ensures that users only see navigation items they have permission to access, creating a clean and secure user experience.

## Features

- ✅ Automatic permission-based filtering of navigation items
- ✅ Support for nested navigation items (sub-menus)
- ✅ Context-aware permission checking (project, portfolio, organization scopes)
- ✅ Flexible rendering through render props pattern
- ✅ Loading state support
- ✅ Multiple permissions support (OR logic)
- ✅ Icon support for navigation items

## Requirements

**Validates: Requirements 3.3** - Hide menu items for unauthorized features

## Installation

The component is part of the `@/components/auth` module:

```typescript
import { RoleBasedNav, NavItem } from '@/components/auth'
```

## Basic Usage

```typescript
import { RoleBasedNav, NavItem } from '@/components/auth'
import Link from 'next/link'

const navItems: NavItem[] = [
  {
    id: 'projects',
    label: 'Projects',
    path: '/projects',
    requiredPermission: 'project_read'
  },
  {
    id: 'portfolios',
    label: 'Portfolios',
    path: '/portfolios',
    requiredPermission: 'portfolio_read'
  }
]

function MyNav() {
  return (
    <RoleBasedNav
      items={navItems}
      renderItem={(item) => (
        <Link href={item.path}>{item.label}</Link>
      )}
    />
  )
}
```

## Props

### RoleBasedNavProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `NavItem[]` | Yes | Array of navigation items to filter based on permissions |
| `renderItem` | `(item: NavItem) => ReactNode` | Yes | Render function for each navigation item |
| `className` | `string` | No | Optional className for the navigation container |
| `loadingFallback` | `ReactNode` | No | Optional loading fallback while permissions are being checked |

### NavItem

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the navigation item |
| `label` | `string` | Yes | Display label for the navigation item |
| `path` | `string` | Yes | URL path for the navigation item |
| `requiredPermission` | `Permission \| Permission[]` | Yes | Required permission(s) to view this item |
| `context` | `PermissionContext` | No | Optional context for scoped permission checking |
| `icon` | `ReactNode` | No | Optional icon component |
| `children` | `NavItem[]` | No | Optional nested navigation items (sub-menu) |

## Advanced Usage

### Navigation with Icons

```typescript
import { Home, Briefcase, Users } from 'lucide-react'

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    requiredPermission: 'portfolio_read',
    icon: <Home className="h-5 w-5" />
  },
  {
    id: 'projects',
    label: 'Projects',
    path: '/projects',
    requiredPermission: 'project_read',
    icon: <Briefcase className="h-5 w-5" />
  }
]

<RoleBasedNav
  items={navItems}
  renderItem={(item) => (
    <Link href={item.path} className="flex items-center gap-3">
      {item.icon}
      <span>{item.label}</span>
    </Link>
  )}
/>
```

### Nested Navigation (Sub-menus)

```typescript
const navItems: NavItem[] = [
  {
    id: 'admin',
    label: 'Administration',
    path: '/admin',
    requiredPermission: 'admin_read',
    children: [
      {
        id: 'users',
        label: 'User Management',
        path: '/admin/users',
        requiredPermission: 'user_manage'
      },
      {
        id: 'roles',
        label: 'Role Management',
        path: '/admin/roles',
        requiredPermission: 'role_manage'
      }
    ]
  }
]

<RoleBasedNav
  items={navItems}
  renderItem={(item) => (
    <div>
      <Link href={item.path}>{item.label}</Link>
      {/* Nested items will be rendered recursively */}
    </div>
  )}
/>
```

### Context-Aware Navigation

```typescript
function ProjectNav({ projectId }: { projectId: string }) {
  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      path: `/projects/${projectId}`,
      requiredPermission: 'project_read',
      context: { project_id: projectId }
    },
    {
      id: 'settings',
      label: 'Settings',
      path: `/projects/${projectId}/settings`,
      requiredPermission: 'project_update',
      context: { project_id: projectId }
    }
  ]

  return (
    <RoleBasedNav
      items={navItems}
      renderItem={(item) => <Link href={item.path}>{item.label}</Link>}
    />
  )
}
```

### Multiple Permissions (OR Logic)

```typescript
const navItems: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/overview',
    // User needs EITHER portfolio_read OR project_read
    requiredPermission: ['portfolio_read', 'project_read']
  }
]
```

### Horizontal Tab Navigation

```typescript
<RoleBasedNav
  items={navItems}
  renderItem={(item) => (
    <Link 
      href={item.path}
      className="px-4 py-2 border-b-2 border-transparent hover:border-blue-500"
    >
      {item.label}
    </Link>
  )}
  className="flex gap-4 border-b border-gray-200"
/>
```

## Integration with Existing Components

### Sidebar Integration

```typescript
import Sidebar from '@/components/navigation/Sidebar'
import { RoleBasedNav } from '@/components/auth'

// Replace hardcoded navigation items in Sidebar with RoleBasedNav
// to automatically filter based on user permissions
```

### Mobile Navigation

```typescript
import MobileNav from '@/components/navigation/MobileNav'
import { RoleBasedNav } from '@/components/auth'

// Wrap mobile navigation items with RoleBasedNav
// for consistent permission filtering across devices
```

## Permission Checking Behavior

1. **Loading State**: While permissions are being checked, the `loadingFallback` is displayed (if provided)
2. **No Permission**: Navigation items for which the user lacks permission are not rendered at all
3. **Multiple Permissions**: When an array of permissions is provided, ANY permission grants access (OR logic)
4. **Context-Aware**: When a context is provided, permissions are checked within that specific scope

## Performance Considerations

- Navigation items are checked individually, allowing for granular permission control
- Permission checks are cached by the underlying `PermissionGuard` component
- Nested navigation items are rendered recursively only when the parent item is authorized

## Accessibility

- Ensure navigation items have proper ARIA labels
- Use semantic HTML elements (nav, ul, li) in your render function
- Provide keyboard navigation support in your render function

## Examples

See `RoleBasedNav.example.tsx` for comprehensive usage examples including:
- Basic navigation menu
- Navigation with icons
- Nested navigation (sub-menus)
- Context-aware navigation
- Multiple permissions (OR logic)
- Sidebar navigation
- Horizontal tab navigation

## Related Components

- `PermissionGuard` - Underlying component for permission checking
- `PermissionButton` - Permission-based button control
- `ActionButtonGroup` - Group of permission-based action buttons
- `usePermissions` - Hook for permission checking in component logic

## Backend Integration

The component integrates with the backend RBAC system through the `/api/rbac/check-permission` endpoint. Ensure your backend is properly configured to handle permission checks.

## Troubleshooting

### Navigation items not appearing

1. Check that the user has the required permission
2. Verify the permission string matches the backend Permission enum
3. Check browser console for permission check errors
4. Ensure the backend RBAC endpoint is accessible

### Context-aware checks not working

1. Verify the context object structure matches the backend PermissionContext model
2. Check that the backend supports context-aware permission checking
3. Ensure the context IDs (project_id, portfolio_id, etc.) are valid

### Loading state persists

1. Check that the auth provider is properly initialized
2. Verify the backend permission endpoint is responding
3. Check for network errors in browser console
