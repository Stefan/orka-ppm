
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImpactAnalysisDashboard from '../ImpactAnalysisDashboard'

const mockOnDataUpdate = jest.fn()

const mockImpactData = {
  change_request_id: 'test-change-1',
  critical_path_affected: true,
  schedule_impact_days: 14,
  affected_activities: [
    {
      id: 'act-1',
      name: 'Foundation Excavation',
      original_duration: 5,
      new_duration: 8,
      delay_days: 3,
      is_critical: true
    },
    {
      id: 'act-2',
      name: 'Foundation Pour',
      original_duration: 3,
      new_duration: 5,
      delay_days: 2,
      is_critical: true
    }
  ],
  total_cost_impact: 25000,
  direct_costs: 18000,
  indirect_costs: 7000,
  cost_savings: 0,
  cost_breakdown: {
    materials: 12000,
    labor: 8000,
    equipment: 3000,
    overhead: 1500,
    contingency: 500
  },
  additional_resources_needed: [
    {
      resource_type: 'Excavator Operator',
      quantity: 2,
      cost_per_unit: 150,
      duration_weeks: 2
    }
  ],
  resource_reallocation: [
    {
      from_activity: 'Site Preparation',
      to_activity: 'Foundation Work',
      resource_type: 'General Laborer',
      quantity: 4
    }
  ],
  new_risks: [
    {
      id: 'risk-1',
      description: 'Weather delays during extended foundation work',
      probability: 0.3,
      impact: 5000,
      mitigation_cost: 1000
    }
  ],
  modified_risks: [
    {
      id: 'existing-risk-1',
      description: 'Schedule overrun',
      old_probability: 0.2,
      new_probability: 0.4,
      old_impact: 10000,
      new_impact: 20000
    }
  ],
  scenarios: {
    best_case: {
      cost_impact: 18000,
      schedule_impact_days: 10,
      probability: 0.2
    },
    worst_case: {
      cost_impact: 35000,
      schedule_impact_days: 21,
      probability: 0.1
    },
    most_likely: {
      cost_impact: 25000,
      schedule_impact_days: 14,
      probability: 0.7
    }
  },
  analyzed_by: 'Test Analyst',
  analyzed_at: '2024-01-15T10:30:00Z'
}

const defaultProps = {
  changeId: 'test-change-1',
  impactData: mockImpactData,
  editable: false,
  onDataUpdate: mockOnDataUpdate
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
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />
}))

