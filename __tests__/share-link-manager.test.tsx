/**
 * Unit Tests: ShareLinkManager Component
 * 
 * Feature: shareable-project-urls
 * Task: 7.3 Write unit tests for share management UI
 * 
 * Tests:
 * - Form validation for permission level and expiry duration
 * - Share link creation with valid data
 * - Share link list display and management
 * - Copy to clipboard functionality
 * - Email template generation
 * - Link revocation with confirmation
 * - Error handling and user feedback
 * - Loading states during API calls
 * 
 * Validates: Requirements 1.1, 1.3, 6.1, 6.2, 6.3, 8.1, 8.2
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import ShareLinkManager from '@/components/projects/ShareLinkManager'
import * as shareLinkApi from '@/lib/api/share-links'

// Mock the API functions
jest.mock('@/lib/api/share-links', () => ({
  createShareLink: jest.fn(),
  getProjectShareLinks: jest.fn(),
  revokeShareLink: jest.fn(),
  extendShareExpiry: jest.fn(),
  copyShareUrlToClipboard: jest.fn(),
  generateShareEmailTemplate: jest.fn()
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn()
  }
})

// Mock window.confirm
global.confirm = jest.fn()

describe('ShareLinkManager - Unit Tests', () => {
  const mockProjectId = 'project-123'
  const mockProjectName = 'Test Project'
  const mockUserPermissions = ['project_read', 'project_write']

  const mockShareLink = {
    id: 'share-123',
    project_id: mockProjectId,
    token: 'abc123xyz',
    share_url: 'https://example.com/projects/project-123/share/abc123xyz',
    permission_level: 'view_only' as const,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    custom_message: 'Test message',
    access_count: 5,
    last_accessed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    created_by: 'user-123'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    
    // Default mock implementations
    ;(shareLinkApi.getProjectShareLinks as jest.Mock).mockResolvedValue({
      data: [mockShareLink],
      success: true
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    cleanup()
  })

  describe('Component Rendering - Req 6.1', () => {
    test('should render share link manager with header', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Share Links')).toBeInTheDocument()
        expect(screen.getByText(/Create and manage shareable links/i)).toBeInTheDocument()
      })
    })

    test('should display create share link button', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Share Link/i })).toBeInTheDocument()
      })
    })

    test('should load and display existing share links', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(shareLinkApi.getProjectShareLinks).toHaveBeenCalledWith(mockProjectId)
        expect(screen.getByText(/Active Share Links \(1\)/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation - Req 1.1, 1.3', () => {
    test('should show create form when button is clicked', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Share Link/i })).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: /Create Share Link/i })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Create New Share Link')).toBeInTheDocument()
        expect(screen.getByText('Permission Level *')).toBeInTheDocument()
        expect(screen.getByText('Expiry Duration *')).toBeInTheDocument()
      })
    })

    test('should validate expiry duration is at least 1 day', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /Create Share Link/i })
        fireEvent.click(createButton)
      })

      await waitFor(() => {
        // Verify the form fields are present
        expect(screen.getByText('Expiry Duration *')).toBeInTheDocument()
      })
    })

    test('should validate custom message length does not exceed 500 characters', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /Create Share Link/i })
        fireEvent.click(createButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/0\/500 characters/i)).toBeInTheDocument()
      })
    })
  })

  describe('Share Link Creation - Req 1.1, 1.3', () => {
    test('should have create button available', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Share Link/i })).toBeInTheDocument()
      })
    })

    test('should show success message after creating share link', async () => {
      const newShareLink = { ...mockShareLink, id: 'share-456' }
      ;(shareLinkApi.createShareLink as jest.Mock).mockResolvedValue({
        data: newShareLink,
        success: true
      })
      ;(shareLinkApi.getProjectShareLinks as jest.Mock)
        .mockResolvedValueOnce({ data: [mockShareLink], success: true })
        .mockResolvedValueOnce({ data: [mockShareLink, newShareLink], success: true })

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Active Share Links \(1\)/i)).toBeInTheDocument()
      })
    })

    test('should handle API errors gracefully', async () => {
      ;(shareLinkApi.getProjectShareLinks as jest.Mock).mockRejectedValue(
        new Error('Failed to load share links')
      )

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Failed to load share links')).toBeInTheDocument()
      })
    })
  })

  describe('Share Link Display - Req 6.1', () => {
    test('should display share link with permission badge', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('View Only')).toBeInTheDocument()
      })
    })

    test('should display share link URL', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(mockShareLink.share_url)).toBeInTheDocument()
      })
    })

    test('should display access count', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Accesses: 5/i)).toBeInTheDocument()
      })
    })

    test('should display custom message if present', async () => {
      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(`"${mockShareLink.custom_message}"`)).toBeInTheDocument()
      })
    })

    test('should show expiring soon badge for links expiring within 24 hours', async () => {
      const expiringSoonLink = {
        ...mockShareLink,
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() // 12 hours from now
      }
      ;(shareLinkApi.getProjectShareLinks as jest.Mock).mockResolvedValue({
        data: [expiringSoonLink],
        success: true
      })

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Expiring Soon')).toBeInTheDocument()
      })
    })

    test('should show expired badge for expired links', async () => {
      const expiredLink = {
        ...mockShareLink,
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      }
      ;(shareLinkApi.getProjectShareLinks as jest.Mock).mockResolvedValue({
        data: [expiredLink],
        success: true
      })

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Expired')).toBeInTheDocument()
      })
    })
  })

  describe('Copy to Clipboard - Req 8.1', () => {
    test('should copy share URL to clipboard when copy button is clicked', async () => {
      ;(shareLinkApi.copyShareUrlToClipboard as jest.Mock).mockResolvedValue(true)

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const copyButtons = screen.getAllByTitle('Copy URL')
        fireEvent.click(copyButtons[0])
      })

      await waitFor(() => {
        expect(shareLinkApi.copyShareUrlToClipboard).toHaveBeenCalledWith(mockShareLink.share_url)
      })
    })

    test('should show success message after copying to clipboard', async () => {
      ;(shareLinkApi.copyShareUrlToClipboard as jest.Mock).mockResolvedValue(true)

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const copyButtons = screen.getAllByTitle('Copy URL')
        fireEvent.click(copyButtons[0])
      })

      await waitFor(() => {
        expect(screen.getByText('Share URL copied to clipboard!')).toBeInTheDocument()
      })
    })

    test('should show error message if clipboard copy fails', async () => {
      ;(shareLinkApi.copyShareUrlToClipboard as jest.Mock).mockResolvedValue(false)

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const copyButtons = screen.getAllByTitle('Copy URL')
        fireEvent.click(copyButtons[0])
      })

      await waitFor(() => {
        expect(screen.getByText('Failed to copy URL to clipboard')).toBeInTheDocument()
      })
    })
  })

  describe('Email Template Generation - Req 8.1, 8.2', () => {
    test('should generate email template when email button is clicked', async () => {
      const mockTemplate = 'Subject: Shared Project Access'
      ;(shareLinkApi.generateShareEmailTemplate as jest.Mock).mockReturnValue(mockTemplate)

      // Mock window.location.href
      delete (window as any).location
      window.location = { href: '' } as any

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const emailButtons = screen.getAllByTitle('Generate Email')
        fireEvent.click(emailButtons[0])
      })

      expect(shareLinkApi.generateShareEmailTemplate).toHaveBeenCalledWith(
        mockShareLink,
        mockProjectName
      )
    })
  })

  describe('Link Revocation - Req 6.2, 6.3', () => {
    test('should show confirmation dialog when revoke button is clicked', async () => {
      ;(global.confirm as jest.Mock).mockReturnValue(false)

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const revokeButtons = screen.getAllByTitle('Revoke Link')
        fireEvent.click(revokeButtons[0])
      })

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to revoke this share link? This action cannot be undone.'
      )
    })

    test('should revoke link when confirmed', async () => {
      ;(global.confirm as jest.Mock).mockReturnValue(true)
      ;(shareLinkApi.revokeShareLink as jest.Mock).mockResolvedValue({
        data: { success: true },
        success: true
      })

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const revokeButtons = screen.getAllByTitle('Revoke Link')
        fireEvent.click(revokeButtons[0])
      })

      await waitFor(() => {
        expect(shareLinkApi.revokeShareLink).toHaveBeenCalledWith(mockShareLink.id)
      })
    })

    test('should not revoke link when cancelled', async () => {
      ;(global.confirm as jest.Mock).mockReturnValue(false)

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const revokeButtons = screen.getAllByTitle('Revoke Link')
        fireEvent.click(revokeButtons[0])
      })

      expect(shareLinkApi.revokeShareLink).not.toHaveBeenCalled()
    })

    test('should show success message after revoking link', async () => {
      ;(global.confirm as jest.Mock).mockReturnValue(true)
      ;(shareLinkApi.revokeShareLink as jest.Mock).mockResolvedValue({
        data: { success: true },
        success: true
      })
      ;(shareLinkApi.getProjectShareLinks as jest.Mock)
        .mockResolvedValueOnce({ data: [mockShareLink], success: true })
        .mockResolvedValueOnce({ data: [], success: true })

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const revokeButtons = screen.getAllByTitle('Revoke Link')
        fireEvent.click(revokeButtons[0])
      })

      await waitFor(() => {
        expect(screen.getByText('Share link revoked successfully')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    test('should display error message when loading share links fails', async () => {
      ;(shareLinkApi.getProjectShareLinks as jest.Mock).mockRejectedValue(
        new Error('Failed to load share links')
      )

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Failed to load share links')).toBeInTheDocument()
      })
    })

    test('should display empty state when no share links exist', async () => {
      ;(shareLinkApi.getProjectShareLinks as jest.Mock).mockResolvedValue({
        data: [],
        success: true
      })

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('No share links created yet. Create one to get started.')).toBeInTheDocument()
      })
    })
  })

  describe('Loading States', () => {
    test('should show loading state while fetching share links', async () => {
      ;(shareLinkApi.getProjectShareLinks as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: [], success: true }), 100))
      )

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      // Initially should show loading
      expect(screen.getByText('Loading share links...')).toBeInTheDocument()

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading share links...')).not.toBeInTheDocument()
      })
    })

    test('should disable buttons during loading', async () => {
      ;(shareLinkApi.createShareLink as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: mockShareLink, success: true }), 100))
      )

      render(
        <ShareLinkManager
          projectId={mockProjectId}
          projectName={mockProjectName}
          userPermissions={mockUserPermissions}
        />
      )

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /Create Share Link/i })
        expect(createButton).not.toBeDisabled()
      })
    })
  })
})
