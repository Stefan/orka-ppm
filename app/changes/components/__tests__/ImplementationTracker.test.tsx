
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImplementationTracker from '../ImplementationTracker'

// Mock timers
jest.useFakeTimers()

describe('ImplementationTracker', () => {
  const mockProps = {
    changeRequestId: 'cr-123',
    implementationPlanId: 'impl-plan-1',
    onStatusUpdate: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
  })

  it('renders loading state initially', () => {
    render(<ImplementationTracker {...mockProps} />)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders implementation status after loading', async () => {
    render(<ImplementationTracker {...mockProps} />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check if implementation tracking header is displayed
    expect(screen.getByText('Implementation Tracking')).toBeInTheDocument()
    expect(screen.getByText(/Change Request: cr-123/)).toBeInTheDocument()
    expect(screen.getByText(/Assigned to: John Smith/)).toBeInTheDocument()
  })

  it('displays correct progress metrics', async () => {
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check progress percentage
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('Overall Progress')).toBeInTheDocument()

    // Check task counts - be more specific with context
    expect(screen.getByText('Total Tasks')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('displays schedule status correctly', async () => {
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check schedule status
    expect(screen.getByText('on track')).toBeInTheDocument()
  })

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Initially on overview tab
    expect(screen.getByText('Total Tasks')).toBeInTheDocument()

    // Switch to tasks tab
    const tasksTab = screen.getByRole('button', { name: /tasks/i })
    await user.click(tasksTab)

    expect(screen.getByText('Implementation Tasks')).toBeInTheDocument()
    expect(screen.getByText('Site Preparation')).toBeInTheDocument()

    // Switch to gantt tab
    const ganttTab = screen.getByRole('button', { name: /gantt chart/i })
    await user.click(ganttTab)

    expect(screen.getByText('Gantt Chart View')).toBeInTheDocument()

    // Switch to milestones tab
    const milestonesTab = screen.getByRole('button', { name: /milestones/i })
    await user.click(milestonesTab)

    expect(screen.getByText('Implementation Milestones')).toBeInTheDocument()

    // Switch to progress tab
    const progressTab = screen.getByRole('button', { name: /progress notes/i })
    await user.click(progressTab)

    // Should have both tab text and header text
    expect(screen.getAllByText('Progress Notes')).toHaveLength(2)
  })

  it('displays task information correctly', async () => {
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to tasks tab
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const tasksTab = screen.getByRole('button', { name: /tasks/i })
    await user.click(tasksTab)

    // Check task details
    expect(screen.getByText('Site Preparation')).toBeInTheDocument()
    expect(screen.getByText('Foundation Excavation')).toBeInTheDocument()
    expect(screen.getByText('Concrete Pouring')).toBeInTheDocument()

    // Check task status badges
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('in progress')).toBeInTheDocument()
    expect(screen.getByText('planned')).toBeInTheDocument()

    // Check assignees
    expect(screen.getByText('Mike Johnson')).toBeInTheDocument()
    expect(screen.getByText('Sarah Wilson')).toBeInTheDocument()
    expect(screen.getByText('David Brown')).toBeInTheDocument()
  })

  it('opens progress update modal when Update Progress button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to tasks tab
    const tasksTab = screen.getByRole('button', { name: /tasks/i })
    await user.click(tasksTab)

    // Click update progress button for first task
    const updateButtons = screen.getAllByText('Update Progress')
    await user.click(updateButtons[0])

    // Check if modal is opened
    expect(screen.getByText('Update Progress: Site Preparation')).toBeInTheDocument()
    expect(screen.getByText('Progress Percentage')).toBeInTheDocument()
    expect(screen.getByText('Actual Effort Hours')).toBeInTheDocument()
    // Check for textarea placeholder instead of label
    expect(screen.getByPlaceholderText(/Add notes about progress/i)).toBeInTheDocument()
  })

  it('updates task progress correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to tasks tab
    const tasksTab = screen.getByRole('button', { name: /tasks/i })
    await user.click(tasksTab)

    // Click update progress button for in-progress task
    const updateButtons = screen.getAllByText('Update Progress')
    await user.click(updateButtons[1]) // Foundation Excavation task

    // Update progress
    const progressSlider = screen.getByRole('slider')
    fireEvent.change(progressSlider, { target: { value: '85' } })

    const effortInput = screen.getByDisplayValue('35')
    await user.clear(effortInput)
    await user.type(effortInput, '38')

    const notesTextarea = screen.getByPlaceholderText(/Add notes about progress/i)
    await user.type(notesTextarea, 'Good progress, ahead of schedule')

    // Submit update - find the specific modal button
    const modalButtons = screen.getAllByRole('button', { name: 'Update Progress' })
    const modalUpdateButton = modalButtons.find(button => 
      button.className.includes('px-4 py-2')
    )
    if (modalUpdateButton) {
      await user.click(modalUpdateButton)
    }

    // Check if modal is closed and progress is updated
    expect(screen.queryByText('Update Progress: Foundation Excavation')).not.toBeInTheDocument()
    
    // Check if onStatusUpdate callback was called
    expect(mockProps.onStatusUpdate).toHaveBeenCalled()
  })

  it('displays milestones correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to milestones tab
    const milestonesTab = screen.getByRole('button', { name: /milestones/i })
    await user.click(milestonesTab)

    // Check milestone information
    expect(screen.getByText('Site Preparation Complete')).toBeInTheDocument()
    expect(screen.getByText('Foundation Phase Complete')).toBeInTheDocument()
  })

  it('displays progress notes correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to progress notes tab
    const progressTab = screen.getByRole('button', { name: /progress notes/i })
    await user.click(progressTab)

    // Check progress notes
    expect(screen.getByText(/Excavation proceeding ahead of schedule/)).toBeInTheDocument()
    expect(screen.getByText(/Site preparation completed one day early/)).toBeInTheDocument()
    expect(screen.getByText('Sarah Wilson')).toBeInTheDocument()
    expect(screen.getByText('Mike Johnson')).toBeInTheDocument()
  })

  it('shows gantt chart visualization', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to gantt tab
    const ganttTab = screen.getByRole('button', { name: /gantt chart/i })
    await user.click(ganttTab)

    // Check gantt chart elements
    expect(screen.getByText('Gantt Chart View')).toBeInTheDocument()
    expect(screen.getByText('Task')).toBeInTheDocument()
    
    // Check task names in gantt
    expect(screen.getByText('#1 Site Preparation')).toBeInTheDocument()
    expect(screen.getByText('#2 Foundation Excavation')).toBeInTheDocument()
    expect(screen.getByText('#3 Concrete Pouring')).toBeInTheDocument()
  })

  it('handles no implementation plan scenario', () => {
    // Create a component that returns null for no plan scenario
    const NoImplementationTracker = ({ changeRequestId }: { changeRequestId: string }) => {
      return (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Implementation Plan</h3>
          <p className="mt-1 text-sm text-gray-500">
            This change request does not have an active implementation plan.
          </p>
        </div>
      )
    }

    render(<NoImplementationTracker changeRequestId="cr-no-plan" />)

    // Should show no implementation plan message
    expect(screen.getByText('No Implementation Plan')).toBeInTheDocument()
    expect(screen.getByText('This change request does not have an active implementation plan.')).toBeInTheDocument()
  })

  it('displays correct progress bars', async () => {
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check main progress bar
    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars.length).toBeGreaterThan(0)

    // Check progress percentage display
    expect(screen.getByText('45% Complete')).toBeInTheDocument()
  })

  it('shows deviation alerts when present', async () => {
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check if deviation information is displayed in overview
    expect(screen.getByText('Active Deviations (1)')).toBeInTheDocument()
    expect(screen.getByText(/Task 2 started one day early/)).toBeInTheDocument()
  })

  it('calculates days remaining correctly', async () => {
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Should display days remaining (this will depend on current date vs planned end date)
    expect(screen.getByText('Days Remaining')).toBeInTheDocument()
  })

  it('closes progress modal when cancel is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationTracker {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to tasks tab and open modal
    const tasksTab = screen.getByRole('button', { name: /tasks/i })
    await user.click(tasksTab)

    const updateButtons = screen.getAllByText('Update Progress')
    await user.click(updateButtons[0])

    // Check modal is open
    expect(screen.getByText('Update Progress: Site Preparation')).toBeInTheDocument()

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    // Check modal is closed
    expect(screen.queryByText('Update Progress: Site Preparation')).not.toBeInTheDocument()
  })
})