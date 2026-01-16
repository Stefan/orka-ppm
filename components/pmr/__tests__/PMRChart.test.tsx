import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import PMRChart, { PMRChartDataPoint } from '../PMRChart'
import { AIInsight } from '../types'

// Mock the InteractiveChart component
jest.mock('../../charts/InteractiveChart', () => {
  return function MockInteractiveChart({ title, data, type }: any) {
    return (
      <div data-testid="interactive-chart">
        <div>{title}</div>
        <div>{type}</div>
        <div>{data.length} data points</div>
      </div>
    )
  }
})

describe('PMRChart', () => {
  const mockAIInsight: AIInsight = {
    id: '1',
    type: 'alert',
    category: 'budget',
    title: 'Budget Overrun Alert',
    content: 'Labor costs are trending 12% over budget.',
    confidence_score: 0.89,
    supporting_data: { category: 'Labor' },
    recommended_actions: ['Review resource assignments'],
    priority: 'high',
    generated_at: new Date().toISOString(),
    validated: false
  }

  const mockData: PMRChartDataPoint[] = [
    {
      name: 'Labor',
      value: 560000,
      baseline: 500000,
      variance: 12,
      status: 'at-risk',
      aiInsights: [mockAIInsight]
    },
    {
      name: 'Materials',
      value: 195000,
      baseline: 200000,
      variance: -2.5,
      status: 'on-track',
      aiInsights: []
    }
  ]

  it('renders budget variance chart', () => {
    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        title="Budget Variance Analysis"
      />
    )

    expect(screen.getByText('Budget Variance Analysis')).toBeInTheDocument()
    expect(screen.getByTestId('interactive-chart')).toBeInTheDocument()
  })

  it('renders schedule performance chart', () => {
    const scheduleData: PMRChartDataPoint[] = [
      { name: 'Q1 2024', value: 0.92, baseline: 1.0, status: 'at-risk' },
      { name: 'Q2 2024', value: 0.90, baseline: 1.0, status: 'critical' }
    ]

    render(
      <PMRChart
        type="schedule-performance"
        data={scheduleData}
        title="Schedule Performance Index"
      />
    )

    expect(screen.getByText('Schedule Performance Index')).toBeInTheDocument()
  })

  it('renders risk heatmap chart', () => {
    const riskData: PMRChartDataPoint[] = [
      { name: 'Technical', value: 59.5, status: 'at-risk' },
      { name: 'Schedule', value: 45, status: 'on-track' }
    ]

    render(
      <PMRChart
        type="risk-heatmap"
        data={riskData}
        title="Risk Heatmap"
      />
    )

    expect(screen.getByText('Risk Heatmap')).toBeInTheDocument()
  })

  it('shows AI insights indicator when insights are available', () => {
    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        showAIInsights={true}
      />
    )

    expect(screen.getByText('AI Insights Available')).toBeInTheDocument()
  })

  it('hides AI insights indicator when showAIInsights is false', () => {
    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        showAIInsights={false}
      />
    )

    expect(screen.queryByText('AI Insights Available')).not.toBeInTheDocument()
  })

  it('shows alert indicators for data points with critical insights', () => {
    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        showAIInsights={true}
      />
    )

    expect(screen.getByText(/Labor: 1 alert/)).toBeInTheDocument()
  })

  it('opens insight overlay when alert is clicked', async () => {
    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        showAIInsights={true}
      />
    )

    const alertButton = screen.getByText(/Labor: 1 alert/)
    fireEvent.click(alertButton)

    await waitFor(() => {
      expect(screen.getByText('Budget Overrun Alert')).toBeInTheDocument()
      expect(screen.getByText('Labor costs are trending 12% over budget.')).toBeInTheDocument()
    })
  })

  it('displays data point details in insight overlay', async () => {
    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        showAIInsights={true}
      />
    )

    const alertButton = screen.getByText(/Labor: 1 alert/)
    fireEvent.click(alertButton)

    await waitFor(() => {
      expect(screen.getByText('560,000')).toBeInTheDocument() // value
      expect(screen.getByText('500,000')).toBeInTheDocument() // baseline
      expect(screen.getByText('+12.0%')).toBeInTheDocument() // variance
    })
  })

  it('shows recommended actions in insight overlay', async () => {
    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        showAIInsights={true}
      />
    )

    const alertButton = screen.getByText(/Labor: 1 alert/)
    fireEvent.click(alertButton)

    await waitFor(() => {
      expect(screen.getByText('Recommended Actions:')).toBeInTheDocument()
      expect(screen.getByText('Review resource assignments')).toBeInTheDocument()
    })
  })

  it('closes insight overlay when close button is clicked', async () => {
    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        showAIInsights={true}
      />
    )

    const alertButton = screen.getByText(/Labor: 1 alert/)
    fireEvent.click(alertButton)

    await waitFor(() => {
      expect(screen.getByText('Budget Overrun Alert')).toBeInTheDocument()
    })

    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText('Budget Overrun Alert')).not.toBeInTheDocument()
    })
  })

  it('calls onDataPointClick when provided', async () => {
    const handleClick = jest.fn()

    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        showAIInsights={true}
        onDataPointClick={handleClick}
      />
    )

    const alertButton = screen.getByText(/Labor: 1 alert/)
    fireEvent.click(alertButton)

    await waitFor(() => {
      expect(screen.getByText('Budget Overrun Alert')).toBeInTheDocument()
    })

    // Verify the callback was called with the correct data point
    expect(handleClick).toHaveBeenCalledTimes(1)
    expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Labor',
      value: 560000,
      status: 'at-risk'
    }))
  })

  it('calls onExport when export is triggered', async () => {
    const handleExport = jest.fn()

    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        showAIInsights={true}
        enableExport={true}
        onExport={handleExport}
      />
    )

    const alertButton = screen.getByText(/Labor: 1 alert/)
    fireEvent.click(alertButton)

    await waitFor(() => {
      expect(screen.getByText('Export Details')).toBeInTheDocument()
    })

    const exportButton = screen.getByText('Export Details')
    fireEvent.click(exportButton)

    expect(handleExport).toHaveBeenCalledWith('json')
  })

  it('opens expanded view when expand button is clicked', () => {
    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
      />
    )

    const expandButton = screen.getByTitle('Expand Chart')
    fireEvent.click(expandButton)

    // Check for the expanded view by looking for the close button in the expanded view
    const closeButtons = screen.getAllByRole('button')
    const expandedViewCloseButton = closeButtons.find(
      button => button.querySelector('.lucide-x.h-6.w-6')
    )
    expect(expandedViewCloseButton).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <PMRChart
        type="budget-variance"
        data={mockData}
        className="custom-class"
      />
    )

    const chartContainer = container.querySelector('.custom-class')
    expect(chartContainer).toBeInTheDocument()
  })

  it('uses default height when not specified', () => {
    render(
      <PMRChart
        type="budget-variance"
        data={mockData}
      />
    )

    expect(screen.getByTestId('interactive-chart')).toBeInTheDocument()
  })

  it('handles empty data gracefully', () => {
    render(
      <PMRChart
        type="budget-variance"
        data={[]}
      />
    )

    expect(screen.getByTestId('interactive-chart')).toBeInTheDocument()
    expect(screen.getByText('0 data points')).toBeInTheDocument()
  })

  it('handles data without AI insights', () => {
    const dataWithoutInsights: PMRChartDataPoint[] = [
      { name: 'Category 1', value: 100, status: 'on-track' },
      { name: 'Category 2', value: 200, status: 'on-track' }
    ]

    render(
      <PMRChart
        type="budget-variance"
        data={dataWithoutInsights}
        showAIInsights={true}
      />
    )

    expect(screen.queryByText('AI Insights Available')).not.toBeInTheDocument()
  })
})
