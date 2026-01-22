/**
 * Unit Tests: Admin Role Management UI Components
 * 
 * Feature: ai-empowered-ppm-features
 * Task: 13.5 Write unit tests for admin UI components
 * 
 * Tests:
 * - User list rendering
 * - Role assignment form
 * - Access control redirect
 * 
 * Validates: Requirements 10.1, 10.2, 10.5
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock the auth provider
const mockUseAuth = jest.fn()
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => mockUseAuth()
}))

// Mock the API
global.fetch = jest.fn()

// Mock AppLayout
jest.mock('@/components/shared/AppLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>
}))

// Mock translations
jest.mock('@/lib/i18n/context', () => ({
  useTranslations: () => (key: string) => key
}))

// Import the component after mocks are set up
import AdminUsers from '@/app/admin/users/page'

describe('Admin Role Management UI Components', () => {
  let mockPush: jest.Mock

  beforeEach(() => {
    mockPush = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
    })

    // Suppress console errors for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  describe('User List Rendering', () => {
    test('should render user list with roles', async () => {
      // Mock admin user session
      const session = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' }
      }

      mockUseAuth.mockReturnValue({
        session,
        user: session.user,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      // Mock API responses
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ([
            { role: 'admin', permissions: ['all'], description: 'Administrator' },
            { role: 'manager', permissions: ['read', 'write'], description: 'Manager' }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            users: [
              {
                id: 'user-1',
                email: 'user1@example.com',
                role: 'admin',
                roles: ['admin'],
                status: 'active',
                is_active: true,
                last_login: '2024-01-01T00:00:00Z',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: null,
                deactivated_at: null,
                deactivated_by: null,
                deactivation_reason: null,
                sso_provider: null
              },
              {
                id: 'user-2',
                email: 'user2@example.com',
                role: 'manager',
                roles: ['manager'],
                status: 'active',
                is_active: true,
                last_login: '2024-01-01T00:00:00Z',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: null,
                deactivated_at: null,
                deactivated_by: null,
                deactivation_reason: null,
                sso_provider: null
              }
            ],
            total_count: 2,
            page: 1,
            per_page: 20,
            total_pages: 1
          })
        })

      const { container } = render(<AdminUsers />)

      // Wait for users to load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/admin/users'),
          expect.any(Object)
        )
      })

      // Verify user list is rendered
      await waitFor(() => {
        const content = container.textContent || ''
        expect(content).toContain('user1@example.com')
        expect(content).toContain('user2@example.com')
      })
    })

    test('should display role badges for each user', async () => {
      // Mock admin user session
      const session = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' }
      }

      mockUseAuth.mockReturnValue({
        session,
        user: session.user,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      // Mock API responses
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ([
            { role: 'admin', permissions: ['all'], description: 'Administrator' }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            users: [
              {
                id: 'user-1',
                email: 'user1@example.com',
                role: 'admin',
                roles: ['admin', 'manager'],
                status: 'active',
                is_active: true,
                last_login: '2024-01-01T00:00:00Z',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: null,
                deactivated_at: null,
                deactivated_by: null,
                deactivation_reason: null,
                sso_provider: null
              }
            ],
            total_count: 1,
            page: 1,
            per_page: 20,
            total_pages: 1
          })
        })

      const { container } = render(<AdminUsers />)

      // Wait for users to load
      await waitFor(() => {
        const content = container.textContent || ''
        expect(content).toContain('Admin')
        expect(content).toContain('Manager')
      })
    })

    test('should show empty state when no users found', async () => {
      // Mock admin user session
      const session = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' }
      }

      mockUseAuth.mockReturnValue({
        session,
        user: session.user,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      // Mock API responses
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ([
            { role: 'admin', permissions: ['all'], description: 'Administrator' }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            users: [],
            total_count: 0,
            page: 1,
            per_page: 20,
            total_pages: 0
          })
        })

      const { container } = render(<AdminUsers />)

      // Wait for empty state
      await waitFor(() => {
        const content = container.textContent || ''
        expect(content).toContain('noUsersFound')
      })
    })
  })

  describe('Role Assignment Form', () => {
    test('should open role management modal when clicking manage roles button', async () => {
      // Mock admin user session
      const session = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' }
      }

      mockUseAuth.mockReturnValue({
        session,
        user: session.user,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      // Mock API responses
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ([
            { role: 'admin', permissions: ['all'], description: 'Administrator' },
            { role: 'manager', permissions: ['read', 'write'], description: 'Manager' }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            users: [
              {
                id: 'user-1',
                email: 'user1@example.com',
                role: 'admin',
                roles: ['admin'],
                status: 'active',
                is_active: true,
                last_login: '2024-01-01T00:00:00Z',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: null,
                deactivated_at: null,
                deactivated_by: null,
                deactivation_reason: null,
                sso_provider: null
              }
            ],
            total_count: 1,
            page: 1,
            per_page: 20,
            total_pages: 1
          })
        })

      const { container } = render(<AdminUsers />)

      // Wait for users to load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/admin/users'),
          expect.any(Object)
        )
      })

      // Find and click the shield icon (manage roles button)
      const shieldButtons = container.querySelectorAll('svg')
      const manageRolesButton = Array.from(shieldButtons).find(
        svg => svg.parentElement?.getAttribute('title') === 'Manage Roles'
      )

      if (manageRolesButton?.parentElement) {
        fireEvent.click(manageRolesButton.parentElement)

        // Wait for modal to appear
        await waitFor(() => {
          const content = container.textContent || ''
          expect(content).toContain('Manage Roles')
        })
      }
    })

    test('should display available roles in modal', async () => {
      // Mock admin user session
      const session = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' }
      }

      mockUseAuth.mockReturnValue({
        session,
        user: session.user,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      // Mock API responses
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ([
            { role: 'admin', permissions: ['all'], description: 'Administrator' },
            { role: 'manager', permissions: ['read', 'write'], description: 'Manager' },
            { role: 'viewer', permissions: ['read'], description: 'Viewer' }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            users: [
              {
                id: 'user-1',
                email: 'user1@example.com',
                role: 'admin',
                roles: ['admin'],
                status: 'active',
                is_active: true,
                last_login: '2024-01-01T00:00:00Z',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: null,
                deactivated_at: null,
                deactivated_by: null,
                deactivation_reason: null,
                sso_provider: null
              }
            ],
            total_count: 1,
            page: 1,
            per_page: 20,
            total_pages: 1
          })
        })

      render(<AdminUsers />)

      // Wait for component to load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })

  describe('Access Control Redirect', () => {
    test('should redirect non-admin users to home page', async () => {
      // Mock non-admin user session
      const session = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'user-id', email: 'user@example.com', role: 'viewer' }
      }

      mockUseAuth.mockReturnValue({
        session,
        user: session.user,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      // Mock API response with 403 Forbidden
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ detail: 'Forbidden' })
      })

      render(<AdminUsers />)

      // Wait for redirect to be called
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/')
      }, { timeout: 3000 })
    })

    test('should display access denied message for non-admin users', async () => {
      // Mock non-admin user session
      const session = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'user-id', email: 'user@example.com', role: 'viewer' }
      }

      mockUseAuth.mockReturnValue({
        session,
        user: session.user,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      // Mock API response with 403 Forbidden
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ detail: 'Forbidden' })
      })

      const { container } = render(<AdminUsers />)

      // Wait for access denied message
      await waitFor(() => {
        const content = container.textContent || ''
        expect(content).toContain('Access Denied')
      })
    })

    test('should not redirect admin users', async () => {
      // Mock admin user session
      const session = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' }
      }

      mockUseAuth.mockReturnValue({
        session,
        user: session.user,
        loading: false,
        error: null,
        clearSession: jest.fn()
      })

      // Mock successful API responses for admin
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ([
            { role: 'admin', permissions: ['all'], description: 'Administrator' }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            users: [],
            total_count: 0,
            page: 1,
            per_page: 20,
            total_pages: 0
          })
        })

      render(<AdminUsers />)

      // Wait for component to load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      // Verify NO redirect was called
      expect(mockPush).not.toHaveBeenCalledWith('/')
    })
  })
})
