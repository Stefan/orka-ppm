/**
 * PermissionGuard Component Usage Examples
 * 
 * This file demonstrates various ways to use the PermissionGuard component
 * for implementing role-based access control in the UI.
 * 
 * Requirements: 3.1 - UI Component Permission Enforcement
 */

import React from 'react'
import { PermissionGuard } from './PermissionGuard'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

/**
 * Example 1: Basic Permission Check
 * 
 * Shows/hides content based on a single permission.
 */
export function BasicPermissionExample() {
  return (
    <div>
      <h2>Project Dashboard</h2>
      
      {/* Only users with project_read permission can see this */}
      <PermissionGuard permission="project_read">
        <Card>
          <h3>Project Details</h3>
          <p>Project information visible to authorized users</p>
        </Card>
      </PermissionGuard>
      
      {/* Only users with project_update permission can see this button */}
      <PermissionGuard permission="project_update">
        <Button>Edit Project</Button>
      </PermissionGuard>
    </div>
  )
}

/**
 * Example 2: Multiple Permissions (OR Logic)
 * 
 * Grants access if user has ANY of the specified permissions.
 */
export function MultiplePermissionsExample() {
  return (
    <div>
      <h2>Management Dashboard</h2>
      
      {/* Show if user has EITHER portfolio_read OR project_read */}
      <PermissionGuard permission={["portfolio_read", "project_read"]}>
        <Card>
          <h3>Overview</h3>
          <p>Visible to portfolio managers and project managers</p>
        </Card>
      </PermissionGuard>
    </div>
  )
}

/**
 * Example 3: Permission Check with Fallback
 * 
 * Shows alternative content when user lacks permission.
 */
export function PermissionWithFallbackExample() {
  return (
    <div>
      <h2>Financial Data</h2>
      
      <PermissionGuard 
        permission="financial_read"
        fallback={
          <Card>
            <p>You don't have permission to view financial data.</p>
            <p>Please contact your administrator for access.</p>
          </Card>
        }
      >
        <Card>
          <h3>Budget Overview</h3>
          <p>Total Budget: $1,000,000</p>
          <p>Spent: $750,000</p>
          <p>Remaining: $250,000</p>
        </Card>
      </PermissionGuard>
    </div>
  )
}

/**
 * Example 4: Context-Aware Permission Check
 * 
 * Checks permissions within a specific project or portfolio scope.
 */
export function ContextAwarePermissionExample({ projectId }: { projectId: string }) {
  return (
    <div>
      <h2>Project Actions</h2>
      
      {/* Check if user can update THIS specific project */}
      <PermissionGuard 
        permission="project_update"
        context={{ project_id: projectId }}
        fallback={<p>You cannot edit this project</p>}
      >
        <Button>Edit Project</Button>
      </PermissionGuard>
      
      {/* Check if user can delete THIS specific project */}
      <PermissionGuard 
        permission="project_delete"
        context={{ project_id: projectId }}
      >
        <Button variant="danger">Delete Project</Button>
      </PermissionGuard>
    </div>
  )
}

/**
 * Example 5: Loading State
 * 
 * Shows loading indicator while permissions are being checked.
 */
export function PermissionWithLoadingExample() {
  return (
    <div>
      <h2>Admin Panel</h2>
      
      <PermissionGuard 
        permission="admin_read"
        loadingFallback={
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span>Checking permissions...</span>
          </div>
        }
        fallback={<p>Admin access required</p>}
      >
        <Card>
          <h3>Admin Dashboard</h3>
          <p>Administrative controls and settings</p>
        </Card>
      </PermissionGuard>
    </div>
  )
}

/**
 * Example 6: Nested Permission Guards
 * 
 * Combines multiple permission checks for fine-grained control.
 */
export function NestedPermissionExample({ portfolioId, projectId }: { 
  portfolioId: string
  projectId: string 
}) {
  return (
    <div>
      <h2>Portfolio Management</h2>
      
      {/* First check portfolio read permission */}
      <PermissionGuard 
        permission="portfolio_read"
        context={{ portfolio_id: portfolioId }}
      >
        <Card>
          <h3>Portfolio Overview</h3>
          
          {/* Then check if user can update the portfolio */}
          <PermissionGuard 
            permission="portfolio_update"
            context={{ portfolio_id: portfolioId }}
          >
            <Button>Edit Portfolio</Button>
          </PermissionGuard>
          
          {/* Check project-level permissions within the portfolio */}
          <PermissionGuard 
            permission="project_create"
            context={{ portfolio_id: portfolioId }}
          >
            <Button>Add New Project</Button>
          </PermissionGuard>
        </Card>
      </PermissionGuard>
    </div>
  )
}

