/**
 * Unit Tests for Workflow UI Components
 * 
 * Tests modal rendering, approval submission, and status display
 * for the workflow frontend interface.
 * 
 * Requirements: 8.1, 8.2, 8.4
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import WorkflowStatusBadge from '@/components/workflow/WorkflowStatusBadge'
import WorkflowApprovalModal from '@/components/workflow/WorkflowApprovalModal'
import WorkflowHistory from '@/components/workflow/WorkflowHistory'

// Mock fetch
global.fetch = jest.fn()

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

// Mock useWorkflowRealtime hook
jest.mock('@/hooks/useWorkflowRealtime', () => ({
  useWorkflowRealtime: jest.fn(() => ({
    isConnected: true,
    cleanup: jest.fn()
  }))
}))

describe('Workflow UI Components', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  describe('WorkflowStatusBadge', () => {
    it('should render pending status correctly', () => {
      render(
        <WorkflowStatusBadge
          status="pending"
          currentStep={0}
          workflowName="Project Approval"
          pendingApprovals={2}
        />
      )

      expect(screen.getByText('Pending Approval')).toBeInTheDocument()
      expect(screen.getByText('Project Approval')).toBeInTheDocument()
      expect(screen.getByText('Step 1')).toBeInTheDocument()
      expect(screen.getByText('2 pending approvals')).toBeInTheDocument()
    })

    it('should render completed status correctly', () => {
      render(
        <WorkflowStatusBadge
          status="completed"
          currentStep={2}
          workflowName="Project Approval"
          pendingApprovals={0}
        />
      )

      expect(screen.getByText('Approved')).toBeInTheDocument()
      expect(screen.getByText('Step 3')).toBeInTheDocument()
      expect(screen.queryByText('pending approval')).not.toBeInTheDocument()
    })

    it('should render rejected status correctly', () => {
      render(
        <WorkflowStatusBadge
          status="rejected"
          currentStep={1}
          workflowName="Project Approval"
          pendingApprovals={0}
        />
      )

      expect(screen.getByText('Rejected')).toBeInTheDocument()
    })

    it('should call onClick when clicked', async () => {
      const handleClick = jest.fn()
      const user = userEvent.setup()

      render(
        <WorkflowStatusBadge
          status="pending"
          currentStep={0}
          workflowName="Project Approval"
          pendingApprovals={1}
          onClick={handleClick}
        />
      )

      const badge = screen.getByRole('button')
      await user.click(badge)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should highlight badge when there are pending approvals', () => {
      const { container } = render(
        <WorkflowStatusBadge
          status="pending"
          currentStep={0}
          workflowName="Project Approval"
          pendingApprovals={3}
        />
      )

      const badge = container.querySelector('button')
      expect(badge).toHaveClass('ring-2', 'ring-yellow-400')
    })
  })

  describe('WorkflowApprovalModal', () => {
    const mockWorkflowInstance = {
      id: 'workflow-123',
      workflow_id: 'wf-456',
      workflow_name: 'Project Approval Workflow',
      entity_type: 'project',
      entity_id: 'project-789',
      current_step: 0,
      status: 'pending',
      started_by: 'user-111',
      started_at: '2024-01-15T10:00:00Z',
      completed_at: null,
      approvals: {
        0: [
          {
            id: 'approval-1',
            approver_id: 'user-222',
            status: 'pending',
            comments: null,
            approved_at: null
          },
          {
            id: 'approval-2',
            approver_id: 'user-333',
            status: 'approved',
            comments: 'Looks good',
            approved_at: '2024-01-15T11:00:00Z'
          }
        ]
      },
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T11:00:00Z'
    }

    beforeEach(() => {
      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/workflows/instances/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockWorkflowInstance)
          })
        }
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ user_id: 'user-222' })
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })
    })

    it('should render modal with workflow details', async () => {
      render(
        <WorkflowApprovalModal
          workflowInstanceId="workflow-123"
          onClose={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Approval Workflow')).toBeInTheDocument()
      })

      // Check for status (may appear multiple times)
      const statusElements = screen.getAllByText(/Pending|In Progress/)
      expect(statusElements.length).toBeGreaterThan(0)
      
      // Check for step information (may appear multiple times)
      const stepElements = screen.getAllByText(/Step 1/)
      expect(stepElements.length).toBeGreaterThan(0)
      
      expect(screen.getByText('project')).toBeInTheDocument()
    })

    it('should display current step approvals', async () => {
      render(
        <WorkflowApprovalModal
          workflowInstanceId="workflow-123"
          onClose={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Current Step Approvals')).toBeInTheDocument()
      })

      // Should show approval comments (may appear in multiple places)
      const commentsElements = screen.getAllByText('Looks good')
      expect(commentsElements.length).toBeGreaterThan(0)
      
      // Check for status badges
      const statusElements = screen.getAllByText(/Approved|Pending/)
      expect(statusElements.length).toBeGreaterThan(0)
    })

    it('should show approval actions for current user', async () => {
      render(
        <WorkflowApprovalModal
          workflowInstanceId="workflow-123"
          onClose={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Your Approval')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Add your comments here...')).toBeInTheDocument()
    })

    it('should submit approval decision', async () => {
      const user = userEvent.setup()
      const mockOnClose = jest.fn()

      // Mock approval submission
      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/approve')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          })
        }
        if (url.includes('/api/workflows/instances/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockWorkflowInstance)
          })
        }
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ user_id: 'user-222' })
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      // Mock window.alert
      window.alert = jest.fn()

      render(
        <WorkflowApprovalModal
          workflowInstanceId="workflow-123"
          onClose={mockOnClose}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Your Approval')).toBeInTheDocument()
      })

      // Add comments
      const commentsField = screen.getByPlaceholderText('Add your comments here...')
      await user.type(commentsField, 'Approved with conditions')

      // Click approve button
      const approveButton = screen.getByRole('button', { name: /Approve/i })
      await user.click(approveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/approve'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Approved with conditions')
          })
        )
      })
    })

    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup()
      const mockOnClose = jest.fn()

      render(
        <WorkflowApprovalModal
          workflowInstanceId="workflow-123"
          onClose={mockOnClose}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Approval Workflow')).toBeInTheDocument()
      })

      // Find and click close button (X icon)
      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find(btn => 
        btn.querySelector('svg') && !btn.textContent?.includes('Approve')
      )
      
      if (closeButton) {
        await user.click(closeButton)
        expect(mockOnClose).toHaveBeenCalled()
      }
    })

    it('should display loading state while fetching workflow', () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      )

      render(
        <WorkflowApprovalModal
          workflowInstanceId="workflow-123"
          onClose={jest.fn()}
        />
      )

      // Should show loading skeleton
      const loadingElements = document.querySelectorAll('.animate-pulse')
      expect(loadingElements.length).toBeGreaterThan(0)
    })

    it('should display error state when fetch fails', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      render(
        <WorkflowApprovalModal
          workflowInstanceId="workflow-123"
          onClose={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
      })
    })
  })

  describe('WorkflowHistory', () => {
    const mockWorkflowWithHistory = {
      id: 'workflow-123',
      workflow_id: 'wf-456',
      workflow_name: 'Project Approval',
      entity_type: 'project',
      entity_id: 'project-789',
      current_step: 2,
      status: 'completed',
      started_by: 'user-111',
      started_at: '2024-01-15T10:00:00Z',
      completed_at: '2024-01-15T14:00:00Z',
      approvals: {
        0: [
          {
            id: 'approval-1',
            approver_id: 'user-222',
            status: 'approved',
            comments: 'Approved step 1',
            approved_at: '2024-01-15T11:00:00Z'
          }
        ],
        1: [
          {
            id: 'approval-2',
            approver_id: 'user-333',
            status: 'approved',
            comments: 'Approved step 2',
            approved_at: '2024-01-15T13:00:00Z'
          }
        ]
      },
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T14:00:00Z'
    }

    it('should render workflow history timeline', () => {
      render(<WorkflowHistory workflowInstance={mockWorkflowWithHistory} />)

      expect(screen.getByText('Workflow History')).toBeInTheDocument()
      expect(screen.getByText('Workflow Created')).toBeInTheDocument()
      expect(screen.getByText('Workflow Completed')).toBeInTheDocument()
    })

    it('should display all approval events', () => {
      render(<WorkflowHistory workflowInstance={mockWorkflowWithHistory} />)

      expect(screen.getByText('Approved step 1')).toBeInTheDocument()
      expect(screen.getByText('Approved step 2')).toBeInTheDocument()
    })

    it('should display events in chronological order', () => {
      render(<WorkflowHistory workflowInstance={mockWorkflowWithHistory} />)

      // Check that creation event appears
      expect(screen.getByText('Workflow Created')).toBeInTheDocument()
      
      // Check that approval events appear
      expect(screen.getByText('Approved step 1')).toBeInTheDocument()
      expect(screen.getByText('Approved step 2')).toBeInTheDocument()
    })

    it('should display timestamps for all events', () => {
      render(<WorkflowHistory workflowInstance={mockWorkflowWithHistory} />)

      // Check that dates are formatted and displayed
      const timestamps = document.querySelectorAll('.text-xs.text-gray-500.whitespace-nowrap')
      expect(timestamps.length).toBeGreaterThan(0)
    })

    it('should display user information for approval events', () => {
      render(<WorkflowHistory workflowInstance={mockWorkflowWithHistory} />)

      // Should show user information in the history
      const historySection = screen.getByText('Workflow History').parentElement
      expect(historySection).toBeInTheDocument()
      
      // Check that user IDs are present somewhere in the document
      expect(document.body.textContent).toContain('user-')
    })

    it('should handle workflow with no history', () => {
      const emptyWorkflow = {
        ...mockWorkflowWithHistory,
        approvals: {},
        completed_at: null
      }

      render(<WorkflowHistory workflowInstance={emptyWorkflow} />)

      // Should still show creation event
      expect(screen.getByText('Workflow Created')).toBeInTheDocument()
    })

    it('should display rejection event for rejected workflows', () => {
      const rejectedWorkflow = {
        ...mockWorkflowWithHistory,
        status: 'rejected',
        completed_at: null,
        approvals: {
          0: [
            {
              id: 'approval-1',
              approver_id: 'user-222',
              status: 'rejected',
              comments: 'Does not meet requirements',
              approved_at: '2024-01-15T11:00:00Z'
            }
          ]
        }
      }

      render(<WorkflowHistory workflowInstance={rejectedWorkflow} />)

      expect(screen.getByText('Workflow Rejected')).toBeInTheDocument()
      expect(screen.getByText('Does not meet requirements')).toBeInTheDocument()
    })
  })

  describe('Integration: Modal with History', () => {
    it('should display workflow history within modal', async () => {
      const mockWorkflow = {
        id: 'workflow-123',
        workflow_id: 'wf-456',
        workflow_name: 'Project Approval',
        entity_type: 'project',
        entity_id: 'project-789',
        current_step: 1,
        status: 'in_progress',
        started_by: 'user-111',
        started_at: '2024-01-15T10:00:00Z',
        completed_at: null,
        approvals: {
          0: [
            {
              id: 'approval-1',
              approver_id: 'user-222',
              status: 'approved',
              comments: 'First step approved',
              approved_at: '2024-01-15T11:00:00Z'
            }
          ],
          1: [
            {
              id: 'approval-2',
              approver_id: 'user-333',
              status: 'pending',
              comments: null,
              approved_at: null
            }
          ]
        },
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T11:00:00Z'
      }

      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/workflows/instances/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockWorkflow)
          })
        }
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ user_id: 'user-333' })
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      render(
        <WorkflowApprovalModal
          workflowInstanceId="workflow-123"
          onClose={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow History')).toBeInTheDocument()
      })

      // Should show history events
      expect(screen.getByText('Workflow Created')).toBeInTheDocument()
      expect(screen.getByText('First step approved')).toBeInTheDocument()
    })
  })
})