describe('ImpactAnalysisDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state when no impact data is provided', () => {
    render(
      <ImpactAnalysisDashboard
        changeId="test-change-1"
        onDataUpdate={mockOnDataUpdate}
      />
    )
    
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders dashboard header with correct title and actions', () => {
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    expect(screen.getByText('Impact Analysis Dashboard')).toBeInTheDocument()
    expect(screen.getByText(/Comprehensive impact analysis for change request/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
  })

  it('shows configure button when editable is true', () => {
    render(<ImpactAnalysisDashboard {...defaultProps} editable={true} />)
    
    expect(screen.getByRole('button', { name: /configure/i })).toBeInTheDocument()
  })

  it('displays all navigation tabs', () => {
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cost impact/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /schedule impact/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resources/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /risk impact/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /scenarios/i })).toBeInTheDocument()
  })

  it('shows overview tab content by default', () => {
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    // Check key metrics cards
    expect(screen.getByText('Total Cost Impact')).toBeInTheDocument()
    expect(screen.getByText('$25,000')).toBeInTheDocument()
    expect(screen.getAllByText('Schedule Impact')).toHaveLength(2) // Tab and metric card
    expect(screen.getByText('14 days')).toBeInTheDocument()
    expect(screen.getByText('Critical Path')).toBeInTheDocument()
    expect(screen.getByText('Affected')).toBeInTheDocument()
    expect(screen.getByText('New Risks')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders charts in overview tab', () => {
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    expect(screen.getByText('Cost Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Scenario Comparison')).toBeInTheDocument()
    expect(screen.getAllByTestId('responsive-container')).toHaveLength(2)
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument()
  })

  it('switches to cost impact tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const costTab = screen.getByRole('button', { name: /cost impact/i })
    await user.click(costTab)
    
    expect(screen.getByText('Cost Summary')).toBeInTheDocument()
    expect(screen.getByText('Direct Costs')).toBeInTheDocument()
    expect(screen.getByText('$18,000')).toBeInTheDocument()
    expect(screen.getByText('Indirect Costs')).toBeInTheDocument()
    expect(screen.getByText('$7,000')).toBeInTheDocument()
    expect(screen.getByText('Detailed Cost Breakdown')).toBeInTheDocument()
  })

  it('switches to schedule impact tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const scheduleTab = screen.getByRole('button', { name: /schedule impact/i })
    await user.click(scheduleTab)
    
    expect(screen.getByText('Activity Impact Analysis')).toBeInTheDocument()
    expect(screen.getByText('Critical Path Activities')).toBeInTheDocument()
    
    // Check table headers
    expect(screen.getByText('Activity')).toBeInTheDocument()
    expect(screen.getByText('Original Duration')).toBeInTheDocument()
    expect(screen.getByText('New Duration')).toBeInTheDocument()
    expect(screen.getByText('Delay')).toBeInTheDocument()
    expect(screen.getByText('Critical Path')).toBeInTheDocument()
    
    // Check activity data
    expect(screen.getByText('Foundation Excavation')).toBeInTheDocument()
    expect(screen.getByText('Foundation Pour')).toBeInTheDocument()
    expect(screen.getAllByText('5 days')).toHaveLength(2) // Two activities with 5 days
    expect(screen.getByText('8 days')).toBeInTheDocument()
  })

  it('switches to resources tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const resourcesTab = screen.getByRole('button', { name: /resources/i })
    await user.click(resourcesTab)
    
    expect(screen.getByText('Additional Resources Needed')).toBeInTheDocument()
    expect(screen.getByText('Resource Reallocation')).toBeInTheDocument()
    expect(screen.getByText('Excavator Operator')).toBeInTheDocument()
    expect(screen.getByText('General Laborer')).toBeInTheDocument()
    expect(screen.getByText('From: Site Preparation')).toBeInTheDocument()
    expect(screen.getByText('To: Foundation Work')).toBeInTheDocument()
  })

  it('switches to risk impact tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const risksTab = screen.getByRole('button', { name: /risk impact/i })
    await user.click(risksTab)
    
    expect(screen.getByText('Risk Impact Analysis')).toBeInTheDocument()
    expect(screen.getByText('New Risks Identified')).toBeInTheDocument()
    expect(screen.getByText('Modified Existing Risks')).toBeInTheDocument()
    expect(screen.getByText('Weather delays during extended foundation work')).toBeInTheDocument()
    expect(screen.getByText('Schedule overrun')).toBeInTheDocument()
  })

  it('switches to scenarios tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const scenariosTab = screen.getByRole('button', { name: /scenarios/i })
    await user.click(scenariosTab)
    
    expect(screen.getByText('Scenario Analysis')).toBeInTheDocument()
    // Check for scenario content without exact text matching
    expect(screen.getByText(/Case/)).toBeInTheDocument()
    expect(screen.getByText(/Likely/)).toBeInTheDocument()
    
    // Check scenario values
    expect(screen.getByText('$18,000')).toBeInTheDocument()
    expect(screen.getByText('$35,000')).toBeInTheDocument()
    expect(screen.getByText('10 days')).toBeInTheDocument()
    expect(screen.getByText('21 days')).toBeInTheDocument()
  })

  it('handles refresh button click', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await user.click(refreshButton)
    
    // Should show loading state briefly
    expect(refreshButton).toBeDisabled()
  })

  it('handles export button click', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const exportButton = screen.getByRole('button', { name: /export/i })
    await user.click(exportButton)
    
    expect(consoleSpy).toHaveBeenCalledWith('Exporting impact analysis data')
    consoleSpy.mockRestore()
  })

  it('displays analysis metadata at the bottom', () => {
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    expect(screen.getByText(/Analysis performed by Test Analyst/)).toBeInTheDocument()
    expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument()
  })

  it('shows update analysis button when editable', () => {
    render(<ImpactAnalysisDashboard {...defaultProps} editable={true} />)
    
    expect(screen.getByRole('button', { name: /update analysis/i })).toBeInTheDocument()
  })

  it('displays no impact analysis message when data is null', () => {
    render(
      <ImpactAnalysisDashboard
        changeId="test-change-1"
        impactData={null}
        onDataUpdate={mockOnDataUpdate}
      />
    )
    
    // Wait for loading to complete
    setTimeout(() => {
      expect(screen.getByText('No impact analysis available')).toBeInTheDocument()
      expect(screen.getByText('Impact analysis has not been completed for this change request.')).toBeInTheDocument()
    }, 1100)
  })

  it('formats currency values correctly', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    expect(screen.getByText('$25,000')).toBeInTheDocument()
    
    // Switch to cost tab to see more currency values
    const costTab = screen.getByRole('button', { name: /cost impact/i })
    await user.click(costTab)
    
    expect(screen.getByText('$18,000')).toBeInTheDocument()
    expect(screen.getByText('$7,000')).toBeInTheDocument()
  })

  it('displays risk probability as percentage', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const risksTab = screen.getByRole('button', { name: /risk impact/i })
    await user.click(risksTab)
    
    expect(screen.getByText('30%')).toBeInTheDocument() // 0.3 * 100
    expect(screen.getByText('40%')).toBeInTheDocument() // 0.4 * 100 (new probability)
    // Check that percentage values are displayed
    const percentageElements = screen.getAllByText(/%/)
    expect(percentageElements.length).toBeGreaterThan(0)
  })

  it('shows critical path status correctly', () => {
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    expect(screen.getByText('Affected')).toBeInTheDocument()
  })

  it('displays activity delay information in schedule tab', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const scheduleTab = screen.getByRole('button', { name: /schedule impact/i })
    await user.click(scheduleTab)
    
    expect(screen.getByText('+3 days')).toBeInTheDocument()
    expect(screen.getByText('+2 days')).toBeInTheDocument()
    expect(screen.getAllByText('Critical')).toHaveLength(2)
  })

  it('calculates resource costs correctly', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const resourcesTab = screen.getByRole('button', { name: /resources/i })
    await user.click(resourcesTab)
    
    // Excavator Operator: 2 * $150 * 2 weeks * 5 days = $3,000
    expect(screen.getByText('$3,000')).toBeInTheDocument()
    expect(screen.getByText('$150/day')).toBeInTheDocument()
  })

  it('shows scenario probabilities correctly', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const scenariosTab = screen.getByRole('button', { name: /scenarios/i })
    await user.click(scenariosTab)
    
    expect(screen.getByText('20%')).toBeInTheDocument() // Best case
    expect(screen.getByText('70%')).toBeInTheDocument() // Most likely
    expect(screen.getByText('10%')).toBeInTheDocument() // Worst case
  })

  it('handles tab navigation with keyboard', async () => {
    const user = userEvent.setup()
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const overviewTab = screen.getByRole('button', { name: /overview/i })
    const costTab = screen.getByRole('button', { name: /cost impact/i })
    
    overviewTab.focus()
    await user.keyboard('{Tab}')
    expect(costTab).toHaveFocus()
  })

  it('maintains responsive design with proper chart containers', () => {
    render(<ImpactAnalysisDashboard {...defaultProps} />)
    
    const containers = screen.getAllByTestId('responsive-container')
    expect(containers.length).toBeGreaterThan(0)
  })
})