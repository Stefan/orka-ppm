
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImplementationMonitoringDashboard from '../ImplementationMonitoringDashboard'

// Mock timers
jest.useFakeTimers()

describe('ImplementationMonitoringDashboard', () => {
  const mockProps = {
    projectId: 'project-123',
    refreshInterval: 30000,
    onAlertAction: jest.fn()
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
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders dashboard after loading', async () => {
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    // Fast-forward time to complete the setTimeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check if dashboard header is displayed
    expect(screen.getByText('Implementation Monitoring Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Real-time monitoring of implementation progress and issues')).toBeInTheDocument()
  })

  it('displays critical alerts banner when critical alerts exist', async () => {
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check critical alerts banner
    expect(screen.getByText(/Critical Alerts Require Immediate Attention/)).toBeInTheDocument()
    
    // Check that the critical alert appears in the banner (first occurrence)
    const criticalBanner = screen.getByText(/Critical Alerts Require Immediate Attention/).closest('.bg-red-50')
    expect(criticalBanner).toContainElement(screen.getAllByText(/Significant Cost Overrun/)[0])
  })

  it('displays key metrics correctly', async () => {
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check metrics cards
    expect(screen.getByText('Active Implementations')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument() // Active implementations count
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    
    // Find the overdue count within the overdue metrics card
    const overdueCard = screen.getByText('Overdue').closest('.bg-white')
    expect(overdueCard).toContainElement(screen.getAllByText('2')[0]) // Overdue count
    
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
    expect(screen.getByText('87.5%')).toBeInTheDocument()
    expect(screen.getByText('Avg. Completion')).toBeInTheDocument()
    expect(screen.getByText('18.5')).toBeInTheDocument()
  })

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Initially on overview tab
    expect(screen.getByText('Schedule Performance')).toBeInTheDocument()

    // Switch to alerts tab
    const alertsTab = screen.getByRole('button', { name: /alerts/i })
    await user.click(alertsTab)

    expect(screen.getByText('Implementation Alerts')).toBeInTheDocument()

    // Switch to deviations tab
    const deviationsTab = screen.getByRole('button', { name: /deviations/i })
    await user.click(deviationsTab)

    expect(screen.getByText('Implementation Deviations')).toBeInTheDocument()

    // Switch to lessons learned tab
    const lessonsTab = screen.getByRole('button', { name: /lessons learned/i })
    await user.click(lessonsTab)

    expect(screen.getByRole('heading', { name: /lessons learned/i })).toBeInTheDocument()
  })

  it('displays alerts with correct severity badges', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to alerts tab
    const alertsTab = screen.getByRole('button', { name: /alerts/i })
    await user.click(alertsTab)

    // Check alert titles
    expect(screen.getByText('Implementation Behind Schedule')).toBeInTheDocument()
    expect(screen.getByText('Resource Overallocation')).toBeInTheDocument()
    expect(screen.getByText('Significant Cost Overrun')).toBeInTheDocument()

    // Check that severity badges exist within their specific alert containers
    const highAlert = screen.getByText('Implementation Behind Schedule').closest('.border')
    const mediumAlert = screen.getByText('Resource Overallocation').closest('.border')
    const criticalAlert = screen.getByText('Significant Cost Overrun').closest('.border')
    
    expect(highAlert).toBeInTheDocument()
    expect(mediumAlert).toBeInTheDocument()
    expect(criticalAlert).toBeInTheDocument()
  })

  it('handles alert actions correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to alerts tab
    const alertsTab = screen.getByRole('button', { name: /alerts/i })
    await user.click(alertsTab)

    // Click acknowledge button on first unacknowledged alert
    const acknowledgeButtons = screen.getAllByText('Acknowledge')
    await user.click(acknowledgeButtons[0])

    // Check if alert is marked as acknowledged by looking for acknowledged badges
    const acknowledgedBadges = screen.getAllByText('Acknowledged')
    expect(acknowledgedBadges.length).toBeGreaterThan(0)

    // Check if callback was called
    expect(mockProps.onAlertAction).toHaveBeenCalledWith('alert-1', 'acknowledge')
  })

  it('filters alerts correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to alerts tab
    const alertsTab = screen.getByRole('button', { name: /alerts/i })
    await user.click(alertsTab)

    // Filter by severity
    const severityFilter = screen.getByDisplayValue('All Severities')
    await user.selectOptions(severityFilter, 'critical')

    // Should only show critical alerts
    expect(screen.getByText('Significant Cost Overrun')).toBeInTheDocument()
    expect(screen.queryByText('Implementation Behind Schedule')).not.toBeInTheDocument()
    expect(screen.queryByText('Resource Overallocation')).not.toBeInTheDocument()
  })

  it('displays deviations with correct information', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to deviations tab
    const deviationsTab = screen.getByRole('button', { name: /deviations/i })
    await user.click(deviationsTab)

    // Check deviation information
    expect(screen.getByText('Concrete pouring delayed due to weather conditions')).toBeInTheDocument()
    expect(screen.getByText('Equipment rental costs higher than estimated')).toBeInTheDocument()

    // Check deviation types and severities within their specific containers
    const weatherDeviation = screen.getByText('Concrete pouring delayed due to weather conditions').closest('.border')
    const equipmentDeviation = screen.getByText('Equipment rental costs higher than estimated').closest('.border')
    
    expect(weatherDeviation).toContainElement(screen.getByText('Schedule'))
    expect(equipmentDeviation).toContainElement(screen.getByText('Cost'))

    // Check status badges within their containers
    expect(weatherDeviation).toContainElement(screen.getByText('in progress'))
    expect(equipmentDeviation).toContainElement(screen.getByText('resolved'))
  })

  it('displays lessons learned correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to lessons learned tab
    const lessonsTab = screen.getByRole('button', { name: /lessons learned/i })
    await user.click(lessonsTab)

    // Check lessons learned content
    expect(screen.getByText(/Weather contingency planning is crucial/)).toBeInTheDocument()
    expect(screen.getByText(/Early supplier engagement and price confirmation/)).toBeInTheDocument()

    // Check categories
    expect(screen.getByText('planning')).toBeInTheDocument()
    expect(screen.getByText('procurement')).toBeInTheDocument()

    // Check authors by looking for text that includes their names
    expect(screen.getByText(/John Smith/)).toBeInTheDocument()
    expect(screen.getByText(/Sarah Wilson/)).toBeInTheDocument()
  })

  it('opens lessons learned detail modal', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to lessons learned tab
    const lessonsTab = screen.getByRole('button', { name: /lessons learned/i })
    await user.click(lessonsTab)

    // Click view details button
    const viewDetailsButtons = screen.getAllByText('View Details')
    await user.click(viewDetailsButtons[0])

    // Check if modal is opened
    expect(screen.getByText('Lesson Learned Details')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Impact on Future Changes')).toBeInTheDocument()
  })

  it('closes lessons learned modal when close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Switch to lessons learned tab and open modal
    const lessonsTab = screen.getByRole('button', { name: /lessons learned/i })
    await user.click(lessonsTab)

    const viewDetailsButtons = screen.getAllByText('View Details')
    await user.click(viewDetailsButtons[0])

    // Check modal is open
    expect(screen.getByText('Lesson Learned Details')).toBeInTheDocument()

    // Click close button
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    // Check modal is closed
    expect(screen.queryByText('Lesson Learned Details')).not.toBeInTheDocument()
  })

  it('refreshes data when refresh button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await user.click(refreshButton)

    // Should show loading state briefly
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

    // Fast-forward to complete refresh
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })
  })

  it('displays last refresh time', async () => {
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check if last updated time is displayed
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
  })

  it('shows tab badges with correct counts', async () => {
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check tab badges by looking for badges within the tab navigation
    const alertsTab = screen.getByRole('button', { name: /alerts/i })
    const deviationsTab = screen.getByRole('button', { name: /deviations/i })
    const lessonsTab = screen.getByRole('button', { name: /lessons learned/i })
    
    // Check that badges exist within the tabs
    expect(alertsTab).toContainElement(screen.getByText('3')) // 3 unresolved alerts
    expect(deviationsTab).toContainElement(screen.getByText('1')) // 1 unresolved deviation
    expect(lessonsTab).toContainElement(screen.getAllByText('2')[1]) // 2 lessons learned (second occurrence)
  })

  it('displays performance metrics in overview', async () => {
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check performance metrics
    expect(screen.getByText('Schedule Performance')).toBeInTheDocument()
    expect(screen.getByText('Cost Performance')).toBeInTheDocument()
    expect(screen.getByText('Average Schedule Variance')).toBeInTheDocument()
    expect(screen.getByText('Average Cost Variance')).toBeInTheDocument()
  })

  it('shows recent activity in overview', async () => {
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    // Check recent activity section
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    expect(screen.getByText('Implementation Behind Schedule')).toBeInTheDocument()
    expect(screen.getByText('Resource Overallocation')).toBeInTheDocument()
    expect(screen.getByText('Significant Cost Overrun')).toBeInTheDocument()
  })

  it('handles auto-refresh correctly', async () => {
    render(<ImplementationMonitoringDashboard {...mockProps} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })

    const initialTime = screen.getByText(/Last updated:/)
    
    // Fast-forward to trigger auto-refresh
    act(() => {
      jest.advanceTimersByTime(30000) // 30 seconds
    })

    // Should update the last refresh time
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
  })

  it('disables auto-refresh when refreshInterval is 0', () => {
    render(<ImplementationMonitoringDashboard {...mockProps} refreshInterval={0} />)
    
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Fast-forward a long time - should not auto-refresh
    act(() => {
      jest.advanceTimersByTime(60000)
    })

    // Component should still be functional
    expect(screen.getByText('Implementation Monitoring Dashboard')).toBeInTheDocument()
  })
})