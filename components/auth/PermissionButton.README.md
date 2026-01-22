# PermissionButton Component

## Overview

The `PermissionButton` component provides automatic permission-based control of button state and visibility. It ensures that users can only interact with buttons for actions they have permission to perform, creating a secure and intuitive user experience.

## Features

- ✅ Automatic permission-based button state control
- ✅ Context-aware permission evaluation (project, portfolio, organization scopes)
- ✅ Configurable behavior (disable vs hide) for unauthorized access
- ✅ Loading state support
- ✅ Tooltip support for disabled state
- ✅ All standard button props supported
- ✅ Multiple permissions support (OR logic)
- ✅ Force disabled state for form validation

## Requirements

**Validates: Requirements 3.4** - Disable or hide buttons for unauthorized operations

## Installation

The component is part of the `@/components/auth` module:

```typescript
import { PermissionButton } from '@/components/auth'
```

## Basic Usage

```typescript
import { PermissionButton } from '@/components/auth'

function MyComponent() {
  const handleEdit = () => {
    console.log('Editing project...')
  }

  return (
    <PermissionButton 
      permission="project_update"
      onClick={handleEdit}
      className="px-4 py-2 bg-blue-600 text-white rounded"
    >
      Edit Project
    </PermissionButton>
  )
}
```

## Props

### PermissionButtonProps

Extends all standard HTML button attributes except `disabled`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `permission` | `Permission \| Permission[]` | Yes | Required permission(s) to enable this button |
| `context` | `PermissionContext` | No | Optional context for scoped permission checking |
| `children` | `ReactNode` | Yes | Button content |
| `unauthorizedBehavior` | `'disable' \| 'hide'` | No | Behavior when user lacks permission (default: 'disable') |
| `unauthorizedTooltip` | `string` | No | Tooltip text when button is disabled due to lack of permission |
| `loadingContent` | `ReactNode` | No | Optional loading state content while permissions are being checked |
| `forceDisabled` | `boolean` | No | Force disabled state regardless of permissions |
| `className` | `string` | No | CSS classes for styling |
| `onClick` | `() => void` | No | Click handler (only called when button is enabled) |

## Advanced Usage

### Hide Button When No Permission

```typescript
<PermissionButton 
  permission="project_delete"
  unauthorizedBehavior="hide"
  onClick={handleDelete}
  className="px-4 py-2 bg-red-600 text-white rounded"
>
  Delete Project
</PermissionButton>
```

### Context-Aware Permission Check

```typescript
<PermissionButton 
  permission="project_update"
  context={{ project_id: projectId }}
  unauthorizedTooltip="You don't have permission to edit this project"
  onClick={handleEdit}
  className="px-4 py-2 bg-blue-600 text-white rounded"
>
  Edit This Project
</PermissionButton>
```

### Multiple Permissions (OR Logic)

```typescript
<PermissionButton 
  // User needs EITHER financial_read OR financial_update
  permission={["financial_read", "financial_update"]}
  onClick={handleManageBudget}
  className="px-4 py-2 bg-green-600 text-white rounded"
>
  Manage Budget
</PermissionButton>
```

### Button with Icon

```typescript
import { Save } from 'lucide-react'

<PermissionButton 
  permission="project_update"
  onClick={handleSave}
  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded"
>
  <Save className="h-4 w-4" />
  Save Changes
</PermissionButton>
```

### Force Disabled for Form Validation

```typescript
const [isFormValid, setIsFormValid] = useState(false)

<PermissionButton 
  permission="project_create"
  forceDisabled={!isFormValid}
  onClick={handleSubmit}
  className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
>
  Create Project
</PermissionButton>
```

### Loading State

```typescript
const [isLoading, setIsLoading] = useState(false)

<PermissionButton 
  permission="pmr_export"
  onClick={handleExport}
  forceDisabled={isLoading}
  loadingContent={
    <button disabled className="px-4 py-2 bg-gray-300 rounded">
      Checking permissions...
    </button>
  }
>
  {isLoading ? 'Exporting...' : 'Export Report'}
</PermissionButton>
```

### Button Group

