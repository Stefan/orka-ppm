
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangeRequestManager from '../ChangeRequestManager'

// Mock the router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock timers
jest.useFakeTimers()

describe('ChangeRequestManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
  })

  it('renders the component with loading state initially', () => {
    render(<ChangeRequestManager />)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders change requests after loading', async () => {
    render(<ChangeRequestManager />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check if mock data is displayed
    expect(screen.getByText('CR-2024-0001')).toBeInTheDocument()
    expect(screen.getByText('Foundation Design Modification')).toBeInTheDocument()
    expect(screen.getByText('CR-2024-0002')).toBeInTheDocument()
    expect(screen.getByText('Additional Safety Requirements')).toBeInTheDocument()
  })

  it('opens create form when New Change Request button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ChangeRequestManager />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const newButton = screen.getByRole('button', { name: /new change request/i })
    await user.click(newButton)

    // Should show the form
    expect(screen.getByText(/new change request/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
  })

  it('filters change requests by search term', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ChangeRequestManager />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search change requests/i)
    await user.type(searchInput, 'Foundation')

    // Should show filtered results
    expect(screen.getByText('Foundation Design Modification')).toBeInTheDocument()
    expect(screen.queryByText('Additional Safety Requirements')).not.toBeInTheDocument()
  })

  it('shows and hides filters when filter button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ChangeRequestManager />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const filterButton = screen.getByRole('button', { name: /filters/i })
    
    // Filters should be hidden initially
    expect(screen.queryByText('All Statuses')).not.toBeInTheDocument()
    
    await user.click(filterButton)
    
    // Filters should be visible
    expect(screen.getByText('All Statuses')).toBeInTheDocument()
    expect(screen.getByText('All Types')).toBeInTheDocument()
    expect(screen.getByText('All Priorities')).toBeInTheDocument()
  })

  it('selects and deselects individual items', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ChangeRequestManager />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    const firstItemCheckbox = checkboxes[1] // Skip the "select all" checkbox
    
    expect(firstItemCheckbox).not.toBeChecked()
    
    await user.click(firstItemCheckbox)
    
    expect(firstItemCheckbox).toBeChecked()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('selects all items when select all checkbox is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ChangeRequestManager />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
    
    await user.click(selectAllCheckbox)
    
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bulk approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bulk reject/i })).toBeInTheDocument()
  })

  it('navigates to detail view when view button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ChangeRequestManager />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const viewButtons = screen.getAllByTitle('View Details')
    await user.click(viewButtons[0])
    
    expect(mockPush).toHaveBeenCalledWith('/changes/1')
  })

  it('navigates to edit view when edit button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ChangeRequestManager />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])
    
    expect(mockPush).toHaveBeenCalledWith('/changes/1')
  })

  it('displays correct priority and status badges', async () => {
    render(<ChangeRequestManager />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check priority badges
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('critical')).toBeInTheDocument()

    // Check status indicators
    expect(screen.getByText('pending approval')).toBeInTheDocument()
    expect(screen.getByText('approved')).toBeInTheDocument()
  })

  it('shows implementation progress for approved changes', async () => {
    render(<ChangeRequestManager />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Should show progress bar and percentage
    expect(screen.getByText('65%')).toBeInTheDocument()
    
    // Check progress bar exists
    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars).toHaveLength(1)
  })
})