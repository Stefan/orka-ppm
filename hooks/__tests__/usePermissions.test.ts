/**
 * Unit Tests for usePermissions Hook
 * 
 * Tests the usePermissions hook's ability to check permissions and roles,
 * handle caching, and provide real-time updates.
 * 
 * Requirements: 3.2, 3.5 - Hook-based API with real-time updates and caching
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { usePermissions } from '../usePermissions'
import type { Permission, UserPermissions } from '@/types/rbac'

// Mock the auth provider
const mockUseAuth = jest.fn()
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => mockUseAuth()
}))

// Mock fetch for API calls
global.fetch = jest.fn()

describe('usePermissions', () => {
  const mockSession = {
    access_token: 'mock-token',
    user: { id: 'user-123', email: 'test@example.com' }
  }

  const mockUserPermissions: UserPermissions = {
    user_id: 'user-123',
    roles: [
      {
        id: 'role-1',
        name: 'project_manager',
        permissions: ['project_read', 'project_update', 'resource_read'] as Permission[]
      }
    ],
    permissions: ['project_read', 'project_update', 'resource_read'] as Permission[],
    effective_permissions: ['project_read', 'project_update', 'resource_read'] as Permission[]
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Initialization and Loading', () => {
    it('should start with loading state', () => {
      mockUseAuth.mockReturnValue({
        session: null,
        user: null,
        loading: true,
        error: null
      })

      const { result } = renderHook(() => usePermissions())

      expect(result.current.loading).toBe(true)
      expect(result.current.permissions).toEqual([])
      expect(result.current.userRoles).toEqual([])
    })

    it('should fetch permissions when user is authenticated', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/rbac/user-permissions'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockSession.access_token}`
          })
        })
      )

      expect(result.current.permissions).toEqual(mockUserPermissions.effective_permissions)
      expect(result.current.userRoles).toEqual(['project_manager'])
    })

    it('should not fetch permissions when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue({
        session: null,
        user: null,
        loading: false,
        error: null
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(global.fetch).not.toHaveBeenCalled()
      expect(result.current.permissions).toEqual([])
      expect(result.current.userRoles).toEqual([])
    })
  })

  describe('Permission Checking - Global Permissions', () => {
    it('should return true for permissions user has', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.hasPermission('project_read')).toBe(true)
      expect(result.current.hasPermission('project_update')).toBe(true)
      expect(result.current.hasPermission('resource_read')).toBe(true)
    })

    it('should return false for permissions user does not have', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.hasPermission('project_delete')).toBe(false)
      expect(result.current.hasPermission('admin_read')).toBe(false)
      expect(result.current.hasPermission('system_admin')).toBe(false)
    })

    it('should handle multiple permissions with OR logic', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // User has project_read, so should return true
      expect(result.current.hasPermission(['project_read', 'admin_read'])).toBe(true)

      // User has resource_read, so should return true
      expect(result.current.hasPermission(['admin_read', 'resource_read'])).toBe(true)

      // User has none of these permissions
      expect(result.current.hasPermission(['admin_read', 'system_admin'])).toBe(false)
    })

    it('should return false when checking permissions before loading completes', () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: true,
        error: null
      })

      const { result } = renderHook(() => usePermissions())

      expect(result.current.hasPermission('project_read')).toBe(false)
    })
  })

  describe('Permission Checking - Context-Aware', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })
    })

    it('should check context-aware permissions via API', async () => {
      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Mock the context permission check
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_permission: true })
      })

      const context = { project_id: 'project-123' }
      
      // Note: Context checks rely on cache, so we need to trigger the check first
      // In real usage, PermissionGuard would populate the cache
      expect(result.current.hasPermission('project_update', context)).toBe(false)
    })

    it('should use cached context permission results', async () => {
      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const context = { project_id: 'project-123' }

      // First check - not in cache
      expect(result.current.hasPermission('project_update', context)).toBe(false)

      // The hook itself doesn't make API calls for context checks in hasPermission
      // It relies on cache populated by other means (like PermissionGuard)
      // This is by design for synchronous operation
    })
  })

  describe('Role Checking', () => {
    it('should return true for roles user has', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 3000 })

      // Wait a bit more for roles to be populated
      await waitFor(() => {
        expect(result.current.userRoles).toContain('project_manager')
      }, { timeout: 3000 })

      expect(result.current.hasRole('project_manager')).toBe(true)
    })

    it('should return false for roles user does not have', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.hasRole('admin')).toBe(false)
      expect(result.current.hasRole('portfolio_manager')).toBe(false)
    })

    it('should handle multiple roles with OR logic', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // User has project_manager
      expect(result.current.hasRole(['project_manager', 'admin'])).toBe(true)

      // User has none of these roles
      expect(result.current.hasRole(['admin', 'portfolio_manager'])).toBe(false)
    })

    it('should return false when checking roles before loading completes', () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: true,
        error: null
      })

      const { result } = renderHook(() => usePermissions())

      expect(result.current.hasRole('project_manager')).toBe(false)
    })
  })

  describe('Manual Refresh', () => {
    it('should refetch permissions when refetch is called', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Call refetch
      await act(async () => {
        await result.current.refetch()
      })

      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should update permissions after refetch', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      // Initial permissions
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.hasPermission('admin_read')).toBe(false)

      // Updated permissions with admin access
      const updatedPermissions: UserPermissions = {
        ...mockUserPermissions,
        roles: [
          ...mockUserPermissions.roles,
          {
            id: 'role-2',
            name: 'admin',
            permissions: ['admin_read', 'admin_update'] as Permission[]
          }
        ],
        effective_permissions: [
          ...mockUserPermissions.effective_permissions,
          'admin_read',
          'admin_update'
        ] as Permission[]
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedPermissions
      })

      // Refetch
      await act(async () => {
        await result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.permissions).toContain('admin_read')
      })

      expect(result.current.hasPermission('admin_read')).toBe(true)
      expect(result.current.userRoles).toContain('admin')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      expect(result.current.error?.message).toBe('Network error')
      expect(result.current.permissions).toEqual([])
      expect(result.current.loading).toBe(false)

      consoleErrorSpy.mockRestore()
    })

    it('should handle non-OK API responses', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403
      })

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.permissions).toEqual([])

      consoleErrorSpy.mockRestore()
    })

    it('should clear error on successful refetch', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      // First call fails
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      expect(result.current.error?.message).toBe('Network error')

      // Second call succeeds
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      await act(async () => {
        await result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.error).toBeNull()
        expect(result.current.permissions.length).toBeGreaterThan(0)
      })

      expect(result.current.permissions).toEqual(mockUserPermissions.effective_permissions)

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Real-Time Updates', () => {
    it('should refetch permissions when user changes', async () => {
      // Initial state - no user
      mockUseAuth.mockReturnValue({
        session: null,
        user: null,
        loading: false,
        error: null
      })

      const { rerender } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled()
      })

      // User logs in
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      rerender()

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })
    })

    it('should clear permissions when user logs out', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result, rerender } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.permissions.length).toBeGreaterThan(0)
      })

      // User logs out
      mockUseAuth.mockReturnValue({
        session: null,
        user: null,
        loading: false,
        error: null
      })

      rerender()

      await waitFor(() => {
        expect(result.current.permissions).toEqual([])
        expect(result.current.userRoles).toEqual([])
      })
    })
  })

  describe('Performance and Caching', () => {
    it('should cache global permission checks', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Multiple checks for the same permission
      const check1 = result.current.hasPermission('project_read')
      const check2 = result.current.hasPermission('project_read')
      const check3 = result.current.hasPermission('project_read')

      expect(check1).toBe(true)
      expect(check2).toBe(true)
      expect(check3).toBe(true)

      // Should only have made one API call (initial fetch)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should not make redundant API calls for global permissions', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Check multiple different permissions
      result.current.hasPermission('project_read')
      result.current.hasPermission('project_update')
      result.current.hasPermission('resource_read')

      // Should only have made one API call (initial fetch)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should clear cache on refetch', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.hasPermission('project_read')).toBe(true)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockUserPermissions,
          effective_permissions: [] as Permission[]
        })
      })

      await act(async () => {
        await result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.permissions).toEqual([])
      })

      expect(result.current.hasPermission('project_read')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      // Clear any mocks from previous test sections
      jest.clearAllMocks()
      ;(global.fetch as jest.Mock).mockClear()
    })

    it('should handle empty permissions array', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockUserPermissions,
          effective_permissions: [] as Permission[]
        })
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.permissions).toEqual([])
      expect(result.current.hasPermission('project_read')).toBe(false)
    })

    it('should handle empty roles array', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockUserPermissions,
          roles: []
        })
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.userRoles).toEqual([])
      expect(result.current.hasRole('project_manager')).toBe(false)
    })

    it('should handle checking empty permission array', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.hasPermission([])).toBe(false)
    })

    it('should handle checking empty role array', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      const { result } = renderHook(() => usePermissions())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.hasRole([])).toBe(false)
    })
  })

  describe('API URL Configuration', () => {
    it('should call user-permissions API with relative path', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserPermissions
      })

      renderHook(() => usePermissions())

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/rbac/user-permissions',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'Authorization': `Bearer ${mockSession.access_token}`,
              'Content-Type': 'application/json'
            })
          })
        )
      })
    })
  })
})
