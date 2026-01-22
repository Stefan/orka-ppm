'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from './SupabaseAuthProvider'
import { supabase } from '../../lib/api/supabase-minimal'
import type { Permission, PermissionContext, UserRole } from '@/types/rbac'

/**
 * Enhanced Auth Context Type
 * 
 * Extends the base auth context with role and permission information.
 * 
 * Requirements: 2.1, 2.4 - Auth integration with role and permission information
 */
interface EnhancedAuthContextType {
  userRoles: string[]
  userPermissions: Permission[]
  hasPermission: (permission: Permission | Permission[], context?: PermissionContext) => boolean
  hasRole: (role: string | string[]) => boolean
  refreshPermissions: () => Promise<void>
  preloadPermissionsForContext: (context: PermissionContext) => Promise<void>
  loading: boolean
  error: Error | null
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType>({
  userRoles: [],
  userPermissions: [],
  hasPermission: () => false,
  hasRole: () => false,
  refreshPermissions: async () => {},
  preloadPermissionsForContext: async () => {},
  loading: true,
  error: null,
})

/**
 * Permission Cache
 * 
 * In-memory cache for permission check results to minimize redundant checks.
 * Cache entries expire after 5 minutes.
 * 
 * Requirements: 2.4 - Role information caching for performance optimization
 */
interface PermissionCacheEntry {
  result: boolean
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

class PermissionCache {
  private cache: Map<string, PermissionCacheEntry> = new Map()

  private getCacheKey(permission: Permission, context?: PermissionContext): string {
    const contextStr = context 
      ? `${context.project_id || ''}_${context.portfolio_id || ''}_${context.resource_id || ''}_${context.organization_id || ''}`
      : 'global'
    return `${permission}_${contextStr}`
  }

  get(permission: Permission, context?: PermissionContext): boolean | null {
    const key = this.getCacheKey(permission, context)
    const entry = this.cache.get(key)
    
    if (!entry) return null
    
    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(key)
      return null
    }
    
    return entry.result
  }

  set(permission: Permission, result: boolean, context?: PermissionContext): void {
    const key = this.getCacheKey(permission, context)
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    })
  }

  clear(): void {
    this.cache.clear()
  }
}

/**
 * EnhancedAuthProvider Component
 * 
 * Extends the existing SupabaseAuthProvider with role and permission information.
 * Provides real-time role and permission loading, caching, and helper methods.
 * 
 * Requirements: 2.1, 2.4 - Auth integration with role and permission information
 */
