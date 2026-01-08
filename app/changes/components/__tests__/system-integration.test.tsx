/**
 * System Integration Test for Change Management
 * Verifies that the change management system integrates properly with the PPM platform
 */


import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Import key components
import ChangeRequestManager from '../ChangeRequestManager'
import ChangeRequestDetail from '../ChangeRequestDetail'
import ChangeRequestForm from '../ChangeRequestForm'
import ApprovalWorkflow from '../ApprovalWorkflow'
import ImpactAnalysisDashboard from '../ImpactAnalysisDashboard'
import ChangeAnalyticsDashboard from '../ChangeAnalyticsDashboard'

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/changes',
}))

describe('Change Management System Integration', () => {
  describe('Core Component Rendering', () => {
    it('should render ChangeRequestManager without errors', async () => {
      render(<ChangeRequestManager />)
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show main interface elements
      expect(screen.getByText('New Change Request')).toBeInTheDocument()
      expect(screen.getByText('Filters')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search change requests...')).toBeInTheDocument()
    })

    it('should render ChangeRequestDetail without errors', async () => {
      const mockProps = {
        changeId: 'test-id',
        onEdit: jest.fn(),
        onBack: jest.fn()
      }
      
      render(<ChangeRequestDetail {...mockProps} />)
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show change details
      expect(screen.getByText('Foundation Design Modification')).toBeInTheDocument()
      expect(screen.getByText('CR-2024-0001')).toBeInTheDocument()
    })

    it('should render ChangeRequestForm without errors', () => {
      const mockProps = {
        onSubmit: jest.fn(),
        onCancel: jest.fn()
      }
      
      render(<ChangeRequestForm {...mockProps} />)
      
      // Should show form elements
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/project/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/change type/i)).toBeInTheDocument()
    })

    it('should render ApprovalWorkflow without errors', () => {
      const mockProps = {
        changeId: 'test-id',
        userRole: 'approver',
        onApprovalDecision: jest.fn()
      }
      
      render(<ApprovalWorkflow {...mockProps} />)
      
      // Should show approval interface
      expect(screen.getByText('Approval Workflow')).toBeInTheDocument()
    })

    it('should render ImpactAnalysisDashboard without errors', () => {
      const mockProps = {
        changeId: 'test-id',
        impactData: {
          changeId: 'test-id',
          scheduleImpact: { days: 14, criticalPath: true },
          costImpact: { total: 25000, direct: 20000, indirect: 5000 },
          riskImpact: { newRisks: 2, modifiedRisks: 1 }
        }
      }
      
      render(<ImpactAnalysisDashboard {...mockProps} />)
      
      // Should show impact analysis
      expect(screen.getByText('Impact Analysis')).toBeInTheDocument()
    })

    it('should render ChangeAnalyticsDashboard without errors', () => {
      const mockProps = {
        analyticsData: {
          total_changes: 150,
          changes_by_status: { approved: 80, pending: 45, rejected: 25 },
          changes_by_type: { design: 60, scope: 40, budget: 30, schedule: 20 },
          changes_by_priority: { high: 30, medium: 80, low: 40 },
          average_approval_time_days: 5.2,
          average_implementation_time_days: 12.5,
          approval_rate_percentage: 76.7,
          cost_estimate_accuracy: 85.3,
          schedule_estimate_accuracy: 78.9,
          monthly_change_volume: [
            { month: 'Jan', approved_changes: 12, rejected_changes: 3 },
            { month: 'Feb', approved_changes: 15, rejected_changes: 2 }
          ],
          top_change_categories: [
            { category: 'Design', count: 60 },
            { category: 'Scope', count: 40 }
          ],
          changes_by_project: [
            { project_name: 'Project A', count: 25 },
            { project_name: 'Project B', count: 20 }
          ],
          high_impact_changes: [
            { id: '1', title: 'Major Design Change', impact_score: 8.5 }
          ]
        }
      }
      
      render(<ChangeAnalyticsDashboard {...mockProps} />)
      
      // Should show analytics
      expect(screen.getByText('Change Analytics')).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should handle form interactions correctly', async () => {
      const user = userEvent.setup()
      const mockOnSubmit = jest.fn()
      const mockOnCancel = jest.fn()
      
      render(<ChangeRequestForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      
      // Fill out form fields
      const titleInput = screen.getByLabelText(/title/i)
      await user.type(titleInput, 'Test Change Request')
      
      expect(titleInput).toHaveValue('Test Change Request')
      
      // Test cancel button
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)
      
      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('should handle search functionality', async () => {
      const user = userEvent.setup()
      
      render(<ChangeRequestManager />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Test search input
      const searchInput = screen.getByPlaceholderText('Search change requests...')
      await user.type(searchInput, 'Foundation')
      
      expect(searchInput).toHaveValue('Foundation')
    })

    it('should handle tab navigation in detail view', async () => {
      const user = userEvent.setup()
      const mockProps = {
        changeId: 'test-id',
        onEdit: jest.fn(),
        onBack: jest.fn()
      }
      
      render(<ChangeRequestDetail {...mockProps} />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Test tab navigation
      const documentsTab = screen.getByRole('button', { name: /documents/i })
      await user.click(documentsTab)
      
      // Should show documents content
      await waitFor(() => {
        expect(screen.getByText('Attached Documents')).toBeInTheDocument()
      })
    })
  })

  describe('Data Integration', () => {
    it('should display mock data correctly', async () => {
      render(<ChangeRequestManager />)
      
      // Wait for loading and data
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Should show mock change request data
      expect(screen.getByText('CR-2024-0001')).toBeInTheDocument()
      expect(screen.getByText('Foundation Design Modification')).toBeInTheDocument()
    })

    it('should handle empty states gracefully', () => {
      // Test with no data
      const mockProps = {
        analyticsData: {
          total_changes: 0,
          changes_by_status: {},
          changes_by_type: {},
          changes_by_priority: {},
          average_approval_time_days: 0,
          average_implementation_time_days: 0,
          approval_rate_percentage: 0,
          cost_estimate_accuracy: 0,
          schedule_estimate_accuracy: 0,
          monthly_change_volume: [],
          top_change_categories: [],
          changes_by_project: [],
          high_impact_changes: []
        }
      }
      
      render(<ChangeAnalyticsDashboard {...mockProps} />)
      
      // Should handle empty data gracefully
      expect(screen.getByText('Change Analytics')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument() // Total changes
    })
  })

  describe('Error Handling', () => {
    it('should handle component errors gracefully', () => {
      // Mock console.error to avoid noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      // Test with invalid props
      const mockProps = {
        changeId: '',
        onEdit: jest.fn(),
        onBack: jest.fn()
      }
      
      render(<ChangeRequestDetail {...mockProps} />)
      
      // Should not crash
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(<ChangeRequestManager />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Check for proper button roles
      const newButton = screen.getByRole('button', { name: /new change request/i })
      expect(newButton).toBeInTheDocument()
      
      // Check for proper input labels
      const searchInput = screen.getByPlaceholderText('Search change requests...')
      expect(searchInput).toHaveAttribute('type', 'text')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      
      render(<ChangeRequestManager />)
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      // Test keyboard focus
      const newButton = screen.getByRole('button', { name: /new change request/i })
      newButton.focus()
      expect(newButton).toHaveFocus()
      
      // Test tab navigation
      await user.tab()
      const filterButton = screen.getByRole('button', { name: /filters/i })
      expect(filterButton).toHaveFocus()
    })
  })

  describe('Performance', () => {
    it('should render components within reasonable time', async () => {
      const startTime = Date.now()
      
      render(<ChangeRequestManager />)
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      }, { timeout: 2000 })
      
      const endTime = Date.now()
      const renderTime = endTime - startTime
      
      // Should render within 2 seconds
      expect(renderTime).toBeLessThan(2000)
    })
  })
})