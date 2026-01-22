/**
 * RoleBasedNav Component Usage Examples
 * 
 * This file demonstrates various ways to use the RoleBasedNav component
 * for implementing permission-based navigation menu filtering.
 */

import React from 'react'
import Link from 'next/link'
import { RoleBasedNav, NavItem } from './RoleBasedNav'
import { Home, Briefcase, Users, DollarSign, AlertTriangle, Settings } from 'lucide-react'

// ============================================================================
// Example 1: Basic Navigation Menu
// ============================================================================

export function BasicNavExample() {
  const navItems: NavItem[] = [
    {
      id: 'dashboards',
      label: 'Dashboards',
      path: '/dashboards',
      requiredPermission: 'portfolio_read'
    },
    {
      id: 'projects',
      label: 'Projects',
      path: '/projects',
      requiredPermission: 'project_read'
    },
    {
      id: 'resources',
      label: 'Resources',
      path: '/resources',
      requiredPermission: 'resource_read'
    },
    {
      id: 'financials',
      label: 'Financials',
      path: '/financials',
      requiredPermission: 'financial_read'
    }
  ]

  return (
    <RoleBasedNav
      items={navItems}
      renderItem={(item) => (
        <Link 
          href={item.path}
          className="block py-2 px-4 hover:bg-gray-100 rounded"
        >
          {item.label}
        </Link>
      )}
      className="space-y-1"
    />
  )
}

// ============================================================================
// Example 2: Navigation with Icons
// ============================================================================

export function NavWithIconsExample() {
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
    },
    {
      id: 'resources',
      label: 'Resources',
      path: '/resources',
      requiredPermission: 'resource_read',
      icon: <Users className="h-5 w-5" />
    },
    {
      id: 'financials',
      label: 'Financials',
      path: '/financials',
      requiredPermission: 'financial_read',
      icon: <DollarSign className="h-5 w-5" />
    },
    {
      id: 'risks',
      label: 'Risks',
      path: '/risks',
      requiredPermission: 'risk_read',
      icon: <AlertTriangle className="h-5 w-5" />
    }
  ]

  return (
    <RoleBasedNav
      items={navItems}
      renderItem={(item) => (
        <Link 
          href={item.path}
          className="flex items-center gap-3 py-2 px-4 hover:bg-gray-100 rounded transition-colors"
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      )}
      className="space-y-1"
    />
  )
}

// ============================================================================
// Example 3: Nested Navigation (Sub-menus)
// ============================================================================

export function NestedNavExample() {
  const navItems: NavItem[] = [
    {
      id: 'dashboards',
      label: 'Dashboards',
      path: '/dashboards',
      requiredPermission: 'portfolio_read'
    },
    {
      id: 'admin',
      label: 'Administration',
      path: '/admin',
      requiredPermission: 'admin_read',
      icon: <Settings className="h-5 w-5" />,
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
        },
        {
          id: 'system',
          label: 'System Settings',
          path: '/admin/system',
          requiredPermission: 'system_admin'
        }
      ]
    }
  ]

  return (
    <RoleBasedNav
      items={navItems}
      renderItem={(item) => (
        <div>
          <Link 
            href={item.path}
            className="flex items-center gap-3 py-2 px-4 hover:bg-gray-100 rounded font-medium"
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
          {/* Nested items will be rendered recursively by RoleBasedNav */}
        </div>
      )}
      className="space-y-1"
    />
  )
}

// ============================================================================
// Example 4: Context-Aware Navigation
// ============================================================================

export function ContextAwareNavExample({ projectId }: { projectId: string }) {
  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Project Overview',
      path: `/projects/${projectId}`,
      requiredPermission: 'project_read',
      context: { project_id: projectId }
    },
    {
      id: 'financials',
      label: 'Project Financials',
      path: `/projects/${projectId}/financials`,
      requiredPermission: 'financial_read',
      context: { project_id: projectId }
    },
    {
      id: 'resources',
      label: 'Project Resources',
      path: `/projects/${projectId}/resources`,
      requiredPermission: 'resource_read',
      context: { project_id: projectId }
    },
    {
      id: 'settings',
      label: 'Project Settings',
      path: `/projects/${projectId}/settings`,
      requiredPermission: 'project_update',
      context: { project_id: projectId }
    }
  ]

  return (
    <RoleBasedNav
      items={navItems}
      renderItem={(item) => (
        <Link 
          href={item.path}
          className="block py-2 px-4 hover:bg-blue-50 rounded"
        >
          {item.label}
        </Link>
      )}
      className="space-y-1"
    />
  )
}

