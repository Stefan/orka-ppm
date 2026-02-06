/**
 * Unit tests for PermissionGuard (EnhancedAuth only, no API).
 * @regression Critical path: UI permission enforcement.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PermissionGuard } from '../PermissionGuard'

const mockUseEnhancedAuth = jest.fn()
jest.mock('@/app/providers/EnhancedAuthProvider', () => ({
  useEnhancedAuth: () => mockUseEnhancedAuth(),
}))

describe('PermissionGuard [@regression]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('[@regression] shows loading fallback when auth is loading', () => {
    mockUseEnhancedAuth.mockReturnValue({
      hasPermission: jest.fn(),
      loading: true,
      userRoles: [],
      userPermissions: [],
      hasRole: jest.fn(),
      refreshPermissions: jest.fn(),
      error: null,
    })
    render(
      <PermissionGuard permission="project_read" loadingFallback={<div>Loading...</div>}>
        <div>Protected</div>
      </PermissionGuard>
    )
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
  })

  it('[@regression] shows children when user has permission', () => {
    mockUseEnhancedAuth.mockReturnValue({
      hasPermission: jest.fn().mockReturnValue(true),
      loading: false,
      userRoles: [],
      userPermissions: [],
      hasRole: jest.fn(),
      refreshPermissions: jest.fn(),
      error: null,
    })
    render(
      <PermissionGuard permission="project_read">
        <div>Protected</div>
      </PermissionGuard>
    )
    expect(screen.getByText('Protected')).toBeInTheDocument()
  })

  it('[@regression] shows fallback when user lacks permission', async () => {
    mockUseEnhancedAuth.mockReturnValue({
      hasPermission: jest.fn().mockReturnValue(false),
      loading: false,
      userRoles: [],
      userPermissions: [],
      hasRole: jest.fn(),
      refreshPermissions: jest.fn(),
      error: null,
    })
    render(
      <PermissionGuard permission="project_update" fallback={<div>Access denied</div>}>
        <div>Protected</div>
      </PermissionGuard>
    )
    await waitFor(() => {
      expect(screen.getByText('Access denied')).toBeInTheDocument()
      expect(screen.queryByText('Protected')).not.toBeInTheDocument()
    })
  })

  it('[@regression] shows nothing when no fallback and user lacks permission', () => {
    mockUseEnhancedAuth.mockReturnValue({
      hasPermission: jest.fn().mockReturnValue(false),
      loading: false,
      userRoles: [],
      userPermissions: [],
      hasRole: jest.fn(),
      refreshPermissions: jest.fn(),
      error: null,
    })
    render(
      <PermissionGuard permission="project_read">
        <div>Protected</div>
      </PermissionGuard>
    )
    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
  })
})
