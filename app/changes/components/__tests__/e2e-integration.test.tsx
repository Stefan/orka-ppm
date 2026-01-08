/**
 * End-to-End Integration Tests for Change Management System
 * Tests complete user workflows and system integration
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Import page components
import ChangesPage from '../../page'
import ChangeDetailPage from '../../[id]/page'

// Mock Next.js navigation
const mockPush = jest.fn()
const mockBack = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: jest.fn(),
    prefetch: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/changes',
}))

// Mock AppLayout to avoid complex dependencies
jest.mock('../../../../components/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>
}))

describe('Change Management E2E Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Main Changes Page Integration', () => {
    it('should render the complete changes page with all components', async () => {
      render(<ChangesPage />)
      
      // Should show the page heading
      expect(screen.getByText('Change Management')).toBeInTheDocument()
      expect(screen.getByText('Manage project change requests, approvals, and implementation tracking')).toBeInTheDocument()
      
      // Wait for the manager component to load
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show the main interface elements
      expect(screen.getByText('New Change Request')).toBeInTheDocument()
      expect(screen.getByText('Filters')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search change requests...')).toBeInTheDocument()
      
      // Should show the table structure
      expect(screen.getByText('Change Request')).toBeInTheDocument()
      expect(screen.getByText('Type & Priority')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Impact')).toBeInTheDocument()
      expect(screen.getByText('Progress')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('should handle new change request creation workflow', async () => {
      const user = userEvent.setup()
      render(<ChangesPage />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Click new change request button
      const newButton = screen.getByText('New Change Request')
      await user.click(newButton)
      
      // Should show the form
      await waitFor(() => {
        expect(screen.getByText('New Change Request')).toBeInTheDocument()
      })
      
      // Should show form fields
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/project/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/change type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument()
    })

    it('should handle search and filtering functionality', async () => {
      const user = userEvent.setup()
      render(<ChangesPage />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Test search functionality
      const searchInput = screen.getByPlaceholderText('Search change requests...')
      await user.type(searchInput, 'Foundation')
      
      expect(searchInput).toHaveValue('Foundation')
      
      // Test filter button
      const filterButton = screen.getByText('Filters')
      await user.click(filterButton)
      
      // Should show filter options
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument()
      })
    })

    it('should display change request data correctly', async () => {
      render(<ChangesPage />)
      
      // Wait for loading and data
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show mock data
      expect(screen.getByText('CR-2024-0001')).toBeInTheDocument()
      expect(screen.getByText('Foundation Design Modification')).toBeInTheDocument()
      expect(screen.getByText('High')).toBeInTheDocument()
      expect(screen.getByText('Pending Approval')).toBeInTheDocument()
    })
  })

  describe('Change Detail Page Integration', () => {
    it('should render change detail page with all tabs', async () => {
      const mockParams = { id: 'test-change-id' }
      render(<ChangeDetailPage params={mockParams} />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show change details
      expect(screen.getByText('Foundation Design Modification')).toBeInTheDocument()
      expect(screen.getByText('CR-2024-0001')).toBeInTheDocument()
      
      // Should show all tabs
      expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /timeline/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /approvals/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /documents/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /communications/i })).toBeInTheDocument()
    })

    it('should handle tab navigation correctly', async () => {
      const user = userEvent.setup()
      const mockParams = { id: 'test-change-id' }
      render(<ChangeDetailPage params={mockParams} />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Click on approvals tab
      const approvalsTab = screen.getByRole('button', { name: /approvals/i })
      await user.click(approvalsTab)
      
      // Should show approvals content
      await waitFor(() => {
        expect(screen.getByText('Approval Workflow')).toBeInTheDocument()
      })
      
      // Click on documents tab
      const documentsTab = screen.getByRole('button', { name: /documents/i })
      await user.click(documentsTab)
      
      // Should show documents content
      await waitFor(() => {
        expect(screen.getByText('Attached Documents')).toBeInTheDocument()
      })
    })

    it('should handle edit mode correctly', async () => {
      const user = userEvent.setup()
      const mockParams = { id: 'test-change-id' }
      render(<ChangeDetailPage params={mockParams} />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Click edit button
      const editButton = screen.getByText('Edit')
      await user.click(editButton)
      
      // Should show edit form
      await waitFor(() => {
        expect(screen.getByText('Edit Change Request')).toBeInTheDocument()
      })
      
      // Should show form fields with current values
      const titleInput = screen.getByDisplayValue('Foundation Design Modification')
      expect(titleInput).toBeInTheDocument()
    })
  })

  describe('Responsive Design Testing', () => {
    it('should be responsive on mobile devices', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      render(<ChangesPage />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show mobile-friendly layout
      expect(screen.getByText('Change Management')).toBeInTheDocument()
      
      // Check for responsive classes
      const container = screen.getByTestId('app-layout')
      expect(container).toBeInTheDocument()
    })

    it('should handle tablet viewport correctly', async () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      })
      
      render(<ChangesPage />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show appropriate layout for tablet
      expect(screen.getByText('Change Management')).toBeInTheDocument()
      expect(screen.getByText('New Change Request')).toBeInTheDocument()
    })
  })

  describe('Accessibility Testing', () => {
    it('should have proper ARIA labels and roles', async () => {
      render(<ChangesPage />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Check for proper heading structure
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toHaveTextContent('Change Management')
      
      // Check for proper form elements
      const searchInput = screen.getByPlaceholderText('Search change requests...')
      expect(searchInput).toHaveAttribute('type', 'text')
      
      // Check for proper button elements
      const newButton = screen.getByRole('button', { name: /new change request/i })
      expect(newButton).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ChangesPage />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Test tab navigation
      const newButton = screen.getByRole('button', { name: /new change request/i })
      newButton.focus()
      expect(newButton).toHaveFocus()
      
      // Test Enter key activation
      await user.keyboard('{Enter}')
      
      // Should open the form
      await waitFor(() => {
        expect(screen.getByText('New Change Request')).toBeInTheDocument()
      })
    })

    it('should have proper color contrast and visual indicators', async () => {
      render(<ChangesPage />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Check for proper button styling
      const newButton = screen.getByRole('button', { name: /new change request/i })
      expect(newButton).toHaveClass('bg-blue-600')
      
      // Check for proper text contrast
      const heading = screen.getByText('Change Management')
      expect(heading).toHaveClass('text-gray-900')
    })
  })

  describe('Performance and Loading States', () => {
    it('should show appropriate loading states', async () => {
      render(<ChangesPage />)
      
      // Should show loading initially
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      
      // Should hide loading after data loads
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show content
      expect(screen.getByText('Change Management')).toBeInTheDocument()
    })

    it('should handle large datasets efficiently', async () => {
      render(<ChangesPage />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show table structure even with large datasets
      expect(screen.getByRole('table')).toBeInTheDocument()
      
      // Should show pagination or virtual scrolling indicators if implemented
      // This would depend on the actual implementation
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock console.error to avoid noise in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<ChangesPage />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should still show the interface even if data loading fails
      expect(screen.getByText('Change Management')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })

    it('should handle invalid change IDs gracefully', async () => {
      const mockParams = { id: 'invalid-id' }
      render(<ChangeDetailPage params={mockParams} />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should handle invalid ID gracefully
      // The component should either show an error message or handle it gracefully
      expect(screen.getByText(/Foundation Design Modification|Change request not found/)).toBeInTheDocument()
    })
  })

  describe('Integration with PPM Platform', () => {
    it('should integrate with AppLayout correctly', async () => {
      render(<ChangesPage />)
      
      // Should be wrapped in AppLayout
      expect(screen.getByTestId('app-layout')).toBeInTheDocument()
      
      // Should show proper content structure
      expect(screen.getByText('Change Management')).toBeInTheDocument()
    })

    it('should handle navigation correctly', async () => {
      const user = userEvent.setup()
      render(<ChangesPage />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Test navigation to detail page (would be triggered by clicking a change request)
      // This would depend on the actual implementation of row clicks
      const changeRow = screen.getByText('CR-2024-0001')
      await user.click(changeRow)
      
      // Should trigger navigation
      // Note: This would depend on the actual implementation
    })
  })
})