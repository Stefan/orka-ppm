/**
 * Pure RBAC permission-check helpers (no fetch).
 * Used by usePermissions and tests; critical path for auth.
 */
import type { Permission } from '@/types/rbac'

/**
 * Check if a list of effective permissions includes the required permission(s).
 * OR logic: returns true if the user has any of the given permissions.
 */
export function hasPermissionInList(
  effectivePermissions: Permission[],
  required: Permission | Permission[]
): boolean {
  if (!effectivePermissions?.length) return false
  const list = Array.isArray(required) ? required : [required]
  if (list.length === 0) return false
  return list.some(p => effectivePermissions.includes(p))
}

/**
 * Check if a list of role names includes the required role(s).
 * OR logic: returns true if the user has any of the given roles.
 */
export function hasRoleInList(
  userRoleNames: string[],
  required: string | string[]
): boolean {
  if (!userRoleNames?.length) return false
  const list = Array.isArray(required) ? required : [required]
  if (list.length === 0) return false
  return list.some(r => userRoleNames.includes(r))
}
