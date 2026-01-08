
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangeAnalyticsDashboard from '../ChangeAnalyticsDashboard'

const mockOnExport = jest.fn()

const defaultProps = {
  dateRange: {
    from: new Date('2024-01-01'),
    to: new Date('2024-06-30')
  },
  filters: {},
  onExport: mockOnExport
}

// Mock recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  ComposedChart: ({ children }: any) => <div data-testid="composed-chart">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  ScatterChart: ({ children }: any) => <div data-testid="scatter-chart">{children}</div>,
  Scatter: () => <div data-testid="scatter" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />
}))

// Mock PerformanceMonitoringInterface
jest.mock('../PerformanceMonitoringInterface', () => {
  return function MockPerformanceMonitoringInterface(props: any) {
    return <div data-testid="performance-monitoring-interface">Performance Monitoring Interface</div>
  }
})

describe('ChangeAnalyticsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state initially', () => {
    render(<ChangeAnalyticsDashboard {...defaultProps} />)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders dashboard header with correct title and actions', async () => {
    render(<ChangeAnalyticsDashboard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Change Analytics Dashboard')).toBeInTheDocument()
    }, { timeout: 2000 })
    
    expect(screen.getByText(/Executive dashboard with KPIs and trends/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
  })

  it('displays all navigation tabs after loading', async () => {
    render(<ChangeAnalyticsDashboard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
    }, { timeout: 2000 })
    
    expect(screen.getByRole('button', { name: /performance/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /trends/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /projects/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /impact analysis/i })).toBeInTheDocument()
  })

  it('shows overview tab content by default after loading', async () => {
    render(<ChangeAnalyticsDashboard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Total Changes')).toBeInTheDocument()
    }, { timeout: 2000 })
    
    // Check key metrics cards
    expect(screen.getByText('156')).toBeInTheDocument()
    expect(screen.getByText('Approval Rate')).toBeInTheDocument()
    expect(screen.getByText('82.3%')).toBeInTheDocument()
    expect(screen.getByText('Avg Approval Time')).toBeInTheDocument()
    expect(screen.getByText('5.2 days')).toBeInTheDocument()
  })

  it('renders charts in overview tab after loading', async () => {
    render(<ChangeAnalyticsDashboard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Changes by Status')).toBeInTheDocument()
    }, { timeout: 2000 })
    
    expect(screen.getByText('Changes by Type')).toBeInTheDocument()
    expect(screen.getByText('Changes by Priority')).toBeInTheDocument()
    expect(screen.getAllByTestId('responsive-container')).toHaveLength(3)
    expect(screen.getAllByTestId('pie-chart')).toHaveLength(2)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('switches to performance tab and shows performance monitoring interface', async () => {
    const user = userEvent.setup()
    render(<ChangeAnalyticsDashboard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /performance/i })).toBeInTheDocument()
    }, { timeout: 2000 })
    
    const performanceTab = screen.getByRole('button', { name: /performance/i })
    await user.click(performanceTab)
    
    expect(screen.getByTestId('performance-monitoring-interface')).toBeInTheDocument()
  })

  it('handles export button click with custom onExport', async () => {
    const user = userEvent.setup()
    render(<ChangeAnalyticsDashboard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    }, { timeout: 2000 })
    
    const exportButton = screen.getByRole('button', { name: /export/i })
    await user.click(exportButton)
    
    // Wait for data to load first
    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalled()
    })
  })

  it('displays analytics metadata at the bottom after loading', async () => {
    render(<ChangeAnalyticsDashboard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText(/Analytics generated on/)).toBeInTheDocument()
    }, { timeout: 2000 })
    
    expect(screen.getByText(/Date range:/)).toBeInTheDocument()
    expect(screen.getByText(/1\/1\/2024/)).toBeInTheDocument()
    expect(screen.getByText(/6\/30\/2024/)).toBeInTheDocument()
  })

  it('shows project filter in metadata when projectId is provided', async () => {
    render(<ChangeAnalyticsDashboard {...defaultProps} projectId="test-project-1" />)
    
    await waitFor(() => {
      expect(screen.getByText(/Project: test-project-1/)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('maintains responsive design with proper chart containers after loading', async () => {
    render(<ChangeAnalyticsDashboard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getAllByTestId('responsive-container')).toHaveLength(3)
    }, { timeout: 2000 })
    
    const containers = screen.getAllByTestId('responsive-container')
    expect(containers.length).toBeGreaterThan(0)
  })

  it('handles tab navigation correctly', async () => {
    const user = userEvent.setup()
    render(<ChangeAnalyticsDashboard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
    }, { timeout: 2000 })
    
    const overviewTab = screen.getByRole('button', { name: /overview/i })
    const performanceTab = screen.getByRole('button', { name: /performance/i })
    
    // Test tab switching
    await user.click(performanceTab)
    expect(screen.getByTestId('performance-monitoring-interface')).toBeInTheDocument()
    
    await user.click(overviewTab)
    expect(screen.getByText('Total Changes')).toBeInTheDocument()
  })

  it('filters data correctly when filters are applied', async () => {
    const filtersProps = {
      ...defaultProps,
      filters: {
        changeType: 'scope',
        priority: 'high',
        status: 'approved'
      }
    }
    
    render(<ChangeAnalyticsDashboard {...filtersProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Change Analytics Dashboard')).toBeInTheDocument()
    }, { timeout: 2000 })
    
    // The component should still render with filters applied
    expect(screen.getByText('Total Changes')).toBeInTheDocument()
  })
})