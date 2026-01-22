'use client'

import React, { ReactNode } from 'react'
import { PermissionGuard } from './PermissionGuard'
import type { Permission, PermissionContext } from '@/types/rbac'

/**
 * Navigation item configuration
 * 
 * Requirements: 3.3 - Navigation Permission Filtering
 */
export interface NavItem {
  /**
   * Unique identifier for the navigation item
   */
  id: string
  
  /**
   * Display label for the navigation item
   */
  label: string
  
  /**
   * URL path for the navigation item
   */
  path: string
  
  /**
   * Required permission(s) to view this navigation item.
   * Can be a single permission or an array (OR logic).
   */
  requiredPermission: Permission | Permission[]
  
  /**
   * Optional context for scoped permission checking
   */
  context?: PermissionContext
  
  /**
   * Optional icon component to display with the navigation item
   */
  icon?: ReactNode
  
  /**
   * Optional nested navigation items (sub-menu)
   */
  children?: NavItem[]
}

/**
 * Props for the RoleBasedNav component
 */
export interface RoleBasedNavProps {
  /**
   * Array of navigation items to filter based on permissions
   */
  items: NavItem[]
  
  /**
   * Render function for each navigation item.
   * Receives the filtered item and returns the rendered element.
   */
  renderItem: (item: NavItem) => ReactNode
  
  /**
   * Optional className for the navigation container
   */
  className?: string
  
  /**
   * Optional loading fallback while permissions are being checked
   */
  loadingFallback?: ReactNode
}

/**
 * RoleBasedNav Component
 * 
 * A React component that automatically filters navigation menu items based on user permissions.
 * Only navigation items that the user has permission to access will be rendered.
 * 
 * Features:
 * - Automatic permission-based filtering of navigation items
 * - Support for nested navigation items (sub-menus)
 * - Context-aware permission checking
 * - Flexible rendering through render props pattern
 * - Loading state support
 * 
 * Requirements: 3.3 - Hide menu items for unauthorized features
 * 
 * @example
 * // Basic usage
 * const navItems: NavItem[] = [
 *   { id: 'projects', label: 'Projects', path: '/projects', requiredPermission: 'project_read' },
 *   { id: 'portfolios', label: 'Portfolios', path: '/portfolios', requiredPermission: 'portfolio_read' },
 * ]
 * 
 * <RoleBasedNav
 *   items={navItems}
 *   renderItem={(item) => (
 *     <Link href={item.path}>{item.label}</Link>
 *   )}
 * />
 * 
 * @example
 * // With icons and nested items
 * const navItems: NavItem[] = [
 *   {
 *     id: 'admin',
 *     label: 'Admin',
 *     path: '/admin',
 *     requiredPermission: 'admin_read',
 *     icon: <AdminIcon />,
 *     children: [
 *       { id: 'users', label: 'Users', path: '/admin/users', requiredPermission: 'user_manage' },
 *       { id: 'roles', label: 'Roles', path: '/admin/roles', requiredPermission: 'role_manage' },
 *     ]
 *   }
 * ]
 * 
 * <RoleBasedNav
 *   items={navItems}
 *   renderItem={(item) => (
 *     <div>
 *       {item.icon}
 *       <Link href={item.path}>{item.label}</Link>
 *     </div>
 *   )}
 * />
 */
export const RoleBasedNav: React.FC<RoleBasedNavProps> = ({
  items,
  renderItem,
  className,
  loadingFallback
}) => {
  /**
   * Recursively render navigation items with permission guards
   */
  const renderNavItem = (item: NavItem): ReactNode => {
    return (
      <PermissionGuard
        key={item.id}
        permission={item.requiredPermission}
        context={item.context}
        loadingFallback={loadingFallback}
      >
        {renderItem(item)}
        
        {/* Recursively render nested items if they exist */}
        {item.children && item.children.length > 0 && (
          <RoleBasedNav
            items={item.children}
            renderItem={renderItem}
            loadingFallback={loadingFallback}
          />
        )}
      </PermissionGuard>
    )
  }

  return (
    <nav className={className}>
      {items.map(renderNavItem)}
    </nav>
  )
}

export default RoleBasedNav