// ============================================================================
// Example 5: Multiple Permissions (OR Logic)
// ============================================================================

export function MultiplePermissionsNavExample() {
  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      path: '/overview',
      // User needs EITHER portfolio_read OR project_read
      requiredPermission: ['portfolio_read', 'project_read']
    },
    {
      id: 'management',
      label: 'Management',
      path: '/management',
      // User needs EITHER portfolio_update OR project_update
      requiredPermission: ['portfolio_update', 'project_update']
    },
    {
      id: 'reports',
      label: 'Reports',
      path: '/reports',
      // User needs EITHER financial_read OR admin_read
      requiredPermission: ['financial_read', 'admin_read']
    }
  ]

  return (
    <RoleBasedNav
      items={navItems}
      renderItem={(item) => (
        <Link 
          href={item.path}
          className="block py-2 px-4 hover:bg-gray-100 rounded"
        >
          {item.label}
        </Link>
      )}
      className="space-y-1"
    />
  )
}

// ============================================================================
// Example 6: Sidebar Navigation with Loading State
// ============================================================================

export function SidebarNavExample() {
  const navItems: NavItem[] = [
    {
      id: 'dashboards',
      label: 'Portfolio Dashboards',
      path: '/dashboards',
      requiredPermission: 'portfolio_read',
      icon: <Home className="h-5 w-5" />
    },
    {
      id: 'projects',
      label: 'Projects',
      path: '/projects',
      requiredPermission: 'project_read',
      icon: <Briefcase className="h-5 w-5" />
    },
    {
      id: 'resources',
      label: 'Resource Management',
      path: '/resources',
      requiredPermission: 'resource_read',
      icon: <Users className="h-5 w-5" />
    },
    {
      id: 'financials',
      label: 'Financial Tracking',
      path: '/financials',
      requiredPermission: 'financial_read',
      icon: <DollarSign className="h-5 w-5" />
    },
    {
      id: 'risks',
      label: 'Risk/Issue Registers',
      path: '/risks',
      requiredPermission: 'risk_read',
      icon: <AlertTriangle className="h-5 w-5" />
    },
    {
      id: 'admin',
      label: 'Administration',
      path: '/admin',
      requiredPermission: 'admin_read',
      icon: <Settings className="h-5 w-5" />,
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

  return (
    <aside className="w-64 bg-gray-800 text-white h-screen">
      <div className="p-4">
        <h1 className="text-xl font-bold">ORKA PPM</h1>
      </div>
      
      <RoleBasedNav
        items={navItems}
        renderItem={(item) => (
          <Link 
            href={item.path}
            className="flex items-center gap-3 py-3 px-4 hover:bg-gray-700 transition-colors"
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        )}
        className="space-y-1 px-2"
        loadingFallback={
          <div className="py-3 px-4 text-gray-400">
            Loading...
          </div>
        }
      />
    </aside>
  )
}

// ============================================================================
// Example 7: Horizontal Tab Navigation
// ============================================================================

export function TabNavExample({ projectId }: { projectId: string }) {
  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      path: `/projects/${projectId}`,
      requiredPermission: 'project_read',
      context: { project_id: projectId }
    },
    {
      id: 'tasks',
      label: 'Tasks',
      path: `/projects/${projectId}/tasks`,
      requiredPermission: 'project_read',
      context: { project_id: projectId }
    },
    {
      id: 'budget',
      label: 'Budget',
      path: `/projects/${projectId}/budget`,
      requiredPermission: 'financial_read',
      context: { project_id: projectId }
    },
    {
      id: 'team',
      label: 'Team',
      path: `/projects/${projectId}/team`,
      requiredPermission: 'resource_read',
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
      renderItem={(item) => (
        <Link 
          href={item.path}
          className="px-4 py-2 border-b-2 border-transparent hover:border-blue-500 transition-colors"
        >
          {item.label}
        </Link>
      )}
      className="flex gap-4 border-b border-gray-200"
    />
  )
}
