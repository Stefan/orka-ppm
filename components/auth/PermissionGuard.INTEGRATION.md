# PermissionGuard Integration Guide

## Overview

This guide shows how to integrate the `PermissionGuard` component into existing pages and components in the ORKA-PPM application.

## Integration with Existing Components

### 1. Dashboard Integration

Update the main dashboard to show/hide sections based on permissions:

```tsx
// app/dashboards/page.tsx
import { PermissionGuard } from '@/components/auth'

export default function DashboardPage() {
  return (
    <AppLayout>
      {/* Admin-only sections */}
      <PermissionGuard permission="admin_read">
        <AdminDashboardSection />
      </PermissionGuard>
      
      {/* Manager sections */}
      <PermissionGuard permission={["portfolio_read", "project_read"]}>
        <ManagerDashboardSection />
      </PermissionGuard>
      
      {/* Enhanced existing components with role awareness */}
      <PermissionGuard permission="financial_read">
        <VarianceKPIs showDetailedMetrics={true} />
      </PermissionGuard>
      
      <PermissionGuard permission="budget_alert_manage">
        <VarianceAlerts showAdminActions={true} />
      </PermissionGuard>
    </AppLayout>
  )
}
```

### 2. Project Page Integration

Add permission-based action buttons to project pages:

```tsx
// app/projects/[id]/page.tsx
import { PermissionGuard } from '@/components/auth'

export default function ProjectPage({ params }: { params: { id: string } }) {
  const projectId = params.id
  
  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1>Project Details</h1>
        
        <div className="flex gap-2">
          <PermissionGuard 
            permission="project_update"
            context={{ project_id: projectId }}
          >
            <Button onClick={handleEdit}>Edit Project</Button>
          </PermissionGuard>
          
          <PermissionGuard 
            permission="project_delete"
            context={{ project_id: projectId }}
          >
            <Button variant="danger" onClick={handleDelete}>
              Delete Project
            </Button>
          </PermissionGuard>
          
          <PermissionGuard 
            permission="financial_update"
            context={{ project_id: projectId }}
          >
            <Button onClick={handleBudgetUpdate}>Update Budget</Button>
          </PermissionGuard>
        </div>
      </div>
      
      {/* Project content visible to all with project_read */}
      <PermissionGuard permission="project_read" context={{ project_id: projectId }}>
        <ProjectDetails projectId={projectId} />
      </PermissionGuard>
      
      {/* Financial data only for authorized users */}
      <PermissionGuard 
        permission="financial_read"
        context={{ project_id: projectId }}
        fallback={
          <Card>
            <p>Financial data is restricted. Contact your administrator for access.</p>
          </Card>
        }
      >
        <FinancialOverview projectId={projectId} />
      </PermissionGuard>
    </PageContainer>
  )
}
```

### 3. Navigation Integration

Update the sidebar navigation to show/hide menu items:

```tsx
// components/navigation/Sidebar.tsx
import { PermissionGuard } from '@/components/auth'

export function Sidebar() {
  return (
    <nav className="sidebar">
      <ul>
        <li>
          <a href="/dashboard">Dashboard</a>
        </li>
        
        <PermissionGuard permission="portfolio_read">
          <li>
            <a href="/portfolios">Portfolios</a>
          </li>
        </PermissionGuard>
        
        <PermissionGuard permission="project_read">
          <li>
            <a href="/projects">Projects</a>
          </li>
        </PermissionGuard>
        
        <PermissionGuard permission="resource_read">
          <li>
            <a href="/resources">Resources</a>
          </li>
        </PermissionGuard>
        
        <PermissionGuard permission="financial_read">
          <li>
            <a href="/financials">Financial Reports</a>
          </li>
        </PermissionGuard>
        
        <PermissionGuard permission="risk_read">
          <li>
            <a href="/risks">Risk Management</a>
          </li>
        </PermissionGuard>
        
        <PermissionGuard permission={["admin_read", "system_admin"]}>
          <li>
            <a href="/admin">Administration</a>
          </li>
        </PermissionGuard>
        
        <PermissionGuard permission="pmr_read">
          <li>
            <a href="/pmr">Monthly Reports</a>
          </li>
        </PermissionGuard>
      </ul>
    </nav>
  )
}
```

### 4. PMR Component Integration

Add permission checks to PMR (Project Monthly Report) components:

