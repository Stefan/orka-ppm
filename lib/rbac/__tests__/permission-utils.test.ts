/**
 * Unit tests for lib/rbac/permission-utils.ts
 * Critical: RBAC permission and role checks (no fetch).
 */
import { hasPermissionInList, hasRoleInList } from '../permission-utils'
import type { Permission } from '@/types/rbac'

describe('hasPermissionInList', () => {
  const perms: Permission[] = ['project_read', 'project_update', 'resource_read']

  it('returns true when user has the single required permission', () => {
    expect(hasPermissionInList(perms, 'project_read')).toBe(true)
    expect(hasPermissionInList(perms, 'project_update')).toBe(true)
  })

  it('returns false when user lacks the required permission', () => {
    expect(hasPermissionInList(perms, 'project_delete')).toBe(false)
    expect(hasPermissionInList(perms, 'admin_read')).toBe(false)
  })

  it('uses OR logic for array: true if user has any', () => {
    expect(hasPermissionInList(perms, ['project_read', 'admin_read'])).toBe(true)
    expect(hasPermissionInList(perms, ['admin_read', 'resource_read'])).toBe(true)
    expect(hasPermissionInList(perms, ['admin_read', 'system_admin'])).toBe(false)
  })

  it('returns false for empty effective permissions', () => {
    expect(hasPermissionInList([], 'project_read')).toBe(false)
    expect(hasPermissionInList([], ['project_read'])).toBe(false)
  })

  it('returns false for empty required array', () => {
    expect(hasPermissionInList(perms, [])).toBe(false)
  })
})

describe('hasRoleInList', () => {
  const roles = ['project_manager', 'viewer']

  it('returns true when user has the single required role', () => {
    expect(hasRoleInList(roles, 'project_manager')).toBe(true)
    expect(hasRoleInList(roles, 'viewer')).toBe(true)
  })

  it('returns false when user lacks the required role', () => {
    expect(hasRoleInList(roles, 'admin')).toBe(false)
  })

  it('uses OR logic for array: true if user has any', () => {
    expect(hasRoleInList(roles, ['admin', 'project_manager'])).toBe(true)
    expect(hasRoleInList(roles, ['admin', 'portfolio_manager'])).toBe(false)
  })

  it('returns false for empty user roles', () => {
    expect(hasRoleInList([], 'admin')).toBe(false)
  })

  it('returns false for empty required array', () => {
    expect(hasRoleInList(roles, [])).toBe(false)
  })
})
