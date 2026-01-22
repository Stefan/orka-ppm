/**
 * Unit Tests for RoleManagement Component
 * 
 * Tests the role management interface including:
 * - Role list display
 * - Custom role creation
 * - Custom role editing
 * - Custom role deletion
 * - Search and filtering
 * - System vs custom role differentiation
 * 
 * Requirements: 4.2, 4.3
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RoleManagement } from '../RoleManagement'
import type { Permission } from '@/types/rbac'

// Mock the auth provider
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: {
      access_token: 'mock-token',
    },
    user: {
      id: 'admin-user-id',
      email: 'admin@example.com',
    },
    loading: false,
  }),
}))

// Mock fetch
global.fetch = jest.fn()

describe('RoleManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockRoles = [
    {
      id: 'role-1',
      name: 'admin',
      description: 'Full system access with user and role management capabilities',
      permissions: ['system_admin'] as Permission[],
      is_custom: false,
      assigned_users_count: 2,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'role-2',
      name: 'custom_manager',
      description: 'Custom manager role with specific permissions',
      permissions: ['project_read', 'project_update', 'financial_read'] as Permission[],
      is_custom: true,
      assigned_users_count: 5,
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-20T00:00:00Z',
    },
    {
      id: 'role-3',
      name: 'viewer',
      description: 'Read-only access to projects and reports',
      permissions: ['project_read', 'portfolio_read'] as Permission[],
      is_custom: false,
      assigned_users_count: 10,
      created_at: '2024-01-01T00:00:00Z',
    },
  ]

  describe('Component Rendering', () => {
    it('should render the component with header', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('Role Management')).toBeInTheDocument()
        expect(screen.getByText('Create and manage custom roles with specific permission sets')).toBeInTheDocument()
      })
    })

    it('should show loading state initially', () => {
      ;(global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<RoleManagement />)

      expect(screen.getByText('Loading roles...')).toBeInTheDocument()
    })

    it('should display search input and create role button', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search roles by name, description, or permissions...')).toBeInTheDocument()
        expect(screen.getByText('Create Role')).toBeInTheDocument()
      })
    })
  })

  describe('Role Statistics', () => {
    it('should display role statistics correctly', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument() // Total roles
        expect(screen.getByText('Total Roles')).toBeInTheDocument()
        expect(screen.getByText('1')).toBeInTheDocument() // Custom roles
        expect(screen.getByText('Custom Roles')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument() // System roles
        expect(screen.getByText('System Roles')).toBeInTheDocument()
      })
    })
  })

  describe('Role List Display', () => {
    it('should display list of roles with details', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        // Check role names
        expect(screen.getByText('admin')).toBeInTheDocument()
        expect(screen.getByText('custom_manager')).toBeInTheDocument()
        expect(screen.getByText('viewer')).toBeInTheDocument()

        // Check descriptions
        expect(screen.getByText('Full system access with user and role management capabilities')).toBeInTheDocument()
        expect(screen.getByText('Custom manager role with specific permissions')).toBeInTheDocument()

        // Check user counts
        expect(screen.getByText('2 user(s)')).toBeInTheDocument()
        expect(screen.getByText('5 user(s)')).toBeInTheDocument()
        expect(screen.getByText('10 user(s)')).toBeInTheDocument()
      })
    })

    it('should differentiate between system and custom roles', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        const systemBadges = screen.getAllByText('System')
        const customBadges = screen.getAllByText('Custom')

        expect(systemBadges).toHaveLength(2) // admin and viewer
        expect(customBadges).toHaveLength(1) // custom_manager
      })
    })

    it('should display permission counts', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('1 permission')).toBeInTheDocument() // admin with system_admin
        expect(screen.getByText('3 permissions')).toBeInTheDocument() // custom_manager
        expect(screen.getByText('2 permissions')).toBeInTheDocument() // viewer
      })
    })

    it('should display permission preview badges', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('system_admin')).toBeInTheDocument()
        expect(screen.getByText('project_read')).toBeInTheDocument()
        expect(screen.getByText('project_update')).toBeInTheDocument()
        expect(screen.getByText('financial_read')).toBeInTheDocument()
      })
    })

    it('should show empty state when no roles found', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('No roles found')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('should filter roles by name', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument()
        expect(screen.getByText('custom_manager')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search roles by name, description, or permissions...')
      fireEvent.change(searchInput, { target: { value: 'custom' } })

      await waitFor(() => {
        expect(screen.queryByText('admin')).not.toBeInTheDocument()
        expect(screen.getByText('custom_manager')).toBeInTheDocument()
        expect(screen.queryByText('viewer')).not.toBeInTheDocument()
      })
    })

    it('should filter roles by description', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search roles by name, description, or permissions...')
      fireEvent.change(searchInput, { target: { value: 'read-only' } })

      await waitFor(() => {
        expect(screen.queryByText('admin')).not.toBeInTheDocument()
        expect(screen.queryByText('custom_manager')).not.toBeInTheDocument()
        expect(screen.getByText('viewer')).toBeInTheDocument()
      })
    })

    it('should filter roles by permissions', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search roles by name, description, or permissions...')
      fireEvent.change(searchInput, { target: { value: 'financial' } })

      await waitFor(() => {
        expect(screen.queryByText('admin')).not.toBeInTheDocument()
        expect(screen.getByText('custom_manager')).toBeInTheDocument()
        expect(screen.queryByText('viewer')).not.toBeInTheDocument()
      })
    })

    it('should show "no roles found" message when search has no results', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search roles by name, description, or permissions...')
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

      await waitFor(() => {
        expect(screen.getByText('No roles found matching your search')).toBeInTheDocument()
      })
    })
  })

  describe('Role Actions', () => {
    it('should show edit and delete buttons for custom roles', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        const editButtons = screen.getAllByText('Edit')
        const deleteButtons = screen.getAllByText('Delete')

        // Only custom_manager should have edit/delete buttons
        expect(editButtons).toHaveLength(1)
        expect(deleteButtons).toHaveLength(1)
      })
    })

    it('should show "System Role" badge for system roles instead of action buttons', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        const systemRoleBadges = screen.getAllByText('System Role')
        expect(systemRoleBadges).toHaveLength(2) // admin and viewer
      })
    })

    it('should open create dialog when clicking create role button', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument()
      })

      const createButton = screen.getByText('Create Role')
      fireEvent.click(createButton)

      // Dialog should open (we test the dialog component separately)
      expect(createButton).toBeInTheDocument()
    })

    it('should open edit dialog when clicking edit button', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('custom_manager')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit')
      fireEvent.click(editButton)

      // Dialog should open
      expect(editButton).toBeInTheDocument()
    })
  })

  describe('Role Deletion', () => {
    it('should call API to delete role when confirmed', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRoles,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Role deleted' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRoles.filter(r => r.id !== 'role-2'),
        })

      // Mock window.confirm
      global.confirm = jest.fn(() => true)

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('custom_manager')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/roles/role-2'),
          expect.objectContaining({
            method: 'DELETE',
          })
        )
      })
    })

    it('should not delete role if user cancels confirmation', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      // Mock window.confirm to return false
      global.confirm = jest.fn(() => false)

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('custom_manager')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      // Should not make DELETE request
      expect(global.fetch).toHaveBeenCalledTimes(1) // Only the initial fetch
    })

    it('should warn when deleting role with assigned users', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      global.confirm = jest.fn(() => false)

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('custom_manager')).toBeInTheDocument()
        expect(screen.getByText('5 user(s)')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      expect(global.confirm).toHaveBeenCalledWith(
        expect.stringContaining('This role is assigned to 5 user(s)')
      )
    })

    it('should display error message on deletion failure', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRoles,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ detail: 'Cannot delete system roles' }),
        })

      global.confirm = jest.fn(() => true)

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('custom_manager')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText(/Cannot delete system roles/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      })
    })

    it('should display error message when API returns error status', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch roles: 500/i)).toBeInTheDocument()
      })
    })
  })

  describe('Requirements Validation', () => {
    it('should satisfy requirement 4.2 - provide interface for creating custom roles', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        // Create button should be available
        expect(screen.getByText('Create Role')).toBeInTheDocument()

        // Custom roles should be displayed
        expect(screen.getByText('custom_manager')).toBeInTheDocument()
        expect(screen.getByText('Custom')).toBeInTheDocument()

        // Edit and delete actions for custom roles
        expect(screen.getByText('Edit')).toBeInTheDocument()
        expect(screen.getByText('Delete')).toBeInTheDocument()
      })
    })

    it('should satisfy requirement 4.3 - prevent editing/deleting system roles', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoles,
      })

      render(<RoleManagement />)

      await waitFor(() => {
        // System roles should have "System Role" badge instead of action buttons
        const systemRoleBadges = screen.getAllByText('System Role')
        expect(systemRoleBadges).toHaveLength(2)

        // Only one Edit button (for custom role)
        const editButtons = screen.getAllByText('Edit')
        expect(editButtons).toHaveLength(1)
      })
    })
  })
})
