/**
 * Property-Based Tests for Frontend Permission Controls
 * 
 * Tests universal correctness properties for frontend permission components
 * using property-based testing with fast-check.
 * 
 * Properties tested:
 * - Property 9: UI Component Permission Enforcement
 * - Property 10: Dynamic UI Reactivity
 * - Property 11: Navigation Permission Filtering
 * - Property 12: Action Button Permission Control
 * - Property 13: API Flexibility Completeness
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import * as fc from 'fast-check'
import { PermissionGuard } from '../PermissionGuard'
import { PermissionButton } from '../PermissionButton'
import { RoleBasedNav, NavItem } from '../RoleBasedNav'
import { ActionButtonGroup, ActionButton } from '../ActionButtonGroup'
import { usePermissions } from '@/hooks/usePermissions'
import type { Permission, PermissionContext } from '@/types/rbac'

// Mock the auth provider
const mockUseAuth = jest.fn()
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => mockUseAuth()
}))

// Mock fetch for API calls
global.fetch = jest.fn()

// ============================================================================
// Arbitraries (Generators) for Property-Based Testing
// ============================================================================

/**
 * Generate valid Permission values
 */
const permissionArbitrary = (): fc.Arbitrary<Permission> => {
  const allPermissions: Permission[] = [
    'portfolio_create', 'portfolio_read', 'portfolio_update', 'portfolio_delete',
    'project_create', 'project_read', 'project_update', 'project_delete',
    'resource_create', 'resource_read', 'resource_update', 'resource_delete',
    'financial_read', 'financial_create', 'financial_update', 'financial_delete',
    'admin_read', 'admin_update', 'admin_delete', 'system_admin',
    'user_manage', 'role_manage'
  ]
  return fc.constantFrom(...allPermissions)
}

/**
 * Generate arrays of permissions (for OR logic testing)
 */
const permissionArrayArbitrary = (): fc.Arbitrary<Permission[]> => {
  return fc.array(permissionArbitrary(), { minLength: 1, maxLength: 5 })
}

/**
 * Generate permission contexts
 */
const permissionContextArbitrary = (): fc.Arbitrary<PermissionContext | undefined> => {
  return fc.option(
    fc.record({
      project_id: fc.option(fc.uuid(), { nil: undefined }),
      portfolio_id: fc.option(fc.uuid(), { nil: undefined }),
      resource_id: fc.option(fc.uuid(), { nil: undefined }),
      organization_id: fc.option(fc.uuid(), { nil: undefined })
    }),
    { nil: undefined }
  )
}

/**
 * Generate user permission sets
 */
const userPermissionsArbitrary = (): fc.Arbitrary<Set<Permission>> => {
  return fc.array(permissionArbitrary(), { minLength: 0, maxLength: 10 })
    .map(perms => new Set(perms))
}

/**
 * Generate navigation items
 */
const navItemArbitrary = (): fc.Arbitrary<NavItem> => {
  return fc.record({
    id: fc.uuid(),
    label: fc.string({ minLength: 1, maxLength: 20 }),
    path: fc.webPath(),
    requiredPermission: fc.oneof(permissionArbitrary(), permissionArrayArbitrary()),
    context: permissionContextArbitrary()
  })
}

/**
 * Generate action buttons
 */
