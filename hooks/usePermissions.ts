'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { hasPermissionInList, hasRoleInList } from '@/lib/rbac/permission-utils'
import type { Permission, PermissionContext, UserPermissions } from '@/types/rbac'

/**
 * Return type for the usePermissions hook
 * 
 * Requirements: 3.5 - Hook-based API for flexible integration
 */
export interface UsePermissionsReturn {
  /**
   * Check if the current user has a specific permission or any of multiple permissions.
   * Supports context-aware permission checking.
   * 
   * @param permission - Single permission or array of permissions (OR logic)
   * @param context - Optional context for scoped permission checking
   * @returns true if user has the permission(s), false otherwise
   */
  hasPermission: (permission: Permission | Permission[], context?: PermissionContext) => boolean

  /**
   * Check if the current user has a specific role or any of multiple roles.
   * 
   * @param role - Single role name or array of role names (OR logic)
   * @returns true if user has the role(s), false otherwise
   */
  hasRole: (role: string | string[]) => boolean

  /**
   * List of all permissions the user has (global permissions)
   */
  permissions: Permission[]

  /**
   * List of all roles assigned to the user
   */
  userRoles: string[]

  /**
   * Loading state - true while permissions are being fetched
   */
  loading: boolean

  /**
   * Error state - contains error if permission fetch failed
   */
  error: Error | null

  /**
   * Manually refresh permissions from the backend.
   * Useful when you know roles have changed and need to update immediately.
   * 
   * Requirements: 3.2 - Real-time permission updates when user roles change
   */
  refetch: () => Promise<void>
}

/**
 * Permission cache entry
 */
interface PermissionCacheEntry {
  result: boolean
  timestamp: number
}

/**
 * Permission cache for performance optimization
 * Requirements: 3.2 - Permission caching and optimization for performance
 */
class PermissionCache {
  private cache: Map<string, PermissionCacheEntry> = new Map()
  private readonly TTL = 60000 // 1 minute cache TTL

  /**
   * Generate cache key from permission and context
   */
  private getCacheKey(permission: Permission, context?: PermissionContext): string {
    const contextStr = context ? JSON.stringify(context) : 'global'
    return `${permission}:${contextStr}`
  }

  /**
   * Get cached permission result if available and not expired
   */
  get(permission: Permission, context?: PermissionContext): boolean | null {
    const key = this.getCacheKey(permission, context)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key)
      return null
    }

    return entry.result
  }

  /**
   * Set permission result in cache
   */
  set(permission: Permission, result: boolean, context?: PermissionContext): void {
    const key = this.getCacheKey(permission, context)
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    })
  }

  /**
   * Clear all cached permissions
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear cached permissions for a specific context
   */
  clearContext(context: PermissionContext): void {
    const contextStr = JSON.stringify(context)
    for (const [key] of this.cache) {
      if (key.includes(contextStr)) {
        this.cache.delete(key)
      }
    }
  }
}

/**
 * usePermissions Hook
 * 
 * React hook for checking user permissions in component logic.
 * Provides real-time permission updates, caching, and performance optimization.
 * 
 * Features:
 * - Permission checking with context awareness
 * - Role checking
 * - Permission caching for performance
 * - Real-time updates when roles change
 * - Manual refresh capability
 * 
 * Requirements:
 * - 3.2: Real-time permission updates when user roles change
 * - 3.5: Hook-based API for flexible integration
 * 
 * @example
 * // Basic usage
 * const { hasPermission, loading } = usePermissions()
 * 
 * if (loading) return <Spinner />
 * 
 * if (hasPermission('project_update')) {
 *   return <EditButton />
 * }
 * 
 * @example
 * // Context-aware permission checking
 * const { hasPermission } = usePermissions()
 * const canEdit = hasPermission('project_update', { project_id: projectId })
 * 
 * @example
 * // Multiple permissions (OR logic)
 * const { hasPermission } = usePermissions()
 * const canView = hasPermission(['project_read', 'portfolio_read'])
 * 
 * @example
 * // Role checking
 * const { hasRole } = usePermissions()
 * const isAdmin = hasRole('admin')
 * const isManager = hasRole(['portfolio_manager', 'project_manager'])
 * 
 * @example
 * // Manual refresh
 * const { refetch } = usePermissions()
 * 
 * const handleRoleChange = async () => {
 *   await updateUserRole()
 *   await refetch() // Refresh permissions immediately
 * }
 */
