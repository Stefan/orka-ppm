
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangeRequestDetail from '../ChangeRequestDetail'

const mockOnEdit = jest.fn()
const mockOnBack = jest.fn()

const defaultProps = {
  changeId: '1',
  onEdit: mockOnEdit,
  onBack: mockOnBack,
}

describe('ChangeRequestDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state initially', () => {
    render(<ChangeRequestDetail {...defaultProps} />)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders change request details after loading', async () => {
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check header information
    expect(screen.getByText('CR-2024-0001')).toBeInTheDocument()
    expect(screen.getByText('Foundation Design Modification')).toBeInTheDocument()
    expect(screen.getByText('pending approval')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const backButton = screen.getByRole('button', { name: /back to list/i })
    await user.click(backButton)
    
    expect(mockOnBack).toHaveBeenCalled()
  })

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)
    
    expect(mockOnEdit).toHaveBeenCalled()
  })

  it('displays all tab navigation options', async () => {
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /timeline/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approvals/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /documents/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /communications/i })).toBeInTheDocument()
  })

  it('shows overview tab content by default', async () => {
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check overview content
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Justification')).toBeInTheDocument()
    expect(screen.getByText('Impact Analysis')).toBeInTheDocument()
    expect(screen.getByText('Project Linkages')).toBeInTheDocument()
    
    // Check impact values
    expect(screen.getByText('$25,000')).toBeInTheDocument()
    expect(screen.getByText('14 days')).toBeInTheDocument()
  })

  it('switches to timeline tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const timelineTab = screen.getByRole('button', { name: /timeline/i })
    await user.click(timelineTab)
    
    expect(screen.getByText('Change Request Timeline')).toBeInTheDocument()
    expect(screen.getByText('Initial change request submitted for review')).toBeInTheDocument()
    expect(screen.getByText('Status changed from Draft to Submitted')).toBeInTheDocument()
  })

  it('switches to approvals tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const approvalsTab = screen.getByRole('button', { name: /approvals/i })
    await user.click(approvalsTab)
    
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument()
    expect(screen.getByText('Approval History')).toBeInTheDocument()
    expect(screen.getByText('Step 1: Sarah Johnson')).toBeInTheDocument()
    expect(screen.getByText('Technical Review Team')).toBeInTheDocument()
  })

  it('switches to documents tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const documentsTab = screen.getByRole('button', { name: /documents/i })
    await user.click(documentsTab)
    
    expect(screen.getByText('Attachments')).toBeInTheDocument()
    expect(screen.getByText('Geotechnical_Report_Rev2.pdf')).toBeInTheDocument()
    expect(screen.getByText('Foundation_Design_Changes.dwg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument()
  })

  it('switches to communications tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const communicationsTab = screen.getByRole('button', { name: /communications/i })
    await user.click(communicationsTab)
    
    expect(screen.getByText('Add Comment')).toBeInTheDocument()
    expect(screen.getByText('Communication History')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add comment/i })).toBeInTheDocument()
  })

  it('displays project linkages correctly', async () => {
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check affected milestones
    expect(screen.getByText('Affected Milestones')).toBeInTheDocument()
    expect(screen.getByText('Foundation Complete')).toBeInTheDocument()
    expect(screen.getByText('Structure Complete')).toBeInTheDocument()
    
    // Check affected purchase orders
    expect(screen.getByText('Affected Purchase Orders')).toBeInTheDocument()
    expect(screen.getByText('PO-2024-001 - Concrete Supply')).toBeInTheDocument()
    expect(screen.getByText('PO-2024-003 - Foundation Materials')).toBeInTheDocument()
  })

  it('displays request details in sidebar', async () => {
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    expect(screen.getByText('Request Details')).toBeInTheDocument()
    expect(screen.getByText('Requested by:')).toBeInTheDocument()
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('Requested:')).toBeInTheDocument()
    expect(screen.getByText('Required by:')).toBeInTheDocument()
    expect(screen.getByText('Type:')).toBeInTheDocument()
    expect(screen.getByText('design')).toBeInTheDocument()
  })

  it('shows implementation progress when available', async () => {
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    expect(screen.getByText('Implementation Progress')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    
    // Check progress bar
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toBeInTheDocument()
  })

  it('formats file sizes correctly', async () => {
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const documentsTab = screen.getByRole('button', { name: /documents/i })
    await userEvent.setup().click(documentsTab)
    
    // Check file size formatting
    expect(screen.getByText('2 MB')).toBeInTheDocument()
    expect(screen.getByText('1.46 MB')).toBeInTheDocument()
  })

  it('handles adding comments in communications tab', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const communicationsTab = screen.getByRole('button', { name: /communications/i })
    await user.click(communicationsTab)
    
    const commentInput = screen.getByPlaceholderText(/add a comment/i)
    const addButton = screen.getByRole('button', { name: /add comment/i })
    
    await user.type(commentInput, 'This is a test comment')
    await user.click(addButton)
    
    // Comment should be cleared after submission
    expect(commentInput).toHaveValue('')
  })

  it('displays communication history with correct types', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const communicationsTab = screen.getByRole('button', { name: /communications/i })
    await user.click(communicationsTab)
    
    // Check different communication types
    expect(screen.getByText('comment')).toBeInTheDocument()
    expect(screen.getByText('status change')).toBeInTheDocument()
    expect(screen.getByText('approval')).toBeInTheDocument()
  })

  it('shows error state when change request is not found', async () => {
    // Mock a failed load
    jest.spyOn(React, 'useEffect').mockImplementationOnce((effect) => {
      effect()
      return () => {}
    })
    
    render(<ChangeRequestDetail {...defaultProps} changeId="nonexistent" />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    expect(screen.getByText('Change request not found')).toBeInTheDocument()
    expect(screen.getByText('The requested change request could not be loaded.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  it('displays correct status icons', async () => {
    render(<ChangeRequestDetail {...defaultProps} />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Should show appropriate status icon for pending approval
    const statusIcons = screen.getAllByTestId('status-icon')
    expect(statusIcons.length).toBeGreaterThan(0)
  })
})