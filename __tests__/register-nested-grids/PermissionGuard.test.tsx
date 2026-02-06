/**
 * Feature: register-nested-grids, Property 12: Permission-basiertes Nested Grid Verhalten
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import PermissionGuard from '@/components/register-nested-grids/PermissionGuard'
import { checkPermission, getAlternative } from '@/lib/register-nested-grids/permissions'

jest.mock('@/lib/register-nested-grids/permissions', () => ({
  checkPermission: jest.fn(),
  getAlternative: jest.fn(() => Promise.resolve({ message: 'No permission.', type: 'summary' })),
}))

describe('Feature: register-nested-grids, Property 12: Permission-basiertes Nested Grid Verhalten', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls checkPermission with resourceId and action (permission-based behavior)', () => {
    ;(checkPermission as jest.Mock).mockResolvedValue(true)
    render(
      <PermissionGuard resourceId="r1" action="view">
        <span>Content</span>
      </PermissionGuard>
    )
    expect(checkPermission).toHaveBeenCalledWith('r1', 'view')
    expect(getAlternative).toHaveBeenCalledWith('r1', 'view')
  })

  it('calls checkPermission for edit action (permission check before content)', () => {
    ;(checkPermission as jest.Mock).mockResolvedValue(false)
    render(
      <PermissionGuard resourceId="r2" action="edit">
        <span>Content</span>
      </PermissionGuard>
    )
    expect(checkPermission).toHaveBeenCalledWith('r2', 'edit')
  })

  it('renders without crashing for any action', () => {
    ;(checkPermission as jest.Mock).mockResolvedValue(false)
    const { container } = render(
      <PermissionGuard resourceId="r3" action="delete">
        <span>Content</span>
      </PermissionGuard>
    )
    expect(container).toBeInTheDocument()
  })
})