export function EnhancedAuthProvider({ children }: { children: React.ReactNode }) {
  const { session, user, loading: authLoading } = useAuth()
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [userPermissions, setUserPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const permissionCache = useMemo(() => new PermissionCache(), [])

  /**
   * Fetch user roles and permissions from the database
   * 
   * Requirements: 2.1 - Retrieve role assignments from user_roles table
   */
  const fetchUserRolesAndPermissions = useCallback(async (userId: string) => {
    try {
      setLoading(true)
      setError(null)

      // Fetch user role assignments with role details
      const { data: roleAssignments, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles (
            id,
            name,
            permissions
          )
        `)
        .eq('user_id', userId)

      if (rolesError) {
        throw new Error(`Failed to fetch user roles: ${rolesError.message}`)
      }

      if (!roleAssignments || roleAssignments.length === 0) {
        // No roles assigned, set to empty arrays
        setUserRoles([])
        setUserPermissions([])
        permissionCache.clear()
        return
      }

      // Extract role names and aggregate permissions
      const roles: string[] = []
      const permissionsSet = new Set<Permission>()

      for (const assignment of roleAssignments) {
        const roleData = assignment.roles as any
        if (roleData) {
          roles.push(roleData.name)
          
          // Add all permissions from this role
          if (Array.isArray(roleData.permissions)) {
            roleData.permissions.forEach((perm: string) => {
              permissionsSet.add(perm as Permission)
            })
          }
        }
      }

      setUserRoles(roles)
      setUserPermissions(Array.from(permissionsSet))
      
      // Clear permission cache when roles/permissions change
      permissionCache.clear()

    } catch (err) {
      console.error('Error fetching user roles and permissions:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setUserRoles([])
      setUserPermissions([])
    } finally {
      setLoading(false)
    }
  }, [permissionCache])

  /**
   * Refresh permissions manually
   * 
   * Allows components to manually trigger a permission refresh, useful after
   * role assignments are changed or when permissions need to be re-validated.
   * 
   * Requirements: 2.2 - Update user's session to reflect new permissions
   */
  const refreshPermissions = useCallback(async () => {
    if (!user?.id) {
      console.warn('Cannot refresh permissions: no user logged in')
      return
    }
    
    console.log('Manually refreshing permissions for user:', user.id)
    await fetchUserRolesAndPermissions(user.id)
  }, [user?.id, fetchUserRolesAndPermissions])

  /**
   * Preload permissions for a specific context
   * 
   * This method allows components to preload and cache permissions for a specific
   * context (e.g., a project or portfolio). This is useful for optimizing permission
   * checks in components that need to check multiple permissions for the same context.
   * 
   * Requirements: 2.2 - Permission context sharing across components
   */
  const preloadPermissionsForContext = useCallback(async (context: PermissionContext) => {
    if (!user?.id) {
      console.warn('Cannot preload permissions: no user logged in')
      return
    }

    console.log('Preloading permissions for context:', context)
    
    // For now, we cache all user permissions for the given context
    // In a more advanced implementation, this could fetch context-specific
    // permissions from the backend
    userPermissions.forEach(permission => {
      permissionCache.set(permission, true, context)
    })
    
    console.log(`Preloaded ${userPermissions.length} permissions for context`)
  }, [user?.id, userPermissions, permissionCache])

  /**
   * Check if user has a specific permission or any of multiple permissions
   * 
   * Supports both single permission and array of permissions (OR logic).
   * Optionally supports context-aware permission checking.
   * 
   * Requirements: 2.1, 2.4 - Permission checking with caching
   */
  const hasPermission = useCallback((
    permission: Permission | Permission[],
    context?: PermissionContext
  ): boolean => {
    // Handle array of permissions (OR logic)
    if (Array.isArray(permission)) {
      return permission.some(perm => hasPermission(perm, context))
    }

    // Check cache first
    const cachedResult = permissionCache.get(permission, context)
    if (cachedResult !== null) {
      return cachedResult
    }

    // Check if user has the permission
    const result = userPermissions.includes(permission)

    // Cache the result
    permissionCache.set(permission, result, context)

    return result
  }, [userPermissions, permissionCache])

  /**
   * Check if user has a specific role or any of multiple roles
   * 
   * Supports both single role and array of roles (OR logic).
   * 
   * Requirements: 2.1 - Role checking
   */
  const hasRole = useCallback((role: string | string[]): boolean => {
    if (Array.isArray(role)) {
      return role.some(r => userRoles.includes(r))
    }
    return userRoles.includes(role)
  }, [userRoles])

  /**
   * Effect: Load roles and permissions when user changes
   * 
   * Requirements: 2.1 - Retrieve role assignments on authentication
   */
  useEffect(() => {
    if (user?.id && !authLoading) {
      fetchUserRolesAndPermissions(user.id)
    } else if (!user && !authLoading) {
      // User logged out, clear roles and permissions
      setUserRoles([])
      setUserPermissions([])
      permissionCache.clear()
      setLoading(false)
    }
  }, [user?.id, authLoading, fetchUserRolesAndPermissions, permissionCache])

  /**
   * Effect: Set up real-time subscription for role changes
   * 
   * Requirements: 2.2 - Update user's session to reflect new permissions
   */
  useEffect(() => {
    if (!user?.id) return

    // Subscribe to changes in user_roles table for this user
    const channel = supabase
      .channel(`user_roles:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('User roles changed, refreshing permissions:', payload)
          try {
            await refreshPermissions()
            console.log('Permissions refreshed successfully after role change')
          } catch (error) {
            console.error('Failed to refresh permissions after role change:', error)
            // Set error state so UI can show notification
            setError(error instanceof Error ? error : new Error('Failed to refresh permissions'))
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to role changes for user:', user.id)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to role changes:', err)
          setError(new Error('Failed to subscribe to role changes'))
        } else if (status === 'TIMED_OUT') {
          console.error('Subscription to role changes timed out')
          setError(new Error('Role change subscription timed out'))
        }
      })

    return () => {
      console.log('Unsubscribing from role changes for user:', user.id)
      supabase.removeChannel(channel)
    }
  }, [user?.id, refreshPermissions])

  const value: EnhancedAuthContextType = {
    userRoles,
    userPermissions,
    hasPermission,
    hasRole,
    refreshPermissions,
    preloadPermissionsForContext,
    loading: authLoading || loading,
    error,
  }

  return (
    <EnhancedAuthContext.Provider value={value}>
      {children}
    </EnhancedAuthContext.Provider>
  )
}

/**
 * Hook to access enhanced auth context
 * 
 * Must be used within an EnhancedAuthProvider.
 */
export const useEnhancedAuth = () => {
  const context = useContext(EnhancedAuthContext)
  if (context === undefined) {
    throw new Error('useEnhancedAuth must be used within an EnhancedAuthProvider')
  }
  return context
}

/**
 * Hook for permission checking (convenience hook)
 * 
 * Provides just the permission-related functionality from enhanced auth.
 */
export const usePermissions = () => {
  const { hasPermission, userPermissions, loading, refreshPermissions } = useEnhancedAuth()
  return {
    hasPermission,
    permissions: userPermissions,
    loading,
    refetch: refreshPermissions
  }
}

/**
 * Hook for role checking (convenience hook)
 * 
 * Provides just the role-related functionality from enhanced auth.
 */
export const useRoles = () => {
  const { hasRole, userRoles, loading } = useEnhancedAuth()
  return {
    hasRole,
    roles: userRoles,
    loading
  }
}