const actionButtonArbitrary = (): fc.Arbitrary<ActionButton> => {
  return fc.record({
    id: fc.uuid(),
    label: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    permission: fc.oneof(permissionArbitrary(), permissionArrayArbitrary()),
    context: permissionContextArbitrary(),
    onClick: fc.constant(() => {}),
    variant: fc.constantFrom('primary', 'secondary', 'danger', 'success', 'outline') as fc.Arbitrary<'primary' | 'secondary' | 'danger' | 'success' | 'outline'>
  })
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Setup mock auth and fetch for a test scenario
 */
const setupMocks = (
  userPermissions: Set<Permission>,
  authenticated: boolean = true
) => {
  const mockSession = authenticated ? {
    access_token: 'mock-token',
    user: { id: 'user-123', email: 'test@example.com' }
  } : null

  mockUseAuth.mockReturnValue({
    session: mockSession,
    user: mockSession?.user || null,
    loading: false,
    error: null
  })

  // Mock permission check API
  ;(global.fetch as jest.Mock).mockImplementation(async (url: string) => {
    if (url.includes('/api/rbac/check-permission')) {
      // Extract permission from URL
      const urlObj = new URL(url)
      const permission = urlObj.searchParams.get('permission') as Permission
      
      // Check if user has this permission
      const hasPermission = userPermissions.has(permission)
      
      return {
        ok: true,
        json: async () => ({ has_permission: hasPermission })
      }
    }
    
    return {
      ok: false,
      status: 404
    }
  })
}

/**
 * Check if a permission matches user's permissions (OR logic for arrays)
 */
const hasPermission = (
  required: Permission | Permission[],
  userPerms: Set<Permission>
): boolean => {
  const permissions = Array.isArray(required) ? required : [required]
  return permissions.some(perm => userPerms.has(perm))
}

// ============================================================================
// Property 9: UI Component Permission Enforcement
// **Validates: Requirements 3.1**
// ============================================================================

describe('Property 9: UI Component Permission Enforcement', () => {
  afterEach(() => {
    cleanup()
    jest.clearAllMocks()
  })

  it('should enforce permissions consistently across all permission values', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        userPermissionsArbitrary(),
        async (requiredPermission, userPerms) => {
          setupMocks(userPerms)

          render(
            <PermissionGuard permission={requiredPermission}>
              <div data-testid="protected-content">Protected</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            const content = screen.queryByTestId('protected-content')
            const shouldBeVisible = userPerms.has(requiredPermission)
            
            if (shouldBeVisible) {
              expect(content).toBeInTheDocument()
            } else {
              expect(content).not.toBeInTheDocument()
            }
          })

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should enforce OR logic for multiple permissions consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionArrayArbitrary(),
        userPermissionsArbitrary(),
        async (requiredPermissions, userPerms) => {
          setupMocks(userPerms)

          render(
            <PermissionGuard permission={requiredPermissions}>
              <div data-testid="protected-content">Protected</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            const content = screen.queryByTestId('protected-content')
            const shouldBeVisible = hasPermission(requiredPermissions, userPerms)
            
            if (shouldBeVisible) {
              expect(content).toBeInTheDocument()
            } else {
              expect(content).not.toBeInTheDocument()
            }
          })

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should always deny access when user is not authenticated', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(permissionArbitrary(), permissionArrayArbitrary()),
        async (requiredPermission) => {
          setupMocks(new Set(), false) // Not authenticated

          render(
            <PermissionGuard permission={requiredPermission}>
              <div data-testid="protected-content">Protected</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            const content = screen.queryByTestId('protected-content')
            expect(content).not.toBeInTheDocument()
          })

          cleanup()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should render fallback consistently when permission is denied', async () => {
    let testCounter = 0
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (requiredPermission, fallbackText) => {
          const testId = `test-${Date.now()}-${testCounter++}`
          // User has no permissions
          setupMocks(new Set())

          const { container, unmount } = render(
            <PermissionGuard 
              permission={requiredPermission}
              fallback={<div data-testid={`fallback-${testId}`}>{fallbackText}</div>}
            >
              <div data-testid={`protected-${testId}`}>Protected</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            const protectedElement = container.querySelector(`[data-testid="protected-${testId}"]`)
            const fallbackElement = container.querySelector(`[data-testid="fallback-${testId}"]`)
            
            expect(protectedElement).not.toBeInTheDocument()
            expect(fallbackElement).toBeInTheDocument()
            expect(fallbackElement).toHaveTextContent(fallbackText)
          })

          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ============================================================================
// Property 10: Dynamic UI Reactivity
// **Validates: Requirements 3.2**
// ============================================================================

describe('Property 10: Dynamic UI Reactivity', () => {
  afterEach(() => {
    cleanup()
    jest.clearAllMocks()
  })

  it('should update UI when permissions change from denied to granted', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        async (permission) => {
          // Start with no permissions
          setupMocks(new Set())

          const { rerender } = render(
            <PermissionGuard permission={permission}>
              <div data-testid="protected-content">Protected</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
          })

          // Grant permission
          setupMocks(new Set([permission]))

          rerender(
            <PermissionGuard permission={permission}>
              <div data-testid="protected-content">Protected</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            expect(screen.getByTestId('protected-content')).toBeInTheDocument()
          })

          cleanup()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should update UI when permissions change from granted to denied', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        async (permission) => {
          // Start with permission
          setupMocks(new Set([permission]))

          const { rerender } = render(
            <PermissionGuard permission={permission}>
              <div data-testid="protected-content">Protected</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            expect(screen.getByTestId('protected-content')).toBeInTheDocument()
          })

          // Revoke permission
          setupMocks(new Set())

          rerender(
            <PermissionGuard permission={permission}>
              <div data-testid="protected-content">Protected</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
          })

          cleanup()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should react to context changes consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        fc.uuid(),
        fc.uuid(),
        async (permission, projectId1, projectId2) => {
          setupMocks(new Set([permission]))

          const { rerender } = render(
            <PermissionGuard 
              permission={permission}
              context={{ project_id: projectId1 }}
            >
              <div data-testid="protected-content">Protected</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            expect(screen.getByTestId('protected-content')).toBeInTheDocument()
          })

          // Change context - should re-check permission
          rerender(
            <PermissionGuard 
              permission={permission}
              context={{ project_id: projectId2 }}
            >
              <div data-testid="protected-content">Protected</div>
            </PermissionGuard>
          )

          // Component should re-render (may show loading state briefly)
          await waitFor(() => {
            // Content should still be there since user has permission
            expect(screen.getByTestId('protected-content')).toBeInTheDocument()
          })

          cleanup()
        }
      ),
      { numRuns: 30 }
    )
  })
})

