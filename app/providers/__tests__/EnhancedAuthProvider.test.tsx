/**
 * Unit Tests for EnhancedAuthProvider
 * 
 * Tests the enhanced authentication provider with role and permission information.
 * 
 * Requirements: 2.1, 2.4 - Auth integration with role and permission information
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { EnhancedAuthProvider, useEnhancedAuth, usePermissions, useRoles } from '../EnhancedAuthProvider'
import * as SupabaseAuthProvider from '../SupabaseAuthProvider'
import { supabase } from '@/lib/api/supabase-minimal'

// Mock the SupabaseAuthProvider
jest.mock('../SupabaseAuthProvider', () => ({
  useAuth: jest.fn()
}))

// Mock supabase client (use same path as provider so one mock is shared)
jest.mock('@/lib/api/supabase-minimal', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn()
  }
}))

describe('EnhancedAuthProvider', () => {
  const mockUseAuth = SupabaseAuthProvider.useAuth as jest.MockedFunction<typeof SupabaseAuthProvider.useAuth>
  const mockSupabase = supabase as jest.Mocked<typeof supabase>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Role and Permission Loading', () => {
    it('should load user roles and permissions on mount', async () => {
      // Mock authenticated user
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      // Mock database response
      const mockRoleData = [
        {
          role_id: 'role-1',
          roles: {
            id: 'role-1',
            name: 'admin',
            permissions: ['project_read', 'project_update', 'user_manage']
          }
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockRoleData,
            error: null
          })
        })
      } as any)

      // Mock channel subscription
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)

      // Test component that uses the hook
      const TestComponent = () => {
        const { userRoles, userPermissions, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div>
            <div data-testid="roles">{userRoles.join(', ')}</div>
            <div data-testid="permissions">{userPermissions.join(', ')}</div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      // Wait for roles and permissions to load
      await waitFor(() => {
        expect(screen.getByTestId('roles')).toHaveTextContent('admin')
      })

      expect(screen.getByTestId('permissions')).toHaveTextContent('project_read')
      expect(screen.getByTestId('permissions')).toHaveTextContent('project_update')
      expect(screen.getByTestId('permissions')).toHaveTextContent('user_manage')
    })

    it('should aggregate permissions from multiple roles', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      // Mock multiple role assignments
      const mockRoleData = [
        {
          role_id: 'role-1',
          roles: {
            id: 'role-1',
            name: 'project_manager',
            permissions: ['project_read', 'project_update']
          }
        },
        {
          role_id: 'role-2',
          roles: {
            id: 'role-2',
            name: 'resource_manager',
            permissions: ['resource_read', 'resource_allocate']
          }
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockRoleData,
            error: null
          })
        })
      } as any)

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)

      const TestComponent = () => {
        const { userRoles, userPermissions, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div>
            <div data-testid="roles">{userRoles.join(', ')}</div>
            <div data-testid="permissions">{userPermissions.join(', ')}</div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('roles')).toHaveTextContent('project_manager, resource_manager')
      })

      const permissionsText = screen.getByTestId('permissions').textContent
      expect(permissionsText).toContain('project_read')
      expect(permissionsText).toContain('project_update')
      expect(permissionsText).toContain('resource_read')
      expect(permissionsText).toContain('resource_allocate')
    })

    it('should handle users with no roles assigned', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      } as any)

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)

      const TestComponent = () => {
        const { userRoles, userPermissions, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div>
            <div data-testid="roles">{userRoles.length === 0 ? 'No roles' : userRoles.join(', ')}</div>
            <div data-testid="permissions">{userPermissions.length === 0 ? 'No permissions' : userPermissions.join(', ')}</div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('roles')).toHaveTextContent('No roles')
      })

      expect(screen.getByTestId('permissions')).toHaveTextContent('No permissions')
    })

    it('should handle database errors gracefully', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
          })
        })
      } as any)

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)

      const TestComponent = () => {
        const { userRoles, userPermissions, loading, error } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        if (error) return <div data-testid="error">{error.message}</div>
        
        return (
          <div>
            <div data-testid="roles">{userRoles.join(', ')}</div>
            <div data-testid="permissions">{userPermissions.join(', ')}</div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument()
      })

      expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch user roles')
    })
  })

  describe('hasPermission method', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      const mockRoleData = [
        {
          role_id: 'role-1',
          roles: {
            id: 'role-1',
            name: 'project_manager',
            permissions: ['project_read', 'project_update', 'resource_read']
          }
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockRoleData,
            error: null
          })
        })
      } as any)

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)
    })

    it('should return true for permissions user has', async () => {
      const TestComponent = () => {
        const { hasPermission, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div>
            <div data-testid="has-project-read">{hasPermission('project_read').toString()}</div>
            <div data-testid="has-project-update">{hasPermission('project_update').toString()}</div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('has-project-read')).toHaveTextContent('true')
      })

      expect(screen.getByTestId('has-project-update')).toHaveTextContent('true')
    })

    it('should return false for permissions user does not have', async () => {
      const TestComponent = () => {
        const { hasPermission, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div data-testid="has-admin">{hasPermission('user_manage').toString()}</div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('has-admin')).toHaveTextContent('false')
      })
    })

    it('should support checking multiple permissions with OR logic', async () => {
      const TestComponent = () => {
        const { hasPermission, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div>
            <div data-testid="has-any-valid">
              {hasPermission(['project_read', 'user_manage']).toString()}
            </div>
            <div data-testid="has-any-invalid">
              {hasPermission(['user_manage', 'admin_read']).toString()}
            </div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('has-any-valid')).toHaveTextContent('true')
      })

      expect(screen.getByTestId('has-any-invalid')).toHaveTextContent('false')
    })
  })

  describe('hasRole method', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      const mockRoleData = [
        {
          role_id: 'role-1',
          roles: {
            id: 'role-1',
            name: 'project_manager',
            permissions: ['project_read', 'project_update']
          }
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockRoleData,
            error: null
          })
        })
      } as any)

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)
    })

    it('should return true for roles user has', async () => {
      const TestComponent = () => {
        const { hasRole, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div data-testid="has-role">{hasRole('project_manager').toString()}</div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('has-role')).toHaveTextContent('true')
      })
    })

    it('should return false for roles user does not have', async () => {
      const TestComponent = () => {
        const { hasRole, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div data-testid="has-role">{hasRole('admin').toString()}</div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('has-role')).toHaveTextContent('false')
      })
    })

    it('should support checking multiple roles with OR logic', async () => {
      const TestComponent = () => {
        const { hasRole, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div>
            <div data-testid="has-any-valid">
              {hasRole(['project_manager', 'admin']).toString()}
            </div>
            <div data-testid="has-any-invalid">
              {hasRole(['admin', 'viewer']).toString()}
            </div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('has-any-valid')).toHaveTextContent('true')
      })

      expect(screen.getByTestId('has-any-invalid')).toHaveTextContent('false')
    })
  })

  describe('Real-time updates', () => {
    it('should set up real-time subscription for role changes', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      } as any)

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)

      const TestComponent = () => {
        const { loading } = useEnhancedAuth()
        return <div>{loading ? 'Loading' : 'Loaded'}</div>
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(mockSupabase.channel).toHaveBeenCalledWith('user_roles:user-123')
      })

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: 'user_id=eq.user-123'
        }),
        expect.any(Function)
      )

      expect(mockChannel.subscribe).toHaveBeenCalled()
    })

    it('should refresh permissions when role changes are detected', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      let callCount = 0
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: callCount++ === 0 
              ? [] // First call: no roles
              : [{ // Second call: admin role added
                  role_id: 'role-1',
                  roles: {
                    id: 'role-1',
                    name: 'admin',
                    permissions: ['user_manage']
                  }
                }],
            error: null
          })
        })
      } as any))

      let changeCallback: Function | null = null
      const mockChannel = {
        on: jest.fn().mockImplementation((event, config, callback) => {
          changeCallback = callback
          return mockChannel
        }),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)

      const TestComponent = () => {
        const { userRoles, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div data-testid="roles">{userRoles.length === 0 ? 'No roles' : userRoles.join(', ')}</div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('roles')).toHaveTextContent('No roles')
      })

      // Simulate role change
      act(() => {
        if (changeCallback) {
          changeCallback({ eventType: 'INSERT' })
        }
      })

      // Wait for refresh
      await waitFor(() => {
        expect(screen.getByTestId('roles')).toHaveTextContent('admin')
      })
    })
  })

  describe('Permission caching', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      const mockRoleData = [
        {
          role_id: 'role-1',
          roles: {
            id: 'role-1',
            name: 'project_manager',
            permissions: ['project_read']
          }
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockRoleData,
            error: null
          })
        })
      } as any)

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)
    })

    it('should cache permission check results', async () => {
      let checkCount = 0
      
      const TestComponent = () => {
        const { hasPermission, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        // Call hasPermission multiple times with same permission
        const result1 = hasPermission('project_read')
        const result2 = hasPermission('project_read')
        const result3 = hasPermission('project_read')
        
        checkCount = result1 && result2 && result3 ? 3 : 0
        
        return (
          <div data-testid="check-count">{checkCount}</div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('check-count')).toHaveTextContent('3')
      })

      // The permission check should be cached, so all three calls should return the same result
      expect(checkCount).toBe(3)
    })
  })

  describe('Convenience hooks', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      const mockRoleData = [
        {
          role_id: 'role-1',
          roles: {
            id: 'role-1',
            name: 'project_manager',
            permissions: ['project_read', 'project_update']
          }
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockRoleData,
            error: null
          })
        })
      } as any)

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)
    })

    it('usePermissions hook should provide permission functionality', async () => {
      const TestComponent = () => {
        const { hasPermission, permissions, loading } = usePermissions()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div>
            <div data-testid="permissions">{permissions.join(', ')}</div>
            <div data-testid="has-permission">{hasPermission('project_read').toString()}</div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('permissions')).toHaveTextContent('project_read')
      })

      expect(screen.getByTestId('has-permission')).toHaveTextContent('true')
    })

    it('useRoles hook should provide role functionality', async () => {
      const TestComponent = () => {
        const { hasRole, roles, loading } = useRoles()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div>
            <div data-testid="roles">{roles.join(', ')}</div>
            <div data-testid="has-role">{hasRole('project_manager').toString()}</div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('roles')).toHaveTextContent('project_manager')
      })

      expect(screen.getByTestId('has-role')).toHaveTextContent('true')
    })
  })

  describe('Permission context sharing', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      const mockRoleData = [
        {
          role_id: 'role-1',
          roles: {
            id: 'role-1',
            name: 'project_manager',
            permissions: ['project_read', 'project_update', 'resource_read']
          }
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockRoleData,
            error: null
          })
        })
      } as any)

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)
    })

    it('should preload permissions for a specific context', async () => {
      const TestComponent = () => {
        const { preloadPermissionsForContext, hasPermission, loading } = useEnhancedAuth()
        const [preloaded, setPreloaded] = React.useState(false)
        
        React.useEffect(() => {
          if (!loading && !preloaded) {
            preloadPermissionsForContext({ project_id: 'project-123' }).then(() => {
              setPreloaded(true)
            })
          }
        }, [loading, preloaded, preloadPermissionsForContext])
        
        if (loading || !preloaded) return <div>Loading...</div>
        
        return (
          <div>
            <div data-testid="preloaded">true</div>
            <div data-testid="has-permission">
              {hasPermission('project_read', { project_id: 'project-123' }).toString()}
            </div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('preloaded')).toHaveTextContent('true')
      })

      expect(screen.getByTestId('has-permission')).toHaveTextContent('true')
    })

    it('should share permission context across multiple components', async () => {
      const Component1 = () => {
        const { preloadPermissionsForContext, loading } = useEnhancedAuth()
        
        React.useEffect(() => {
          if (!loading) {
            preloadPermissionsForContext({ project_id: 'project-456' })
          }
        }, [loading, preloadPermissionsForContext])
        
        return <div data-testid="component1">Component 1</div>
      }

      const Component2 = () => {
        const { hasPermission, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        // This should use the cached permission from Component1
        const hasProjectRead = hasPermission('project_read', { project_id: 'project-456' })
        
        return (
          <div data-testid="component2">
            {hasProjectRead ? 'Has permission' : 'No permission'}
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <Component1 />
          <Component2 />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('component2')).toHaveTextContent('Has permission')
      })
    })
  })

  describe('Enhanced error handling', () => {
    it('should handle subscription errors gracefully', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      } as any)

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback) => {
          // Simulate subscription error
          callback('CHANNEL_ERROR', new Error('Connection failed'))
        })
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)

      const TestComponent = () => {
        const { error, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div>
            <div data-testid="error">{error ? error.message : 'No error'}</div>
          </div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to subscribe to role changes')
      })
    })

    it('should handle refresh errors during role changes', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-123' } } as any,
        user: { id: 'user-123' } as any,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      let callCount = 0
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: callCount++ === 0 
              ? [] // First call: success
              : null, // Second call: error
            error: callCount > 1 ? { message: 'Database error' } : null
          })
        })
      } as any))

      let changeCallback: Function | null = null
      const mockChannel = {
        on: jest.fn().mockImplementation((event, config, callback) => {
          changeCallback = callback
          return mockChannel
        }),
        subscribe: jest.fn()
      }
      mockSupabase.channel.mockReturnValue(mockChannel as any)

      const TestComponent = () => {
        const { error, loading } = useEnhancedAuth()
        
        if (loading) return <div>Loading...</div>
        
        return (
          <div data-testid="error">{error ? error.message : 'No error'}</div>
        )
      }

      render(
        <EnhancedAuthProvider>
          <TestComponent />
        </EnhancedAuthProvider>
      )

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('No error')
      })

      // Simulate role change that causes error
      await act(async () => {
        if (changeCallback) {
          await changeCallback({ eventType: 'INSERT' })
        }
      })

      // Wait for error to be set
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch user roles')
      })
    })
  })
})
