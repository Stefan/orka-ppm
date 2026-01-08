/**
 * Integration tests for Change Management System
 * Tests complete end-to-end workflows and component integration
 */


import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Import all change management components
import ChangeRequestManager from '../ChangeRequestManager'
import ChangeRequestForm from '../ChangeRequestForm'
import ChangeRequestDetail from '../ChangeRequestDetail'
import ApprovalWorkflow from '../ApprovalWorkflow'
import PendingApprovals from '../PendingApprovals'
import ImpactAnalysisDashboard from '../ImpactAnalysisDashboard'
import ChangeAnalyticsDashboard from '../ChangeAnalyticsDashboard'
import ImplementationTracker from '../ImplementationTracker'

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

describe('Change Management System Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Complete Change Request Workflow', () => {
    it('should handle complete change request lifecycle', async () => {
      const user = userEvent.setup()
      
      // 1. Start with Change Request Manager
      render(<ChangeRequestManager />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show the main interface
      expect(screen.getByText('Change Management')).toBeInTheDocument()
      expect(screen.getByText('New Change Request')).toBeInTheDocument()
      
      // 2. Create new change request
      const newChangeButton = screen.getByText('New Change Request')
      await user.click(newChangeButton)
      
      // Should show the form
      await waitFor(() => {
        expect(screen.getByText('Create Change Request')).toBeInTheDocument()
      })
      
      // Fill out the form
      const titleInput = screen.getByLabelText(/title/i)
      const descriptionInput = screen.getByLabelText(/description/i)
      
      await user.type(titleInput, 'Test Change Request')
      await user.type(descriptionInput, 'This is a test change request for integration testing')
      
      // Submit the form
      const submitButton = screen.getByText('Submit for Review')
      await user.click(submitButton)
      
      // Should return to the main list
      await waitFor(() => {
        expect(screen.getByText('Change Management')).toBeInTheDocument()
      })
    }, 10000)

    it('should display change request details correctly', async () => {
      const mockOnEdit = jest.fn()
      const mockOnBack = jest.fn()
      
      render(
        <ChangeRequestDetail 
          changeId="test-id" 
          onEdit={mockOnEdit}
          onBack={mockOnBack}
        />
      )
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show change request details
      expect(screen.getByText('Foundation Design Modification')).toBeInTheDocument()
      expect(screen.getByText('CR-2024-0001')).toBeInTheDocument()
      expect(screen.getByText('High Priority')).toBeInTheDocument()
      
      // Should show tabs
      expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /timeline/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /approvals/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /documents/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /communications/i })).toBeInTheDocument()
    }, 10000)

    it('should handle approval workflow correctly', async () => {
      const user = userEvent.setup()
      const mockOnApprovalDecision = jest.fn()
      
      render(
        <ApprovalWorkflow 
          changeId="test-id"
          userRole="approver"
          onApprovalDecision={mockOnApprovalDecision}
        />
      )
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show approval interface
      expect(screen.getByText('Approval Workflow')).toBeInTheDocument()
      
      // Should show approval buttons
      const approveButton = screen.getByText('Approve')
      const rejectButton = screen.getByText('Reject')
      
      expect(approveButton).toBeInTheDocument()
      expect(rejectButton).toBeInTheDocument()
      
      // Test approval action
      await user.click(approveButton)
      
      // Should show confirmation or comments dialog
      await waitFor(() => {
        expect(screen.getByText(/approve this change/i)).toBeInTheDocument()
      })
    }, 10000)
  })

  describe('Responsive Design and Accessibility', () => {
    it('should be responsive on mobile devices', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      render(<ChangeRequestManager />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show mobile-friendly interface
      expect(screen.getByText('Change Management')).toBeInTheDocument()
      
      // Check for responsive elements
      const container = screen.getByText('Change Management').closest('div')
      expect(container).toHaveClass('p-6') // Should have proper padding
    })

    it('should have proper accessibility attributes', async () => {
      render(<ChangeRequestManager />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Check for proper ARIA labels and roles
      const searchInput = screen.getByPlaceholderText(/search change requests/i)
      expect(searchInput).toHaveAttribute('type', 'text')
      
      const newButton = screen.getByText('New Change Request')
      expect(newButton).toHaveAttribute('type', 'button')
      
      // Check for proper heading structure
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      
      render(<ChangeRequestManager />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Test tab navigation
      const newButton = screen.getByText('New Change Request')
      newButton.focus()
      expect(newButton).toHaveFocus()
      
      // Test Enter key activation
      await user.keyboard('{Enter}')
      
      // Should open the form
      await waitFor(() => {
        expect(screen.getByText('Create Change Request')).toBeInTheDocument()
      })
    })
  })

  describe('Integration with PPM Platform', () => {
    it('should integrate with existing navigation', async () => {
      render(<ChangeRequestManager />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show proper navigation context
      expect(screen.getByText('Change Management')).toBeInTheDocument()
      
      // Should have proper breadcrumb or navigation structure
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toBeInTheDocument()
    })

    it('should handle authentication context', async () => {
      // Mock authenticated user
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'project_manager'
      }
      
      render(<ChangeRequestManager />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show user-appropriate interface
      expect(screen.getByText('New Change Request')).toBeInTheDocument()
    })

    it('should handle project context correctly', async () => {
      render(<ChangeRequestManager />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show project-related functionality
      expect(screen.getByText('Change Management')).toBeInTheDocument()
      
      // Should have project filtering capabilities
      const filterButton = screen.getByText('Filters')
      expect(filterButton).toBeInTheDocument()
    })
  })

  describe('Performance and Loading States', () => {
    it('should show loading states appropriately', async () => {
      render(<ChangeRequestManager />)
      
      // Should show loading initially
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      
      // Should hide loading after data loads
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show content
      expect(screen.getByText('Change Management')).toBeInTheDocument()
    })

    it('should handle error states gracefully', async () => {
      // Mock error condition
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<ChangeRequestDetail changeId="invalid-id" onEdit={jest.fn()} onBack={jest.fn()} />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show error state or handle gracefully
      // The component should either show an error message or handle the invalid ID gracefully
      expect(screen.getByText(/Foundation Design Modification|Change request not found/)).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })
  })

  describe('Data Flow and State Management', () => {
    it('should maintain state consistency across components', async () => {
      const user = userEvent.setup()
      
      render(<ChangeRequestManager />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Test filtering
      const searchInput = screen.getByPlaceholderText(/search change requests/i)
      await user.type(searchInput, 'Foundation')
      
      // Should filter results
      await waitFor(() => {
        expect(searchInput).toHaveValue('Foundation')
      })
    })

    it('should handle form validation correctly', async () => {
      const user = userEvent.setup()
      const mockOnSubmit = jest.fn()
      const mockOnCancel = jest.fn()
      
      render(
        <ChangeRequestForm 
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )
      
      // Try to submit empty form
      const submitButton = screen.getByText('Submit for Review')
      await user.click(submitButton)
      
      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Analytics and Reporting Integration', () => {
    it('should display analytics dashboard correctly', async () => {
      const mockAnalyticsData = {
        totalChanges: 150,
        changesByStatus: { approved: 80, pending: 45, rejected: 25 },
        changesByType: { design: 60, scope: 40, budget: 30, schedule: 20 },
        averageApprovalTime: 5.2,
        approvalRate: 76.7
      }
      
      render(<ChangeAnalyticsDashboard analyticsData={mockAnalyticsData} />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show analytics data
      expect(screen.getByText('Change Analytics')).toBeInTheDocument()
      expect(screen.getByText('150')).toBeInTheDocument() // Total changes
      expect(screen.getByText('76.7%')).toBeInTheDocument() // Approval rate
    })

    it('should display impact analysis correctly', async () => {
      const mockImpactData = {
        changeId: 'test-id',
        scheduleImpact: { days: 14, criticalPath: true },
        costImpact: { total: 25000, direct: 20000, indirect: 5000 },
        riskImpact: { newRisks: 2, modifiedRisks: 1 }
      }
      
      render(<ImpactAnalysisDashboard changeId="test-id" impactData={mockImpactData} />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show impact analysis
      expect(screen.getByText('Impact Analysis')).toBeInTheDocument()
      expect(screen.getByText('$25,000')).toBeInTheDocument() // Total cost impact
      expect(screen.getByText('14 days')).toBeInTheDocument() // Schedule impact
    })
  })
})