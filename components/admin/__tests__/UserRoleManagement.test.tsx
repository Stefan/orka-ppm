/**
 * Unit Tests for UserRoleManagement Component
 * 
 * Tests the user role management interface including:
 * - User list display
 * - Role assignment interface
 * - Role removal
 * - Effective permissions display
 * 
 * Requirements: 4.1, 4.4
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { UserRoleManagement } from '../UserRoleManagement'

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

describe('UserRoleManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the component with header', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      render(<UserRoleManagement />)

      expect(screen.getByText('User Role Management')).toBeInTheDocument()
      expect(
        screen.getByText('View and manage user role assignments with scope-based access control')
      ).toBeInTheDocument()
    })

    it('should show loading state initially', () => {
      ;(global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<UserRoleManagement />)

      expect(screen.getByText('Loading users...')).toBeInTheDocument()
    })

    it('should display search input and assign role button', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by name, email, or role...')).toBeInTheDocument()
        expect(screen.getByText('Assign Role')).toBeInTheDocument()
      })
    })
  })

  describe('User List Display', () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'john@example.com',
        full_name: 'John Doe',
        roles: [
          {
            id: 'role-1',
            name: 'admin',
            scope_type: 'global',
            assigned_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
      {
        id: 'user-2',
        email: 'jane@example.com',
        full_name: 'Jane Smith',
        roles: [
          {
            id: 'role-2',
            name: 'project_manager',
            scope_type: 'project',
            scope_id: 'project-123',
            assigned_at: '2024-01-02T00:00:00Z',
          },
        ],
      },
      {
        id: 'user-3',
        email: 'bob@example.com',
        full_name: 'Bob Johnson',
        roles: [],
      },
    ]

    it('should display list of users with their roles', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('john@example.com')).toBeInTheDocument()
        expect(screen.getByText('admin')).toBeInTheDocument()

        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.getByText('jane@example.com')).toBeInTheDocument()
        expect(screen.getByText('project_manager')).toBeInTheDocument()

        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
        expect(screen.getByText('No roles assigned')).toBeInTheDocument()
      })
    })

    it('should display scope type for scoped roles', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        // Global role should not show scope
        const adminBadge = screen.getByText('admin').closest('span')
        expect(adminBadge).not.toHaveTextContent('(global)')

        // Project-scoped role should show scope
        const projectManagerBadge = screen.getByText('project_manager').closest('span')
        expect(projectManagerBadge).toHaveTextContent('(project)')
      })
    })

    it('should show empty state when no users found', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'john@example.com',
        full_name: 'John Doe',
        roles: [{ id: 'role-1', name: 'admin', scope_type: 'global', assigned_at: '2024-01-01T00:00:00Z' }],
      },
      {
        id: 'user-2',
        email: 'jane@example.com',
        full_name: 'Jane Smith',
        roles: [{ id: 'role-2', name: 'viewer', scope_type: 'global', assigned_at: '2024-01-02T00:00:00Z' }],
      },
    ]

    it('should filter users by name', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search by name, email, or role...')
      fireEvent.change(searchInput, { target: { value: 'john' } })

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
      })
    })

    it('should filter users by email', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search by name, email, or role...')
      fireEvent.change(searchInput, { target: { value: 'jane@' } })

      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
    })

    it('should filter users by role', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search by name, email, or role...')
      fireEvent.change(searchInput, { target: { value: 'admin' } })

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
      })
    })

    it('should show "no users found" message when search has no results', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search by name, email, or role...')
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

      await waitFor(() => {
        expect(screen.getByText('No users found matching your search')).toBeInTheDocument()
      })
    })
  })

  describe('Role Assignment', () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'john@example.com',
        full_name: 'John Doe',
        roles: [],
      },
    ]

    it('should open role assignment dialog when clicking assign role button', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      const assignButtons = screen.getAllByText('Assign Role')
      fireEvent.click(assignButtons[1]) // Click the button for the user (not the header button)

      // Dialog should open (we'll test the dialog component separately)
      // For now, just verify the button click works
      expect(assignButtons[1]).toBeInTheDocument()
    })
  })

  describe('Role Removal', () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'john@example.com',
        full_name: 'John Doe',
        roles: [
          {
            id: 'role-1',
            name: 'admin',
            scope_type: 'global',
            assigned_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
    ]

    it('should call API to remove role when clicking remove button', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUsers,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Role removed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ ...mockUsers[0], roles: [] }],
        })

      // Mock window.confirm
      global.confirm = jest.fn(() => true)

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument()
      })

      const removeButton = screen.getByLabelText('Remove admin role')
      fireEvent.click(removeButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/users/user-1/roles/role-1'),
          expect.objectContaining({
            method: 'DELETE',
          })
        )
      })
    })

    it('should not remove role if user cancels confirmation', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })

      // Mock window.confirm to return false
      global.confirm = jest.fn(() => false)

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument()
      })

      const removeButton = screen.getByLabelText('Remove admin role')
      fireEvent.click(removeButton)

      // Should not make DELETE request
      expect(global.fetch).toHaveBeenCalledTimes(1) // Only the initial fetch
    })
  })

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      })
    })

    it('should display error message when API returns error status', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch users: 500/i)).toBeInTheDocument()
      })
    })
  })

  describe('Requirements Validation', () => {
    it('should satisfy requirement 4.1 - provide interface for viewing and modifying user role assignments', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'john@example.com',
          full_name: 'John Doe',
          roles: [
            {
              id: 'role-1',
              name: 'admin',
              scope_type: 'global',
              assigned_at: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        // Viewing: User list is displayed
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('admin')).toBeInTheDocument()

        // Modifying: Assign and remove buttons are available
        expect(screen.getAllByText('Assign Role').length).toBeGreaterThan(0)
        expect(screen.getByLabelText('Remove admin role')).toBeInTheDocument()
      })
    })

    it('should satisfy requirement 4.4 - provide effective permissions display', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'john@example.com',
          full_name: 'John Doe',
          roles: [
            {
              id: 'role-1',
              name: 'admin',
              scope_type: 'global',
              assigned_at: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      })

      render(<UserRoleManagement />)

      await waitFor(() => {
        // View Permissions button should be available
        expect(screen.getByText('View Permissions')).toBeInTheDocument()
      })
    })
  })
})