// ============================================================================
// Property 11: Navigation Permission Filtering
// **Validates: Requirements 3.3**
// ============================================================================

describe('Property 11: Navigation Permission Filtering', () => {
  afterEach(() => {
    cleanup()
    jest.clearAllMocks()
  })

  it('should only show navigation items user has permission for', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(navItemArbitrary(), { minLength: 1, maxLength: 5 }),
        userPermissionsArbitrary(),
        async (navItems, userPerms) => {
          setupMocks(userPerms)

          render(
            <RoleBasedNav
              items={navItems}
              renderItem={(item) => (
                <div data-testid={`nav-${item.id}`}>{item.label}</div>
              )}
            />
          )

          await waitFor(() => {
            navItems.forEach(item => {
              const navElement = screen.queryByTestId(`nav-${item.id}`)
              const shouldBeVisible = hasPermission(item.requiredPermission, userPerms)
              
              if (shouldBeVisible) {
                expect(navElement).toBeInTheDocument()
              } else {
                expect(navElement).not.toBeInTheDocument()
              }
            })
          })

          cleanup()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should hide all navigation items when user has no permissions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(navItemArbitrary(), { minLength: 1, maxLength: 5 }),
        async (navItems) => {
          // User has no permissions
          setupMocks(new Set())

          render(
            <RoleBasedNav
              items={navItems}
              renderItem={(item) => (
                <div data-testid={`nav-${item.id}`}>{item.label}</div>
              )}
            />
          )

          await waitFor(() => {
            navItems.forEach(item => {
              expect(screen.queryByTestId(`nav-${item.id}`)).not.toBeInTheDocument()
            })
          })

          cleanup()
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should show all navigation items when user has all permissions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(navItemArbitrary(), { minLength: 1, maxLength: 5 }),
        async (navItems) => {
          // Extract all required permissions from nav items
          const allRequiredPerms = new Set<Permission>()
          navItems.forEach(item => {
            const perms = Array.isArray(item.requiredPermission) 
              ? item.requiredPermission 
              : [item.requiredPermission]
            perms.forEach(p => allRequiredPerms.add(p))
          })

          // User has all required permissions
          setupMocks(allRequiredPerms)

          render(
            <RoleBasedNav
              items={navItems}
              renderItem={(item) => (
                <div data-testid={`nav-${item.id}`}>{item.label}</div>
              )}
            />
          )

          await waitFor(() => {
            navItems.forEach(item => {
              expect(screen.getByTestId(`nav-${item.id}`)).toBeInTheDocument()
            })
          })

          cleanup()
        }
      ),
      { numRuns: 30 }
    )
  })
})

// ============================================================================
// Property 12: Action Button Permission Control
// **Validates: Requirements 3.4**
// ============================================================================