/**
 * Example 7: Action Buttons with Permissions
 * 
 * Common pattern for showing/hiding action buttons based on permissions.
 */
export function ActionButtonsExample({ projectId }: { projectId: string }) {
  return (
    <div className="flex gap-2">
      <PermissionGuard 
        permission="project_read"
        context={{ project_id: projectId }}
      >
        <Button variant="secondary">View Details</Button>
      </PermissionGuard>
      
      <PermissionGuard 
        permission="project_update"
        context={{ project_id: projectId }}
      >
        <Button>Edit</Button>
      </PermissionGuard>
      
      <PermissionGuard 
        permission="project_delete"
        context={{ project_id: projectId }}
      >
        <Button variant="danger">Delete</Button>
      </PermissionGuard>
      
      <PermissionGuard 
        permission={["financial_read", "financial_update"]}
        context={{ project_id: projectId }}
      >
        <Button>Manage Budget</Button>
      </PermissionGuard>
    </div>
  )
}

/**
 * Example 8: Navigation Menu with Permissions
 * 
 * Shows how to conditionally render navigation items based on permissions.
 */
export function NavigationMenuExample() {
  return (
    <nav>
      <ul>
        <PermissionGuard permission="portfolio_read">
          <li><a href="/portfolios">Portfolios</a></li>
        </PermissionGuard>
        
        <PermissionGuard permission="project_read">
          <li><a href="/projects">Projects</a></li>
        </PermissionGuard>
        
        <PermissionGuard permission="resource_read">
          <li><a href="/resources">Resources</a></li>
        </PermissionGuard>
        
        <PermissionGuard permission="financial_read">
          <li><a href="/financials">Financials</a></li>
        </PermissionGuard>
        
        <PermissionGuard permission={["admin_read", "system_admin"]}>
          <li><a href="/admin">Admin</a></li>
        </PermissionGuard>
      </ul>
    </nav>
  )
}

/**
 * Example 9: Conditional Features
 * 
 * Shows how to enable/disable features based on permissions.
 */
export function ConditionalFeaturesExample() {
  return (
    <div>
      <h2>Project Dashboard</h2>
      
      {/* Basic project info - always visible to those with project_read */}
      <PermissionGuard permission="project_read">
        <Card>
          <h3>Project Information</h3>
          <p>Basic project details</p>
        </Card>
      </PermissionGuard>
      
      {/* AI features - only for users with AI permissions */}
      <PermissionGuard permission="ai_resource_optimize">
        <Card>
          <h3>AI Resource Optimization</h3>
          <p>AI-powered resource allocation suggestions</p>
        </Card>
      </PermissionGuard>
      
      {/* Monte Carlo simulations - only for users with simulation permissions */}
      <PermissionGuard permission="simulation_run">
        <Card>
          <h3>Monte Carlo Simulation</h3>
          <Button>Run Simulation</Button>
        </Card>
      </PermissionGuard>
      
      {/* PMR features - only for users with PMR permissions */}
      <PermissionGuard permission="pmr_read">
        <Card>
          <h3>Project Monthly Reports</h3>
          <p>View and manage monthly reports</p>
        </Card>
      </PermissionGuard>
    </div>
  )
}

/**
 * Example 10: Complex Permission Logic
 * 
 * Demonstrates combining multiple PermissionGuards for complex scenarios.
 */
export function ComplexPermissionExample({ 
  projectId, 
  portfolioId 
}: { 
  projectId: string
  portfolioId: string 
}) {
  return (
    <div>
      <h2>Project Financial Management</h2>
      
      {/* Can view if user has financial_read OR is project manager */}
      <PermissionGuard 
        permission={["financial_read", "project_update"]}
        context={{ project_id: projectId }}
      >
        <Card>
          <h3>Budget Summary</h3>
          <p>View budget information</p>
          
          {/* Can edit only with financial_update permission */}
          <PermissionGuard 
            permission="financial_update"
            context={{ project_id: projectId }}
            fallback={<p className="text-sm text-gray-500 dark:text-slate-400">Read-only access</p>}
          >
            <Button>Edit Budget</Button>
          </PermissionGuard>
        </Card>
      </PermissionGuard>
      
      {/* Budget alerts - requires specific permission */}
      <PermissionGuard 
        permission="budget_alert_manage"
        context={{ portfolio_id: portfolioId }}
      >
        <Card>
          <h3>Budget Alerts</h3>
          <p>Configure budget alert thresholds</p>
          <Button>Manage Alerts</Button>
        </Card>
      </PermissionGuard>
    </div>
  )
}