```typescript
<div className="flex gap-2">
  <PermissionButton 
    permission="project_read"
    context={{ project_id: projectId }}
    onClick={handleView}
    className="px-4 py-2 bg-gray-600 text-white rounded"
  >
    View
  </PermissionButton>
  
  <PermissionButton 
    permission="project_update"
    context={{ project_id: projectId }}
    onClick={handleEdit}
    className="px-4 py-2 bg-blue-600 text-white rounded"
  >
    Edit
  </PermissionButton>
  
  <PermissionButton 
    permission="project_delete"
    context={{ project_id: projectId }}
    unauthorizedBehavior="hide"
    onClick={handleDelete}
    className="px-4 py-2 bg-red-600 text-white rounded"
  >
    Delete
  </PermissionButton>
</div>
```

## Permission Checking Behavior

1. **Loading State**: While permissions are being checked, the button is disabled and `loadingContent` is displayed (if provided)
2. **No Permission + Disable**: Button is rendered but disabled, click handler is not called
3. **No Permission + Hide**: Button is not rendered at all
4. **Multiple Permissions**: When an array of permissions is provided, ANY permission enables the button (OR logic)
5. **Context-Aware**: When a context is provided, permissions are checked within that specific scope
6. **Force Disabled**: When `forceDisabled` is true, button is disabled regardless of permissions

## Styling

The component accepts all standard button props including `className`. You should provide appropriate styles for:

- Normal state
- Hover state
- Disabled state
- Focus state (for accessibility)

Example with Tailwind CSS:

```typescript
<PermissionButton 
  permission="project_update"
  onClick={handleEdit}
  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
>
  Edit Project
</PermissionButton>
```

## Accessibility

- The component sets `aria-disabled` attribute when button is disabled
- Tooltip text (via `title` attribute) is shown when button is disabled due to lack of permission
- Ensure sufficient color contrast for disabled state
- Use descriptive button text or ARIA labels

## Performance Considerations

- Permission checks are performed on component mount and when dependencies change
- Results are cached by the underlying permission checking system
- Multiple buttons with the same permission will share cached results

## Integration with Forms

```typescript
function ProjectForm() {
  const [formData, setFormData] = useState({ name: '', description: '' })
  const isFormValid = formData.name.length > 0 && formData.description.length > 0

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      
      <textarea
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      />
      
      <PermissionButton 
        permission="project_create"
        forceDisabled={!isFormValid}
        onClick={handleSubmit}
        type="submit"
      >
        Create Project
      </PermissionButton>
    </form>
  )
}
```

## Examples

See `PermissionButton.example.tsx` for comprehensive usage examples including:
- Basic permission button
- Hide button when no permission
- Context-aware permission check
- Multiple permissions (OR logic)
- Button with icon
- Force disabled for form validation
- Button group with different permissions
- Loading state
- Toolbar with multiple action buttons
- Card with action buttons

## Related Components

- `ActionButtonGroup` - Group of permission-based action buttons
- `PermissionGuard` - Conditional rendering based on permissions
- `RoleBasedNav` - Permission-based navigation menu filtering
- `usePermissions` - Hook for permission checking in component logic

## Backend Integration

The component integrates with the backend RBAC system through the `/api/rbac/check-permission` endpoint. Ensure your backend is properly configured to handle permission checks.

## Troubleshooting

### Button always disabled

1. Check that the user has the required permission
2. Verify the permission string matches the backend Permission enum
3. Check browser console for permission check errors
4. Ensure the backend RBAC endpoint is accessible
5. Check if `forceDisabled` is set to true

### Context-aware checks not working

1. Verify the context object structure matches the backend PermissionContext model
2. Check that the backend supports context-aware permission checking
3. Ensure the context IDs (project_id, portfolio_id, etc.) are valid

### Button not hiding with unauthorizedBehavior="hide"

1. Verify that `unauthorizedBehavior` is set to 'hide'
2. Check that the permission check is completing (not stuck in loading state)
3. Check browser console for errors

### Click handler called when button is disabled

This should not happen. If it does:
1. Check that you're not manually calling the handler
2. Verify the component is receiving the correct props
3. File a bug report with reproduction steps