export function usePermissions(): UsePermissionsReturn {
  const { session, user, loading: authLoading } = useAuth()
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  
  // Use ref to maintain cache across re-renders
  const cacheRef = useRef<PermissionCache>(new PermissionCache())
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef<boolean>(true)

  /**
   * Fetch user permissions from the backend
   */
  const fetchPermissions = useCallback(async () => {
    // If no user is authenticated, clear permissions
    if (!user || !session) {
      if (isMountedRef.current) {
        setUserPermissions(null)
        setLoading(false)
        setError(null)
        cacheRef.current.clear()
      }
      return
    }

    try {
      if (isMountedRef.current) {
        setLoading(true)
        setError(null)
      }

      const response = await fetch(`/api/rbac/user-permissions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch permissions: ${response.status}`)
      }

      const data: UserPermissions = await response.json()

      if (isMountedRef.current) {
        setUserPermissions(data)
        // Clear cache when permissions are refreshed
        cacheRef.current.clear()
      }
    } catch (err) {
      console.error('Error fetching user permissions:', err)
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setUserPermissions(null)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [user, session])

  /**
   * Fetch permissions on mount and when user/session changes
   */
  useEffect(() => {
    isMountedRef.current = true

    if (!authLoading) {
      fetchPermissions()
    }

    return () => {
      isMountedRef.current = false
    }
  }, [authLoading, fetchPermissions])

  /**
   * Check if user has a specific permission
   * Uses caching for performance optimization
   */
  const checkSinglePermission = useCallback(
    async (permission: Permission, context?: PermissionContext): Promise<boolean> => {
      // If no user or permissions loaded, deny access
      if (!user || !session || !userPermissions) {
        return false
      }

      // Check cache first
      const cached = cacheRef.current.get(permission, context)
      if (cached !== null) {
        return cached
      }

      // If no context, check global permissions
      if (!context) {
        const hasGlobalPermission = userPermissions.effective_permissions.includes(permission)
        cacheRef.current.set(permission, hasGlobalPermission)
        return hasGlobalPermission
      }

      // For context-aware checks, make API call
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const contextParam = `&context=${encodeURIComponent(JSON.stringify(context))}`
        
        const response = await fetch(
          `${apiUrl}/api/rbac/check-permission?permission=${encodeURIComponent(permission)}${contextParam}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          console.warn(`Permission check failed for ${permission}:`, response.status)
          return false
        }

        const data = await response.json()
        const result = data.has_permission === true

        // Cache the result
        cacheRef.current.set(permission, result, context)
        return result
      } catch (err) {
        console.error(`Error checking permission ${permission}:`, err)
        return false
      }
    },
    [user, session, userPermissions]
  )

  /**
   * Check if user has permission(s)
   * Synchronous function that uses cached data
   */
  const hasPermission = useCallback(
    (permission: Permission | Permission[], context?: PermissionContext): boolean => {
      // If no user or permissions loaded, deny access
      if (!user || !userPermissions) {
        return false
      }

      // Normalize to array
      const permissions = Array.isArray(permission) ? permission : [permission]

      // For global permissions (no context), check against loaded permissions
      if (!context) {
        return hasPermissionInList(userPermissions.effective_permissions, permission)
      }

      // For context-aware permissions, check cache
      // Note: This is synchronous and relies on cache. For uncached context permissions,
      // components should use PermissionGuard which handles async checking.
      return permissions.some(perm => {
        const cached = cacheRef.current.get(perm, context)
        return cached === true
      })
    },
    [user, userPermissions]
  )

  /**
   * Check if user has role(s)
   */
  const hasRole = useCallback(
    (role: string | string[]): boolean => {
      if (!userPermissions?.roles?.length) {
        return false
      }
      const userRoleNames = userPermissions.roles.map(r => r.name)
      return hasRoleInList(userRoleNames, role)
    },
    [userPermissions]
  )

  /**
   * Manual refresh function
   */
  const refetch = useCallback(async () => {
    await fetchPermissions()
  }, [fetchPermissions])

  return {
    hasPermission,
    hasRole,
    permissions: userPermissions?.effective_permissions || [],
    userRoles: userPermissions?.roles?.map(r => r.name) || [],
    loading: loading || authLoading,
    error,
    refetch,
  }
}

export default usePermissions
