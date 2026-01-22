/**
 * Unit Tests for PermissionGuard Component (Updated for EnhancedAuthProvider)
 * 
 * Tests the PermissionGuard component's ability to conditionally render
 * content based on user permissions using the EnhancedAuthProvider.
 * 
 * Requirements: 3.1 - UI Component Permission Enforcement
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PermissionGuard } from '../PermissionGuard'
import type { Permission } from '@/types/rbac'

// Mock the enhanced auth provider
const mockUseEnhancedAuth = jest.fn()
jest.mock('@/app/providers/EnhancedAuthProvider', () => ({
  useEnhancedAuth: () => mockUseEnhancedAuth()
}))

describe('PermissionGuard with EnhancedAuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Loading State', () => {
    it('should show nothing when permissions are loading', () => {
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

    it('should show loading fallback when provided', () => {
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
  })

  describe('Permission Checking', () => {
    it('should render children when user has the required permission', () => {
      const mockHasPermission = jest.fn().mockReturnValue(true)
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: mockHasPermission,
        loading: false,
        userRoles: ['project_manager'],
        userPermissions: ['project_read' as Permission],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      render(
        <PermissionGuard permission="project_read">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
      expect(mockHasPermission).toHaveBeenCalledWith('project_read', undefined)
    })

    it('should not render children when user lacks the required permission', () => {
      const mockHasPermission = jest.fn().mockReturnValue(false)
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: mockHasPermission,
        loading: false,
        userRoles: ['viewer'],
        userPermissions: ['project_read' as Permission],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      render(
        <PermissionGuard permission="project_update">
          <div>Protected Content</div>
        </PermissionGuard>
      )

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      expect(mockHasPermission).toHaveBeenCalledWith('project_update', undefined)
    })

    it('should show fallback when user lacks permission', () => {
      const mockHasPermission = jest.fn().mockReturnValue(false)
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: mockHasPermission,
        loading: false,
        userRoles: ['viewer'],
        userPermissions: ['project_read' as Permission],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      render(
        <PermissionGuard 
          permission="project_delete"
          fallback={<div>Access Denied</div>}
        >
          <div>Protected Content</div>
        </PermissionGuard>
      )

      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('Multiple Permissions (OR Logic)', () => {
    it('should render children when user has ANY of the required permissions', () => {
      const mockHasPermission = jest.fn().mockReturnValue(true)
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: mockHasPermission,
        loading: false,
        userRoles: ['project_manager'],
        userPermissions: ['project_read' as Permission],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      const permissions: Permission[] = ['project_update', 'project_read']

      render(
        <PermissionGuard permission={permissions}>
          <div>Protected Content</div>
        </PermissionGuard>
      )

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
      expect(mockHasPermission).toHaveBeenCalledWith(permissions, undefined)
    })

    it('should not render children when user has NONE of the required permissions', () => {
      const mockHasPermission = jest.fn().mockReturnValue(false)
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: mockHasPermission,
        loading: false,
        userRoles: ['viewer'],
        userPermissions: ['project_read' as Permission],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      const permissions: Permission[] = ['project_update', 'project_delete']

      render(
        <PermissionGuard permission={permissions}>
          <div>Protected Content</div>
        </PermissionGuard>
      )

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('Context-Aware Permission Checking', () => {
    it('should pass context to hasPermission', () => {
      const mockHasPermission = jest.fn().mockReturnValue(true)
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: mockHasPermission,
        loading: false,
        userRoles: ['project_manager'],
        userPermissions: ['project_update' as Permission],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      const context = { project_id: 'project-123' }

      render(
        <PermissionGuard permission="project_update" context={context}>
          <div>Protected Content</div>
        </PermissionGuard>
      )

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
      expect(mockHasPermission).toHaveBeenCalledWith('project_update', context)
    })

    it('should handle project-scoped permissions', () => {
      const mockHasPermission = jest.fn().mockReturnValue(true)
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: mockHasPermission,
        loading: false,
        userRoles: ['project_manager'],
        userPermissions: ['project_update' as Permission],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      const context = { project_id: 'project-456' }

      render(
        <PermissionGuard permission="project_update" context={context}>
          <div>Edit Project</div>
        </PermissionGuard>
      )

      expect(screen.getByText('Edit Project')).toBeInTheDocument()
      expect(mockHasPermission).toHaveBeenCalledWith('project_update', context)
    })

    it('should handle portfolio-scoped permissions', () => {
      const mockHasPermission = jest.fn().mockReturnValue(true)
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: mockHasPermission,
        loading: false,
        userRoles: ['portfolio_manager'],
        userPermissions: ['portfolio_read' as Permission],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      const context = { portfolio_id: 'portfolio-789' }

      render(
        <PermissionGuard permission="portfolio_read" context={context}>
          <div>View Portfolio</div>
        </PermissionGuard>
      )

      expect(screen.getByText('View Portfolio')).toBeInTheDocument()
      expect(mockHasPermission).toHaveBeenCalledWith('portfolio_read', context)
    })
  })

  describe('Edge Cases', () => {
    it('should handle complex nested children', () => {
      const mockHasPermission = jest.fn().mockReturnValue(true)
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: mockHasPermission,
        loading: false,
        userRoles: ['admin'],
        userPermissions: ['project_read' as Permission],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
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

      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Nested content')).toBeInTheDocument()
      expect(screen.getByText('Action')).toBeInTheDocument()
    })

    it('should handle empty permission array gracefully', () => {
      const mockHasPermission = jest.fn().mockReturnValue(false)
      mockUseEnhancedAuth.mockReturnValue({
        hasPermission: mockHasPermission,
        loading: false,
        userRoles: [],
        userPermissions: [],
        hasRole: jest.fn(),
        refreshPermissions: jest.fn(),
        error: null
      })

      render(
        <PermissionGuard permission={[] as Permission[]}>
          <div>Protected Content</div>
        </PermissionGuard>
      )

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })
})
