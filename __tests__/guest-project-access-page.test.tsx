/**
 * Unit Tests: Guest Project Access Page
 * 
 * Feature: shareable-project-urls
 * Task: 8.3 Write unit tests for guest interface
 * 
 * Tests:
 * - Loading states and progressive enhancement
 * - Error handling for invalid/expired links
 * - Successful project data display
 * 
 * Validates: Requirements 5.3, 5.4
 */

import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import GuestProjectAccessPage from '@/app/projects/[id]/share/[token]/page'
import type { FilteredProjectData } from '@/types/share-links'

// Mock next/navigation
const mockPush = jest.fn()
const mockParams = {
  id: 'project-123',
  token: 'test-token-abc123'
}

jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock fetch
global.fetch = jest.fn()

describe('GuestProjectAccessPage - Unit Tests', () => {
  const mockProjectData: FilteredProjectData = {
    id: 'project-123',
    name: 'Test Project',
    description: 'Test project description',
    status: 'active',
    progress_percentage: 50,
    start_date: '2024-01-01',
    end_date: '2024-12-31'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Loading State - Req 5.4', () => {
    test('should display loading state initially', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(() => {}) // Never resolves to keep loading state
      )

      render(<GuestProjectAccessPage />)

      expect(screen.getByText('Loading Project...')).toBeInTheDocument()
      expect(screen.getByText(/Please wait while we retrieve/)).toBeInTheDocument()
    })

    test('should show loading spinner', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(() => {})
      )

      const { container } = render(<GuestProjectAccessPage />)

      // Check for spinner (animated element)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Successful Data Loading - Req 5.1', () => {
    test('should display project data when fetch succeeds', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          project: mockProjectData,
          permission_level: 'view_only'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      expect(screen.getByText('Test project description')).toBeInTheDocument()
    })

    test('should pass custom message to GuestProjectView', async () => {
      const customMessage = 'Welcome to the project!'
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          project: mockProjectData,
          permission_level: 'view_only',
          custom_message: customMessage
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText(/Welcome to the project/)).toBeInTheDocument()
      })
    })

    test('should call correct API endpoint', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          project: mockProjectData,
          permission_level: 'view_only'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/projects/project-123/share/test-token-abc123'),
          expect.objectContaining({
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          })
        )
      })
    })
  })

  describe('Error Handling - Req 5.3', () => {
    test('should display expired link error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'This share link has expired',
          error_type: 'expired'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText('Link Expired')).toBeInTheDocument()
      })

      expect(screen.getAllByText(/This share link has expired/).length).toBeGreaterThan(0)
      expect(screen.getByText(/contact the project manager/)).toBeInTheDocument()
    })

    test('should display revoked access error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Access has been revoked',
          error_type: 'revoked'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText('Access Revoked')).toBeInTheDocument()
      })

      expect(screen.getAllByText(/Access has been revoked/).length).toBeGreaterThan(0)
    })

    test('should display invalid token error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Invalid share token',
          error_type: 'invalid_token'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText('Invalid Link')).toBeInTheDocument()
      })

      expect(screen.getByText(/This link is not valid/)).toBeInTheDocument()
    })

    test('should display not found error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Project not found',
          error_type: 'not_found'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText('Project Not Found')).toBeInTheDocument()
      })
    })

    test('should display server error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Internal server error',
          error_type: 'server_error'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText('Connection Error')).toBeInTheDocument()
      })

      expect(screen.getByText(/Unable to connect to the server/)).toBeInTheDocument()
    })

    test('should handle network errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText('Connection Error')).toBeInTheDocument()
      })

      expect(screen.getAllByText(/Unable to connect to the server/).length).toBeGreaterThan(0)
    })

    test('should display Try Again button on error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Server error',
          error_type: 'server_error'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
      })
    })
  })

  describe('Error Icons and Visual Feedback - Req 5.3', () => {
    test('should display clock icon for expired links', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Link expired',
          error_type: 'expired'
        })
      })

      const { container } = render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText('Link Expired')).toBeInTheDocument()
      })

      // Clock icon should be present
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    test('should display X icon for revoked access', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Access revoked',
          error_type: 'revoked'
        })
      })

      const { container } = render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText('Access Revoked')).toBeInTheDocument()
      })

      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    test('should display alert icon for invalid tokens', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Invalid token',
          error_type: 'invalid_token'
        })
      })

      const { container } = render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText('Invalid Link')).toBeInTheDocument()
      })

      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Error Guidance Messages - Req 5.3', () => {
    test('should provide guidance for expired links', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Link expired',
          error_type: 'expired'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText(/request a new link with extended access/)).toBeInTheDocument()
      })
    })

    test('should provide guidance for revoked access', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Access revoked',
          error_type: 'revoked'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText(/contact them if you need access/)).toBeInTheDocument()
      })
    })

    test('should provide guidance for invalid tokens', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Invalid token',
          error_type: 'invalid_token'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText(/check that you have the correct URL/)).toBeInTheDocument()
      })
    })

    test('should provide guidance for server errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Server error',
          error_type: 'server_error'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText(/check your internet connection/)).toBeInTheDocument()
      })
    })
  })

  describe('Contact Information - Req 5.3', () => {
    test('should display contact information on error pages', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Error',
          error_type: 'server_error'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(screen.getByText(/Need help\? Contact the project manager/)).toBeInTheDocument()
      })
    })
  })

  describe('Progressive Enhancement - Req 5.4', () => {
    test('should handle missing environment variables gracefully', async () => {
      const originalEnv = process.env.NEXT_PUBLIC_API_URL
      delete process.env.NEXT_PUBLIC_API_URL

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          project: mockProjectData,
          permission_level: 'view_only'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      // Restore environment variable
      if (originalEnv) {
        process.env.NEXT_PUBLIC_API_URL = originalEnv
      }
    })

    test('should handle malformed API responses', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing required fields
          success: true
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        // Should show fallback error state
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    test('should have accessible error messages', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Link expired',
          error_type: 'expired'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: /Link Expired/i })
        expect(heading).toBeInTheDocument()
      })
    })

    test('should have accessible loading state', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(() => {})
      )

      render(<GuestProjectAccessPage />)

      const heading = screen.getByRole('heading', { name: /Loading Project/i })
      expect(heading).toBeInTheDocument()
    })

    test('should have accessible buttons', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Error',
          error_type: 'server_error'
        })
      })

      render(<GuestProjectAccessPage />)

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Try Again/i })
        expect(button).toBeInTheDocument()
        expect(button).toHaveAttribute('type', 'button')
      })
    })
  })
})
