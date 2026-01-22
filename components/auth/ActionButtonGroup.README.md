# ActionButtonGroup Component

## Overview

The `ActionButtonGroup` component provides a convenient way to render multiple permission-based action buttons together with consistent styling and layout. It automatically handles permission checking for each button and provides flexible configuration options.

## Features

- ✅ Automatic permission-based button filtering and state control
- ✅ Shared context for all buttons with individual override capability
- ✅ Flexible layout options (horizontal/vertical)
- ✅ Configurable spacing
- ✅ Loading state support
- ✅ Consistent styling with variant support
- ✅ Multiple permissions support (OR logic)
- ✅ Icon support for buttons

## Requirements

**Validates: Requirements 3.4** - Disable or hide buttons for unauthorized operations

## Installation

The component is part of the `@/components/auth` module:

```typescript
import { ActionButtonGroup, ActionButton } from '@/components/auth'
```

## Basic Usage

```typescript
import { ActionButtonGroup, ActionButton } from '@/components/auth'

function MyComponent({ projectId }: { projectId: string }) {
  const actions: ActionButton[] = [
    {
      id: 'view',
      label: 'View',
      permission: 'project_read',
      onClick: () => console.log('Viewing...'),
      variant: 'secondary'
    },
    {
      id: 'edit',
      label: 'Edit',
      permission: 'project_update',
      onClick: () => console.log('Editing...'),
      variant: 'primary'
    },
    {
      id: 'delete',
      label: 'Delete',
      permission: 'project_delete',
      onClick: () => console.log('Deleting...'),
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
```

## Props

### ActionButtonGroupProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `actions` | `ActionButton[]` | Yes | Array of action buttons to render with permission checks |
| `context` | `PermissionContext` | No | Optional shared context for all buttons |
| `className` | `string` | No | Optional className for the button group container |
| `direction` | `'horizontal' \| 'vertical'` | No | Layout direction (default: 'horizontal') |
| `spacing` | `'tight' \| 'normal' \| 'loose'` | No | Spacing between buttons (default: 'normal') |
| `loading` | `boolean` | No | Optional loading state for all buttons |

### ActionButton

Extends `PermissionButtonProps` except `children`.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the action button |
| `label` | `string` | Yes | Display label for the button |
| `permission` | `Permission \| Permission[]` | Yes | Required permission(s) to enable this button |
| `onClick` | `() => void` | No | Click handler |
| `icon` | `ReactNode` | No | Optional icon component |
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'success' \| 'outline'` | No | Button style variant |
| `context` | `PermissionContext` | No | Optional button-specific context (overrides group context) |
| `unauthorizedBehavior` | `'disable' \| 'hide'` | No | Behavior when user lacks permission |
| `unauthorizedTooltip` | `string` | No | Tooltip text when disabled |
| `forceDisabled` | `boolean` | No | Force disabled state |
| `className` | `string` | No | Additional CSS classes |

## Advanced Usage

### Vertical Layout

```typescript
<ActionButtonGroup
  actions={actions}
  context={{ project_id: projectId }}
  direction="vertical"
  spacing="loose"
/>
```

### With Icons

```typescript
import { Edit, Trash2, Eye } from 'lucide-react'

const actions: ActionButton[] = [
  {
    id: 'view',
    label: 'View Details',
    icon: <Eye className="h-4 w-4" />,
    permission: 'project_read',
    onClick: handleView,
    variant: 'outline'
  },
  {
    id: 'edit',
    label: 'Edit Project',
    icon: <Edit className="h-4 w-4" />,
    permission: 'project_update',
    onClick: handleEdit,
    variant: 'primary'
  },
  {
    id: 'delete',
    label: 'Delete Project',
    icon: <Trash2 className="h-4 w-4" />,
    permission: 'project_delete',
    onClick: handleDelete,
    variant: 'danger'
  }
]

<ActionButtonGroup actions={actions} />
```

### Mixed Contexts

```typescript
const actions: ActionButton[] = [
  {
    id: 'edit-project',
    label: 'Edit Project',
    permission: 'project_update',
    context: { project_id: projectId }, // Project-specific
    onClick: handleEditProject
  },
  {
    id: 'edit-portfolio',
    label: 'Edit Portfolio',
    permission: 'portfolio_update',
    context: { portfolio_id: portfolioId }, // Portfolio-specific
    onClick: handleEditPortfolio
  },
  {
    id: 'manage-resources',
    label: 'Manage Resources',
    permission: 'resource_allocate',
    // Uses shared context from ActionButtonGroup
    onClick: handleManageResources
  }
]

<ActionButtonGroup
  actions={actions}
  context={{ project_id: projectId }} // Shared context
/>
```

### Loading State

```typescript
const [isSaving, setIsSaving] = useState(false)

<ActionButtonGroup
  actions={actions}
  loading={isSaving}
  context={{ project_id: projectId }}