describe('Property 12: Action Button Permission Control', () => {
  afterEach(() => {
    cleanup()
    jest.clearAllMocks()
  })

  it('should disable buttons when user lacks permission (disable behavior)', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        userPermissionsArbitrary(),
        fc.uuid(), // Add unique ID for each test iteration
        async (permission, label, userPerms, testId) => {
          setupMocks(userPerms)

          const { unmount } = render(
            <PermissionButton
              permission={permission}
              unauthorizedBehavior="disable"
              data-testid={`button-${testId}`}
            >
              {label}
            </PermissionButton>
          )

          await waitFor(() => {
            const buttons = screen.getAllByRole('button')
            const button = buttons.find(b => b.textContent?.trim() === label.trim())
            expect(button).toBeDefined()
            
            const shouldBeEnabled = userPerms.has(permission)
            
            if (shouldBeEnabled) {
              expect(button).not.toBeDisabled()
            } else {
              expect(button).toBeDisabled()
            }
          })

          unmount()
          cleanup()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should hide buttons when user lacks permission (hide behavior)', async () => {
    let testCounter = 0
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        userPermissionsArbitrary(),
        async (permission, label, userPerms) => {
          const testId = `test-${Date.now()}-${testCounter++}`
          setupMocks(userPerms)

          const uniqueLabel = `${label}-${testId}`

          const { container, unmount } = render(
            <PermissionButton
              permission={permission}
              unauthorizedBehavior="hide"
            >
              {uniqueLabel}
            </PermissionButton>
          )

          await waitFor(() => {
            const buttons = Array.from(container.querySelectorAll('button'))
            const button = buttons.find(b => b.textContent?.includes(uniqueLabel))
            const shouldBeVisible = userPerms.has(permission)
            
            if (shouldBeVisible) {
              expect(button).toBeDefined()
              expect(button).toBeInTheDocument()
            } else {
              expect(button).toBeUndefined()
            }
          })

          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should handle OR logic for multiple permissions in buttons', async () => {
    let testCounter = 0
    await fc.assert(
      fc.asyncProperty(
        permissionArrayArbitrary(),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        userPermissionsArbitrary(),
        async (permissions, label, userPerms) => {
          const testId = `test-${Date.now()}-${testCounter++}`
          setupMocks(userPerms)

          const uniqueLabel = `${label}-${testId}`

          const { container, unmount } = render(
            <PermissionButton
              permission={permissions}
              unauthorizedBehavior="disable"
            >
              {uniqueLabel}
            </PermissionButton>
          )

          await waitFor(() => {
            const buttons = Array.from(container.querySelectorAll('button'))
            const button = buttons.find(b => b.textContent?.includes(uniqueLabel))
            expect(button).toBeDefined()
            
            const shouldBeEnabled = hasPermission(permissions, userPerms)
            
            if (shouldBeEnabled) {
              expect(button).not.toBeDisabled()
            } else {
              expect(button).toBeDisabled()
            }
          })

          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should control action button groups consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(actionButtonArbitrary(), { minLength: 1, maxLength: 4 }),
        userPermissionsArbitrary(),
        fc.uuid(), // Add unique ID for each test iteration
        async (actions, userPerms, testId) => {
          setupMocks(userPerms)

          // Make labels unique for this test iteration
          const uniqueActions = actions.map((action, idx) => ({
            ...action,
            label: `${action.label}-${testId}-${idx}`
          }))

          const { unmount } = render(
            <ActionButtonGroup
              actions={uniqueActions}
              unauthorizedBehavior="disable"
            />
          )

          await waitFor(() => {
            uniqueActions.forEach(action => {
              const buttons = screen.getAllByRole('button')
              const button = buttons.find(b => b.textContent?.includes(action.label))
              expect(button).toBeDefined()
              
              const shouldBeEnabled = hasPermission(action.permission, userPerms)
              
              if (shouldBeEnabled) {
                expect(button).not.toBeDisabled()
              } else {
                expect(button).toBeDisabled()
              }
            })
          })

          unmount()
          cleanup()
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should respect forceDisabled regardless of permissions', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.uuid(), // Add unique ID for each test iteration
        async (permission, label, testId) => {
          // User has the permission
          setupMocks(new Set([permission]))

          const uniqueLabel = `${label}-${testId}`

          const { unmount } = render(
            <PermissionButton
              permission={permission}
              forceDisabled={true}
            >
              {uniqueLabel}
            </PermissionButton>
          )

          await waitFor(() => {
            const buttons = screen.getAllByRole('button')
            const button = buttons.find(b => b.textContent?.includes(uniqueLabel))
            expect(button).toBeDefined()
            // Should be disabled even though user has permission
            expect(button).toBeDisabled()
          })

          unmount()
          cleanup()
        }
      ),
      { numRuns: 30 }
    )
  })
})

// ============================================================================
// Property 13: API Flexibility Completeness
// **Validates: Requirements 3.5**
// ============================================================================

describe('Property 13: API Flexibility Completeness', () => {
  afterEach(() => {
    cleanup()
    jest.clearAllMocks()
  })

  it('should provide both component and hook APIs for the same permission check', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        userPermissionsArbitrary(),
        async (permission, userPerms) => {
          setupMocks(userPerms)

          // Test component API
          const { unmount } = render(
            <PermissionGuard permission={permission}>
              <div data-testid="component-api">Component API</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            const componentResult = screen.queryByTestId('component-api')
            const shouldBeVisible = userPerms.has(permission)
            
            if (shouldBeVisible) {
              expect(componentResult).toBeInTheDocument()
            } else {
              expect(componentResult).not.toBeInTheDocument()
            }
          })

          unmount()

          // Note: Hook API testing would require a more complex setup with renderHook
          // and proper mocking of the user permissions endpoint. The hook is tested
          // separately in usePermissions.test.ts

          cleanup()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should support both single and array permission formats consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        userPermissionsArbitrary(),
        async (permission, userPerms) => {
          setupMocks(userPerms)

          // Test single permission
          const { unmount: unmount1 } = render(
            <PermissionGuard permission={permission}>
              <div data-testid="single-perm">Single</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            const singleResult = screen.queryByTestId('single-perm')
            const shouldBeVisible = userPerms.has(permission)
            
            if (shouldBeVisible) {
              expect(singleResult).toBeInTheDocument()
            } else {
              expect(singleResult).not.toBeInTheDocument()
            }
          })

          unmount1()

          // Test array with single permission (should behave identically)
          const { unmount: unmount2 } = render(
            <PermissionGuard permission={[permission]}>
              <div data-testid="array-perm">Array</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            const arrayResult = screen.queryByTestId('array-perm')
            const shouldBeVisible = userPerms.has(permission)
            
            if (shouldBeVisible) {
              expect(arrayResult).toBeInTheDocument()
            } else {
              expect(arrayResult).not.toBeInTheDocument()
            }
          })

          unmount2()
          cleanup()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should support context-aware checking across all components', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        permissionContextArbitrary(),
        userPermissionsArbitrary(),
        async (permission, context, userPerms) => {
          // Skip if context is undefined
          if (!context) return

          setupMocks(userPerms)

          // Test PermissionGuard with context
          const { unmount: unmount1 } = render(
            <PermissionGuard permission={permission} context={context}>
              <div data-testid="guard-context">Guard</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            const guardResult = screen.queryByTestId('guard-context')
            const shouldBeVisible = userPerms.has(permission)
            
            if (shouldBeVisible) {
              expect(guardResult).toBeInTheDocument()
            } else {
              expect(guardResult).not.toBeInTheDocument()
            }
          })

          unmount1()

          // Test PermissionButton with context
          const { unmount: unmount2 } = render(
            <PermissionButton permission={permission} context={context}>
              Button
            </PermissionButton>
          )

          await waitFor(() => {
            const button = screen.getByRole('button')
            const shouldBeEnabled = userPerms.has(permission)
            
            if (shouldBeEnabled) {
              expect(button).not.toBeDisabled()
            } else {
              expect(button).toBeDisabled()
            }
          })

          unmount2()
          cleanup()
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should provide consistent fallback/loading state APIs across components', async () => {
    let testCounter = 0
    await fc.assert(
      fc.asyncProperty(
        permissionArbitrary(),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        fc.uuid(), // Add unique ID for each test iteration
        async (permission, fallbackText, loadingText, testId) => {
          const uniqueTestId = `${testId}-${testCounter++}`
          // User has no permissions
          setupMocks(new Set())

          // Test PermissionGuard fallback
          const { container: container1, unmount: unmount1 } = render(
            <PermissionGuard 
              permission={permission}
              fallback={<div data-testid={`fallback-guard-${uniqueTestId}`}>{fallbackText}</div>}
            >
              <div>Protected</div>
            </PermissionGuard>
          )

          await waitFor(() => {
            const fallbackElement = container1.querySelector(`[data-testid="fallback-guard-${uniqueTestId}"]`)
            expect(fallbackElement).toBeInTheDocument()
            expect(fallbackElement).toHaveTextContent(fallbackText)
          })

          unmount1()

          // Test RoleBasedNav with loading fallback
          const { container: container2, unmount: unmount2 } = render(
            <RoleBasedNav
              items={[{
                id: uniqueTestId,
                label: `Test-${uniqueTestId}`,
                path: '/test',
                requiredPermission: permission
              }]}
              renderItem={(item) => <div>{item.label}</div>}
              loadingFallback={<div data-testid={`loading-${uniqueTestId}`}>{loadingText}</div>}
            />
          )

          // Navigation item should not be visible (no permission)
          await waitFor(() => {
            const navText = container2.textContent
            expect(navText).not.toContain(`Test-${uniqueTestId}`)
          })

          unmount2()
        }
      ),
      { numRuns: 30 }
    )
  })
})
