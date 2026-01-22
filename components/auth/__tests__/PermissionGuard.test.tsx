/**
 * Unit Tests for PermissionGuard Component
 * 
 * Tests the PermissionGuard component's ability to conditionally render
 * content based on user permissions.
 * 
 * Requirements: 3.1 - UI Component Permission Enforcement
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PermissionGuard } from '../PermissionGuard'
import type { Permission } from '@/types/rbac'

// Mock the enhanced auth provider
const mockUseEnhancedAuth = jest.fn()
jest.mock('@/app/providers/EnhancedAuthProvider', () => ({
  useEnhancedAuth: () => mockUseEnhancedAuth()
}))

describe('PermissionGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Authentication State Handling', () => {
    it('should show nothing when auth is loading', () => {
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: jest.fn(),
        loading: true,
        userRoles: [],
        userPermissions: [],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      render(
        <PermissionGuard permission="project_read">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('should show loading fallback when auth is loading and loadingFallback is provided', () => {
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: jest.fn(),
        loading: true,
        userRoles: [],
        userPermissions: [],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      render(
        <PermissionGuard 
          permission="project_read"
          loadingFallback={<div>Loading permissions...</div>}
        >
          <div>Protected Content</div>
        </PermissionGuard>
      )

      expect(screen.getByText('Loading permissions...')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('should deny access when user is not authenticated', async () => {
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: jest.fn().mockReturnValue(false),
        loading: false,
        userRoles: [],
        userPermissions: [],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      render(
        <PermissionGuard permission="project_read">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      })
    })

    it('should show fallback when user is not authenticated and fallback is provided', async () => {
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: jest.fn().mockReturnValue(false),
        loading: false,
        userRoles: [],
        userPermissions: [],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      render(
        <PermissionGuard 
          permission="project_read"
          fallback={<div>Please log in</div>}
        >
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Please log in')).toBeInTheDocument()
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      })
    })
  })

  describe('Single Permission Checking', () => {
    it('should render children when user has the required permission', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_permission: true })
      })

      render(
        <PermissionGuard permission="project_read">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('permission=project_read'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockSession.access_token}`
          })
        })
      )
    })

    it('should not render children when user lacks the required permission', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_permission: false })
      })

      render(
        <PermissionGuard permission="project_update">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      })
    })

    it('should show fallback when user lacks permission and fallback is provided', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_permission: false })
      })

      render(
        <PermissionGuard 
          permission="project_delete"
          fallback={<div>Access Denied</div>}
        >
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument()
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      })
    })
  })

  describe('Multiple Permission Checking (OR Logic)', () => {
    it('should render children when user has ANY of the required permissions', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      // First permission check fails, second succeeds
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ has_permission: false })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ has_permission: true })
        })

      const permissions: Permission[] = ['project_update', 'project_read']

      render(
        <PermissionGuard permission={permissions}>
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      // Should have checked both permissions
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should not render children when user has NONE of the required permissions', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      // Both permission checks fail
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ has_permission: false })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ has_permission: false })
        })

      const permissions: Permission[] = ['project_delete', 'admin_delete']

      render(
        <PermissionGuard permission={permissions}>
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      })
    })

    it('should render children when user has ALL of the required permissions', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      // Both permission checks succeed
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ has_permission: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ has_permission: true })
        })

      const permissions: Permission[] = ['project_read', 'portfolio_read']

      render(
        <PermissionGuard permission={permissions}>
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })
    })
  })

  describe('Context-Aware Permission Checking', () => {
    it('should include context in permission check request', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_permission: true })
      })

      const context = {
        project_id: 'project-123',
        portfolio_id: 'portfolio-456'
      }

      render(
        <PermissionGuard permission="project_update" context={context}>
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`context=${encodeURIComponent(JSON.stringify(context))}`),
        expect.any(Object)
      )
    })

    it('should handle project-scoped permissions', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_permission: true })
      })

      render(
        <PermissionGuard 
          permission="project_update" 
          context={{ project_id: 'project-123' }}
        >
          <div>Edit Project</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Edit Project')).toBeInTheDocument()
      })
    })

    it('should handle portfolio-scoped permissions', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_permission: true })
      })

      render(
        <PermissionGuard 
          permission="portfolio_read" 
          context={{ portfolio_id: 'portfolio-456' }}
        >
          <div>View Portfolio</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('View Portfolio')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should deny access when API request fails', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      render(
        <PermissionGuard permission="project_read">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('should deny access when API returns non-OK status', async () => {
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

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      render(
        <PermissionGuard permission="project_read">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      })

      expect(consoleWarnSpy).toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })

    it('should handle malformed API responses gracefully', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      })

      render(
        <PermissionGuard permission="project_read">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty permission array', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      render(
        <PermissionGuard permission={[]}>
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      })
    })

    it('should re-check permissions when permission prop changes', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ has_permission: true })
      })

      const { rerender } = render(
        <PermissionGuard permission="project_read">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Change permission
      rerender(
        <PermissionGuard permission="project_update">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })

    it('should re-check permissions when context changes', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ has_permission: true })
      })

      const { rerender } = render(
        <PermissionGuard 
          permission="project_read" 
          context={{ project_id: 'project-1' }}
        >
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Change context
      rerender(
        <PermissionGuard 
          permission="project_read" 
          context={{ project_id: 'project-2' }}
        >
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })

    it('should handle complex nested children', async () => {
      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_permission: true })
      })

      render(
        <PermissionGuard permission="project_read">
          <div>
            <h1>Title</h1>
            <div>
              <p>Nested content</p>
              <button>Action</button>
            </div>
          </div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Title')).toBeInTheDocument()
        expect(screen.getByText('Nested content')).toBeInTheDocument()
        expect(screen.getByText('Action')).toBeInTheDocument()
      })
    })
  })

  describe('API URL Configuration', () => {
    it('should use NEXT_PUBLIC_API_URL environment variable when available', async () => {
      const originalEnv = process.env.NEXT_PUBLIC_API_URL
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'

      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_permission: true })
      })

      render(
        <PermissionGuard permission="project_read">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('https://api.example.com'),
          expect.any(Object)
        )
      })

      process.env.NEXT_PUBLIC_API_URL = originalEnv
    })

    it('should fallback to localhost when NEXT_PUBLIC_API_URL is not set', async () => {
      const originalEnv = process.env.NEXT_PUBLIC_API_URL
      delete process.env.NEXT_PUBLIC_API_URL

      mockUseAuth.mockReturnValue({
        session: mockSession,
        user: mockSession.user,
        loading: false,
        error: null
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_permission: true })
      })

      render(
        <PermissionGuard permission="project_read">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('http://localhost:8000'),
          expect.any(Object)
        )
      })

      process.env.NEXT_PUBLIC_API_URL = originalEnv
    })
  })
})