/>
```

### Card Footer Actions

```typescript
<div className="border rounded-lg overflow-hidden">
  <div className="p-4">
    <h3 className="text-lg font-semibold">Project Name</h3>
    <p className="text-gray-600">Project details...</p>
  </div>
  
  <div className="bg-gray-50 px-4 py-3 border-t">
    <ActionButtonGroup
      actions={actions}
      context={{ project_id: projectId }}
    />
  </div>
</div>
```

### Modal Actions

```typescript
const actions: ActionButton[] = [
  {
    id: 'cancel',
    label: 'Cancel',
    permission: 'project_read',
    onClick: onClose,
    variant: 'outline'
  },
  {
    id: 'save',
    label: 'Save Changes',
    permission: 'project_update',
    onClick: handleSave,
    variant: 'primary'
  }
]

<ActionButtonGroup
  actions={actions}
  context={{ project_id: projectId }}
  className="justify-end"
/>
```

## Button Variants

The component provides five built-in variants:

- **primary**: Blue background, white text (main actions)
- **secondary**: Gray background, white text (secondary actions)
- **danger**: Red background, white text (destructive actions)
- **success**: Green background, white text (positive actions)
- **outline**: Transparent background, bordered (subtle actions)

Each variant includes:
- Hover states
- Focus states (for accessibility)
- Disabled states

## Layout Options

### Direction

- **horizontal** (default): Buttons arranged in a row
- **vertical**: Buttons arranged in a column

### Spacing

- **tight**: Minimal spacing between buttons (gap-1)
- **normal** (default): Standard spacing (gap-2)
- **loose**: Generous spacing (gap-4)

## Permission Checking Behavior

1. Each button is independently checked for permissions
2. Buttons without permission are disabled or hidden based on `unauthorizedBehavior`
3. Shared context is applied to all buttons unless overridden
4. Loading state disables all buttons
5. Multiple permissions use OR logic (any permission grants access)

## Styling

The component provides default styling for all variants, but you can:

1. Override button styles with the `className` prop on individual actions
2. Add container styles with the `className` prop on ActionButtonGroup
3. Customize spacing and direction

Example with custom container styling:

```typescript
<ActionButtonGroup
  actions={actions}
  className="justify-end border-t pt-4 mt-4"
  spacing="tight"
/>
```

## Accessibility

- All buttons have proper focus states
- Disabled buttons have `aria-disabled` attribute
- Use descriptive labels for screen readers
- Ensure sufficient color contrast for all variants

## Performance Considerations

- Each button performs its own permission check
- Permission checks are cached by the underlying system
- Buttons with the same permission share cached results
- Loading state prevents unnecessary re-renders

## Common Use Cases

### Toolbar Actions

```typescript
<div className="border-b pb-4 mb-4">
  <ActionButtonGroup
    actions={toolbarActions}
    spacing="tight"
  />
</div>
```

### Card Actions

```typescript
<div className="bg-gray-50 px-4 py-3 border-t">
  <ActionButtonGroup
    actions={cardActions}
    context={{ project_id: projectId }}
  />
</div>
```

### Modal Footer

```typescript
<div className="flex justify-end gap-2 mt-6">
  <ActionButtonGroup
    actions={modalActions}
    className="justify-end"
  />
</div>
```

### Admin Panel

```typescript
<ActionButtonGroup
  actions={adminActions}
  direction="vertical"
  spacing="normal"
/>
```

## Examples

See `ActionButtonGroup.example.tsx` for comprehensive usage examples including:
- Basic action button group
- Vertical button group
- Toolbar with icons
- Card footer actions
- Modal actions
- Mixed contexts for different buttons
- Financial actions with multiple permissions
- Admin panel actions
- Resource management actions
- PMR actions with collaboration

## Related Components

- `PermissionButton` - Individual permission-based button
- `PermissionGuard` - Conditional rendering based on permissions
- `RoleBasedNav` - Permission-based navigation menu filtering
- `usePermissions` - Hook for permission checking in component logic

## Backend Integration

The component integrates with the backend RBAC system through the `/api/rbac/check-permission` endpoint. Ensure your backend is properly configured to handle permission checks.

## Troubleshooting

### All buttons disabled

1. Check that the user has the required permissions
2. Verify permission strings match the backend Permission enum
3. Check if `loading` prop is set to true
4. Check browser console for permission check errors

### Context not working

1. Verify the context object structure matches the backend PermissionContext model
2. Check that individual button contexts override the group context correctly
3. Ensure context IDs are valid

### Buttons not hiding

1. Verify `unauthorizedBehavior` is set to 'hide' on individual buttons
2. Check that permission checks are completing
3. Check browser console for errors

### Styling issues

1. Ensure Tailwind CSS is properly configured
2. Check that custom className props don't conflict with default styles
3. Verify variant prop is one of the supported values
