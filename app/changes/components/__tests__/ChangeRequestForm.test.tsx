
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangeRequestForm from '../ChangeRequestForm'

const mockOnSubmit = jest.fn()
const mockOnCancel = jest.fn()

const defaultProps = {
  onSubmit: mockOnSubmit,
  onCancel: mockOnCancel,
}

describe('ChangeRequestForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the form with required fields', () => {
    render(<ChangeRequestForm {...defaultProps} />)
    
    expect(screen.getByText('New Change Request')).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/project/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/change type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
  })

  it('shows edit mode when changeId is provided', () => {
    render(<ChangeRequestForm {...defaultProps} changeId="123" />)
    
    expect(screen.getByText('Edit Change Request')).toBeInTheDocument()
  })

  it('validates required fields on submit', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    const submitButton = screen.getByRole('button', { name: /create change request/i })
    await user.click(submitButton)
    
    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(screen.getByText('Description is required')).toBeInTheDocument()
    expect(screen.getByText('Change type is required')).toBeInTheDocument()
    expect(screen.getByText('Project selection is required')).toBeInTheDocument()
    
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('validates minimum field lengths', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    const titleInput = screen.getByLabelText(/title/i)
    const descriptionInput = screen.getByLabelText(/description/i)
    
    await user.type(titleInput, 'abc') // Less than 5 characters
    await user.type(descriptionInput, 'short') // Less than 10 characters
    
    const submitButton = screen.getByRole('button', { name: /create change request/i })
    await user.click(submitButton)
    
    expect(screen.getByText('Title must be at least 5 characters')).toBeInTheDocument()
    expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument()
  })

  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    // Fill in required fields
    await user.type(screen.getByLabelText(/title/i), 'Test Change Request')
    await user.type(screen.getByLabelText(/description/i), 'This is a test description that is long enough')
    await user.selectOptions(screen.getByLabelText(/change type/i), 'design')
    await user.selectOptions(screen.getByLabelText(/priority/i), 'high')
    await user.selectOptions(screen.getByLabelText(/project/i), 'proj-1')
    
    const submitButton = screen.getByRole('button', { name: /create change request/i })
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Change Request',
          description: 'This is a test description that is long enough',
          change_type: 'design',
          priority: 'high',
          project_id: 'proj-1',
        })
      )
    })
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)
    
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('loads and applies template when selected', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Design Change Template')).toBeInTheDocument()
    })
    
    const templateSelect = screen.getByLabelText(/template/i)
    await user.selectOptions(templateSelect, 'template-1')
    
    // Should show template-specific fields
    expect(screen.getByLabelText(/design area affected/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/affected drawing numbers/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/technical justification/i)).toBeInTheDocument()
    
    // Should auto-select change type
    expect(screen.getByDisplayValue('design')).toBeInTheDocument()
  })

  it('shows project linkages when project is selected', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('Office Complex Phase 1')).toBeInTheDocument()
    })
    
    const projectSelect = screen.getByLabelText(/project/i)
    await user.selectOptions(projectSelect, 'proj-1')
    
    // Should show project linkages section
    expect(screen.getByText('Project Linkages')).toBeInTheDocument()
    expect(screen.getByText('Affected Milestones')).toBeInTheDocument()
    expect(screen.getByText('Affected Purchase Orders')).toBeInTheDocument()
    
    // Should show milestone and PO options
    expect(screen.getByText('Foundation Complete')).toBeInTheDocument()
    expect(screen.getByText('PO-2024-001 - Concrete Supply')).toBeInTheDocument()
  })

  it('handles file uploads', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByLabelText(/upload documents/i)
    
    await user.upload(fileInput, file)
    
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
    expect(screen.getByText('(0.00 MB)')).toBeInTheDocument()
  })

  it('removes uploaded files when remove button is clicked', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByLabelText(/upload documents/i)
    
    await user.upload(fileInput, file)
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
    
    const removeButton = screen.getByRole('button', { name: /remove/i })
    await user.click(removeButton)
    
    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument()
  })

  it('handles impact estimation inputs', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    const costInput = screen.getByLabelText(/estimated cost impact/i)
    const scheduleInput = screen.getByLabelText(/schedule impact/i)
    const effortInput = screen.getByLabelText(/effort hours/i)
    
    await user.type(costInput, '25000')
    await user.type(scheduleInput, '14')
    await user.type(effortInput, '120')
    
    expect(costInput).toHaveValue(25000)
    expect(scheduleInput).toHaveValue(14)
    expect(effortInput).toHaveValue(120)
  })

  it('shows impact calculator when toggle is clicked', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    const calculatorButton = screen.getByRole('button', { name: /show impact calculator/i })
    await user.click(calculatorButton)
    
    expect(screen.getByRole('button', { name: /hide impact calculator/i })).toBeInTheDocument()
  })

  it('validates template fields when template is selected', async () => {
    const user = userEvent.setup()
    render(<ChangeRequestForm {...defaultProps} />)
    
    // Wait for templates to load and select one
    await waitFor(() => {
      expect(screen.getByText('Design Change Template')).toBeInTheDocument()
    })
    
    const templateSelect = screen.getByLabelText(/template/i)
    await user.selectOptions(templateSelect, 'template-1')
    
    // Fill in basic required fields
    await user.type(screen.getByLabelText(/title/i), 'Test Change Request')
    await user.type(screen.getByLabelText(/description/i), 'This is a test description that is long enough')
    await user.selectOptions(screen.getByLabelText(/project/i), 'proj-1')
    
    // Try to submit without template fields
    const submitButton = screen.getByRole('button', { name: /create change request/i })
    await user.click(submitButton)
    
    expect(screen.getByText('Design Area Affected is required')).toBeInTheDocument()
    expect(screen.getByText('Affected Drawing Numbers is required')).toBeInTheDocument()
    expect(screen.getByText('Technical Justification is required')).toBeInTheDocument()
  })

  it('pre-fills form with initial data when provided', () => {
    const initialData = {
      title: 'Existing Change Request',
      description: 'Existing description',
      change_type: 'budget',
      priority: 'critical',
    }
    
    render(<ChangeRequestForm {...defaultProps} initialData={initialData} />)
    
    expect(screen.getByDisplayValue('Existing Change Request')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument()
    expect(screen.getByDisplayValue('budget')).toBeInTheDocument()
    expect(screen.getByDisplayValue('critical')).toBeInTheDocument()
  })

  it('shows loading state during form submission', async () => {
    const user = userEvent.setup()
    
    // Mock a slow submission
    const slowSubmit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)))
    render(<ChangeRequestForm {...defaultProps} onSubmit={slowSubmit} />)
    
    // Fill in required fields
    await user.type(screen.getByLabelText(/title/i), 'Test Change Request')
    await user.type(screen.getByLabelText(/description/i), 'This is a test description that is long enough')
    await user.selectOptions(screen.getByLabelText(/change type/i), 'design')
    await user.selectOptions(screen.getByLabelText(/project/i), 'proj-1')
    
    const submitButton = screen.getByRole('button', { name: /create change request/i })
    await user.click(submitButton)
    
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })
})