/**
 * Unit Tests for RoleBasedNav Component
 * 
 * Tests the RoleBasedNav component's ability to filter navigation items
 * based on user permissions.
 * 
 * Requirements: 3.3 - Navigation Permission Filtering
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RoleBasedNav, NavItem } from '../RoleBasedNav'

// Mock the PermissionGuard component
jest.mock('../PermissionGuard', () => ({
  PermissionGuard: ({ children, permission }: any) => {
    // For testing, render children for 'project_read' and 'portfolio_read'
    const allowedPermissions = ['project_read', 'portfolio_read', 'admin_read']
    const permissions = Array.isArray(permission) ? permission : [permission]
    const hasPermission = permissions.some(p => allowedPermissions.includes(p))
    
    return hasPermission ? <>{children}</> : null
  }
}))

describe('RoleBasedNav', () => {
  const basicNavItems: NavItem[] = [
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
    },
    {
      id: 'resources',
      label: 'Resources',
      path: '/resources',
      requiredPermission: 'resource_read' // This will be filtered out
    }
  ]

  describe('Basic Rendering', () => {
    it('should render navigation items with permissions', () => {
      render(
        <RoleBasedNav
          items={basicNavItems}
          renderItem={(item) => <div data-testid={item.id}>{item.label}</div>}
        />
      )

      expect(screen.getByTestId('projects')).toBeInTheDocument()
      expect(screen.getByTestId('portfolios')).toBeInTheDocument()
      expect(screen.queryByTestId('resources')).not.toBeInTheDocument()
    })

    it('should apply custom className to nav container', () => {
      const { container } = render(
        <RoleBasedNav
          items={basicNavItems}
          renderItem={(item) => <div>{item.label}</div>}
          className="custom-nav-class"
        />
      )

      const nav = container.querySelector('nav')
      expect(nav).toHaveClass('custom-nav-class')
    })

    it('should render empty nav when no items provided', () => {
      const { container } = render(
        <RoleBasedNav
          items={[]}
          renderItem={(item) => <div>{item.label}</div>}
        />
      )

      const nav = container.querySelector('nav')
      expect(nav).toBeInTheDocument()
      expect(nav?.children.length).toBe(0)
    })
  })

  describe('Permission Filtering', () => {
    it('should only render items user has permission for', () => {
      const items: NavItem[] = [
        {
          id: 'allowed-1',
          label: 'Allowed Item 1',
          path: '/allowed-1',
          requiredPermission: 'project_read'
        },
        {
          id: 'denied-1',
          label: 'Denied Item 1',
          path: '/denied-1',
          requiredPermission: 'project_delete'
        },
        {
          id: 'allowed-2',
          label: 'Allowed Item 2',
          path: '/allowed-2',
          requiredPermission: 'portfolio_read'
        }
      ]

      render(
        <RoleBasedNav
          items={items}
          renderItem={(item) => <div data-testid={item.id}>{item.label}</div>}
        />
      )

      expect(screen.getByTestId('allowed-1')).toBeInTheDocument()
      expect(screen.queryByTestId('denied-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('allowed-2')).toBeInTheDocument()
    })

    it('should handle multiple permissions (OR logic)', () => {
      const items: NavItem[] = [
        {
          id: 'multi-perm',
          label: 'Multi Permission Item',
          path: '/multi',
          requiredPermission: ['project_delete', 'project_read'] // One allowed, one denied
        }
      ]

      render(
        <RoleBasedNav
          items={items}
          renderItem={(item) => <div data-testid={item.id}>{item.label}</div>}
        />
      )

      // Should render because user has project_read (OR logic)
      expect(screen.getByTestId('multi-perm')).toBeInTheDocument()
    })
  })

  describe('Nested Navigation', () => {
    it('should render nested navigation items', () => {
      const nestedItems: NavItem[] = [
        {
          id: 'admin',
          label: 'Admin',
          path: '/admin',
          requiredPermission: 'admin_read',
          children: [
            {
              id: 'users',
              label: 'Users',
              path: '/admin/users',
              requiredPermission: 'user_manage'
            },
            {
              id: 'roles',
              label: 'Roles',
              path: '/admin/roles',
              requiredPermission: 'role_manage'
            }
          ]
        }
      ]

      render(
        <RoleBasedNav
          items={nestedItems}
          renderItem={(item) => (
            <div data-testid={item.id}>
              {item.label}
            </div>
          )}
        />
      )

      // Parent should render
      expect(screen.getByTestId('admin')).toBeInTheDocument()
      
      // Children should be checked for permissions too
      // (In this mock, they won't render because user_manage and role_manage aren't allowed)
      expect(screen.queryByTestId('users')).not.toBeInTheDocument()
      expect(screen.queryByTestId('roles')).not.toBeInTheDocument()
    })

    it('should handle deeply nested navigation', () => {
      const deeplyNestedItems: NavItem[] = [
        {
          id: 'level-1',
          label: 'Level 1',
          path: '/level-1',
          requiredPermission: 'project_read',
          children: [
            {
              id: 'level-2',
              label: 'Level 2',
              path: '/level-2',
              requiredPermission: 'portfolio_read',
              children: [
                {
                  id: 'level-3',
                  label: 'Level 3',
                  path: '/level-3',
                  requiredPermission: 'admin_read'
                }
              ]
            }
          ]
        }
      ]

      render(
        <RoleBasedNav
          items={deeplyNestedItems}
          renderItem={(item) => <div data-testid={item.id}>{item.label}</div>}
        />
      )

      expect(screen.getByTestId('level-1')).toBeInTheDocument()
      expect(screen.getByTestId('level-2')).toBeInTheDocument()
      expect(screen.getByTestId('level-3')).toBeInTheDocument()
    })
  })

  describe('Render Function', () => {
    it('should call renderItem for each visible nav item', () => {
      const renderItem = jest.fn((item) => <div data-testid={item.id}>{item.label}</div>)

      render(
        <RoleBasedNav
          items={basicNavItems}
          renderItem={renderItem}
        />
      )

      // Should be called for all items (PermissionGuard handles filtering)
      expect(renderItem).toHaveBeenCalledTimes(3)
      expect(renderItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'projects' }))
      expect(renderItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'portfolios' }))
      expect(renderItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'resources' }))
    })

    it('should pass complete nav item to renderItem', () => {
      const renderItem = jest.fn((item) => <div>{item.label}</div>)
      
      const itemWithIcon: NavItem[] = [
        {
          id: 'projects',
          label: 'Projects',
          path: '/projects',
          requiredPermission: 'project_read',
          icon: <span>Icon</span>
        }
      ]

      render(
        <RoleBasedNav
          items={itemWithIcon}
          renderItem={renderItem}
        />
      )

      expect(renderItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'projects',
          label: 'Projects',
          path: '/projects',
          requiredPermission: 'project_read',
          icon: expect.anything()
        })
      )
    })

    it('should support complex render functions', () => {
      render(
        <RoleBasedNav
          items={basicNavItems}
          renderItem={(item) => (
            <div data-testid={item.id} className="nav-item">
              <span className="icon">{item.icon}</span>
              <span className="label">{item.label}</span>
              <span className="path">{item.path}</span>
            </div>
          )}
        />
      )

      const projectItem = screen.getByTestId('projects')
      expect(projectItem).toHaveClass('nav-item')
      expect(projectItem.querySelector('.label')).toHaveTextContent('Projects')
      expect(projectItem.querySelector('.path')).toHaveTextContent('/projects')
    })
  })

  describe('Context-Aware Navigation', () => {
    it('should pass context to PermissionGuard', () => {
      const contextItems: NavItem[] = [
        {
          id: 'project-settings',
          label: 'Project Settings',
          path: '/projects/123/settings',
          requiredPermission: 'project_update',
          context: { project_id: '123' }
        }
      ]

      render(
        <RoleBasedNav
          items={contextItems}
          renderItem={(item) => <div data-testid={item.id}>{item.label}</div>}
        />
      )

      // Context is passed to PermissionGuard (tested in PermissionGuard tests)
      // Here we just verify the item is processed
      expect(screen.queryByTestId('project-settings')).not.toBeInTheDocument() // No permission
    })
  })

  describe('Loading State', () => {
    it('should pass loadingFallback to PermissionGuard', () => {
      const loadingFallback = <div data-testid="loading">Loading...</div>

      render(
        <RoleBasedNav
          items={basicNavItems}
          renderItem={(item) => <div>{item.label}</div>}
          loadingFallback={loadingFallback}
        />
      )

      // Loading fallback is passed to PermissionGuard
      // Actual loading behavior is tested in PermissionGuard tests
    })
  })

  describe('Edge Cases', () => {
    it('should handle items without children property', () => {
      const items: NavItem[] = [
        {
          id: 'simple',
          label: 'Simple Item',
          path: '/simple',
          requiredPermission: 'project_read'
        }
      ]

      render(
        <RoleBasedNav
          items={items}
          renderItem={(item) => <div data-testid={item.id}>{item.label}</div>}
        />
      )

      expect(screen.getByTestId('simple')).toBeInTheDocument()
    })

    it('should handle items with empty children array', () => {
      const items: NavItem[] = [
        {
          id: 'empty-children',
          label: 'Empty Children',
          path: '/empty',
          requiredPermission: 'project_read',
          children: []
        }
      ]

      render(
        <RoleBasedNav
          items={items}
          renderItem={(item) => <div data-testid={item.id}>{item.label}</div>}
        />
      )

      expect(screen.getByTestId('empty-children')).toBeInTheDocument()
    })

    it('should handle items with icons', () => {
      const items: NavItem[] = [
        {
          id: 'with-icon',
          label: 'With Icon',
          path: '/icon',
          requiredPermission: 'project_read',
          icon: <span data-testid="icon">📁</span>
        }
      ]

      render(
        <RoleBasedNav
          items={items}
          renderItem={(item) => (
            <div data-testid={item.id}>
              {item.icon}
              {item.label}
            </div>
          )}
        />
      )

      expect(screen.getByTestId('with-icon')).toBeInTheDocument()
      expect(screen.getByTestId('icon')).toBeInTheDocument()
    })

    it('should handle special characters in labels and paths', () => {
      const items: NavItem[] = [
        {
          id: 'special-chars',
          label: 'Projects & Portfolios (2024)',
          path: '/projects?filter=active&year=2024',
          requiredPermission: 'project_read'
        }
      ]

      render(
        <RoleBasedNav
          items={items}
          renderItem={(item) => <div data-testid={item.id}>{item.label}</div>}
        />
      )

      expect(screen.getByText('Projects & Portfolios (2024)')).toBeInTheDocument()
    })

    it('should handle very long navigation lists', () => {
      const manyItems: NavItem[] = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        label: `Item ${i}`,
        path: `/item-${i}`,
        requiredPermission: i % 2 === 0 ? 'project_read' : 'resource_read'
      }))

      render(
        <RoleBasedNav
          items={manyItems}
          renderItem={(item) => <div data-testid={item.id}>{item.label}</div>}
        />
      )

      // Even-numbered items should render (project_read permission)
      expect(screen.getByTestId('item-0')).toBeInTheDocument()
      expect(screen.getByTestId('item-2')).toBeInTheDocument()
      
      // Odd-numbered items should not render (resource_read permission)
      expect(screen.queryByTestId('item-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('item-3')).not.toBeInTheDocument()
    })
  })

  describe('Integration Scenarios', () => {
    it('should work with Link components', () => {
      const LinkComponent = ({ href, children }: any) => (
        <a href={href} data-testid="link">{children}</a>
      )

      render(
        <RoleBasedNav
          items={basicNavItems}
          renderItem={(item) => (
            <LinkComponent href={item.path}>
              {item.label}
            </LinkComponent>
          )}
        />
      )

      const links = screen.getAllByTestId('link')
      expect(links.length).toBeGreaterThan(0)
    })

    it('should work with custom navigation components', () => {
      const CustomNavItem = ({ item }: { item: NavItem }) => (
        <div data-testid={`custom-${item.id}`} className="custom-nav-item">
          <span className="label">{item.label}</span>
          <span className="badge">New</span>
        </div>
      )

      render(
        <RoleBasedNav
          items={basicNavItems}
          renderItem={(item) => <CustomNavItem item={item} />}
        />
      )

      expect(screen.getByTestId('custom-projects')).toBeInTheDocument()
      expect(screen.getByTestId('custom-portfolios')).toBeInTheDocument()
    })
  })
})