```tsx
// components/pmr/PMREditor.tsx
import { PermissionGuard } from '@/components/auth'

export function PMREditor({ projectId, pmrId }: PMREditorProps) {
  return (
    <div>
      {/* Read-only view for users with pmr_read */}
      <PermissionGuard 
        permission="pmr_read"
        context={{ project_id: projectId }}
      >
        <PMRViewer pmrId={pmrId} />
      </PermissionGuard>
      
      {/* Edit controls for users with pmr_update */}
      <PermissionGuard 
        permission="pmr_update"
        context={{ project_id: projectId }}
      >
        <PMREditControls pmrId={pmrId} />
      </PermissionGuard>
      
      {/* Approval controls for users with pmr_approve */}
      <PermissionGuard 
        permission="pmr_approve"
        context={{ project_id: projectId }}
      >
        <PMRApprovalControls pmrId={pmrId} />
      </PermissionGuard>
      
      {/* Export functionality */}
      <PermissionGuard 
        permission="pmr_export"
        context={{ project_id: projectId }}
      >
        <Button onClick={handleExport}>Export PMR</Button>
      </PermissionGuard>
      
      {/* AI insights for authorized users */}
      <PermissionGuard 
        permission="pmr_ai_insights"
        context={{ project_id: projectId }}
      >
        <AIInsightsPanel pmrId={pmrId} />
      </PermissionGuard>
    </div>
  )
}
```

### 5. Admin Panel Integration

Protect admin functionality:

```tsx
// app/admin/page.tsx
import { PermissionGuard } from '@/components/auth'

export default function AdminPage() {
  return (
    <PermissionGuard 
      permission={["admin_read", "system_admin"]}
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Card>
            <h2>Access Denied</h2>
            <p>You don't have permission to access the admin panel.</p>
            <Button onClick={() => router.push('/dashboard')}>
              Return to Dashboard
            </Button>
          </Card>
        </div>
      }
    >
      <PageContainer>
        <h1>Administration</h1>
        
        {/* User management */}
        <PermissionGuard permission="user_manage">
          <Card>
            <h2>User Management</h2>
            <UserManagementTable />
          </Card>
        </PermissionGuard>
        
        {/* Role management */}
        <PermissionGuard permission="role_manage">
          <Card>
            <h2>Role Management</h2>
            <RoleManagementTable />
          </Card>
        </PermissionGuard>
        
        {/* System settings - only for system admins */}
        <PermissionGuard permission="system_admin">
          <Card>
            <h2>System Settings</h2>
            <SystemSettingsForm />
          </Card>
        </PermissionGuard>
      </PageContainer>
    </PermissionGuard>
  )
}
```

### 6. Resource Management Integration

Add permission checks to resource allocation:

```tsx
// components/resources/ResourceAllocation.tsx
import { PermissionGuard } from '@/components/auth'

export function ResourceAllocation({ projectId }: { projectId: string }) {
  return (
    <Card>
      <h3>Resource Allocation</h3>
      
      {/* View resources */}
      <PermissionGuard 
        permission="resource_read"
        context={{ project_id: projectId }}
      >
        <ResourceList projectId={projectId} />
      </PermissionGuard>
      
      {/* Allocate resources */}
      <PermissionGuard 
        permission="resource_allocate"
        context={{ project_id: projectId }}
        fallback={<p className="text-sm text-gray-500">Read-only access</p>}
      >
        <Button onClick={handleAllocate}>Allocate Resources</Button>
      </PermissionGuard>
      
      {/* AI optimization */}
      <PermissionGuard 
        permission="ai_resource_optimize"
        context={{ project_id: projectId }}
      >
        <AIResourceOptimizer projectId={projectId} />
      </PermissionGuard>
    </Card>
  )
}
```

### 7. Financial Dashboard Integration

Protect sensitive financial data:

```tsx
// app/financials/page.tsx
import { PermissionGuard } from '@/components/auth'

export default function FinancialsPage() {
  return (
    <PermissionGuard 
      permission="financial_read"
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Card>
            <h2>Access Restricted</h2>
            <p>You don't have permission to view financial data.</p>
            <p className="text-sm text-gray-600 mt-2">
              Contact your administrator to request access.
            </p>
          </Card>
        </div>
      }
    >
      <PageContainer>
        <h1>Financial Dashboard</h1>
        
        {/* Summary view - available to all with financial_read */}
        <FinancialSummary />
        
        {/* Detailed financial data */}
        <PermissionGuard permission="financial_read">
          <DetailedFinancialReports />
        </PermissionGuard>
        
        {/* Budget management */}
        <PermissionGuard 
          permission="financial_update"
          fallback={<p className="text-sm">Budget management requires additional permissions</p>}
        >
          <BudgetManagementPanel />
        </PermissionGuard>
        
        {/* Budget alerts configuration */}
        <PermissionGuard permission="budget_alert_manage">
          <BudgetAlertConfiguration />
        </PermissionGuard>
      </PageContainer>
    </PermissionGuard>
  )
}
```

### 8. Workflow Integration

Add permission checks to workflow actions:

```tsx
// components/workflow/WorkflowActions.tsx
import { PermissionGuard } from '@/components/auth'

export function WorkflowActions({ workflowId, projectId }: WorkflowActionsProps) {
  return (
    <div className="flex gap-2">
      {/* View workflow */}
      <PermissionGuard 
        permission="project_read"
        context={{ project_id: projectId }}
      >
        <Button variant="secondary" onClick={handleView}>
          View Workflow
        </Button>
      </PermissionGuard>
      
      {/* Edit workflow */}
      <PermissionGuard 
        permission="project_update"
        context={{ project_id: projectId }}
      >
        <Button onClick={handleEdit}>Edit Workflow</Button>
      </PermissionGuard>
      
      {/* Approve workflow */}
      <PermissionGuard 
        permission={["project_update", "pmr_approve"]}
        context={{ project_id: projectId }}
      >
        <Button variant="success" onClick={handleApprove}>
          Approve
        </Button>
      </PermissionGuard>
      
      {/* Reject workflow */}
      <PermissionGuard 
        permission={["project_update", "pmr_approve"]}
        context={{ project_id: projectId }}
      >
        <Button variant="danger" onClick={handleReject}>
          Reject
        </Button>
      </PermissionGuard>
    </div>
  )
}
```

## Migration Strategy

### Step 1: Identify Protected Components

1. Review existing components and pages
2. Identify which components need permission protection
3. Determine appropriate permissions for each component

### Step 2: Add Permission Guards

1. Start with high-level pages (dashboards, admin panels)
2. Add guards to navigation components
3. Protect action buttons and forms
4. Add guards to data display components

### Step 3: Test Thoroughly

1. Test with different user roles
2. Verify fallback content displays correctly
3. Check that context-aware permissions work
4. Test loading states

### Step 4: Update Documentation

1. Document which permissions are required for each feature
2. Update user guides with permission requirements
3. Create role-based feature matrices

## Common Patterns

### Pattern 1: Page-Level Protection

Protect entire pages at the top level:

```tsx
export default function ProtectedPage() {
  return (
    <PermissionGuard 
      permission="required_permission"
      fallback={<AccessDeniedPage />}
    >
      <PageContent />
    </PermissionGuard>
  )
}
```

### Pattern 2: Feature Toggles

Show/hide features based on permissions:

```tsx
<div>
  <BasicFeatures />
  
  <PermissionGuard permission="advanced_feature">
    <AdvancedFeatures />
  </PermissionGuard>
</div>
```

### Pattern 3: Action Button Groups

Group related actions with permissions:

```tsx
<div className="action-buttons">
  <PermissionGuard permission="read">
    <ViewButton />
  </PermissionGuard>
  
  <PermissionGuard permission="update">
    <EditButton />
  </PermissionGuard>
  
  <PermissionGuard permission="delete">
    <DeleteButton />
  </PermissionGuard>
</div>
```

### Pattern 4: Conditional Rendering with Fallback

Provide alternative content for unauthorized users:

```tsx
<PermissionGuard 
  permission="premium_feature"
  fallback={
    <Card>
      <h3>Premium Feature</h3>
      <p>Upgrade your plan to access this feature</p>
      <Button>Upgrade Now</Button>
    </Card>
  }
>
  <PremiumFeatureContent />
</PermissionGuard>
```

## Testing Integration

### Unit Tests

Test components with PermissionGuard:

```tsx
import { render, screen } from '@testing-library/react'
import { PermissionGuard } from '@/components/auth'

// Mock the auth provider
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: mockSession,
    user: mockUser,
    loading: false,
    error: null
  })
}))

test('renders protected content when user has permission', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ has_permission: true })
  })
  
  render(
    <PermissionGuard permission="project_read">
      <div>Protected Content</div>
    </PermissionGuard>
  )
  
  await waitFor(() => {
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})
```

### Integration Tests

Test complete user flows with permissions:

```tsx
test('user can view but not edit project without update permission', async () => {
  // Setup user with only read permission
  setupUserWithPermissions(['project_read'])
  
  render(<ProjectPage projectId="123" />)
  
  // Should see project details
  expect(screen.getByText('Project Details')).toBeInTheDocument()
  
  // Should not see edit button
  expect(screen.queryByText('Edit Project')).not.toBeInTheDocument()
})
```

## Performance Considerations

1. **Minimize Permission Checks**: Group related content under a single PermissionGuard when possible
2. **Use Loading States**: Provide loading feedback for better UX
3. **Cache Results**: The backend caches permission results automatically
4. **Parallel Checks**: Multiple permissions are checked in parallel

## Security Reminders

⚠️ **Critical**: Always enforce permissions on the backend. The PermissionGuard is for UX only.

1. Backend must validate all permissions
2. Frontend checks can be bypassed
3. Never trust client-side permission checks for security
4. Use PermissionGuard to improve UX, not for security

## Next Steps

After integrating PermissionGuard:

1. **Task 6.2**: Implement `usePermissions` hook for programmatic permission checking
2. **Task 6.3**: Create `RoleBasedNav` component for navigation filtering
3. **Task 7**: Implement enhanced auth context provider with permission caching
4. **Task 8**: Build admin role management interface

## Support

For questions or issues:

1. Review this integration guide
2. Check the PermissionGuard README
3. Review the design document
4. Consult the backend RBAC documentation
